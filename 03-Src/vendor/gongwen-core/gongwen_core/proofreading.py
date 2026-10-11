"""Opt-in proofreading: untrusted suggestions, explicit selection, bounded edits."""
from copy import deepcopy
from difflib import SequenceMatcher
from hashlib import sha256
from io import BytesIO
import re
from zipfile import ZipFile
from lxml import etree
from .docx_formatter import prepare, serialize
from .field_ranges import protected_field_paragraphs
from .validation import NS, W


def paragraphs(data):
    _, document = prepare(data)
    fields = protected_field_paragraphs(document)
    result, skipped = [], 0
    body = document.find('w:body', NS)
    for index, p in enumerate(body.findall('.//w:p', NS)):
        text = ''.join(p.xpath('.//w:t/text()', namespaces=NS))
        if not text.strip():
            continue
        safe = (p.getparent() is body and p not in fields
                and all(n.tag in {W+'pPr', W+'r', W+'proofErr'} for n in p)
                and all(n.tag in {W+'rPr', W+'t'} for r in p.findall('w:r', NS) for n in r)
                and not p.xpath('.//w:pPrChange|.//w:rPrChange', namespaces=NS))
        if not safe:
            skipped += 1
            continue
        result.append({'id': f'p{index+1}', 'text': text})
    return result, skipped


def local_findings(rows):
    findings = []
    for row in rows:
        for match in re.finditer(r'([，。；：！？])\1+', row['text']):
            findings.append({'paragraph_id': row['id'], 'original': match.group(),
                             'replacement': match.group(1), 'category': 'punctuation',
                             'reason': '重复标点，请结合语境核对。'})
        # Do not mistake list markers and quoted fragments for certain errors.
        for left, right in [('（','）'),('“','”'),('《','》')]:
            if row['text'].count(left) != row['text'].count(right):
                findings.append({'paragraph_id': row['id'], 'original': row['text'][:60],
                                 'replacement': '', 'category': 'review',
                                 'reason': f'{left}{right}数量不匹配；可能跨段，请人工核对。'})
    return findings


def validate_findings(rows, raw, source):
    if not isinstance(raw, list) or len(raw) > 150:
        raise ValueError('检查结果格式不正确或建议数量超限。')
    texts = {r['id']: r['text'] for r in rows}
    result, seen = [], set()
    for item in raw:
        if not isinstance(item, dict):
            raise ValueError('检查结果包含无效建议。')
        pid, old, new = (item.get(k) for k in ('paragraph_id','original','replacement'))
        category, reason = item.get('category'), item.get('reason')
        if (not isinstance(pid,str) or pid not in texts or not isinstance(old,str) or not old or len(old)>120
                or not isinstance(new,str) or len(new)>120 or not isinstance(reason,str)
                or not reason or len(reason)>500 or not isinstance(category,str) or category not in {'typo','duplicate','punctuation','review','fact','term'}):
            raise ValueError('检查结果含越界或无法定位的建议，请重新检查。')
        text = texts[pid]
        if old not in text:
            raise ValueError('建议中的原文与文档不符，已拒绝本次结果。')
        key = (pid,old,new)
        if key in seen:
            continue
        seen.add(key)
        offset = text.find(old)
        edits = sum(max(b-a,d-c) for op,a,b,c,d in SequenceMatcher(None,old,new).get_opcodes() if op!='equal')
        sensitive = bool(re.search(r'[0-9A-Za-z０-９%％￥¥$元吨米克升年月日时分秒㎡³²]', old+new))
        allowed = bool(re.fullmatch(r'[\u4e00-\u9fff，。；：！？、（）“”《》]*', old+new))
        apply = (category in {'typo','duplicate'} and old != new and text.count(old)==1
                 and len(old)<=12 and len(new)<=12 and edits<=4 and allowed and not sensitive)
        result.append({'id':f's{len(result)+1}', 'paragraph_id':pid, 'original':old,
                       'replacement':new, 'reason':reason, 'category':category,
                       'source':source, 'start':offset, 'end':offset+len(old),
                       'applicable':apply, 'restriction': '' if apply else '仅供核对：涉及敏感字词、重复位置、标点或超出安全替换范围。'})
    return result


def apply_selected(data, expected_hash, findings, selected, replacements=None):
    if sha256(data).hexdigest() != expected_hash:
        raise ValueError('文档已变化，请重新检查。')
    if not selected or len(selected)!=len(set(selected)):
        raise ValueError('请选择建议且不要重复选择。')
    known = {item['id']:dict(item) for item in findings}
    replacements = replacements or {}
    if any(s not in selected for s in replacements):
        raise ValueError('修改文字必须绑定所选建议。')
    rows, _ = paragraphs(data)
    for key, value in replacements.items():
        item = known.get(key)
        if not item or item['category'] not in {'typo', 'duplicate', 'punctuation'}:
            raise ValueError('此项仅供核对，不能在此修改。')
        if not isinstance(value, str) or not value or len(value) > 12:
            raise ValueError('修改文字须为1至12个字符。')
        candidate = {**item, 'replacement': value}
        checked = validate_findings(rows, [candidate], 'user')[0]
        # Explicit user edits may collapse repeated punctuation, never rewrite a sentence.
        punctuation = (item['category'] == 'punctuation'
                       and re.fullmatch(r'([，。；：！？])\1+', item['original'])
                       and value == item['original'][0]
                       and sum(r['text'].count(item['original']) for r in rows if r['id']==item['paragraph_id']) == 1)
        if not checked['applicable'] and not punctuation:
            raise ValueError('修改超出安全范围；数字、事实、术语或不明确位置请在Word中核对。')
        known[key] = {**checked, 'id': key, 'applicable': True, 'restriction': '', 'source': 'user'}
    if any(s not in known or not known[s]['applicable'] for s in selected):
        raise ValueError('含未知或不可自动应用的建议。')
    texts = {r['id']:r['text'] for r in rows}
    groups = {}
    for key in selected:
        item = known[key]
        pid = item['paragraph_id']
        if pid not in texts or texts[pid][item['start']:item['end']] != item['original']:
            raise ValueError('原文定位失效，请重新检查。')
        groups.setdefault(pid,[]).append(item)
    package, document = prepare(data)
    original = deepcopy(document)
    ps = document.find('w:body',NS).findall('.//w:p',NS)
    expected = {}
    for pid, items in groups.items():
        items.sort(key=lambda s:s['start'])
        if any(a['end']>b['start'] for a,b in zip(items,items[1:])):
            raise ValueError('选中建议互相重叠，请每处只保留一个。')
        p = ps[int(pid[1:])-1]
        nodes = p.findall('w:r/w:t',NS)
        expected[pid] = texts[pid]
        for item in reversed(items):
            begin,end = item['start'],item['end']
            expected[pid] = expected[pid][:begin]+item['replacement']+expected[pid][end:]
            offset = 0
            for node in nodes:
                text = node.text or ''; stop = offset+len(text)
                if offset<end and stop>begin:
                    left,right = max(0,begin-offset),min(len(text),end-offset)
                    prefix = item['replacement'] if offset<=begin<stop else ''
                    node.text = text[:left]+prefix+text[right:]
                offset = stop
    # Check intended output and reverse only the explicitly edited text nodes.
    reverse = deepcopy(document)
    rps = reverse.find('w:body',NS).findall('.//w:p',NS)
    ops = original.find('w:body',NS).findall('.//w:p',NS)
    for pid, value in expected.items():
        idx = int(pid[1:])-1
        if ''.join(ps[idx].xpath('.//w:t/text()',namespaces=NS)) != value:
            raise ValueError('修改结果核验失败。')
        for new,old in zip(rps[idx].findall('w:r/w:t',NS),ops[idx].findall('w:r/w:t',NS),strict=True):
            new.text = old.text
    if etree.tostring(reverse,method='c14n') != etree.tostring(original,method='c14n'):
        raise ValueError('无关内容或格式发生变化，已阻止输出。')
    out = BytesIO()
    with ZipFile(BytesIO(data)) as source, ZipFile(out,'w') as target:
        for info in source.infolist():
            target.writestr(info,serialize(document) if info.filename=='word/document.xml' else source.read(info.filename))
    return out.getvalue(), [known[key] for key in selected]
