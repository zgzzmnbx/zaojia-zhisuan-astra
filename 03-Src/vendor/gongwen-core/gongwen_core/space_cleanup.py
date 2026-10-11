"""Conservative local removal of single ASCII spaces outside Chinese quotations."""
from copy import deepcopy
from io import BytesIO
import re
from zipfile import ZipFile
from lxml import etree
from .validation import NS, W, xml, read_package, paragraph_text
from .field_ranges import protected_field_paragraphs
from .models import Check, FormatError

HAN = r'\u3400-\u4dbf\u4e00-\u9fff'
QUOTATION = re.compile(r'[“‘]([' + HAN + r'、，；：！？。]{1,40})[”’]')
SPACES = re.compile(r'[ \u00a0\u3000\u200b\u202f\ufeff]+')


def is_han(char):
    return bool(re.fullmatch('['+HAN+']',char))


def candidates(text):
    # Do not infer separators inside book titles or inline code.
    if '`' in text:
        return set()
    protected = [(m.start(),m.end()) for m in re.finditer(r'《[^《》]*》',text)]
    delete = set()
    for match in QUOTATION.finditer(text):
        if (text[match.start()],text[match.end()-1]) not in {('“','”'),('‘','’')}:
            continue
        if any(a <= match.start() < b for a,b in protected):
            continue
        start,end = match.span()
        if start>=2 and text[start-1]==' ' and is_han(text[start-2]): delete.add(start-1)
        if end+1<len(text) and text[end]==' ' and is_han(text[end+1]): delete.add(end)
    return delete


def clean_spaces(data, allowed_ids):
    package = read_package(data)
    document = xml(package['word/document.xml'])
    original = deepcopy(document)
    body = document.find('w:body',NS)
    fields = protected_field_paragraphs(document)
    changed_nodes = []
    changes, reviews = [], []
    skipped = 0
    for index,p in enumerate(body):
        if p.tag != W+'p': continue
        text = paragraph_text(p)
        gaps = list(SPACES.finditer(text))
        if not gaps: continue
        bid = f'b{index+1}'
        safe = (bid in allowed_ids and p not in fields
                and all(n.tag in {W+'pPr',W+'r',W+'proofErr'} for n in p)
                and all(n.tag in {W+'rPr',W+'t'} for r in p.findall('w:r',NS) for n in r)
                and not p.xpath('.//w:rPrChange|.//w:pPrChange',namespaces=NS)
                and not re.search(r'[`A-Za-z0-9=<>]',text)
                and any(c in text for c in '，。；！？'))
        if not safe:
            skipped += 1
            continue
        delete = candidates(text)
        for gap in gaps:
            a,b = gap.span()
            before = text[max(0,a-14):min(len(text),b+14)]
            after = ''.join(c for j,c in enumerate(text[max(0,a-14):min(len(text),b+14)],max(0,a-14)) if j not in delete)
            entry = {'block_id':bid,'offset':a,'before':before.replace(' ','␠'),
                     'after':after.replace(' ','␠'),'reason':'中文连续语句中引号外侧的单个半角空格'}
            if a in delete and b==a+1:
                changes.append(entry)
            elif (a==0 or b==len(text) or b-a>1 or
                  (is_han(text[a-1]) or text[a-1] in '：，。；！？“”‘’《》') and
                  (is_han(text[b]) or text[b] in '：，。；！？“”‘’《》')):
                entry.update(after=entry['before'],reason='可能是标题分节、排版留白或特殊空格；保持原样')
                reviews.append(entry)
        offset = 0
        for node_index,node in enumerate(p.findall('w:r/w:t',NS)):
            value = node.text or ''
            edited = ''.join(c for j,c in enumerate(value,offset) if j not in delete)
            if edited != value:
                changed_nodes.append((index,node_index,value))
                node.text = edited
            offset += len(value)
        expected = ''.join(c for j,c in enumerate(text) if j not in delete)
        if paragraph_text(p)!=expected or text.replace(' ','')!=expected.replace(' ',''):
            raise FormatError('SPACE_CLEANUP_FAILED','空格清理内容核验失败，已阻止输出。')
    # Restore only modified text, then require every other XML node/attribute to match.
    reverse = deepcopy(document)
    reverse_body = reverse.find('w:body',NS)
    for index,node_index,value in changed_nodes:
        reverse_body[index].findall('w:r/w:t',NS)[node_index].text = value
    if etree.tostring(reverse,method='c14n') != etree.tostring(original,method='c14n'):
        raise FormatError('SPACE_CLEANUP_FAILED','空格清理改变了无关结构，已阻止输出。')
    if changes:
        output=BytesIO()
        with ZipFile(BytesIO(data)) as source, ZipFile(output,'w') as target:
            for info in source.infolist():
                target.writestr(info,etree.tostring(document,encoding='UTF-8',xml_declaration=True,standalone=True)
                                if info.filename=='word/document.xml' else source.read(info.filename))
        data=output.getvalue()
    check=Check('SPACE_CLEANUP','needs_review' if reviews else 'pass',
                f'已清理{len(changes)}处中文引号外侧空格；{len(reviews)}处疑似空格保留待核对，另有{skipped}个含空格的非正文或保护段落未处理。未改变非空格文字。',
                actual={'changes':changes,'preserved':reviews,'skipped_paragraphs':skipped})
    return data,check
