"""Recognize a trailing attachment explanation; preserve every original character."""
import re
from dataclasses import replace

from .letter_layout import organization, document_date, text_width
from .models import Check
from .validation import NS, W

FIRST = re.compile(r'^(附件[：:])\s*(?:(\d{1,3})[.．]\s*)?(\S.*)$')
NEXT = re.compile(r'^\s*(\d{1,3})[.．]\s*(\S.*)$')


def attachment_line_groups(runs):
    """Keep explicit line breaks only for a complete attachment/closing group."""
    if any(r.code or r.link or r.image for r in runs):
        return None
    text = ''.join(r.text for r in runs)
    lines = text.split('\n')
    if len(lines) < 2 or not FIRST.fullmatch(lines[0]):
        return None
    rows = [{'id': f'b{i+1}', 'role': 'body', 'text': line} for i, line in enumerate(lines)]
    identified = attachment_roles(rows)
    if not identified:
        return None
    groups, start = [], 0
    for line in lines:
        end, offset, group = start + len(line), 0, []
        for run in runs:
            left, right = max(start - offset, 0), min(end - offset, len(run.text))
            if left < right:
                group.append(replace(run, text=run.text[left:right]))
            offset += len(run.text)
        groups.append(group)
        start = end + 1
    expected = [(c, r.bold, r.italic, r.strike) for r in runs for c in r.text if c != '\n']
    actual = [(c, r.bold, r.italic, r.strike) for g in groups for r in g for c in r.text]
    if expected != actual:
        from .models import FormatError
        raise FormatError('ATTACHMENT_SPLIT_FAILED', '附件换行文字与格式核验失败，已阻止输出。')
    return groups


def attachment_roles(rows):
    rows = [r for r in rows if r['text'].strip()]
    result = {}
    for i, row in enumerate(rows):
        match = FIRST.fullmatch(row['text'])
        if not match or row.get('protected') or row['role'] not in {'body', 'attachment'}:
            continue
        if '\n' in row['text'] or len(match[3]) > 500 or match[3].endswith(('。', '！', '？')):
            continue
        group = [row]
        number = int(match[2]) if match[2] else None
        if number is not None and number != 1:
            continue
        j = i + 1
        while number is not None and j < len(rows):
            following = rows[j]
            item = NEXT.fullmatch(following['text'])
            if (not item or int(item[1]) != number + 1 or following.get('protected')
                    or following['role'] not in {'body', 'list', 'heading3', 'attachment'}
                    or item[2].endswith(('。', '！', '？'))):
                break
            group.append(following)
            number += 1
            j += 1
        tail = rows[j:]
        # Require an end-of-body group, optionally followed by one closing pair.
        if tail and not (len(tail) == 2 and organization(tail[0]['text']) and document_date(tail[1]['text'])):
            continue
        for member in group:
            result[member['id']] = 'attachment'
    return result


def attachment_properties(rows, profile):
    if not profile.get('attachment_layout'):
        return {}
    output, target = {}, None
    for row in rows:
        if row['role'] != 'attachment':
            target = None
            continue
        text = row['text']
        first, following = FIRST.fullmatch(text), NEXT.fullmatch(text)
        match = first or following
        if not match:
            target = None
            continue
        name = match[3] if first else match[2]
        prefix = text[:match.start(3 if first else 2)]
        # text_width trims input for labels; keep the whitespace in this prefix.
        prefix_width = text_width(prefix, profile, strip=False)
        if first:
            target = profile['body_pt'] * 2 + prefix_width
        if target is None or prefix_width > target:
            continue
        output[row['id']] = [
            ('ind', {'left': round(target * 20), 'right': 0, 'hanging': round(prefix_width * 20)}),
            ('spacing', {'before': profile['line_pt'] * 20 if first else 0, 'after': 0,
                         'line': profile['line_pt'] * 20, 'lineRule': 'exact'}),
            ('jc', {'val': 'left'}), ('outlineLvl', {'val': 9}),
            ('keepNext', {'val': 0}), ('keepLines', {'val': 0}),
        ]
    return output


def validate_attachments(document, expected):
    body = document.find('w:body', NS)
    good = all(
        (node := body[int(bid[1:]) - 1].find('w:pPr/w:' + tag, NS)) is not None
        and all(node.get(W + key) == str(value) for key, value in attrs.items())
        for bid, properties in expected.items() for tag, attrs in properties
    )
    return Check('ATTACHMENT_LAYOUT', 'pass' if good else 'fail',
                 f'已读回{len(expected)}个附件说明段落的组前留白与名称续行对齐；原文字和序号保留。',
                 actual={'block_ids': list(expected), 'rule_version': '1.0.0'})
