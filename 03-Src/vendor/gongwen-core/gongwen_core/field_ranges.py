"""Locate fields as ranges, including result paragraphs with no local markers."""
from .validation import NS, W


def protected_field_paragraphs(document):
    protected, depth = set(), 0
    for p in document.findall('.//w:p', NS):
        active = depth > 0
        for node in p.iter():
            if node.tag == W + 'fldChar':
                active = True
                kind = node.get(W + 'fldCharType')
                if kind == 'begin':
                    depth += 1
                elif kind == 'end':
                    depth = max(0, depth - 1)
        style = p.find('w:pPr/w:pStyle', NS)
        toc_style = style is not None and (style.get(W + 'val', '').lower().replace(' ', '').startswith('toc') or style.get(W + 'val', '').startswith('目录'))
        toc_link = any(n.get(W + 'anchor', '').lower().startswith('_toc') for n in p.findall('.//w:hyperlink', NS))
        if active or toc_style or toc_link or p.find('.//w:fldSimple', NS) is not None:
            protected.add(p)
    body = document.find('w:body', NS)
    for i, p in enumerate(body):
        if p.tag != W + 'p' or ''.join(p.xpath('.//w:t/text()', namespaces=NS)).replace(' ', '').replace('\u3000', '') != '目录':
            continue
        following = next((n for n in list(body)[i+1:] if n.tag != W + 'p' or n in protected or n.xpath('.//w:t/text()', namespaces=NS)), None)
        if following in protected:
            protected.add(p)
    return protected
