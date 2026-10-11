"""Split explicit consecutive prose items, preserving and reversibly checking runs."""

from copy import deepcopy
from dataclasses import replace
from io import BytesIO
import re
from zipfile import ZipFile

from lxml import etree

from .field_ranges import protected_field_paragraphs
from .models import Check, FormatError
from .validation import NS, W, paragraph_text, read_package, xml

RULE_VERSION = '1.1.0'
MARKER = re.compile(r'（([1-9]\d{0,2}|[一二三四五六七八九十百]+)）|\(([1-9]\d{0,2})\)')
DECIMAL_MARKER = re.compile(r'(?<![\w.．])([1-9]\d{0,2})[.．](?![\d.．])')
HAN = re.compile(r'[\u3400-\u9fff]')
SECTION_LINE = re.compile(r'^[1-9]\d{0,2}(?:[.．]\d{1,3})*[.．]?\s+\S')
SECTION_TITLE = re.compile(r'^([1-9]\d{0,2}(?:[.．][1-9]\d{0,2}){0,3})[.．]?\s+([\u3400-\u9fff].*)$')
XML_SPACE = '{http://www.w3.org/XML/1998/namespace}space'
IDENTITIES = {'{http://schemas.microsoft.com/office/word/2010/wordml}paraId',
              '{http://schemas.microsoft.com/office/word/2010/wordml}textId'}


def _number(value):
    if value.isascii() and value.isdigit():
        return int(value)
    digits = {c: i for i, c in enumerate('零一二三四五六七八九')}
    total, digit = 0, 0
    for char in value:
        if char in digits:
            digit = digits[char]
        elif char in '十百':
            total += (digit or 1) * (10 if char == '十' else 100)
            digit = 0
        else:
            return None
    return total + digit


def _quoted_positions(text):
    # Quoted references are not item boundaries. Unbalanced quotes are ambiguous.
    quoted, stack = set(), []
    pairs = {'“': '”', '‘': '’', '「': '」', '『': '』'}
    for i, char in enumerate(text):
        if stack:
            quoted.add(i)
        if char in pairs:
            stack.append(pairs[char])
        elif stack and char == stack[-1]:
            stack.pop()
        elif char == '"':
            if stack and stack[-1] == '"':
                stack.pop()
            else:
                stack.append('"')
    if stack:
        return None
    return quoted


def _parenthesized_offsets(text):
    """Accept a leading series or a Chinese colon introduction followed by (1)."""
    matches = list(MARKER.finditer(text))
    if len(matches) < 2 or '`' in text:
        return []
    intro = text[:matches[0].start()].strip()
    if intro and (not intro.endswith(('：', ':')) or not HAN.search(intro)):
        return []
    quoted = _quoted_positions(text)
    if quoted is None:
        return []
    labels = [m.group(1) or m.group(2) for m in matches]
    family = ['arabic' if value.isascii() else 'chinese' for value in labels]
    numbers = [_number(value) for value in labels]
    if intro and numbers[0] != 1:
        return []
    if len(set(family)) != 1 or numbers != list(range(numbers[0], numbers[0] + len(numbers))):
        return []
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        item = text[match.end():end]
        if match.start() in quoted or len(HAN.findall(item)) < 4:
            return []
        if i:
            preceding = text[:match.start()].rstrip(' \t\u3000')
            if not preceding or preceding[-1] not in '。；！？\n\r':
                return []
    return ([matches[0].start()] if intro else []) + [m.start() for m in matches[1:]]


def _decimal_offsets(text):
    if '`' in text or MARKER.search(text):
        return []
    matches = list(DECIMAL_MARKER.finditer(text))
    if len(matches) < 2 or [int(m[1]) for m in matches] != list(range(1, len(matches) + 1)):
        return []
    intro = text[:matches[0].start()].strip()
    if intro and (not intro.endswith(('：', ':')) or not HAN.search(intro)):
        return []
    quoted = _quoted_positions(text)
    if quoted is None:
        return []
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        item = text[match.end():end]
        if match.start() in quoted or not any(char.isalpha() for char in item):
            return []
        # Decimal item boundaries must be explicit whitespace or sentence punctuation.
        if i and text[match.start() - 1] not in '。；！？;!? \t\u3000\n\r':
            return []
    return ([matches[0].start()] if intro else []) + [m.start() for m in matches[1:]]


def split_offsets(text, *, include_parenthesized=True, include_decimal=False):
    offsets = _parenthesized_offsets(text) if include_parenthesized else []
    return offsets or (_decimal_offsets(text) if include_decimal else [])


def section_number(text):
    """Short standalone Chinese numbered titles, not numeric prose or values."""
    match = SECTION_TITLE.fullmatch(text.strip())
    if not match or len(match[2]) > 60 or len(HAN.findall(match[2])) < 2:
        return None
    if re.search(r'[。；！？：:，,=％%]', match[2]):
        return None
    return tuple(int(part) for part in re.split('[.．]', match[1]))


def markdown_line_groups(runs):
    """Keep existing line boundaries around section headings and numbered prose.

    Called with soft breaks represented as newlines, only for ordinary Markdown
    paragraphs. Other wrapped prose keeps the normal Markdown soft-break policy.
    """
    if any(run.code or run.link or run.image for run in runs):
        return None
    text = ''.join(run.text for run in runs)
    lines = text.split('\n')
    if len(lines) < 2:
        return None
    starts_item = [bool(MARKER.match(line.lstrip()) and len(HAN.findall(line)) >= 4) for line in lines]
    has_series = [bool(split_offsets(line)) for line in lines]
    numbers = [section_number(line) for line in lines]
    # Require sibling progression or an explicit parent/child pair. A lone
    # decimal, IP, year or version line must not trigger paragraph restructuring.
    roots = set()
    candidates = {number for number in numbers if number}
    previous = None
    for number in (number for number in numbers if number):
        siblings = (previous and number[:-1] == previous[:-1] and number[-1] == previous[-1] + 1
                    and len(number) > 1 and (len(number) < 4 or number[:-1] in candidates))
        if previous and (siblings or number[:-1] == previous):
            roots.add(number[0])
        previous = number
    headings = [number if number and number[0] in roots and (len(number) < 4 or number[:-1] in candidates)
                else None for number in numbers]
    numbered_items = any(has_series) or sum(starts_item) >= 2
    if not numbered_items and not roots:
        return None
    is_section = [bool(len(line.strip()) <= 120 and SECTION_LINE.match(line.strip())) for line in lines]
    cuts, cursor = [], 0
    for index, line in enumerate(lines[:-1]):
        cursor += len(line)
        if (starts_item[index + 1] or has_series[index + 1] or headings[index + 1] or headings[index]
                or numbered_items and is_section[index + 1]):
            cuts.append(cursor)
        cursor += 1
    if not cuts:
        return None
    groups = []
    for left, right in zip([0, *[cut + 1 for cut in cuts]], [*cuts, len(text)]):
        group, offset = [], 0
        for run in runs:
            start, end = max(left - offset, 0), min(right - offset, len(run.text))
            if start < end:
                # Remaining source line wraps stay soft breaks, as before.
                group.append(replace(run, text=run.text[start:end].replace('\n', ' ')))
            offset += len(run.text)
        groups.append(group)
    # Independently compare inline style and character order, allowing only the
    # selected newline boundaries and ordinary soft-break whitespace projection.
    expected = [(char, run.bold, run.italic, run.strike) for run in runs for char in run.text]
    allowed = {cut for cut in cuts}
    expected = [((' ' if char == '\n' else char), bold, italic, strike)
                for i, (char, bold, italic, strike) in enumerate(expected) if i not in allowed]
    actual = [(char, run.bold, run.italic, run.strike) for group in groups for run in group for char in run.text]
    if actual != expected:
        raise FormatError('PARAGRAPH_SPLIT_FAILED', 'Markdown分段文字与格式核验失败，已阻止输出。')
    # Roles are attached only to an entire confirmed title line. In particular,
    # sentences such as "6.1 ...规定：" remain prose and retain their text.
    roles = []
    for group in groups:
        number = section_number(''.join(run.text for run in group))
        roles.append(f'heading{len(number)}' if number in headings and number else None)
    return groups, cuts, roles


def simple_paragraph(paragraph):
    """Only direct, nonempty text runs; every other object/range remains untouched."""
    if paragraph.xpath('./w:pPr/w:sectPr|./w:pPr/w:numPr|./w:pPr/w:pPrChange', namespaces=NS):
        return False
    runs = []
    for child in paragraph:
        if child.tag == W + 'pPr':
            continue
        if child.tag != W + 'r' or any(n.tag not in {W + 'rPr', W + 't'} for n in child):
            return False
        texts = child.findall('w:t', NS)
        if len(texts) != 1 or not texts[0].text or child.xpath('.//w:rPrChange', namespaces=NS):
            return False
        runs.append(child)
    return bool(runs)


def _canonical(node):
    # Detached copies do not inherit unused ancestor namespace declarations.
    return etree.tostring(node, method='c14n', exclusive=True)


def _fragments(paragraph, offsets):
    text = paragraph_text(paragraph)
    limits = [0, *offsets, len(text)]
    runs = paragraph.findall('w:r', NS)
    result, run_maps = [], []
    for part, (left, right) in enumerate(zip(limits, limits[1:])):
        fragment = deepcopy(paragraph)
        for run in fragment.findall('w:r', NS):
            fragment.remove(run)
        if part:
            for attr in IDENTITIES:
                fragment.attrib.pop(attr, None)
        cursor, mapping = 0, []
        for index, run in enumerate(runs):
            value = run.find('w:t', NS).text
            start, stop = max(left - cursor, 0), min(right - cursor, len(value))
            if start < stop:
                copy = deepcopy(run)
                node = copy.find('w:t', NS)
                node.text = value[start:stop]
                if node.text[:1].isspace() or node.text[-1:].isspace():
                    node.set(XML_SPACE, 'preserve')
                fragment.append(copy)
                mapping.append(index)
            cursor += len(value)
        result.append(fragment)
        run_maps.append(mapping)
    return result, run_maps


def _restore_checked(original, fragments, run_maps):
    """Read emitted fragments, reconstruct each original run, then compare full XML."""
    source_runs = original.findall('w:r', NS)
    chunks = [[] for _ in source_runs]
    original_props = original.find('w:pPr', NS)
    for part, (fragment, mapping) in enumerate(zip(fragments, run_maps)):
        expected_attrs = dict(original.attrib)
        if part:
            expected_attrs = {k: v for k, v in expected_attrs.items() if k not in IDENTITIES}
        if dict(fragment.attrib) != expected_attrs:
            raise ValueError('paragraph attributes changed')
        props = fragment.find('w:pPr', NS)
        if (props is None) != (original_props is None) or (props is not None and _canonical(props) != _canonical(original_props)):
            raise ValueError('paragraph properties changed')
        runs = fragment.findall('w:r', NS)
        if len(runs) != len(mapping) or len(fragment) != len(runs) + int(props is not None):
            raise ValueError('unexpected fragment structure')
        for run, index in zip(runs, mapping):
            source = source_runs[index]
            node = run.find('w:t', NS)
            if node is None:
                raise ValueError('missing text')
            expected_space = source.find('w:t', NS).get(XML_SPACE)
            if (node.text or '')[:1].isspace() or (node.text or '')[-1:].isspace():
                expected_space = 'preserve'
            if node.get(XML_SPACE) != expected_space:
                raise ValueError('text whitespace policy changed')
            chunks[index].append(node.text or '')
            restored_run = deepcopy(run)
            target = restored_run.find('w:t', NS)
            target.text = source.find('w:t', NS).text
            # Only boundary whitespace preservation is an authorized attribute change.
            original_space = source.find('w:t', NS).get(XML_SPACE)
            if original_space is None:
                target.attrib.pop(XML_SPACE, None)
            else:
                target.set(XML_SPACE, original_space)
            if _canonical(restored_run) != _canonical(source):
                raise ValueError('run formatting or object changed')
    restored = deepcopy(fragments[0])
    for run in restored.findall('w:r', NS):
        restored.remove(run)
    for source, values in zip(source_runs, chunks):
        if ''.join(values) != source.find('w:t', NS).text:
            raise ValueError('run text or order changed')
        restored.append(deepcopy(source))
    if _canonical(restored) != _canonical(original):
        raise ValueError('paragraph reconstruction differs')
    return restored


def split_numbered_paragraphs(data, allowed_ids, *, include_parenthesized=True, include_decimal=False):
    package = read_package(data)
    document = xml(package['word/document.xml'])
    before = deepcopy(document)
    body = document.find('w:body', NS)
    fields = protected_field_paragraphs(document)
    changes, skipped, groups, mapping = [], [], [], {}
    output_index = 0
    for source_index, paragraph in enumerate(list(body)):
        bid = f'b{source_index + 1}'
        offsets = split_offsets(paragraph_text(paragraph), include_parenthesized=include_parenthesized, include_decimal=include_decimal) if paragraph.tag == W + 'p' else []
        if offsets and (bid not in allowed_ids or paragraph in fields or not simple_paragraph(paragraph)):
            skipped.append(bid)
            offsets = []
        if offsets:
            fragments, run_maps = _fragments(paragraph, offsets)
            position = body.index(paragraph)
            body.remove(paragraph)
            for part, fragment in enumerate(fragments):
                body.insert(position + part, fragment)
            ids = [f'b{output_index + part + 1}' for part in range(len(fragments))]
            changes.append({'source_block_id': bid, 'output_block_ids': ids, 'split_offsets': offsets})
            groups.append((output_index, deepcopy(paragraph), run_maps))
            mapping[bid] = ids
            output_index += len(fragments)
        else:
            mapping[bid] = [f'b{output_index + 1}']
            output_index += 1
    if changes:
        out = BytesIO()
        with ZipFile(BytesIO(data)) as source, ZipFile(out, 'w') as target:
            for info in source.infolist():
                target.writestr(info, etree.tostring(document, encoding='UTF-8', xml_declaration=True, standalone=True)
                                if info.filename == 'word/document.xml' else source.read(info.filename))
        data = out.getvalue()
        emitted = read_package(data)
        restored = xml(emitted['word/document.xml'])
        restored_body = restored.find('w:body', NS)
        try:
            for index, original, run_maps in reversed(groups):
                fragments = list(restored_body)[index:index + len(run_maps)]
                rebuilt = _restore_checked(original, fragments, run_maps)
                for fragment in fragments:
                    restored_body.remove(fragment)
                restored_body.insert(index, rebuilt)
            if etree.tostring(restored, method='c14n') != etree.tostring(before, method='c14n') or any(
                emitted.get(name) != value for name, value in package.items() if name != 'word/document.xml'
            ):
                raise ValueError('document or package differs after reversal')
        except (ValueError, IndexError, AttributeError) as error:
            raise FormatError('PARAGRAPH_SPLIT_FAILED', '自动分段保真核验失败，已阻止输出。') from error
    check = Check('NUMBERED_PARAGRAPH_SPLIT', 'needs_review' if skipped else 'pass',
                  f'已将{len(changes)}个连续标号段落拆为独立段落，保留文字、序号及逐run格式；{len(skipped)}个保护或不适用段落保持原样。',
                  actual={'rule_version': RULE_VERSION, 'parenthesized_enabled': include_parenthesized, 'decimal_enabled': include_decimal, 'changes': changes, 'preserved_block_ids': skipped,
                          'block_mapping': mapping})
    return data, check, mapping


def remap_outline(outline, mapping, data):
    body = xml(read_package(data)['word/document.xml']).find('w:body', NS)
    return [{**row, 'id': bid, 'text': paragraph_text(body[int(bid[1:]) - 1])}
            for row in outline for bid in mapping.get(row['id'], [row['id']])]
