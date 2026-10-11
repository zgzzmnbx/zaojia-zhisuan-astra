"""Freeze supported Word list labels; keep uncertain lists intact and report them."""
from copy import deepcopy
import re
from lxml import etree
from .validation import NS, W
from .writer import element
from .field_ranges import protected_field_paragraphs


def chinese(n):
    if not 0 <= n <= 9999:
        raise ValueError('中文编号超出支持范围')
    if n == 0:
        return '零'
    digits, result, pending = '零一二三四五六七八九', '', False
    for power, unit in [(1000, '千'), (100, '百'), (10, '十'), (1, '')]:
        value, n = divmod(n, power)
        if value:
            if pending:
                result += '零'
            result += ('' if power == 10 and value == 1 and not result else digits[value]) + unit
            pending = False
        elif result and n:
            pending = True
    return result


def counter_text(value, kind):
    if kind == 'decimal':
        return str(value)
    if kind == 'decimalZero':
        return str(value).zfill(2)
    if kind in {'chineseCounting', 'chineseCountingThousand'}:
        return chinese(value)
    if kind in {'upperRoman', 'lowerRoman'} and 1 <= value <= 3999:
        text = ''
        for n, roman in [(1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),(50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]:
            count, value = divmod(value, n)
            text += roman * count
        return text.lower() if kind == 'lowerRoman' else text
    raise ValueError('不支持的编号格式：' + str(kind))


def flatten_numbering(document, numbering, styles, preserve_ids, body_pt, source_document=None):
    from .docx_formatter import style_property, replace_properties
    nodes = {s.get(W + 'styleId'): s for s in styles if s.tag == W + 'style'}
    source = source_document if source_document is not None else document
    body = source.find('w:body', NS)
    target_paragraphs = dict(zip(source.findall('.//w:p', NS), document.findall('.//w:p', NS), strict=True))
    ids = {p: f'b{i+1}' for i, p in enumerate(body)}
    fields = protected_field_paragraphs(source)
    plans, bad, state = {}, {}, {}

    def attr(parent, name, default=None):
        node = parent.find('w:' + name, NS)
        return node.get(W + 'val', default) if node is not None else default

    def level_def(num, abstract, level):
        override = num.find(f'w:lvlOverride[@w:ilvl="{level}"]', NS)
        lvl = override.find('w:lvl', NS) if override is not None else None
        if lvl is None:
            lvl = abstract.find(f'w:lvl[@w:ilvl="{level}"]', NS)
        if lvl is None or lvl.find('w:lvlPicBulletId', NS) is not None:
            raise ValueError('编号级别缺失或使用图片项目符号')
        start = int(attr(override, 'startOverride', attr(lvl, 'start', '0'))) if override is not None else int(attr(lvl, 'start', '0'))
        return lvl, start

    for p in body.findall('.//w:p', NS):
        ps = p.find('w:pPr/w:pStyle', NS)
        sid = ps.get(W + 'val', '') if ps is not None else ''
        def effective(name):
            direct = p.find('w:pPr/w:numPr/w:' + name, NS)
            return direct.get(W + 'val') if direct is not None else style_property(nodes, sid, 'w:pPr/w:numPr/w:' + name)
        num_id, ilvl = effective('numId'), effective('ilvl') or '0'
        if not num_id or num_id == '0':
            continue
        plans.setdefault(num_id, [])
        if num_id in bad:
            continue
        try:
            if p in fields or p.getparent() is not body or ids.get(p) in preserve_ids or p.xpath('.//w:ins|.//w:del|.//w:sdt|.//w:object|.//w:drawing|.//w:numPrChange|.//w:pPrChange', namespaces=NS):
                raise ValueError('编号序列含目录、保护对象、表格或指定保留段落')
            if not num_id.isdigit() or not ilvl.isdigit() or not 0 <= int(ilvl) <= 8 or numbering is None:
                raise ValueError('编号引用无效')
            level = int(ilvl)
            num = numbering.find(f'w:num[@w:numId="{num_id}"]', NS)
            aid = attr(num, 'abstractNumId') if num is not None else None
            abstract = numbering.find(f'w:abstractNum[@w:abstractNumId="{aid}"]', NS) if aid and aid.isdigit() else None
            if abstract is None or abstract.find('w:numStyleLink', NS) is not None or any(etree.QName(k).localname == 'restartNumberingAfterBreak' and v not in {'0','false','off'} for k,v in abstract.attrib.items()):
                raise ValueError('编号定义缺失、样式链接或分节重启需人工确认')
            lvl, start = level_def(num, abstract, level)
            counters = state.setdefault(num_id, {})
            counters[level] = counters.get(level, start - 1) + 1
            for deeper in list(counters):
                if deeper > level:
                    child, _ = level_def(num, abstract, deeper)
                    trigger = int(attr(child, 'lvlRestart', str(deeper)))
                    if trigger and level <= trigger - 1:
                        del counters[deeper]
            pattern = attr(lvl, 'lvlText')
            kind = attr(lvl, 'numFmt')
            if pattern is None or kind in {'bullet','none'}:
                raise ValueError('项目符号或空编号保留原样')
            # Validate even an unused current-level format.
            counter_text(counters[level], kind)
            def subst(match):
                ref = int(match.group(1)) - 1
                if ref > level:
                    raise ValueError('编号引用了更深层级')
                ref_lvl, ref_start = level_def(num, abstract, ref)
                legal = attr(lvl, 'isLgl')
                legal_node = lvl.find('w:isLgl', NS)
                fmt = 'decimal' if legal_node is not None and legal not in {'0','false','off'} else attr(ref_lvl, 'numFmt')
                return counter_text(counters.get(ref, ref_start), fmt)
            label = re.sub(r'%([1-9])', subst, pattern)
            if '%' in label:
                raise ValueError('无法解析的编号占位符')
            suffix = attr(lvl, 'suff', 'tab')
            if suffix not in {'tab','space','nothing'}:
                raise ValueError('无法解析的编号后缀')
            # Fixed whitespace cannot drift with Word tab stops.
            label += '' if suffix == 'nothing' else ' '
            plans[num_id].append((target_paragraphs[p], label))
        except (ValueError, TypeError, AttributeError) as error:
            bad[num_id] = str(error)

    changed = 0
    for num_id, items in plans.items():
        if num_id in bad:
            continue
        for p, label in items:
            original = deepcopy(p)
            ppr = p.find('w:pPr', NS)
            if ppr is None:
                ppr = element('pPr'); p.insert(0, ppr)
            cancellation = element('numPr'); cancellation.append(element('numId', val=0))
            replace_properties(ppr, {'numPr','ind'}, [cancellation, element('ind', left=0, right=0, firstLineChars=200, firstLine=int(body_pt*40))])
            run = element('r')
            rp = p.find('w:r/w:rPr', NS)
            if rp is not None:
                run.append(deepcopy(rp))
            text = element('t'); text.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve'); text.text = label
            run.append(text); p.insert(1, run)
            # Independent reverse check: only prefix, numPr and ind may differ.
            reverse = deepcopy(p); reverse.remove(reverse[1])
            rpp = reverse.find('w:pPr', NS)
            opp = original.find('w:pPr', NS)
            for key in ('numPr','ind'):
                for n in list(rpp):
                    if n.tag == W + key: rpp.remove(n)
            if opp is None:
                reverse.remove(rpp)
            else:
                # Restore original order, keeping all untouched property nodes.
                for i,n in enumerate(opp):
                    if n.tag in {W+'numPr',W+'ind'}: rpp.insert(i,deepcopy(n))
            if etree.tostring(reverse, method='c14n') != etree.tostring(original, method='c14n'):
                raise ValueError('编号转文字保真检查失败')
            changed += 1
    return changed, [f'编号组{key}：{reason}' for key,reason in bad.items()]
