"""Conservative OOXML editing. Unchanged parts retain their original bytes."""

from copy import deepcopy
from io import BytesIO
from zipfile import ZipFile
from hashlib import sha256
import re
from lxml import etree
from .models import Check, FormatError
from .field_ranges import protected_field_paragraphs
from .validation import read_package, xml, NS, W, paragraph_text
from .writer import element, font_props, role_latin_font
from .table_layout import apply_table_layout, eligible_table, strip_table_layout

ROLES = {"attachment", "address", "signature", "date", "title", "body", "heading1", "heading2", "heading3", "heading4", "preserve"}
P_FORMAT = {"pStyle", "spacing", "ind", "jc", "outlineLvl", "keepNext", "keepLines"}
R_FORMAT = {"rFonts", "sz", "szCs"}


def serialize(node):
    return etree.tostring(node, encoding="UTF-8", xml_declaration=True, standalone=True)


def prepare(data):
    package = read_package(data)
    if any("vbaProject" in n or n.startswith("_xmlsignatures/") for n in package):
        raise FormatError(
            "UNSUPPORTED_PROTECTED_PACKAGE",
            "含宏或数字签名的文档需要在Office中另存为普通DOCX后处理。",
        )
    types = package["[Content_Types].xml"].lower()
    if b"macroenabled" in types or b"digital-signature" in types:
        raise FormatError("UNSUPPORTED_PROTECTED_PACKAGE", "不支持宏或数字签名文档。")
    document = xml(package["word/document.xml"])
    if document.find("w:body", NS) is None or "word/styles.xml" not in package:
        raise FormatError("INVALID_INPUT", "文档缺少正文或样式部件。")
    if "word/settings.xml" in package:
        settings = xml(package["word/settings.xml"])
        protection = settings.find("w:documentProtection", NS)
        if protection is not None and protection.get(W + "enforcement", "").lower() not in {"0", "false", "off"}:
            raise FormatError(
                "DOCUMENT_PROTECTED", "文档有编辑保护，请在Office中解除后处理。"
            )
    for name, content in package.items():
        if name.endswith(".rels"):
            for rel in xml(content):
                if rel.get("TargetMode") == "External" and not rel.get(
                    "Type", ""
                ).endswith("/hyperlink"):
                    raise FormatError(
                        "EXTERNAL_DEPENDENCY",
                        "文档含外链图片或外部模板，请先在Office中嵌入资源。",
                    )
    return package, document


def style_property(style_nodes, sid, path, attribute="val"):
    """Resolve paragraph-style inheritance without looping on malformed chains."""
    seen = set()
    while sid and sid not in seen:
        seen.add(sid)
        style = style_nodes.get(sid)
        if style is None:
            break
        node = style.find(path, NS)
        if node is not None and node.get(W + attribute) is not None:
            return node.get(W + attribute)
        base = style.find("w:basedOn", NS)
        sid = base.get(W + "val") if base is not None else ""
    return None


def infer_role(p, styles, *, first=False, style_nodes=None):
    ps = p.find("w:pPr/w:pStyle", NS)
    sid = ps.get(W + "val", "") if ps is not None else ""
    name = styles.get(sid, sid).lower().replace(" ", "")
    if sid.startswith("GWV2"):
        role = sid[4:].lower()
        if role in ROLES:
            return role
    if name in {"title", "标题", "公文标题"}:
        return "title"
    text = paragraph_text(p).strip()
    # Explicit section numbering is stronger evidence than imported Heading N.
    # Test this before opening-title geometry so a centered section stays a section.
    for pattern, role in [
        (r"^[一二三四五六七八九十百]+、", "heading1"),
        (r"^（[一二三四五六七八九十百]+）", "heading2"),
        (r"^[1-9]\d{0,2}[.．](?!\d)", "heading3"),
        (r"^（\d+）", "heading4"),
    ]:
        if re.match(pattern, text):
            return role
    if first and 0 < len(text) <= 120 and not re.search(r"[。！？；]", text):
        nodes = style_nodes or {}
        jc = p.find("w:pPr/w:jc", NS)
        alignment = jc.get(W + "val") if jc is not None else style_property(nodes, sid, "w:pPr/w:jc")
        sizes, fonts = [], []
        for run in p.findall("w:r", NS):
            if not "".join(run.xpath(".//w:t/text()", namespaces=NS)).strip():
                continue
            size = run.find("w:rPr/w:sz", NS)
            font = run.find("w:rPr/w:rFonts", NS)
            sizes.append(size.get(W + "val") if size is not None else style_property(nodes, sid, "w:rPr/w:sz"))
            fonts.append(font.get(W + "eastAsia") if font is not None and font.get(W + "eastAsia") else style_property(nodes, sid, "w:rPr/w:rFonts", "eastAsia"))
        large = bool(sizes) and all(v and v.isdigit() and int(v) >= 36 for v in sizes)
        if alignment == "center" and (large or any("小标宋" in (font or "") for font in fonts)):
            return "title"
    match = re.fullmatch(r"(?:heading|标题)([1-4])", name)
    if match:
        return "heading" + match.group(1)
    return "body"


def inherited_numbering(p, styles):
    current = p.find("w:pPr/w:pStyle", NS)
    sid = current.get(W + "val") if current is not None else ""
    seen = set()
    while sid and sid not in seen:
        seen.add(sid)
        style = next((s for s in styles if s.get(W + "styleId") == sid), None)
        if style is None:
            break
        if style.find("w:pPr/w:numPr", NS) is not None:
            return True
        base = style.find("w:basedOn", NS)
        sid = base.get(W + "val") if base is not None else ""
    return False


def numbered_heading(p, numbering, style_nodes, current):
    """Read visible numbering semantics without materializing or changing labels."""
    ps = p.find("w:pPr/w:pStyle", NS)
    sid = ps.get(W + "val", "") if ps is not None else ""
    def value(name):
        node = p.find("w:pPr/w:numPr/w:" + name, NS)
        return node.get(W + "val") if node is not None else style_property(style_nodes, sid, "w:pPr/w:numPr/w:" + name)
    num_id = value("numId")
    level = value("ilvl") or "0"
    if not num_id or num_id == "0" or numbering is None:
        return current, None
    num = numbering.find(f'w:num[@w:numId="{num_id}"]', NS) if num_id.isdigit() else None
    if num is None or not level.isdigit():
        return current, None
    abstract_id = num.find("w:abstractNumId", NS)
    if abstract_id is None:
        return current, None
    aid = abstract_id.get(W + "val", "")
    if not aid.isdigit():
        return current, None
    lvl = num.find(f'w:lvlOverride[@w:ilvl="{level}"]/w:lvl', NS)
    if lvl is None:
        lvl = numbering.find(f'w:abstractNum[@w:abstractNumId="{aid}"]/w:lvl[@w:ilvl="{level}"]', NS)
    if lvl is None:
        return current, None
    fmt, label = lvl.find("w:numFmt", NS), lvl.find("w:lvlText", NS)
    if fmt is None or label is None:
        return current, None
    kind = fmt.get(W + "val")
    pattern = re.sub(r"%[1-9]", "N", label.get(W + "val", "")).replace("(", "（").replace(")", "）")
    candidate = None
    if kind in {"chineseCounting", "chineseCountingThousand", "ideographTraditional"}:
        candidate = {"N、": "heading1", "（N）": "heading2"}.get(pattern)
    elif kind == "decimal" and current.startswith("heading"):
        candidate = {"N.": "heading3", "N．": "heading3", "（N）": "heading4"}.get(pattern)
    if not candidate:
        return current, None
    if current.startswith("heading") and current != candidate:
        labels = {"heading1": "一级标题", "heading2": "二级标题", "heading3": "三级标题", "heading4": "四级标题"}
        return "preserve", f"自动编号指向{labels[candidate]}，原样式或文字指向{labels[current]}；暂保留，请在结构页选择层级或正文。"
    text = paragraph_text(p).strip()
    if current == "body" and (len(text) > 40 or re.search(r"[。！？；：:\n]", text)):
        return current, None
    if current not in {"body", candidate}:
        return current, None
    return candidate, None


def preflight_docx(data, auto_letter_layout=True, attachment_layout=True):
    package, document = prepare(data)
    styles = {
        s.get(W + "styleId"): s.find("w:name", NS).get(W + "val", "")
        for s in xml(package["word/styles.xml"])
        if s.tag == W + "style" and s.find("w:name", NS) is not None
    }
    style_nodes = {s.get(W + "styleId"): s for s in xml(package["word/styles.xml"]) if s.tag == W + "style"}
    numbering = xml(package["word/numbering.xml"]) if "word/numbering.xml" in package else None
    fields = protected_field_paragraphs(document)
    blocks = []
    first_text = True
    for index, p in enumerate(document.find("w:body", NS)):
        if p.tag != W + "p":
            continue
        text = paragraph_text(p)
        if not text.strip():
            continue
        complex_ = p in fields or bool(
            p.xpath(
                ".//w:ins|.//w:del|.//w:sdt|.//w:drawing|.//w:object|.//w:fldChar|.//w:fldSimple",
                namespaces=NS,
            )
        )
        role, reason = numbered_heading(p, numbering, style_nodes, infer_role(p, styles, first=first_text, style_nodes=style_nodes))
        blocks.append(
            {
                "id": f"b{index + 1}",
                "text": text,
                "role": "preserve" if complex_ else role,
                "reason": None if complex_ else reason,
                "protected": complex_,
            }
        )
        first_text = False
    if auto_letter_layout:
        from .address_roles import opening_addresses
        from .letter_layout import closing_roles
        addresses = opening_addresses(blocks)
        closing, reviews = closing_roles(blocks)
        closing_ids = [bid for bid, role in closing.items() if role in {'signature', 'date'}]
        if closing_ids:
            body_nodes = document.find('w:body', NS)
            start = min(int(bid[1:]) for bid in closing_ids) - 1
            tail_objects = any(n.tag == W + 'tbl' or n in fields or n.xpath('.//w:drawing|.//w:object|.//w:sdt', namespaces=NS) for n in list(body_nodes)[max(0, start - 1):])
            landscape = bool(document.xpath('.//w:sectPr/w:pgSz[@w:orient="landscape"]', namespaces=NS))
            if tail_objects or landscape:
                closing = {bid: 'preserve' for bid in closing_ids}
                reviews = ['落款邻近复杂对象或文档含横向分节，保留原格式，请在Word中核对署名、日期及印章位置。']
        for block in blocks:
            if block["id"] in addresses:
                block["role"] = "address"
            if block['id'] in closing:
                block['role'] = closing[block['id']]
                if block['role'] == 'preserve':
                    block['reason'] = ' '.join(reviews)
    if attachment_layout:
        from .attachment_layout import attachment_roles
        attachments = attachment_roles(blocks)
        if attachments:
            start = min(int(bid[1:]) for bid in attachments) - 1
            tail = list(document.find('w:body', NS))[start:]
            if any(n.tag not in {W + 'p', W + 'sectPr'} or (n.tag == W + 'p' and
                       (n in fields or n.xpath('.//w:drawing|.//w:object|.//w:sdt|.//w:sectPr', namespaces=NS))) for n in tail):
                attachments = {}
        for block in blocks:
            block["role"] = attachments.get(block["id"], block["role"])
    return blocks


def replace_properties(parent, names, children):
    for node in list(parent):
        if node.tag in {W + n for n in names}:
            parent.remove(node)
    order = "pStyle keepNext keepLines pageBreakBefore framePr widowControl numPr suppressLineNumbers pBdr shd tabs suppressAutoHyphens kinsoku wordWrap overflowPunct topLinePunct autoSpaceDE autoSpaceDN bidi adjustRightInd snapToGrid spacing ind contextualSpacing mirrorIndents suppressOverlap jc textDirection textAlignment textboxTightWrap outlineLvl divId cnfStyle rPr sectPr pPrChange".split()
    for child in children:
        local = etree.QName(child).localname
        rank = order.index(local) if local in order else len(order)
        following = next(
            (
                n
                for n in parent
                if etree.QName(n).localname in order
                and order.index(etree.QName(n).localname) > rank
            ),
            None,
        )
        if following is None:
            parent.append(child)
        else:
            parent.insert(parent.index(following), child)


def projection(document, table_indices=(), footer_distance=False):
    """Independent structural projection: discard ONLY the allowed format slots."""
    root = deepcopy(document)
    body = root.find("w:body", NS)
    for index in table_indices:
        strip_table_layout(body[index])
    for p in body:
        if p.tag != W + "p":
            continue
        ppr = p.find("w:pPr", NS)
        if ppr is not None:
            replace_properties(ppr, P_FORMAT, [])
            if not len(ppr) and not ppr.attrib:
                p.remove(ppr)
        for run in p.xpath("./w:r|./w:hyperlink/w:r", namespaces=NS):
            rpr = run.find("w:rPr", NS)
            if rpr is not None:
                replace_properties(rpr, R_FORMAT, [])
                if not len(rpr) and not rpr.attrib:
                    run.remove(rpr)
    for section in root.findall(".//w:sectPr", NS):
        size = section.find("w:pgSz", NS)
        if size is not None:
            for key in ["w", "h"]:
                size.attrib.pop(W + key, None)
            if not len(size.attrib):
                section.remove(size)
        margins = section.find("w:pgMar", NS)
        if margins is not None:
            for side in ["top", "bottom", "left", "right"] + (["footer"] if footer_distance else []):
                margins.attrib.pop(W + side, None)
            if not len(margins.attrib):
                section.remove(margins)
    return etree.tostring(root, method="c14n")


def format_docx(data, profile, options):
    if options.confirmed_title is not None:
        from dataclasses import replace
        from .title_confirmation import word_title_roles
        rows = preflight_docx(data, options.auto_letter_layout, profile.get('attachment_layout', False))
        options = replace(options, roles=word_title_roles(rows, options.confirmed_title, options.roles))
    package, document = prepare(data)
    before = deepcopy(document)
    styles = xml(package["word/styles.xml"])
    original_styles = deepcopy(styles)
    names = {
        s.get(W + "styleId"): s.find("w:name", NS).get(W + "val", "")
        for s in styles
        if s.tag == W + "style" and s.find("w:name", NS) is not None
    }
    style_nodes = {s.get(W + "styleId"): s for s in original_styles if s.tag == W + "style"}
    body = document.find("w:body", NS)
    known_ids = {f"b{i + 1}" for i, n in enumerate(body) if n.tag == W + "p"}
    if any(k not in known_ids or v not in ROLES for k, v in options.roles.items()):
        raise FormatError("INVALID_ROLE", "段落角色或段落编号无效，请重新预检。")
    checks, outline, created = [], [], set()
    if options.confirmed_title is not None:
        checks.append(Check('TITLE_CONFIRMED', 'pass', '用户确认无文章标题。' if options.confirmed_title == 'none' else '已按用户确认的原稿段落设置文章标题。', None if options.confirmed_title == 'none' else options.confirmed_title))
    with ZipFile(BytesIO(data)) as original:
        repaired_parts = [name for name, content in package.items() if original.read(name) != content]
    if repaired_parts:
        checks.append(Check("XML_NAMESPACE_REPAIRED", "needs_review",
                            "已删除自定义XML根节点中完全相同的重复命名空间声明：" + "、".join(repaired_parts) + "；严格XML复检通过，原文件未修改。"))
    fields = protected_field_paragraphs(document)
    table_indices = []
    if profile.get("table"):
        for index, table in enumerate(body):
            if table.tag != W + "tbl":
                continue
            if eligible_table(table, styles) and not any(p in fields for p in table.findall(".//w:p", NS)):
                apply_table_layout(table, profile["table"])
                table_indices.append(index)
            else:
                checks.append(Check("TABLE_PRESERVED", "needs_review", "复杂表格含保护对象、嵌套表或编号，完整保留原格式。"))
        checks.append(Check("TABLE_LAYOUT", "pass", f"已规范{len(table_indices)}个普通表格的行距、段间距、首行缩进、上下内边距和行高；保留字体及表格结构。"))
    fields = protected_field_paragraphs(document)
    modified = 0
    preflight = preflight_docx(data, options.auto_letter_layout, profile.get("attachment_layout", False))
    inferred = {b["id"]: b["role"] for b in preflight}
    from .letter_layout import paragraph_layout, validate_letter_layout
    layout_rows = [{**b, 'role': options.roles.get(b['id'], b['role'])} for b in preflight]
    letter_properties = paragraph_layout(layout_rows, profile)
    from .attachment_layout import attachment_properties, validate_attachments
    attachments = attachment_properties(layout_rows, profile)
    letter_properties.update(attachments)
    for block in preflight:
        if block.get("reason") and block["id"] not in options.roles:
            code = "HEADING_CONFLICT" if block["reason"].startswith("自动编号") else "LETTER_IDENTIFICATION"
            checks.append(Check(code, "needs_review", block["reason"], block["id"]))
    first_text = True
    for index, p in enumerate(body):
        if p.tag != W + "p":
            continue
        bid, text = f"b{index + 1}", paragraph_text(p)
        if not text.strip():
            continue
        protected = p in fields or bool(
            p.xpath(
                ".//w:ins|.//w:del|.//w:sdt|.//w:drawing|.//w:object|.//w:fldChar|.//w:fldSimple",
                namespaces=NS,
            )
        )
        role = options.roles.get(bid, inferred[bid])
        first_text = False
        inherited_num = inherited_numbering(p, styles)
        if protected or role == "preserve" or (inherited_num and not role.startswith("heading")):
            checks.append(
                Check(
                    "PROTECTED_PARAGRAPH",
                    "needs_review",
                    "此段含保护对象或指定保留，完整保留原格式。",
                    bid,
                )
            )
            continue
        if (inherited_num or p.find("w:pPr/w:numPr", NS) is not None) and role in profile.get("latin_follow_roles", []) and not options.flatten_numbering:
            checks.append(Check("HEADING_NUMBER_FONT_PRESERVED", "needs_review",
                                "此标题保留Word自动编号及其原字体；编号可能与标题字体不同，请在Word中核对，或开启自动编号转为普通文字。", bid))
        sid = "GWV2" + role.title()
        font = profile["fonts"].get(role, profile["fonts"]["body"])
        size = profile["title_pt"] if role == "title" else profile["body_pt"]
        if sid not in names and sid not in created:
            style = element("style", type="paragraph", styleId=sid)
            style.append(element("name", val=sid))
            style.append(element("qFormat"))
            rp = element("rPr")
            font_props(rp, font, size, role_latin_font(profile, role))
            style.append(rp)
            pp = element("pPr")
            if role.startswith("heading"):
                pp.append(element("outlineLvl", val=int(role[-1]) - 1))
            style.append(pp)
            styles.append(style)
            created.add(sid)
        ppr = p.find("w:pPr", NS)
        if ppr is None:
            ppr = element("pPr")
            p.insert(0, ppr)
        attrs = [
            element("pStyle", val=sid),
            element(
                "spacing",
                before=0,
                after=profile["line_pt"] * 20 if role == "title" else 0,
                line=(profile.get("title_line_pt", profile["line_pt"]) if role == "title" else profile["line_pt"]) * 20,
                lineRule="exact",
            ),
            element("jc", val="center" if role == "title" else "both"),
        ]
        numbered = ppr.find("w:numPr", NS) is not None or inherited_num
        allowed = P_FORMAT - {"ind"} if numbered else P_FORMAT
        if inherited_num:
            allowed = allowed - {"pStyle"}
            attrs = [a for a in attrs if a.tag != W + "pStyle"]
        if not numbered:
            attrs.append(
                element(
                    "ind",
                    firstLineChars=0 if role in {"title", "address"} else 200,
                    firstLine=0 if role in {"title", "address"} else int(size * 40),
                )
            )
        if role == "address":
            for node in attrs:
                if node.tag == W + "ind":
                    node.set(W + "left", "0")
                    node.set(W + "right", "0")
            attrs.append(element("outlineLvl", val=9))
        if bid in letter_properties:
            layout_tags = {tag for tag, _ in letter_properties[bid]}
            attrs = [node for node in attrs if etree.QName(node).localname not in layout_tags]
            attrs.extend(element(tag, **values) for tag, values in letter_properties[bid])
        if role.startswith("heading"):
            # A sequence of peer headings is an outline, not one unbreakable block.
            next_role = None
            for next_index in range(index + 1, len(body)):
                following = body[next_index]
                if following.tag == W + "tbl":
                    next_role = "table"
                    break
                if following.tag == W + "p" and paragraph_text(following).strip():
                    next_role = options.roles.get(
                        f"b{next_index + 1}",
                        inferred.get(f"b{next_index + 1}", "body"),
                    )
                    break
            keep_next = len(text) <= 80 and next_role is not None
            if next_role and next_role.startswith("heading"):
                keep_next = keep_next and int(next_role[-1]) > int(role[-1])
            attrs += [
                element("outlineLvl", val=int(role[-1]) - 1),
                # Run-in numbered paragraphs may contain several sentences.
                # Keep the outline level, but allow long content to paginate.
                element("keepNext", val=int(keep_next)),
                element("keepLines", val=0 if len(text) > 80 else 1),
            ]
        elif role == "title":
            attrs.append(element("keepNext"))
        replace_properties(ppr, allowed, attrs)
        for run in p.xpath("./w:r|./w:hyperlink/w:r", namespaces=NS):
            rpr = run.find("w:rPr", NS)
            if rpr is None:
                rpr = element("rPr")
                run.insert(0, rpr)
            font_props(rpr, font, size, role_latin_font(profile, role))
        modified += 1
        outline.append({"id": bid, "role": role, "text": text})
    for section in document.findall(".//w:sectPr", NS):
        size = section.find("w:pgSz", NS)
        if size is not None and size.get(W + "orient") == "landscape":
            checks.append(
                Check(
                    "LANDSCAPE_PRESERVED",
                    "needs_review",
                    "横向分节保持原页面，避免宽表或图形被裁切。",
                )
            )
            continue
        if size is None:
            size = element("pgSz")
            section.append(size)
        for key, val in [("w", "width_mm"), ("h", "height_mm")]:
            size.set(W + key, str(round(profile["page"][val] * 1440 / 25.4)))
        margin = section.find("w:pgMar", NS)
        if margin is None:
            margin = element("pgMar", header=851, footer=1247, gutter=0)
            section.append(margin)
        for side in ["top", "bottom", "left", "right"]:
            margin.set(
                W + side, str(round(profile["page"][side + "_mm"] * 1440 / 25.4))
            )
    if profile["page"].get("footer_mm") is not None:
        for section in document.findall(".//w:sectPr", NS):
            size = section.find("w:pgSz", NS)
            if size is not None and size.get(W + "orient") == "landscape":
                continue
            section.find("w:pgMar", NS).set(W + "footer", str(round(profile["page"]["footer_mm"] * 1440 / 25.4)))
    package["word/document.xml"] = serialize(document)
    package["word/styles.xml"] = serialize(styles)
    out = BytesIO()
    with ZipFile(BytesIO(data)) as source, ZipFile(out, "w") as target:
        for info in source.infolist():
            target.writestr(info, package[info.filename])
    result = out.getvalue()
    reread = read_package(result)
    unchanged = all(
        v == reread.get(k)
        for k, v in read_package(data).items()
        if k not in {"word/document.xml", "word/styles.xml"}
    )
    style_out = xml(reread["word/styles.xml"])
    for node in list(style_out):
        if node.get(W + "styleId") in created:
            style_out.remove(node)
    styles_ok = etree.tostring(style_out, method="c14n") == etree.tostring(
        original_styles, method="c14n"
    )
    protected_ok = projection(before, table_indices, "footer_mm" in profile["page"]) == projection(xml(reread["word/document.xml"]), table_indices, "footer_mm" in profile["page"])
    checks += [
        Check(
            "PROTECTED_CONTENT",
            "pass" if protected_ok else "fail",
            "文本、表格、对象、修订及非白名单XML逐节点核对。",
        ),
        Check(
            "PACKAGE_PARTS",
            "pass" if unchanged and styles_ok else "fail",
            "原有样式、关系和其他包部件按校验基线核对；如有XML兼容修复，已单独列明。",
        ),
        Check(
            "FORMAT_APPLIED",
            "pass",
            f"已规范{modified}个普通段落；表格按模板策略处理，页眉页脚及复杂对象保持。",
        ),
        Check(
            "LAYOUT_REVIEW",
            "needs_review",
            "请复核标题角色、原有页码、表格及复杂对象版面；保留模式不重建页眉页脚。",
        ),
    ]
    if attachments:
        checks.append(validate_attachments(xml(reread["word/document.xml"]), attachments))
    if options.auto_letter_layout or letter_properties:
        reviews = [b['reason'] for b in preflight if b['role'] == 'preserve' and b.get('reason')]
        checks.append(validate_letter_layout(xml(reread['word/document.xml']), letter_properties, reviews))
    if not any(o["role"] == "title" for o in outline) and options.confirmed_title != 'none':
        checks.append(
            Check(
                "TITLE_CONFIRMATION",
                "needs_review",
                "未识别到已有标题样式，请在段落角色中确认标题。",
            )
        )
    if options.interpret_bold_markers and not any(c.status == "fail" for c in checks):
        from .bold_markers import convert_bold_markers

        final_document = xml(reread["word/document.xml"])
        count, skipped = convert_bold_markers(
            final_document, {key for key, value in options.roles.items() if value == "preserve"}
        )
        if count:
            output = BytesIO()
            with ZipFile(BytesIO(result)) as source, ZipFile(output, "w") as target:
                for info in source.infolist():
                    target.writestr(info, serialize(final_document) if info.filename == "word/document.xml" else source.read(info.filename))
            result = output.getvalue()
            final_body = final_document.find("w:body", NS)
            for item in outline:
                item["text"] = paragraph_text(final_body[int(item["id"][1:]) - 1])
        checks.append(Check("BOLD_MARKERS", "needs_review" if skipped else "pass",
            f"已将{count}处短双星号标记转为加粗并移除定界星号（同段非空、不超过50字符）；{skipped}段含不匹配标记或保护结构，保留待复核。"))
    if options.flatten_numbering and not any(c.status == "fail" for c in checks):
        from .plain_numbering import flatten_numbering
        final_package = read_package(result)
        final_document = xml(final_package["word/document.xml"])
        numbering = xml(final_package["word/numbering.xml"]) if "word/numbering.xml" in final_package else None
        preserve = {b["id"] for b in preflight if b["protected"] or options.roles.get(b["id"], b["role"]) == "preserve"}
        count, skipped = flatten_numbering(final_document, numbering, xml(final_package["word/styles.xml"]), preserve, profile["body_pt"], source_document=before)
        if count:
            output = BytesIO()
            with ZipFile(BytesIO(result)) as source, ZipFile(output, "w") as target:
                for info in source.infolist():
                    target.writestr(info, serialize(final_document) if info.filename == "word/document.xml" else source.read(info.filename))
            result = output.getvalue()
            for item in outline:
                item["text"] = paragraph_text(final_document.find("w:body", NS)[int(item["id"][1:])-1])
        checks.append(Check("PLAIN_NUMBERING", "needs_review" if skipped else "pass",
                            f"已将{count}段自动编号转为固定文字；原编号定义保留为兼容资源，无需手动删除。" + "；".join(skipped)))
    if fields:
        checks.append(Check("FIELD_RANGES_PRESERVED", "needs_review", "目录等跨段落域完整保留，不套用正文或标题格式；正文排版变化后，请在Word中更新整个目录以刷新页码。"))
    if options.convert_chinese_punctuation and not any(c.status == 'fail' for c in checks):
        allowed_punctuation = {b['id'] for b in preflight if not b['protected'] and options.roles.get(b['id'], b['role']) != 'preserve'}
        from .chinese_punctuation import convert_chinese_punctuation
        result, punctuation_check = convert_chinese_punctuation(result, allowed_punctuation)
        checks.append(punctuation_check)
    if options.clean_extra_spaces and not any(c.status == 'fail' for c in checks):
        from .space_cleanup import clean_spaces
        allowed = {b['id'] for b in preflight if not b['protected'] and options.roles.get(b['id'],b['role'])=='body'}
        # Preserve original centered/right-aligned layout even if formatting changed it.
        source_styles = {s.get(W+'styleId'):s for s in original_styles.findall('w:style',NS)}
        for i,p in enumerate(before.find('w:body',NS)):
            sid=p.find('w:pPr/w:pStyle',NS)
            jc=p.find('w:pPr/w:jc',NS)
            alignment=jc.get(W+'val') if jc is not None else style_property(source_styles,sid.get(W+'val') if sid is not None else 'Normal','w:pPr/w:jc')
            if alignment in {'center','right','end','distribute'}:
                allowed.discard(f'b{i+1}')
        result,space_check=clean_spaces(result,allowed)
        checks.append(space_check)
        final_body=xml(read_package(result)['word/document.xml']).find('w:body',NS)
        for item in outline:
            item['text']=paragraph_text(final_body[int(item['id'][1:])-1])
    if (options.split_numbered_paragraphs or options.split_decimal_numbered_paragraphs) and not any(c.status == 'fail' for c in checks):
        from .numbered_paragraphs import split_numbered_paragraphs, remap_outline, simple_paragraph
        # Plain "1." prose is inferred as heading3; explicit user roles still win.
        allowed = {b['id'] for b in preflight if not b['protected'] and
                   (options.roles.get(b['id'], b['role']) in {'body', 'heading2', 'heading4'} or
                    options.split_decimal_numbered_paragraphs and b['role'] == 'heading3' and b['id'] not in options.roles)}
        # A flattened automatic list or an object must not become eligible retrospectively.
        for i, paragraph in enumerate(before.find('w:body', NS)):
            if paragraph.tag == W + 'p' and (not simple_paragraph(paragraph) or inherited_numbering(paragraph, original_styles)):
                allowed.discard(f'b{i + 1}')
        result, split_check, mapping = split_numbered_paragraphs(result, allowed, include_parenthesized=options.split_numbered_paragraphs,
                                                                    include_decimal=options.split_decimal_numbered_paragraphs)
        checks.append(split_check)
        outline = remap_outline(outline, mapping, result)
    return result, checks, outline
