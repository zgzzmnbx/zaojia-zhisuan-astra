"""Interpret short literal **markers** without rebuilding Word paragraphs."""
from copy import deepcopy
import re

from lxml import etree

from .validation import NS, W, paragraph_text

MAX_MARKER_LENGTH = 50
TOKEN = re.compile(r"(?<![\\*])\*\*(?!\*)")


def convert_bold_markers(document, preserve_ids=()):
    from .field_ranges import protected_field_paragraphs
    fields = protected_field_paragraphs(document)
    converted = skipped = 0
    body = document.find("w:body", NS)
    preserved = {p for i, p in enumerate(body) if f"b{i + 1}" in preserve_ids}
    for p in body.findall(".//w:p", NS):
        text = paragraph_text(p)
        if "**" not in text:
            continue
        # Proofing ranges carry no text and remain at their original boundaries.
        # Never cross bookmarks, fields, revisions, links or objects.
        runs = p.findall("w:r", NS)
        safe = (
            p not in preserved and p not in fields
            and "`" not in text
            and all(n.tag in {W + "pPr", W + "r", W + "proofErr"} for n in p)
            and all(all(n.tag in {W + "rPr", W + "t"} for n in r) for r in runs)
            and not p.xpath(".//w:rPrChange|.//w:pPrChange", namespaces=NS)
            and all(a.tag in {W + "body", W + "tbl", W + "tr", W + "tc"}
                    for a in p.iterancestors() if a is not document)
        )
        if not safe:
            skipped += 1
            continue
        tokens = list(TOKEN.finditer(text))
        spans = []
        for opening, closing in zip(tokens[::2], tokens[1::2]):
            inner = text[opening.end():closing.start()]
            if inner.strip() and len(inner) <= MAX_MARKER_LENGTH and "*" not in inner and not any(c in inner for c in "\r\n"):
                spans.append((opening.start(), opening.end(), closing.start(), closing.end()))
        if not spans:
            skipped += 1
            continue
        # Character map makes splitting independent of how Word stored its runs.
        mask = [0] * len(text)  # 0 unchanged, 1 bold, 2 delimiter to remove
        for start, inner_start, inner_end, end in spans:
            mask[start:inner_start] = [2] * (inner_start - start)
            mask[inner_start:inner_end] = [1] * (inner_end - inner_start)
            mask[inner_end:end] = [2] * (end - inner_end)
        offset = 0
        for run in runs:
            content = "".join(n.text or "" for n in run.findall("w:t", NS))
            flags = mask[offset:offset + len(content)]
            offset += len(content)
            if not any(flags):
                continue
            insert_at = p.index(run)
            pos = 0
            while pos < len(content):
                end = pos + 1
                while end < len(content) and flags[end] == flags[pos]:
                    end += 1
                if flags[pos] != 2:
                    piece = deepcopy(run)
                    for node in piece.findall("w:t", NS):
                        piece.remove(node)
                    if flags[pos] == 1:
                        props = piece.find("w:rPr", NS)
                        if props is None:
                            props = etree.Element(W + "rPr")
                            piece.insert(0, props)
                        # Use python-docx's schema-aware insertion for run properties.
                        from docx.oxml import parse_xml
                        props_new = parse_xml(etree.tostring(props))
                        props_new.get_or_add_b().val = True
                        props_new.get_or_add_bCs().val = True
                        piece.replace(props, props_new)
                    node = etree.SubElement(piece, W + "t")
                    node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
                    node.text = content[pos:end]
                    p.insert(insert_at, piece)
                    insert_at += 1
                pos = end
            p.remove(run)
        expected = text
        for start, inner_start, inner_end, end in reversed(spans):
            expected = expected[:start] + text[inner_start:inner_end] + expected[end:]
        if paragraph_text(p) != expected:
            raise ValueError("Bold marker conversion changed non-marker text")
        converted += len(spans)
        if "**" in expected:
            skipped += 1
    return converted, skipped
