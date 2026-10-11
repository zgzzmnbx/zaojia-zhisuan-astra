"""Read the output independently through ZIP/XML; never read writer state."""

from io import BytesIO
from zipfile import ZipFile, BadZipFile
from lxml import etree
from hashlib import sha256
import posixpath
import re
from .models import Check, FormatError

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
W = "{" + NS["w"] + "}"


def repair_root_namespace_duplicates(content):
    """Remove identical root xmlns duplicates only; never use XML recovery mode."""
    head = re.match(rb'\A(?:<\?xml[^?]*\?>\s*)?<([A-Za-z_][\w:.-]*)', content)
    if not head:
        return content
    attr = re.compile(rb"\s+([A-Za-z_][\w:.-]*)\s*=\s*([\"'])(.*?)\2", re.S)
    pos = head.end()
    namespaces, removals = {}, []
    while True:
        match = attr.match(content, pos)
        if not match:
            if not re.match(rb"\s*/?>", content[pos:]):
                return content
            break
        name, value = match.group(1), match.group(3)
        if name == b"xmlns" or name.startswith(b"xmlns:"):
            if name in namespaces:
                if namespaces[name] != value:
                    return content
                removals.append((match.start(), match.end()))
            namespaces[name] = value
        pos = match.end()
    for start, end in reversed(removals):
        content = content[:start] + content[end:]
    return content


def read_package(data):
    if len(data) > 30_000_000:
        raise FormatError("INPUT_TOO_LARGE", "文档超过30MB限制。")
    try:
        with ZipFile(BytesIO(data)) as z:
            infos = z.infolist()
            names = [i.filename for i in infos]
            if (
                len(infos) > 3000
                or len(names) != len(set(names))
                or sum(i.file_size for i in infos) > 150_000_000
            ):
                raise FormatError(
                    "UNSAFE_PACKAGE", "文档压缩包超过限制或存在重复部件。"
                )
            if any(
                ".." in i.filename.split("/")
                or i.filename.startswith(("/", "\\"))
                or "\\" in i.filename
                or i.file_size > max(i.compress_size, 1) * 300
                for i in infos
            ):
                raise FormatError("UNSAFE_PACKAGE", "文档包路径或压缩比异常。")
            if not {"[Content_Types].xml", "word/document.xml"}.issubset(names):
                raise FormatError("INVALID_INPUT", "文件不是有效的 Word DOCX 包。")
            result = {i.filename: z.read(i) for i in infos}
    except (BadZipFile, RuntimeError, KeyError, NotImplementedError, EOFError):
        raise FormatError("INVALID_INPUT", "文档损坏、加密或不是有效DOCX。") from None
    for name, content in result.items():
        if name.endswith((".xml", ".rels")):
            if b"<!DOCTYPE" in content.upper() or b"<!ENTITY" in content.upper():
                raise FormatError("UNSAFE_PACKAGE", "文档包含不支持的XML实体声明。")
            try:
                xml(content)
            except etree.XMLSyntaxError:
                repaired = repair_root_namespace_duplicates(content) if name.startswith("customXml/") and name.endswith(".xml") else content
                try:
                    if repaired == content:
                        raise etree.XMLSyntaxError("unchanged", 0, 0, 0)
                    xml(repaired)
                except etree.XMLSyntaxError:
                    raise FormatError("INVALID_INPUT", f"文档XML损坏：{name}，无法安全自动修复。") from None
                result[name] = repaired
    return result


def xml(data):
    root = etree.fromstring(
        data, etree.XMLParser(resolve_entities=False, no_network=True)
    )
    if root.getroottree().docinfo.doctype:
        raise FormatError("UNSAFE_PACKAGE", "文档包含不支持的XML实体声明。")
    return root


def paragraph_text(p):
    parts = []
    for e in p.iter():
        if e.tag == W + "t":
            parts.append(e.text or "")
        elif e.tag in {W + "br", W + "cr"}:
            parts.append("\n")
        elif e.tag == W + "tab":
            parts.append("\t")
    return "".join(parts)


def semantic_blocks(package):
    body = xml(package["word/document.xml"]).find("w:body", NS)
    result = []
    for node in body:
        if node.tag == W + "p":
            result.append({"kind": "paragraph", "text": paragraph_text(node)})
        elif node.tag == W + "tbl":
            result.append(
                {
                    "kind": "table",
                    "rows": [
                        [
                            "\n".join(
                                paragraph_text(p) for p in cell.findall("w:p", NS)
                            )
                            for cell in row.findall("w:tc", NS)
                        ]
                        for row in node.findall("w:tr", NS)
                    ],
                }
            )
    return result


def validate_markdown(data, blocks, profile, assets=None, options=None):
    package = read_package(data)

    def plain(runs):
        return "".join(r.text for r in runs if not r.image)

    expected = [
        {"kind": "table", "rows": [[plain(cell) for cell in row] for row in b.rows]}
        if b.role == "table"
        else {"kind": "paragraph", "text": plain(b.inlines)}
        for b in blocks
    ]
    actual = semantic_blocks(package)
    checks = [
        Check(
            "CONTENT_ORDER",
            "pass" if expected == actual else "fail",
            "逐段与逐单元格核对内容及顺序。",
            expected=expected if expected != actual else None,
            actual=actual if expected != actual else None,
        )
    ]
    document = xml(package["word/document.xml"])
    section = document.find(".//w:sectPr", NS)
    dims = section.find("w:pgSz", NS)
    margins = section.find("w:pgMar", NS)
    mm = lambda x: round(x / 25.4 * 1440)
    good = all(
        abs(int(dims.get(W + key, "0")) - mm(profile["page"][value])) <= 1
        for key, value in [("w", "width_mm"), ("h", "height_mm")]
    )
    good &= all(
        abs(int(margins.get(W + key, "0")) - mm(profile["page"][key + "_mm"])) <= 1
        for key in ["top", "bottom", "left", "right"]
    )
    checks.append(
        Check("PAGE_GEOMETRY", "pass" if good else "fail", "已读回A4与四边页边距。")
    )
    styles = xml(package["word/styles.xml"])
    ids = {
        "address": "GWAddress",
        "attachment": "GWAttachment",
        "signature": "GWSignature",
        "date": "GWDate",
        "title": "Title",
        "body": "Normal",
        "heading1": "Heading1",
        "heading2": "Heading2",
        "heading3": "Heading3",
        "heading4": "Heading4",
        "code": "GWCode",
        "quote": "GWQuote",
        "list": "GWList",
        "separator": "Normal",
    }
    paras = document.findall("w:body/w:p", NS)
    heading_ok = True
    for p, b in zip(paras, [b for b in blocks if b.role != "table"]):
        style_id = p.find("w:pPr/w:pStyle", NS)
        found_id = style_id.get(W + "val") if style_id is not None else "Normal"
        heading_ok &= found_id == ids[b.role]
        if b.role.startswith("heading"):
            outlines = styles.xpath(
                f'w:style[@w:styleId="{found_id}"]/w:pPr/w:outlineLvl/@w:val',
                namespaces=NS,
            )
            heading_ok &= outlines == [str(int(b.role[-1]) - 1)]
    checks.append(
        Check(
            "SEMANTIC_STYLES",
            "pass" if heading_ok else "fail",
            "标题样式与大纲层级有效。",
        )
    )
    from .letter_layout import paragraph_layout, validate_letter_layout
    letter_properties = paragraph_layout([{'id': b.id, 'role': b.role, 'text': ''.join(r.text for r in b.inlines)} for b in blocks], profile)
    if letter_properties:
        checks.append(validate_letter_layout(document, letter_properties))
    from .attachment_layout import attachment_properties, validate_attachments
    attachments = attachment_properties([{'id': b.id, 'role': b.role, 'text': ''.join(r.text for r in b.inlines)} for b in blocks], profile)
    if attachments:
        checks.append(validate_attachments(document, attachments))
    list_ok = not document.findall(".//w:numPr", NS)
    list_ok &= not styles.xpath('w:style[@w:styleId="GWList"]//w:numPr', namespaces=NS)
    checks.append(Check("LITERAL_LISTS", "pass" if list_ok else "fail",
                        "列表序号与项目符号按原文写成文字，不使用Word自动编号；内容检查同时核对逐项序号。"))
    expected_images = []
    for b in blocks:
        runs = (
            [r for row in b.rows for cell in row for r in cell]
            if b.role == "table"
            else b.inlines
        )
        expected_images.extend(
            sha256(assets[r.image]).hexdigest() for r in runs if r.image
        )
    relationships = {
        r.get("Id"): r.get("Target")
        for r in xml(package["word/_rels/document.xml.rels"])
    }
    actual_images = []
    for rid in document.xpath("//a:blip/@r:embed", namespaces=NS):
        target = posixpath.normpath("word/" + relationships.get(rid, ""))
        actual_images.append(sha256(package.get(target, b"")).hexdigest())
    checks.append(
        Check(
            "IMAGE_IDENTITY",
            "pass" if expected_images == actual_images else "fail",
            "逐个核对图片顺序、关系及二进制身份。",
        )
    )
    footer_fields = sum(
        len(xml(content).xpath('//w:instrText[contains(text(),"PAGE")]', namespaces=NS))
        for name, content in package.items()
        if name.startswith("word/footer") and name.endswith(".xml")
    )
    checks.append(
        Check(
            "PAGE_FIELD",
            "pass" if (footer_fields >= 2 if options is None or options.add_page_numbers else footer_fields == 0) else "fail",
            "奇偶页原生PAGE域已写入。" if options is None or options.add_page_numbers else "已关闭新增页码。",
        )
    )
    checks.append(
        Check(
            "RENDER_REVIEW",
            "needs_review",
            "请复核标题换行、精确行字数、表格分页与接收方字体；不覆盖完整发文要素。",
        )
    )
    return checks
