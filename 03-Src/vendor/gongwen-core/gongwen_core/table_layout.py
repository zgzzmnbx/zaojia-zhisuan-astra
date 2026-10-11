"""Table layout whitelist; never rewrites text, runs, cells or relationships."""

from lxml import etree
from .validation import W, NS

SPACING = {
    "before",
    "after",
    "beforeLines",
    "afterLines",
    "beforeAutospacing",
    "afterAutospacing",
    "line",
    "lineRule",
}
INDENT = {"firstLine", "firstLineChars", "hanging", "hangingChars"}


def node(parent, tag):
    child = parent.find("w:" + tag, NS)
    if child is None:
        child = etree.Element(W + tag)
        # Keep properties in OOXML schema order.
        orders = {
            "pPr": "pStyle keepNext keepLines pageBreakBefore framePr widowControl numPr suppressLineNumbers pBdr shd tabs suppressAutoHyphens kinsoku wordWrap overflowPunct topLinePunct autoSpaceDE autoSpaceDN bidi adjustRightInd snapToGrid spacing ind contextualSpacing mirrorIndents suppressOverlap jc textDirection textAlignment textboxTightWrap outlineLvl divId cnfStyle rPr sectPr pPrChange",
            "tcPr": "cnfStyle tcW gridSpan hMerge vMerge tcBorders shd noWrap tcMar textDirection tcFitText vAlign hideMark headers cellIns cellDel cellMerge tcPrChange",
            "tcMar": "top start left bottom end right",
        }
        order = orders.get(etree.QName(parent).localname, "").split()
        rank = order.index(tag) if tag in order else -1
        index = next(
            (
                i
                for i, n in enumerate(parent)
                if etree.QName(n).localname in order
                and order.index(etree.QName(n).localname) > rank
            ),
            len(parent),
        )
        if tag in {"pPr", "tcPr"}:
            index = 0
        parent.insert(index, child)
    return child


def eligible_table(table, styles=None):
    # Tables inside revisions/controls and nested tables remain untouched.
    protected = {
        "tbl",
        "ins",
        "del",
        "moveFrom",
        "moveTo",
        "sdt",
        "drawing",
        "object",
        "pict",
        "fldChar",
        "fldSimple",
        "numPr",
        "pPrChange",
        "rPrChange",
        "tcPrChange",
        "trPrChange",
        "tblPrChange",
        "sectPr",
        "altChunk",
    }
    if any(
        etree.QName(n).localname in protected
        or etree.QName(n).namespace
        == "http://schemas.openxmlformats.org/officeDocument/2006/math"
        for n in table.iterdescendants()
    ):
        return False
    if styles is not None:
        # Numbering inherited from any paragraph style needs its original indents.
        style_map = {s.get(W + "styleId"): s for s in styles}
        for p in table.findall(".//w:p", NS):
            s = p.find("w:pPr/w:pStyle", NS)
            sid = s.get(W + "val", "") if s is not None else "Normal"
            seen = set()
            while sid and sid not in seen:
                seen.add(sid)
                st = style_map.get(sid)
                if st is None:
                    break
                if st.find("w:pPr/w:numPr", NS) is not None:
                    return False
                base = st.find("w:basedOn", NS)
                sid = base.get(W + "val", "") if base is not None else ""
    return True


def apply_table_layout(table, config):
    for p in table.findall(".//w:tc/w:p", NS):
        pp = node(p, "pPr")
        spacing = node(pp, "spacing")
        for key in SPACING:
            spacing.attrib.pop(W + key, None)
        for key, value in {
            "before": round(config["space_before_pt"] * 20),
            "after": round(config["space_after_pt"] * 20),
            "line": round(config["line_multiple"] * 240),
            "lineRule": "auto",
            "beforeAutospacing": 0,
            "afterAutospacing": 0,
        }.items():
            spacing.set(W + key, str(value))
        ind = node(pp, "ind")
        for key in INDENT:
            ind.attrib.pop(W + key, None)
        ind.set(W + "firstLine", "0")
        ind.set(W + "firstLineChars", str(config["first_line_chars"] * 100))
        node(pp, "snapToGrid").set(W + "val", "0")
    for cell in table.findall(".//w:tc", NS):
        margins = node(node(cell, "tcPr"), "tcMar")
        for side in ("top", "bottom"):
            margin = node(margins, side)
            margin.set(
                W + "w", str(round(config["cell_vertical_margin_mm"] * 1440 / 25.4))
            )
            margin.set(W + "type", "dxa")
    for height in table.findall("w:tr/w:trPr/w:trHeight", NS):
        height.getparent().remove(height)


def strip_table_layout(table):
    """Projection whitelist, separate from the writer's values and traversal."""
    for p in table.findall(".//w:p", NS):
        pp = p.find("w:pPr", NS)
        if pp is None:
            continue
        for tag, attrs in (
            ("spacing", SPACING),
            ("ind", INDENT),
            ("snapToGrid", {"val"}),
        ):
            n = pp.find("w:" + tag, NS)
            if n is not None:
                for attr in attrs:
                    n.attrib.pop(W + attr, None)
                if not n.attrib and not len(n):
                    pp.remove(n)
        if not pp.attrib and not len(pp):
            p.remove(pp)
    for margins in table.findall(".//w:tcPr/w:tcMar", NS):
        for side in ("top", "bottom"):
            n = margins.find("w:" + side, NS)
            if n is not None:
                for attr in ("w", "type"):
                    n.attrib.pop(W + attr, None)
                if not n.attrib and not len(n):
                    margins.remove(n)
        if not margins.attrib and not len(margins):
            margins.getparent().remove(margins)
    for h in table.findall("w:tr/w:trPr/w:trHeight", NS):
        h.getparent().remove(h)
    for props in table.xpath(".//w:tcPr|./w:tr/w:trPr", namespaces=NS):
        if not props.attrib and not len(props):
            props.getparent().remove(props)
