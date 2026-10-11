"""Embed the bundled public-document fonts into generated DOCX packages."""

from __future__ import annotations

from hashlib import sha256
from functools import lru_cache
from importlib.resources import files
from io import BytesIO
from uuid import NAMESPACE_URL, uuid5
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

from fontTools import subset
from fontTools.ttLib import TTFont
from lxml import etree


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
FONT_REL_TYPE = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"
)
FONT_TABLE_REL_TYPE = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable"
)
SETTINGS_REL_TYPE = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings"
)
OBFUSCATED_FONT_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.obfuscatedFont"
)

FONT_FILES = {
    "方正小标宋简体": "fzxiaobiaosong.ttf",
    "仿宋": "simfang.ttf",
    "黑体": "simhei.ttf",
    "楷体": "simkai.ttf",
    "宋体": "simsun.ttf",
    "方正仿宋简体": "fzfangsong.ttf",
    "Times New Roman": "times-new-roman.ttf",
    "方正黑体简体": "fzhei.ttf",
    "方正楷体简体": "fzkai.ttf",
}

FONT_CATALOG = (
    {"id": "title", "family": "方正小标宋简体", "role": "公文标题", "filename": "方正小标宋简体.ttf"},
    {"id": "body", "family": "仿宋", "role": "专业报告及旧版正文、标题", "filename": "仿宋.ttf"},
    {"id": "heading1", "family": "黑体", "role": "专业报告及旧版一级标题", "filename": "黑体.ttf"},
    {"id": "heading2", "family": "楷体", "role": "专业报告及旧版二级标题", "filename": "楷体.ttf"},
    {"id": "footer", "family": "宋体", "role": "页码与兼容文字", "filename": "宋体.ttf"},
    {"id": "latin-default", "family": "方正仿宋简体", "role": "公文正文、三四级标题及默认英文与数字", "filename": "方正仿宋简体.ttf"},
    {"id": "latin", "family": "Times New Roman", "role": "西文、数字与符号", "filename": "Times New Roman.ttf"},
    {"id": "company-heading1", "family": "方正黑体简体", "role": "单位公文一级标题", "filename": "方正黑体简体.ttf"},
    {"id": "company-heading2", "family": "方正楷体简体", "role": "单位公文二级标题", "filename": "方正楷体简体.ttf"},
)

_COMMON_GLYPHS = (
    " \t\n0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    "，。；：！？“”‘’（）〔〕【】《》、—…·"
    "-+/%.°±×÷¥￥§№"
)


def _xml(data: bytes) -> etree._Element:
    return etree.fromstring(data)


def _serialize(node: etree._Element) -> bytes:
    return etree.tostring(
        node, encoding="UTF-8", xml_declaration=True, standalone=True
    )


def _fixed_zip_info(name: str) -> ZipInfo:
    info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = ZIP_DEFLATED
    info.external_attr = 0o600 << 16
    return info


def _next_relationship_id(root: etree._Element) -> str:
    used = {node.get("Id", "") for node in root}
    number = 1
    while f"rId{number}" in used:
        number += 1
    return f"rId{number}"


def _ensure_relationship(
    root: etree._Element, relationship_type: str, target: str
) -> str:
    for node in root:
        if node.get("Type") == relationship_type and node.get("Target") == target:
            return node.get("Id")
    relationship_id = _next_relationship_id(root)
    etree.SubElement(
        root,
        f"{{{PKG_REL_NS}}}Relationship",
        Id=relationship_id,
        Type=relationship_type,
        Target=target,
    )
    return relationship_id


def _ensure_override(root: etree._Element, part_name: str, content_type: str) -> None:
    for node in root:
        if node.get("PartName") == part_name:
            return
    etree.SubElement(
        root,
        f"{{{CT_NS}}}Override",
        PartName=part_name,
        ContentType=content_type,
    )


def _ensure_default(root: etree._Element, extension: str, content_type: str) -> None:
    for node in root:
        if node.get("Extension", "").lower() == extension.lower():
            return
    etree.SubElement(
        root,
        f"{{{CT_NS}}}Default",
        Extension=extension,
        ContentType=content_type,
    )


def _document_text(package: dict[str, bytes]) -> str:
    characters = set(_COMMON_GLYPHS)
    for name, data in package.items():
        if not name.startswith("word/") or not name.endswith(".xml"):
            continue
        try:
            root = _xml(data)
        except etree.XMLSyntaxError:
            continue
        for tag in ("t", "delText", "instrText"):
            for node in root.findall(f".//{{{W_NS}}}{tag}"):
                if node.text:
                    characters.update(node.text)
    return "".join(sorted(characters))


def _subset_font(raw: bytes, text: str) -> bytes:
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.name_legacy = True
    options.notdef_glyph = True
    options.notdef_outline = True
    options.recalc_bounds = True
    font = TTFont(BytesIO(raw), recalcBBoxes=False, recalcTimestamp=False)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    output = BytesIO()
    font.flavor = None
    font.save(output, reorderTables=True)
    return output.getvalue()


@lru_cache(maxsize=96)
def _subset_resource(filename: str, text: str) -> bytes:
    return _subset_font(_font_resource(filename), text)


def _obfuscate_font(raw: bytes, key) -> bytes:
    if len(raw) < 32:
        raise ValueError("font file is too short")
    key_bytes = bytes.fromhex(key.hex)[::-1]
    output = bytearray(raw)
    for index in range(32):
        output[index] ^= key_bytes[index % 16]
    return bytes(output)


def _font_resource(filename: str) -> bytes:
    return files("gongwen_core.fonts").joinpath(filename).read_bytes()


def bundled_font_bytes(font_id: str) -> tuple[dict[str, str], bytes]:
    for item in FONT_CATALOG:
        if item["id"] == font_id:
            return dict(item), _font_resource(FONT_FILES[item["family"]])
    raise KeyError(font_id)


def embed_document_fonts(data: bytes) -> tuple[bytes, list[str]]:
    """Return a DOCX with deterministic, subsetted embedded regular fonts."""

    with ZipFile(BytesIO(data)) as archive:
        infos = archive.infolist()
        package = {info.filename: archive.read(info.filename) for info in infos}

    content_types = _xml(package["[Content_Types].xml"])
    document_rels_name = "word/_rels/document.xml.rels"
    if document_rels_name in package:
        document_rels = _xml(package[document_rels_name])
        document_rels_changed = False
    else:
        document_rels = etree.Element(
            f"{{{PKG_REL_NS}}}Relationships", nsmap={None: PKG_REL_NS}
        )
        document_rels_changed = True

    font_table_name = "word/fontTable.xml"
    if font_table_name in package:
        font_table = _xml(package[font_table_name])
    else:
        font_table = etree.Element(
            f"{{{W_NS}}}fonts", nsmap={"w": W_NS, "r": R_NS}
        )
        _ensure_relationship(document_rels, FONT_TABLE_REL_TYPE, "fontTable.xml")
        document_rels_changed = True
        _ensure_override(
            content_types,
            "/word/fontTable.xml",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml",
        )

    font_rels_name = "word/_rels/fontTable.xml.rels"
    if font_rels_name in package:
        font_rels = _xml(package[font_rels_name])
    else:
        font_rels = etree.Element(
            f"{{{PKG_REL_NS}}}Relationships", nsmap={None: PKG_REL_NS}
        )

    settings_name = "word/settings.xml"
    if settings_name in package:
        settings = _xml(package[settings_name])
    else:
        settings = etree.Element(f"{{{W_NS}}}settings", nsmap={"w": W_NS})
        _ensure_relationship(document_rels, SETTINGS_REL_TYPE, "settings.xml")
        document_rels_changed = True
        _ensure_override(
            content_types,
            "/word/settings.xml",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml",
        )
    for local_name in ("embedTrueTypeFonts", "saveSubsetFonts"):
        if settings.find(f"{{{W_NS}}}{local_name}") is None:
            settings.append(etree.Element(f"{{{W_NS}}}{local_name}"))

    _ensure_default(content_types, "odttf", OBFUSCATED_FONT_CONTENT_TYPE)
    document_text = _document_text(package)
    added_parts: dict[str, bytes] = {}
    embedded = []
    for index, (family, filename) in enumerate(FONT_FILES.items(), start=1):
        matching = font_table.xpath(
            "./w:font[@w:name=$family]", namespaces={"w": W_NS}, family=family
        )
        font_node = matching[0] if matching else etree.SubElement(
            font_table, f"{{{W_NS}}}font", {f"{{{W_NS}}}name": family}
        )
        existing = font_node.find(f"{{{W_NS}}}embedRegular")
        if existing is not None and existing.get(f"{{{R_NS}}}id"):
            embedded.append(family)
            continue
        subset_font = _subset_resource(filename, document_text)
        digest = sha256(subset_font).hexdigest()
        key = uuid5(NAMESPACE_URL, f"gongwen-agent:{family}:{digest}")
        part_name = f"word/fonts/gongwen-font-{index}.odttf"
        relationship_id = _ensure_relationship(
            font_rels, FONT_REL_TYPE, f"fonts/gongwen-font-{index}.odttf"
        )
        if existing is None:
            existing = etree.SubElement(font_node, f"{{{W_NS}}}embedRegular")
        existing.set(f"{{{R_NS}}}id", relationship_id)
        existing.set(f"{{{W_NS}}}fontKey", "{" + str(key).upper() + "}")
        added_parts[part_name] = _obfuscate_font(subset_font, key)
        embedded.append(family)

    replacements = {
        "[Content_Types].xml": _serialize(content_types),
        font_table_name: _serialize(font_table),
        font_rels_name: _serialize(font_rels),
        settings_name: _serialize(settings),
        **added_parts,
    }
    if document_rels_changed:
        replacements[document_rels_name] = _serialize(document_rels)
    output = BytesIO()
    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as target:
        written = set()
        for info in infos:
            name = info.filename
            target.writestr(info, replacements.get(name, package[name]))
            written.add(name)
        for name in sorted(replacements.keys() - written):
            target.writestr(_fixed_zip_info(name), replacements[name])
    return output.getvalue(), embedded
