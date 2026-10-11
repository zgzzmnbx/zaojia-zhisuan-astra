"""Preserve the approved V3.1 cover; the unchanged Gongwen SDK owns body formatting."""
from copy import deepcopy
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from zipfile import BadZipFile
import json
import posixpath
import re
from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
REL = '{http://schemas.openxmlformats.org/package/2006/relationships}'
NS = {'w': W[1:-1], 'r': R[1:-1]}

RISK_SUBHEADINGS = ('本次处理结论', '主要风险概览', '重点复核建议', '规则依据提示', '后续处理建议')

def normalize_risk_subheadings(markdown):
    """Only demote the known model subsections inside the cost report's fifth chapter."""
    lines = []; changes = []; chapter = False; risk = False; fence = None
    for line in markdown.splitlines(keepends=True):
        stripped = line.lstrip(' \t')
        fenced = re.match(r'(`{3,}|~{3,})', stripped)
        if fenced:
            marker = fenced.group(1)
            if fence is None: fence = marker
            elif marker[0] == fence[0] and len(marker) >= len(fence): fence = None
            lines.append(line); continue
        heading = None if fence else re.fullmatch(r'( {0,3})(#{1,6})[ \t]+(.+?)[ \t]*(\r?\n)?', line)
        plain = None if fence or heading else re.fullmatch(r'( {0,3})(\S.*?)[ \t]*(\r?\n)?', line)
        candidate = heading or plain
        if candidate:
            title = candidate.group(3 if heading else 2).strip().strip('*').strip()
            level = len(heading.group(2)) if heading else None
            match = re.fullmatch(r'(?:[一二三四五]、|[（(][一二三四五][）)])\s*('+ '|'.join(RISK_SUBHEADINGS) +')', title)
            if title == '五、其他需要注意的事项':
                chapter = True
            elif title == '大模型风险提示':
                risk = chapter
            elif title == '造价智算匹配报告' or level is not None and level <= 2 and not match:
                chapter = risk = False
            if chapter and risk:
                if match:
                    name = match.group(1)
                    expected = '（'+'一二三四五'[RISK_SUBHEADINGS.index(name)]+'）'+name
                    replacement = candidate.group(1)+'### '+expected+(candidate.group(4 if heading else 3) or '')
                    if replacement != line:
                        changes.append({'before': title, 'after': expected, 'role': 'heading2'})
                        line = replacement
        lines.append(line)
    return ''.join(lines), changes

def package(data):
    with ZipFile(BytesIO(data)) as archive:
        return {name: archive.read(name) for name in archive.namelist()}

def xml(data):
    return etree.fromstring(data, etree.XMLParser(resolve_entities=False, no_network=True))

def serialize(node):
    return etree.tostring(node, encoding='UTF-8', xml_declaration=True, standalone=True)

def text(node):
    return ''.join(node.xpath('.//w:t/text()', namespaces=NS))

def boundary(body):
    return next((i for i, node in enumerate(body) if node.tag == W+'p'
                 and text(node).strip() in {'项目基本情况', '一、项目基本情况'}), None)

def eligible(data):
    try:
        body = xml(package(data)['word/document.xml']).find('w:body', NS)
    except (BadZipFile, KeyError, etree.XMLSyntaxError):
        return False
    end = boundary(body)
    return end is not None and end > 5 and any('招标控制价' in text(node) for node in list(body)[:end])

def preserve_cover(formatted, original):
    source = package(original)
    source_body = xml(source['word/document.xml']).find('w:body', NS)
    end = boundary(source_body)
    if end is None:
        raise ValueError('控制价报告扉页边界不明确，未发布成果')
    config = json.loads((ROOT/'config/cost-report-cover-source.json').read_text(encoding='utf-8'))
    template = (ROOT/config['asset']).read_bytes()
    if sha256(template).hexdigest() != config['sha256']:
        raise ValueError('控制价扉页模板版本不一致，未发布成果')
    base = package(template)
    doc = xml(base['word/document.xml']); body = doc.find('w:body', NS)
    cover_end = boundary(body)
    cover = [deepcopy(node) for node in list(body)[:cover_end]]
    # Values change; all paragraph/run/table layout properties remain the approved template's.
    source_cover = list(source_body)[:end]
    target_lines = [node for node in cover if node.tag == W+'p' and text(node).strip()]
    source_lines = [node for node in source_cover if node.tag == W+'p' and text(node).strip()]
    target_tables = [node for node in cover if node.tag == W+'tbl']
    source_tables = [node for node in source_cover if node.tag == W+'tbl']
    if len(target_lines) != len(source_lines) or len(target_tables) != len(source_tables):
        raise ValueError('控制价报告扉页内容结构与V3.1模板不同，请先核对原Word')
    for target, current in [*zip(target_lines, source_lines), *zip(target_tables, source_tables)]:
        target_ps = [target] if target.tag == W+'p' else target.findall('.//w:p', NS)
        current_ps = [current] if current.tag == W+'p' else current.findall('.//w:p', NS)
        if len(target_ps) != len(current_ps):
            raise ValueError('扉页签署结构已变化，请先核对原Word')
        for target_p, current_p in zip(target_ps, current_ps):
            if text(target_p) == text(current_p):
                continue
            runs = target_p.findall('.//w:t', NS)
            if not runs:
                run = etree.SubElement(target_p, W+'r'); runs = [etree.SubElement(run, W+'t')]
            runs[0].text = text(current_p)
            for run in runs[1:]: run.text = ''
    original_section = deepcopy(body.find('w:sectPr', NS))
    for node in list(body): body.remove(node)
    for node in cover: body.append(node)

    generated = package(formatted)
    gen_doc = xml(generated['word/document.xml']); gen_body = gen_doc.find('w:body', NS)
    start = boundary(gen_body)
    if start is None:
        raise ValueError('公文正文章节边界不明确，未发布成果')
    # A confirmed document title belongs to the body page, never replaces the cover.
    titles = [deepcopy(node) for node in list(gen_body)[:start]
              if node.find('w:pPr/w:pStyle', NS) is not None
              and node.find('w:pPr/w:pStyle', NS).get(W+'val', '').lower().endswith('title')
              and text(node) not in {text(c) for c in cover}]
    content = titles + [deepcopy(node) for node in list(gen_body)[start:] if node.tag != W+'sectPr']
    normalized = []; previous = []; removed = 0
    chapter = '五、其他需要注意的事项'
    for node in content:
        line = text(node).strip()
        if node.tag == W+'p' and line == chapter and previous[-2:] == [chapter, '大模型风险提示']:
            removed += 1
            continue
        normalized.append(node)
        if line: previous.append(line)
    content = normalized
    body_text = [text(node) for node in content]
    gen_section = deepcopy(gen_body.find('w:sectPr', NS))

    # Separate namespaces for all imported styles, numbering and relationship IDs.
    styles = xml(base['word/styles.xml']); gen_styles = xml(generated['word/styles.xml'])
    style_map = {node.get(W+'styleId'): 'AstraBody_'+node.get(W+'styleId') for node in gen_styles.findall('w:style', NS)}
    default_paragraph = next((node.get(W+'styleId') for node in gen_styles.findall('w:style', NS)
                              if node.get(W+'type') == 'paragraph' and node.get(W+'default') == '1'), None)
    if default_paragraph is None:
        raise ValueError('公文正文缺少默认段落样式，未发布成果')
    def bind_body_default(node):
        # The cover owns package defaults. Bind implicit SDK paragraphs before importing.
        for paragraph in node.iter(W+'p'):
            properties = paragraph.find('w:pPr', NS)
            if properties is None:
                properties = etree.Element(W+'pPr'); paragraph.insert(0, properties)
            if properties.find('w:pStyle', NS) is None:
                style = etree.Element(W+'pStyle'); style.set(W+'val', default_paragraph)
                properties.insert(0, style)
    for node in content: bind_body_default(node)
    def remap_styles(node):
        for item in node.iter():
            if item.tag in {W+'pStyle', W+'rStyle', W+'tblStyle', W+'basedOn', W+'next', W+'link', W+'styleLink', W+'numStyleLink'}:
                value = item.get(W+'val')
                if value in style_map: item.set(W+'val', style_map[value])
    for node in gen_styles.findall('w:style', NS):
        node = deepcopy(node); node.set(W+'styleId', style_map[node.get(W+'styleId')]); node.attrib.pop(W+'default', None)
        remap_styles(node); styles.append(node)
    base['word/styles.xml'] = serialize(styles)

    nums = xml(base['word/numbering.xml']) if 'word/numbering.xml' in base else etree.Element(W+'numbering', nsmap={'w': W[1:-1]})
    number_map = {}
    if 'word/numbering.xml' in generated:
        gen_nums = xml(generated['word/numbering.xml'])
        abstract_offset = max([int(n.get(W+'abstractNumId')) for n in nums.findall('w:abstractNum', NS)]+[-1])+1
        number_offset = max([int(n.get(W+'numId')) for n in nums.findall('w:num', NS)]+[0])+1
        for node in gen_nums:
            node = deepcopy(node); remap_styles(node)
            if node.tag == W+'abstractNum': node.set(W+'abstractNumId', str(int(node.get(W+'abstractNumId'))+abstract_offset))
            elif node.tag == W+'num':
                old = node.get(W+'numId'); number_map[old] = str(int(old)+number_offset); node.set(W+'numId', number_map[old])
                ref = node.find('w:abstractNumId', NS); ref.set(W+'val', str(int(ref.get(W+'val'))+abstract_offset))
            nums.append(node)
        base['word/numbering.xml'] = serialize(nums)

    rels = xml(base['word/_rels/document.xml.rels']); gen_rels = xml(generated['word/_rels/document.xml.rels'])
    relationships = {}
    def imported(name): return 'word/astra-body/'+name.removeprefix('word/')
    shared = {'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/fontTable.xml', 'word/settings.xml'}
    def target_part(owner, target):
        return posixpath.normpath(target.lstrip('/') if target.startswith('/') else posixpath.join(posixpath.dirname(owner), target))
    def mapped_part(name): return name if name in shared else imported(name)
    types = xml(base['[Content_Types].xml']); gen_types = xml(generated['[Content_Types].xml'])
    for name, data in generated.items():
        if name not in {'[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/numbering.xml', 'word/fontTable.xml', 'word/_rels/fontTable.xml.rels', 'word/settings.xml'}:
            if name.endswith('.rels'):
                tree = xml(data)
                owner = posixpath.join(posixpath.dirname(posixpath.dirname(name)), posixpath.basename(name).removesuffix('.rels'))
                for relation in tree:
                    if relation.get('TargetMode') != 'External':
                        target = target_part(owner, relation.get('Target'))
                        relation.set('Target', posixpath.relpath(mapped_part(target), posixpath.dirname(imported(owner))))
                data = serialize(tree)
            elif name.endswith('.xml'):
                tree=xml(data);bind_body_default(tree);remap_styles(tree)
                for item in tree.iter(W+'numId'):
                    if item.get(W+'val') in number_map: item.set(W+'val', number_map[item.get(W+'val')])
                data=serialize(tree)
            base[imported(name)] = data
    for node in gen_types:
        node = deepcopy(node)
        if node.tag.endswith('Override'):
            name = node.get('PartName').lstrip('/')
            if imported(name) not in base: continue
            node.set('PartName', '/'+imported(name))
        elif any(existing.get('Extension') == node.get('Extension') for existing in types): continue
        types.append(node)
    for node in gen_rels:
        if node.get('Type').rsplit('/', 1)[-1] in {'styles', 'numbering', 'fontTable', 'settings'}: continue
        node = deepcopy(node); old = node.get('Id'); new = 'astraBody_'+old; relationships[old] = new; node.set('Id', new)
        if node.get('Type').rsplit('/', 1)[-1] in {'footnotes', 'endnotes', 'comments'}:
            for previous in list(rels):
                if previous.get('Type') == node.get('Type'): rels.remove(previous)
        if node.get('TargetMode') != 'External':
            target = target_part('word/document.xml', node.get('Target'))
            node.set('Target', posixpath.relpath(mapped_part(target), 'word'))
        rels.append(node)
    # Embed the original core's fonts into the shared font table.
    fonts = xml(base['word/fontTable.xml']); gen_fonts = xml(generated['word/fontTable.xml'])
    font_rels = xml(base['word/_rels/fontTable.xml.rels']) if 'word/_rels/fontTable.xml.rels' in base else etree.Element(REL+'Relationships', nsmap={None: REL[1:-1]})
    font_map = {}
    if 'word/_rels/fontTable.xml.rels' in generated:
        for node in xml(generated['word/_rels/fontTable.xml.rels']):
            node = deepcopy(node); old = node.get('Id'); new = 'astraBody_'+old; font_map[old] = new; node.set('Id', new)
            target = target_part('word/fontTable.xml', node.get('Target'))
            node.set('Target', posixpath.relpath(mapped_part(target), 'word')); font_rels.append(node)
    for node in gen_fonts:
        node = deepcopy(node)
        for item in node.iter():
            if item.get(R+'id') in font_map: item.set(R+'id', font_map[item.get(R+'id')])
        existing = next((f for f in fonts if f.get(W+'name') == node.get(W+'name')), None)
        if existing is not None: fonts.remove(existing)
        fonts.append(node)
    settings=xml(base['word/settings.xml']); gen_settings=xml(generated['word/settings.xml'])
    for setting in gen_settings:
        if setting.tag==W+'evenAndOddHeaders' and settings.find('w:evenAndOddHeaders',NS) is None: settings.append(deepcopy(setting))
    base['word/settings.xml']=serialize(settings)
    base['word/fontTable.xml'] = serialize(fonts); base['word/_rels/fontTable.xml.rels'] = serialize(font_rels)
    base['word/_rels/document.xml.rels'] = serialize(rels); base['[Content_Types].xml'] = serialize(types)
    def remap_content(node):
        remap_styles(node)
        for item in node.iter():
            for attr in [R+'id', R+'embed', R+'link']:
                if item.get(attr) in relationships: item.set(attr, relationships[item.get(attr)])
            if item.tag == W+'numId' and item.get(W+'val') in number_map: item.set(W+'val', number_map[item.get(W+'val')])
    for node in content: remap_content(node)
    remap_content(gen_section)
    section_break = etree.Element(W+'p'); properties = etree.SubElement(section_break, W+'pPr')
    kind = original_section.find('w:type', NS)
    if kind is None: kind = etree.SubElement(original_section, W+'type')
    kind.set(W+'val', 'nextPage'); properties.append(original_section)
    # Reuse an existing final blank paragraph, so the cover gains no extra vertical space.
    if len(body) and body[-1].tag == W+'p' and not text(body[-1]):
        props = body[-1].find('w:pPr', NS)
        if props is None: props = etree.SubElement(body[-1], W+'pPr')
        props.append(original_section)
    else: body.append(section_break)
    for node in content: body.append(node)
    page_number = gen_section.find('w:pgNumType', NS)
    if page_number is None: page_number = etree.SubElement(gen_section, W+'pgNumType')
    page_number.set(W+'start', '1'); body.append(gen_section)
    base['word/document.xml'] = serialize(doc)
    for name, data in base.items():
        if not name.endswith('.rels'): continue
        owner = '' if name == '_rels/.rels' else posixpath.join(posixpath.dirname(posixpath.dirname(name)), posixpath.basename(name).removesuffix('.rels'))
        for relation in xml(data):
            if relation.get('TargetMode') != 'External' and target_part(owner, relation.get('Target')) not in base:
                raise ValueError('扉页合并部件关系不完整，未发布成果')
    # The only cover addition is a section boundary on its existing final empty paragraph.
    actual_cover = [deepcopy(node) for node in list(body)[:cover_end]]
    for node in actual_cover:
        for section in node.findall('.//w:sectPr', NS): section.getparent().remove(section)
        properties = node.find('w:pPr', NS)
        if properties is not None and len(properties) == 0: node.remove(properties)
    expected_cover = [deepcopy(node) for node in cover]
    for node in expected_cover:
        for section in node.findall('.//w:sectPr', NS): section.getparent().remove(section)
        properties = node.find('w:pPr', NS)
        if properties is not None and len(properties) == 0: node.remove(properties)
    if [etree.tostring(n, method='c14n',exclusive=True) for n in actual_cover] != [etree.tostring(n, method='c14n',exclusive=True) for n in expected_cover] or body_text != [text(n) for n in content]:
        raise ValueError('扉页或正文保护检查未通过，未发布成果')
    output = BytesIO()
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for name, data in base.items(): archive.writestr(name, data)
    return output.getvalue(), {'template_sha256': config['sha256'], 'source_word_sha256': sha256(original).hexdigest(), 'cover_nodes': cover_end, 'cover_unchanged': True, 'body_content_preserved': True, 'body_text_preserved': removed == 0, 'duplicate_chapter_heading_removed': removed}
