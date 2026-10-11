"""Explicit article-title choices and verified user-authorized title insertion."""
from dataclasses import replace
import re
from markdown_it import MarkdownIt
from .models import FormatError


def manual_title_text(value):
    if not isinstance(value, str):
        raise FormatError('INVALID_TITLE', '请手动输入标题。')
    value = value.strip()
    if not value or len(value) > 100 or any(
        ord(c) < 32 or 127 <= ord(c) <= 159 or 0xD800 <= ord(c) <= 0xDFFF
        or ord(c) in {0x2028, 0x2029, 0xFFFE, 0xFFFF} for c in value
    ):
        raise FormatError('INVALID_TITLE', '标题须为1至100字的单行文字，不能包含控制字符。')
    return value


def insert_manual_title(data, title, profile, outline):
    """Insert one directly formatted paragraph; reverse it and compare every part."""
    from copy import deepcopy
    from io import BytesIO
    from zipfile import ZipFile
    from lxml import etree
    from .validation import read_package, xml, NS, W
    from .docx_formatter import serialize
    from .writer import element, font_props, role_latin_font
    from .models import Check
    original = read_package(data)
    document = xml(original['word/document.xml'])
    paragraph = element('p')
    ppr = element('pPr')
    for node in [element('pStyle', val='Title'), element('keepNext'), element('spacing', before=0,
                 after=profile['line_pt'] * 20, line=profile.get('title_line_pt', profile['line_pt']) * 20, lineRule='exact'),
                 element('ind', left=0, right=0, firstLine=0, firstLineChars=0),
                 element('jc', val='center'), element('outlineLvl', val=9)]:
        ppr.append(node)
    paragraph.append(ppr)
    run = element('r'); rpr = element('rPr')
    font_props(rpr, profile['fonts']['title'], profile['title_pt'], role_latin_font(profile, 'title'))
    for index, node in enumerate([element('b', val=0), element('i', val=0), element('color', val='000000')], 1):
        rpr.insert(index, node)
    run.append(rpr)
    text = element('t'); text.text = title; run.append(text); paragraph.append(run)
    document.find('w:body', NS).insert(0, paragraph)
    output = BytesIO()
    with ZipFile(BytesIO(data)) as source, ZipFile(output, 'w') as target:
        for info in source.infolist():
            target.writestr(info, serialize(document) if info.filename == 'word/document.xml' else source.read(info.filename))
    result = output.getvalue(); reread = read_package(result)
    reverse = xml(reread['word/document.xml'])
    body = reverse.find('w:body', NS); first = body[0]
    if first.tag != W + 'p' or ''.join(first.xpath('.//w:t/text()', namespaces=NS)) != title:
        raise FormatError('PROTECTED_CONTENT_CHANGED', '手动标题读回检查失败。')
    body.remove(first)
    if etree.tostring(reverse, method='c14n') != etree.tostring(xml(original['word/document.xml']), method='c14n') or any(
        content != reread.get(name) for name, content in original.items() if name != 'word/document.xml'
    ) or set(original) != set(reread):
        raise FormatError('PROTECTED_CONTENT_CHANGED', '手动标题反向核验失败，未发布成果。')
    shifted = deepcopy(outline)
    for row in shifted:
        if re.fullmatch(r'b\d+', row['id']):
            row.setdefault('source_id', row['id'])
            row['id'] = f"b{int(row['id'][1:]) + 1}"
    return result, [Check('MANUAL_TITLE', 'pass', '已将用户手动输入的标题加入文首；原稿文字、格式对象与包部件反向核验通过。', 'b1')], [
        {'id': 'b1', 'role': 'title', 'text': title, 'origin': 'manual'}, *shifted]


def markdown_candidates(content):
    text = content.removeprefix('\ufeff')
    front = re.match(r'\A---\r?\n.*?\r?\n---(?:\r?\n|$)', text, re.S)
    offset = text[:front.end()].count('\n') if front else 0
    if front:
        text = text[front.end():]
    parser = MarkdownIt('commonmark', {'html': False}).enable('table').enable('strikethrough')
    tokens = parser.parse(text)
    rows = []
    depth = 0
    for i, token in enumerate(tokens):
        if token.type in {'paragraph_open', 'heading_open'} and depth == 0:
            item = tokens[i + 1]
            children = item.children or []
            safe = not any(c.type in {'code_inline', 'image', 'link_open', 'hardbreak'} for c in children)
            value = ''.join(c.content if c.type in {'text', 'code_inline'} else '\n' if c.type in {'softbreak', 'hardbreak'} else '' for c in children)
            lines = value.split('\n')
            for line, label in enumerate(lines):
                if label.strip():
                    rows.append({'id': f'line:{token.map[0] + offset + line + 1}', 'text': label,
                                 'role': 'title' if token.type == 'heading_open' and token.tag == 'h1' else 'body',
                                 'selectable': safe, 'line': token.map[0] + offset + line + 1})
        depth += token.nesting
    return rows[:8]


def candidate_result(rows):
    rows = rows[:8]
    preferred = next((r for r in rows if r.get('selectable') and r['role'] == 'title'), None)
    if preferred is None:
        preferred = next((r for r in rows if r.get('selectable') and len(r['text'].strip()) <= 100
                          and not r['text'].rstrip().endswith(('。', '；', '：', ':', ';'))), None)
    return {'candidates': rows, 'suggested': preferred['id'] if preferred else None}


def selected_line_groups(runs, index):
    """Split at the two confirmed line boundaries, retaining each run's attributes."""
    text = ''.join(r.text for r in runs)
    lines = text.split('\n')
    left = sum(len(line) + 1 for line in lines[:index])
    right = left + len(lines[index])
    groups = []
    for start, end, title in [(0, max(0, left - 1), False), (left, right, True), (right + 1, len(text), False)]:
        group, cursor = [], 0
        for run in runs:
            a, b = max(start - cursor, 0), min(end - cursor, len(run.text))
            if a < b:
                group.append(replace(run, text=run.text[a:b]))
            cursor += len(run.text)
        if group:
            groups.append((group, title))
    return groups


def word_title_roles(rows, selection, roles):
    if selection is None:
        return roles
    eligible = {r['id'] for r in rows[:8] if not r['protected'] and roles.get(r['id'], r['role']) != 'preserve'}
    if selection != 'none' and selection not in eligible:
        raise FormatError('INVALID_TITLE', '标题选择已失效或含保护对象，请重新确认。')
    result = {r['id']: 'body' for r in rows if r['role'] == 'title'}
    result.update(roles)
    result = {key: 'body' if role == 'title' else role for key, role in result.items()}
    if selection != 'none':
        result[selection] = 'title'
    return result
