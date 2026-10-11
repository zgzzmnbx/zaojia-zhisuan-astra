"""Convert unambiguous Chinese prose punctuation without rebuilding OOXML runs."""

from copy import deepcopy
from io import BytesIO
import re
from zipfile import ZipFile

from lxml import etree

from .field_ranges import protected_field_paragraphs
from .models import Check, FormatError
from .validation import NS, W, paragraph_text, read_package, xml


HAN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")
QUOTE_PAIR = re.compile(r'"([^"\r\n]{1,200})"')
PAREN_PAIR = re.compile(r'\(([^()\r\n]{1,200})\)')


def replacements(text):
    """Return only paired ASCII marks surrounding Chinese prose."""
    if '`' in text:
        return {}
    result = {}
    for pattern, left, right in ((QUOTE_PAIR, '“', '”'), (PAREN_PAIR, '（', '）')):
        for match in pattern.finditer(text):
            if not HAN.search(match.group(1)):
                continue
            start, end = match.span()
            before = text[start - 1] if start else ''
            after = text[end] if end < len(text) else ''
            # Embedded pairs need Chinese prose nearby; English and technical
            # quotations are deliberately left for manual review.
            if (before or after) and not any(HAN.fullmatch(c) or c in '，。；：！？、‘’“”' for c in (before, after) if c):
                continue
            result[start] = left
            result[end - 1] = right
    return result


def convert_chinese_punctuation(data, allowed_ids):
    package = read_package(data)
    document = xml(package['word/document.xml'])
    original = deepcopy(document)
    body = document.find('w:body', NS)
    fields = protected_field_paragraphs(document)
    changed_nodes = []
    changes = []
    skipped = 0
    for index, paragraph in enumerate(body):
        if paragraph.tag != W + 'p':
            continue
        text = paragraph_text(paragraph)
        if '"' not in text and '(' not in text:
            continue
        bid = f'b{index + 1}'
        safe = (
            bid in allowed_ids and paragraph not in fields
            and all(node.tag in {W + 'pPr', W + 'r', W + 'proofErr'} for node in paragraph)
            and all(node.tag in {W + 'rPr', W + 't'} for run in paragraph.findall('w:r', NS) for node in run)
            and not paragraph.xpath('.//w:rPrChange|.//w:pPrChange', namespaces=NS)
        )
        if not safe:
            skipped += 1
            continue
        edits = replacements(text)
        if not edits:
            continue
        offset = 0
        for node_index, node in enumerate(paragraph.findall('w:r/w:t', NS)):
            value = node.text or ''
            edited = ''.join(edits.get(position, char) for position, char in enumerate(value, offset))
            if edited != value:
                changed_nodes.append((index, node_index, value))
                node.text = edited
            offset += len(value)
        expected = ''.join(edits.get(position, char) for position, char in enumerate(text))
        if paragraph_text(paragraph) != expected:
            raise FormatError('PUNCTUATION_CONVERSION_FAILED', '中文标点转换内容核验失败，已阻止输出。')
        for position in sorted(edits):
            changes.append({'block_id': bid, 'offset': position, 'before': text[position], 'after': edits[position]})
    reverse = deepcopy(document)
    reverse_body = reverse.find('w:body', NS)
    for index, node_index, value in changed_nodes:
        reverse_body[index].findall('w:r/w:t', NS)[node_index].text = value
    if etree.tostring(reverse, method='c14n') != etree.tostring(original, method='c14n'):
        raise FormatError('PUNCTUATION_CONVERSION_FAILED', '中文标点转换改变了无关结构，已阻止输出。')
    if changes:
        output = BytesIO()
        with ZipFile(BytesIO(data)) as source, ZipFile(output, 'w') as target:
            for info in source.infolist():
                target.writestr(
                    info,
                    etree.tostring(document, encoding='UTF-8', xml_declaration=True, standalone=True)
                    if info.filename == 'word/document.xml' else source.read(info.filename),
                )
        data = output.getvalue()
    check = Check(
        'CHINESE_PUNCTUATION', 'pass',
        f'已转换{len(changes) // 2}组成对的中文引号或括号；{skipped}个非普通段落或保护段落未处理。未配对、英文及不明确标点保留原样。',
        actual={'changes': changes, 'skipped_paragraphs': skipped},
    )
    return data, check
