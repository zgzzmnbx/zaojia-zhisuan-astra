from io import BytesIO
from docx import Document
from docx.shared import Mm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from PIL import Image
from .models import FormatError
from .table_layout import apply_table_layout

STYLE_IDS = {
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
    "list": "GWList",
    "code": "GWCode",
    "quote": "GWQuote",
    "table": "GWTable",
    "separator": "Normal",
}


def element(tag, **attrs):
    node = OxmlElement("w:" + tag)
    for key, value in attrs.items():
        node.set(qn("w:" + key), str(value))
    return node


def role_latin_font(profile, role):
    """Apply explicit role policy without changing archived templates."""
    if role in profile.get("latin_follow_roles", []):
        return profile["fonts"].get(role, profile["fonts"]["body"])
    return profile["fonts"]["latin"]


def font_props(rpr, font, size, latin="Times New Roman"):
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = element("rFonts")
        rpr.insert(0, fonts)
    for key, value in {
        "eastAsia": font,
        "ascii": latin,
        "hAnsi": latin,
        "cs": latin,
    }.items():
        fonts.set(qn("w:" + key), value)
    for key in ("eastAsiaTheme", "asciiTheme", "hAnsiTheme", "cstheme"):
        fonts.attrib.pop(qn("w:" + key), None)
    for tag in ("sz", "szCs"):
        child = rpr.find(qn("w:" + tag))
        if child is None:
            child = element(tag)
            rpr.append(child)
        child.set(qn("w:val"), str(int(size * 2)))


def configure_styles(doc, profile):
    defaults = doc.styles.element.find(qn("w:docDefaults"))
    if defaults is not None:
        rdefault = defaults.find(qn("w:rPrDefault"))
        if rdefault is not None:
            rdefault.clear()
            rpr = element("rPr")
            font_props(
                rpr,
                profile["fonts"]["body"],
                profile["body_pt"],
                profile["fonts"]["latin"],
            )
            rdefault.append(rpr)
    for role, style_id in STYLE_IDS.items():
        if role == "separator":
            continue
        try:
            style = next(s for s in doc.styles if s.style_id == style_id)
        except StopIteration:
            style = doc.styles.add_style(style_id, WD_STYLE_TYPE.PARAGRAPH)
        # This is a newly generated document: discard template decoration and
        # linked character styles, which otherwise override the official fonts.
        for tag in ("pPr", "rPr", "link"):
            for child in list(style.element.findall(qn("w:" + tag))):
                style.element.remove(child)
        style.base_style = doc.styles["Normal"] if role != "body" else None
        font = profile["fonts"].get(role, profile["fonts"]["body"])
        size = (
            profile["title_pt"]
            if role == "title"
            else profile["table_pt"]
            if role == "table"
            else profile["body_pt"]
        )
        font_props(
            style.element.get_or_add_rPr(), font, size, role_latin_font(profile, role)
        )
        style.font.bold = False
        style.font.italic = False
        style.font.color.rgb = RGBColor(0, 0, 0)
        pf = style.paragraph_format
        pf.space_before = Pt(0)
        pf.space_after = Pt(0)
        pf.line_spacing_rule = WD_LINE_SPACING.EXACTLY
        pf.line_spacing = Pt(profile.get("title_line_pt", profile["line_pt"]) if role == "title" else profile["line_pt"] if role != "table" else 20)
        if role == "table" and profile.get("table"):
            pf.line_spacing = profile["table"]["line_multiple"]
            pf.space_before = Pt(profile["table"]["space_before_pt"])
            pf.space_after = Pt(profile["table"]["space_after_pt"])
        pf.widow_control = True
        pf.alignment = (
            WD_ALIGN_PARAGRAPH.CENTER if role == "title" else WD_ALIGN_PARAGRAPH.JUSTIFY
        )
        ppr = style.element.get_or_add_pPr()
        if role in {"body", "heading1", "heading2", "heading3", "heading4", "quote"}:
            ppr.append(element("ind", firstLineChars=200, firstLine=640))
        else:
            ppr.append(element("ind", firstLine=0, firstLineChars=0))
        if role == "address":
            ind = ppr.find(qn("w:ind"))
            ind.set(qn("w:left"), "0")
            ind.set(qn("w:right"), "0")
        if role.startswith("heading"):
            pf.keep_with_next = True
            pf.keep_together = True
            outline = ppr.find(qn("w:outlineLvl"))
            if outline is None:
                outline = element("outlineLvl")
                ppr.append(outline)
            outline.set(qn("w:val"), str(int(role[-1]) - 1))
        if role == "title":
            pf.keep_with_next = True
            pf.space_after = Pt(profile["line_pt"])


def configure_page(doc, profile, add_page_numbers=True):
    page = profile["page"]
    for section in doc.sections:
        section.page_width = Mm(page["width_mm"])
        section.page_height = Mm(page["height_mm"])
        for side in ("top", "bottom", "left", "right"):
            setattr(section, side + "_margin", Mm(page[side + "_mm"]))
        section.header_distance = Mm(page.get("header_mm", 15))
        section.footer_distance = Mm(page.get("footer_mm", 22))
    if add_page_numbers:
        doc.settings.odd_and_even_pages_header_footer = True
    # Preserve Markdown hard breaks without stretching short justified lines.
    compat = doc.settings.element.find(qn("w:compat"))
    if compat is None:
        compat = element("compat")
        doc.settings.element.insert_element_before(compat, "w:docVars", "w:rsids", "m:mathPr")
    for old in list(compat.findall(qn("w:doNotExpandShiftReturn"))):
        compat.remove(old)
    compat.insert(0, element("doNotExpandShiftReturn", val=1))

    if not add_page_numbers:
        return
    from .page_numbers import page_number_rule
    page_rule = page_number_rule()
    for section in doc.sections:
        for footer, alignment in [
            (section.footer, WD_ALIGN_PARAGRAPH.RIGHT),
            (section.even_page_footer, WD_ALIGN_PARAGRAPH.LEFT),
        ]:
            p = footer.paragraphs[0]
            p.alignment = alignment
            p.paragraph_format.first_line_indent = Pt(0)
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = Pt(page_rule['line_pt'])
            p._p.get_or_add_pPr().append(
                element(
                    "ind",
                    firstLineChars=0,
                    leftChars=page_rule['outside_chars'] * 100 if alignment == WD_ALIGN_PARAGRAPH.LEFT else 0,
                    rightChars=page_rule['outside_chars'] * 100 if alignment == WD_ALIGN_PARAGRAPH.RIGHT else 0,
                )
            )
            p.add_run("— ")
            run = p.add_run()
            run._r.append(element("fldChar", fldCharType="begin"))
            instruction = element("instrText")
            instruction.set(qn("xml:space"), "preserve")
            instruction.text = page_rule['field_instruction']
            run._r.append(instruction)
            run._r.append(element("fldChar", fldCharType="separate"))
            text = element("t")
            text.text = "1"
            run._r.append(text)
            run._r.append(element("fldChar", fldCharType="end"))
            p.add_run(" —")
            for r in p.runs:
                font_props(r._r.get_or_add_rPr(), page_rule['font'], page_rule['size_pt'], page_rule['font'])


def add_inlines(p, runs, profile, assets, table=False):
    for item in runs:
        if item.image:
            data = assets[item.image]
            try:
                with Image.open(BytesIO(data)) as img:
                    if img.width * img.height > 40_000_000 or img.format not in {
                        "PNG",
                        "JPEG",
                    }:
                        raise FormatError(
                            "INVALID_IMAGE", "图片须为不超过4000万像素的PNG或JPEG。"
                        )
                    width = min(img.width / 96 * 25.4, 130 if table else 150)
                p.add_run().add_picture(BytesIO(data), width=Mm(width))
            except FormatError:
                raise
            except Exception:
                raise FormatError("INVALID_IMAGE", "图片无法读取。") from None
            continue
        r = p.add_run(item.text)
        r.bold, r.italic, r.font.strike = item.bold, item.italic, item.strike
        # Inline literals (paths, dates, versions) follow the paragraph font.
        # Only standalone code blocks need a monospaced Latin face.
        if item.code and p.style.style_id == STYLE_IDS["code"]:
            r.font.name = "Consolas"
        if item.link:
            link = element("hyperlink")
            if item.link.startswith("#"):
                link.set(qn("w:anchor"), item.link[1:])
            else:
                rid = p.part.relate_to(item.link, RT.HYPERLINK, is_external=True)
                link.set(qn("r:id"), rid)
            p._p.remove(r._r)
            link.append(r._r)
            p._p.append(link)


def render_markdown(blocks, profile, assets, options=None):
    doc = Document()
    configure_styles(doc, profile)
    configure_page(doc, profile, options.add_page_numbers if options else True)
    from .letter_layout import paragraph_layout
    letter_properties = paragraph_layout([{'id': b.id, 'role': b.role, 'text': ''.join(r.text for r in b.inlines)} for b in blocks], profile)
    from .attachment_layout import attachment_properties
    letter_properties.update(attachment_properties([{'id': b.id, 'role': b.role, 'text': ''.join(r.text for r in b.inlines)} for b in blocks], profile))
    for b in blocks:
        if b.role == "table":
            columns = max(len(row) for row in b.rows)
            table = doc.add_table(rows=len(b.rows), cols=columns)
            table.style = "Table Grid"
            table.autofit = False
            width = (
                profile["page"]["width_mm"]
                - profile["page"]["left_mm"]
                - profile["page"]["right_mm"]
            )
            for col in table.columns:
                col.width = Mm(width / columns)
            for row_index, row in enumerate(b.rows):
                for col_index, runs in enumerate(row):
                    cell = table.cell(row_index, col_index)
                    cell.width = Mm(width / columns)
                    p = cell.paragraphs[0]
                    p.style = "GWTable"
                    add_inlines(p, runs, profile, assets, True)
                if row_index == 0:
                    table.rows[0]._tr.get_or_add_trPr().append(element("tblHeader"))
            if profile.get("table"):
                apply_table_layout(table._tbl, profile["table"])
            continue
        p = doc.add_paragraph(
            style=next(s for s in doc.styles if s.style_id == STYLE_IDS[b.role])
        )
        if b.role == "list":
            ppr = p._p.get_or_add_pPr()
            ppr.append(
                element("ind", left=0, right=0, firstLineChars=200, firstLine=round(profile["body_pt"] * 40))
                if b.ordered and b.level == 0 else
                element("ind", left=640 * (b.level + 1), hanging=320, firstLineChars=0)
            )
        elif b.role == "separator":
            border = element("pBdr")
            border.append(element("bottom", val="single", sz=4, color="808080"))
            p._p.get_or_add_pPr().append(border)
        add_inlines(p, b.inlines, profile, assets)
        if b.id in letter_properties:
            ppr = p._p.get_or_add_pPr()
            for tag, attrs in letter_properties[b.id]:
                for old in list(ppr.findall(qn('w:' + tag))):
                    ppr.remove(old)
                ppr.append(element(tag, **attrs))
    output = BytesIO()
    doc.save(output)
    return output.getvalue()
