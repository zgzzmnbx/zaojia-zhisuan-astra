"""Add native outside page fields without rewriting any existing footer."""
from copy import deepcopy
from io import BytesIO
from zipfile import ZipFile
from lxml import etree
from importlib.resources import files
import json
from .validation import read_package, xml, NS, W
from .writer import element, font_props
from .models import Check

R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
CT = 'http://schemas.openxmlformats.org/package/2006/content-types'


def page_number_rule():
    return json.loads(files('gongwen_core').joinpath('rules', 'page_numbers.json').read_text(encoding='utf-8'))


def footer_xml(alignment):
    rule = page_number_rule()
    root = etree.Element(W + 'ftr', nsmap={'w': NS['w']})
    p = element('p')
    root.append(p)
    pp = element('pPr')
    pp.extend([element('spacing', before=0, after=0, line=rule['line_pt'] * 20, lineRule='exact'), element('ind', firstLine=0, firstLineChars=0,
                       leftChars=rule['outside_chars'] * 100 if alignment == 'left' else 0,
                       rightChars=rule['outside_chars'] * 100 if alignment == 'right' else 0), element('jc', val=alignment)])
    p.append(pp)
    for text, field in [('— ', False), (rule['field_instruction'], True), (' —', False)]:
        run = element('r')
        rp = element('rPr')
        font_props(rp, rule['font'], rule['size_pt'], rule['font'])
        run.append(rp)
        if field:
            run.append(element('fldChar', fldCharType='begin'))
            instruction = element('instrText')
            instruction.text = text
            instruction.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
            run.append(instruction)
            run.append(element('fldChar', fldCharType='separate'))
            cached = element('t')
            cached.text = '1'
            run.append(cached)
            run.append(element('fldChar', fldCharType='end'))
        else:
            node = element('t')
            node.text = text
            node.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
            run.append(node)
        p.append(run)
    return root


def add_page_numbers(data, enabled=True):
    if not enabled:
        return data, Check('PAGE_NUMBERS', 'pass', '已关闭新增页码；原有页脚及页码保留。')
    package = read_package(data)
    document = xml(package['word/document.xml'])
    sections = document.findall('.//w:sectPr', NS)
    if document.findall('.//w:sectPr/w:footerReference', NS):
        return data, Check('PAGE_NUMBERS', 'needs_review', '原稿已有页脚，完整保留；请核对原页码是否为四号宋体、奇右偶左及左右各一字线。')
    if 'word/settings.xml' not in package or 'word/_rels/document.xml.rels' not in package:
        return data, Check('PAGE_NUMBERS', 'needs_review', '原稿缺少标准设置或关系部件，保留原包；页码请在Word中核对。')
    settings = xml(package['word/settings.xml'])
    parity = settings.find('w:evenAndOddHeaders', NS)
    parity_on = parity is not None and parity.get(W + 'val', '1').lower() not in {'0', 'false', 'off'}
    if (not sections or document.xpath('.//w:sectPr/w:pgSz[@w:orient="landscape"]', namespaces=NS)
            or (document.findall('.//w:sectPr/w:headerReference', NS)
                and not parity_on)):
        return data, Check('PAGE_NUMBERS', 'needs_review', '文稿分节或页眉配置需要人工核对，保留原包；未新增页码。')
    rels = xml(package['word/_rels/document.xml.rels'])
    types = xml(package['[Content_Types].xml'])
    originals = {name: deepcopy(node) for name, node in [
        ('word/document.xml', document), ('word/settings.xml', settings),
        ('word/_rels/document.xml.rels', rels), ('[Content_Types].xml', types)]}
    used = {r.get('Id') for r in rels}
    added_parts, added_ids = [], []
    for alignment in ['right', 'left']:
        index = 1
        while f'word/gwPageFooter{index}.xml' in package:
            index += 1
        name = f'word/gwPageFooter{index}.xml'
        rid_index = 1
        while f'rIdGWPage{rid_index}' in used:
            rid_index += 1
        rid = f'rIdGWPage{rid_index}'
        used.add(rid)
        added_ids.append(rid)
        added_parts.append(name)
        package[name] = etree.tostring(footer_xml(alignment), xml_declaration=True, encoding='UTF-8')
        etree.SubElement(rels, '{' + REL + '}Relationship', Id=rid, Type=R + '/footer', Target=name.removeprefix('word/'))
        etree.SubElement(types, '{' + CT + '}Override', PartName='/' + name,
                         ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml')
    for section in sections:
        for kind, rid in [('default', added_ids[0]), ('even', added_ids[1])]:
            ref = element('footerReference', type=kind)
            ref.set('{' + R + '}id', rid)
            section.insert(0, ref)
        if section.find('w:titlePg', NS) is not None:
            ref = element('footerReference', type='first')
            ref.set('{' + R + '}id', added_ids[0])
            section.insert(0, ref)
    added_setting = parity is None
    if added_setting:
        node = element('evenAndOddHeaders', val=1)
        successors = {'bookFoldRevPrinting', 'bookFoldPrinting', 'bookFoldPrintingSheets',
                      'drawingGridHorizontalSpacing', 'drawingGridVerticalSpacing', 'displayHorizontalDrawingGridEvery',
                      'displayVerticalDrawingGridEvery', 'doNotUseMarginsForDrawingGridOrigin', 'drawingGridHorizontalOrigin',
                      'drawingGridVerticalOrigin', 'doNotShadeFormData', 'noPunctuationKerning', 'characterSpacingControl',
                      'printTwoOnOne', 'strictFirstAndLastChars', 'noLineBreaksAfter', 'noLineBreaksBefore',
                      'savePreviewPicture', 'doNotValidateAgainstSchema', 'saveInvalidXml', 'ignoreMixedContent',
                      'alwaysShowPlaceholderText', 'doNotDemarcateInvalidXml', 'saveXmlDataOnly', 'useXSLTWhenSaving',
                      'saveThroughXslt', 'showXMLTags', 'alwaysMergeEmptyNamespace', 'updateFields', 'hdrShapeDefaults',
                      'footnotePr', 'endnotePr', 'compat', 'docVars', 'rsids', 'mathPr', 'themeFontLang',
                      'clrSchemeMapping', 'doNotIncludeSubdocsInStats', 'doNotAutoCompressPictures', 'forceUpgrade'}
        following = next((c for c in settings if etree.QName(c).localname in successors), None)
        settings.insert(settings.index(following) if following is not None else len(settings), node)
    elif not parity_on:
        parity.set(W + 'val', '1')
    for name, node in [('word/document.xml', document), ('word/settings.xml', settings),
                       ('word/_rels/document.xml.rels', rels), ('[Content_Types].xml', types)]:
        package[name] = etree.tostring(node, xml_declaration=True, encoding='UTF-8', standalone=True)
    out = BytesIO()
    with ZipFile(BytesIO(data)) as source, ZipFile(out, 'w') as target:
        for info in source.infolist():
            target.writestr(info, package[info.filename])
        for name in added_parts:
            target.writestr(name, package[name])
    result = out.getvalue()
    reread = read_package(result)
    restored = {name: xml(reread[name]) for name in originals}
    for ref in restored['word/document.xml'].findall('.//w:footerReference', NS):
        if ref.get('{' + R + '}id') in added_ids:
            ref.getparent().remove(ref)
    if added_setting:
        node = restored['word/settings.xml'].find('w:evenAndOddHeaders', NS)
        node.getparent().remove(node)
    elif not parity_on:
        node = restored['word/settings.xml'].find('w:evenAndOddHeaders', NS)
        parent = node.getparent()
        index = parent.index(node)
        parent.remove(node)
        parent.insert(index, deepcopy(originals['word/settings.xml'].find('w:evenAndOddHeaders', NS)))
    for name, attr, values in [('word/_rels/document.xml.rels', 'Id', added_ids),
                               ('[Content_Types].xml', 'PartName', ['/' + n for n in added_parts])]:
        for node in list(restored[name]):
            if node.get(attr) in values:
                restored[name].remove(node)
    good = all(etree.tostring(restored[n], method='c14n') == etree.tostring(v, method='c14n')
               for n, v in originals.items())
    good &= all(v == reread[n] for n, v in read_package(data).items() if n not in originals)
    good &= all(etree.tostring(xml(reread[n]), method='c14n') == etree.tostring(footer_xml(a), method='c14n')
                for n, a in zip(added_parts, ['right', 'left']))
    return result, Check('PAGE_NUMBERS', 'pass' if good else 'fail',
                         '已新增四号宋体原生PAGE域，左右各一字线，奇数页右侧、偶数页左侧各空一字；反向还原核验原包。',
                         actual={'rule_version': '1.0.0', 'added_parts': added_parts})
