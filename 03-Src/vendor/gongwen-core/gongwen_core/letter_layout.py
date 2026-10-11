"""Opening recipients and sealed single-organization closing layout."""

from datetime import date
from functools import lru_cache
from importlib.resources import files
from io import BytesIO
import json
import re

from fontTools.ttLib import TTFont

from .embedded_fonts import FONT_FILES
from .models import Check
from .validation import NS, W


def plain_label(text):
    text = text.strip()
    if text.startswith('**') and text.endswith('**') and text.count('**') == 2:
        text = text[2:-2].strip()
    return text


def organization(text):
    text = plain_label(text)
    return bool(
        3 <= len(text) <= 100
        and re.fullmatch(r'[\u3400-\u9fffA-Za-z0-9（）()·—\-]+', text)
        and re.search(r'(?:公司|委员会|人民政府|管理局|办公室|办事处|研究院|研究所|中心|大学|学院|部门|单位|支部|分局|机关|厅|局|部)$', text)
        and not re.match(r'(?:请|现|根据|关于|由于|向|在|我公司|本公司|该公司|此|例如|附件|按|依|应|须|需|将|经|对|于)', text)
    )


def document_date(text):
    match = re.fullmatch(r'(\d{4})年(\d{1,2})月(\d{1,2})日', plain_label(text))
    if not match or not 1900 <= int(match[1]) <= 2199:
        return False
    try:
        date(*map(int, match.groups()))
        return True
    except ValueError:
        return False


def closing_roles(rows):
    """Require a tail date and adjacent named organization, never isolated dates."""
    rows = [row for row in rows if row['text'].strip()]
    if len(rows) < 3:
        return {}, []
    last = rows[-1]
    lines = [plain_label(line) for line in last['text'].splitlines() if line.strip()]
    if len(lines) == 2 and organization(lines[0]) and document_date(lines[1]):
        return ({last['id']: 'preserve'}, ['机关署名与日期在同一段内，保留原格式；请拆成两个独立段落后生成。'])
    previous = rows[-2]
    if (document_date(last['text']) and organization(previous['text'])
            and (last.get('protected') or previous.get('protected'))):
        return {previous['id']: 'preserve', last['id']: 'preserve'}, ['署名或日期含保护对象，落款整体保留，请在Word中核对。']
    if (last['role'] not in {'body', 'date'}
            or previous['role'] not in {'body', 'signature'}
            or not document_date(last['text']) or not organization(previous['text'])):
        return {}, []
    if organization(rows[-3]['text']):
        preserved = {last['id']: 'preserve'}
        for row in reversed(rows[:-1]):
            if not organization(row['text']):
                break
            preserved[row['id']] = 'preserve'
        return preserved, ['文末可能为联合或多段署名，保留原格式，请人工核对盖章编排。']
    if int(last['id'][1:]) != int(previous['id'][1:]) + 1:
        return {previous['id']: 'preserve', last['id']: 'preserve'}, ['署名与日期之间有空段或其他对象，保留原格式；请确认两个段落的连续编排。']
    return {previous['id']: 'signature', last['id']: 'date'}, []


def layout_rule():
    return json.loads(files('gongwen_core').joinpath('rules', 'letter_layout.json').read_text(encoding='utf-8'))


@lru_cache(maxsize=8)
def _advances(family):
    with TTFont(BytesIO(files('gongwen_core').joinpath('fonts', FONT_FILES[family]).read_bytes())) as font:
        units = font['head'].unitsPerEm
        metrics = font['hmtx'].metrics
        return {code: metrics[glyph][0] / units for code, glyph in font.getBestCmap().items()}


def text_width(text, profile, strip=True):
    size = profile['body_pt']
    total = 0
    for char in (plain_label(text) if strip else text):
        family = profile['fonts']['latin'] if ord(char) < 128 else profile['fonts']['body']
        total += _advances(family).get(ord(char), 1) * size
    return total


def paragraph_layout(rows, profile):
    """Return direct OOXML paragraph properties; text/run structure stays intact."""
    rule = layout_rule()
    width = (profile['page']['width_mm'] - profile['page']['left_mm'] - profile['page']['right_mm']) * 72 / 25.4
    date_inset = rule['date_right_chars'] * profile['body_pt']
    output = {}
    for index, row in enumerate(rows):
        role = row['role']
        if row.get('protected') or role not in {'address', 'signature', 'date'}:
            continue
        ind = {'firstLine': 0, 'firstLineChars': 0, 'left': 0, 'right': 0}
        if role == 'address':
            ind.update(leftChars=0, rightChars=0)
        elif role == 'date':
            ind.update(right=round(date_inset * 20), rightChars=rule['date_right_chars'] * 100)
        else:
            following = next((r for r in rows[index + 1:] if r['text'].strip()), None)
            if following is None or following['role'] != 'date':
                continue
            center = width - date_inset - text_width(following['text'], profile) / 2
            if not 0 < center < width:
                continue
            half = min(center, width - center)
            ind.update(left=round((center - half) * 20), right=round((width - center - half) * 20))
        output[row['id']] = [
            ('ind', ind), ('jc', {'val': rule[role + '_alignment']}),
            ('outlineLvl', {'val': 9}), ('keepLines', {'val': 1}),
            ('keepNext', {'val': int(role in {'address', 'signature'})}),
        ]
    return output


def validate_letter_layout(document, expected, reviews=()):
    body = document.find('w:body', NS)
    good = True
    for bid, properties in expected.items():
        paragraph = body[int(bid[1:]) - 1]
        for tag, attrs in properties:
            node = paragraph.find('w:pPr/w:' + tag, NS)
            good &= node is not None and all(node.get(W + key) == str(value) for key, value in attrs.items())
    return Check(
        'LETTER_LAYOUT', 'fail' if not good else 'needs_review' if reviews else 'pass',
        ('主送与落款编排读回核验失败。' if not good else f'已编排{len(expected)}个主送、机关署名或成文日期段落；日期右空四字，署名按日期中心排布。')
        + ' '.join(reviews),
        actual={'blocks': list(expected), 'preserved': list(reviews), 'rule_version': layout_rule()['version']},
    )
