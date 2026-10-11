"""Persist the actual report text/tables as a versioned Markdown conversion source."""
import hashlib
import io
import json
import sys
from datetime import datetime
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml import parse_xml
from lxml import etree

sys.path.insert(0,str(Path(__file__).resolve().parent/'vendor/gongwen-core'))
from gongwen_core.plain_numbering import flatten_numbering

MAIN_HEADINGS={'一、项目基本情况','二、计费依据','三、计算内容','四、需要汇报的其他事项','五、其他需要注意的事项'}

def document_markdown(document):
    # Materialize real Word list labels in memory with the reused official core.
    # Never save this intermediate document back over the business report.
    xml=etree.fromstring(etree.tostring(document.element))
    numbering=etree.fromstring(etree.tostring(document.part.numbering_part.element))
    styles=etree.fromstring(etree.tostring(document.styles.element))
    _,skipped=flatten_numbering(xml,numbering,styles,set(),14)
    if skipped:raise RuntimeError('报告自动编号未能完整转换：'+'；'.join(skipped))
    document._element=parse_xml(etree.tostring(xml))
    lines=['# 招标控制价复核报告','']
    risk=False
    for element in document.element.body.iterchildren():
        if element.tag.endswith('}p'):
            text=Paragraph(element,document).text.strip()
            if not text:continue
            compact=''.join(text.split())
            if compact in MAIN_HEADINGS:
                lines.extend(['## '+text,'']);risk=False
            elif text in {'大模型风险提示','造价智算匹配报告'}:
                lines.extend(['### '+text,'']);risk=text=='大模型风险提示'
            elif risk and any(text.lstrip('#* ').startswith(prefix) for prefix in ['一、本次处理结论','二、主要风险概览','三、重点复核建议','四、规则依据提示','五、后续处理建议']):
                lines.extend(['#### '+text.lstrip('#* ').rstrip('*'),''])
            else:
                lines.extend([text,''])
        elif element.tag.endswith('}tbl'):
            rows=[[cell.text.replace('|','\\|').replace('\n','<br>') for cell in row.cells] for row in Table(element,document).rows]
            if rows:
                lines.append('| '+' | '.join(rows[0])+' |')
                lines.append('| '+' | '.join('---' for _ in rows[0])+' |')
                lines.extend('| '+' | '.join(row)+' |' for row in rows[1:])
                lines.append('')
    return '\n'.join(lines).rstrip()+'\n'

def atomic_write(path,data):
    pending=path.with_name(path.name+'.tmp')
    pending.write_bytes(data)
    pending.replace(path)

def persist(directory,word_path,result):
    directory=Path(directory)
    word_path=Path(word_path)
    word_path.resolve().relative_to(directory.resolve())
    word=word_path.read_bytes()
    markdown=document_markdown(Document(io.BytesIO(word)))
    data=markdown.encode('utf-8');sha=hashlib.sha256(data).hexdigest()
    versions=directory/'astra-risk-reports';versions.mkdir(exist_ok=True)
    archive=versions/(sha+'.md')
    if not archive.exists():atomic_write(archive,data)
    receipt={'markdown_filename':'risk-report.md','markdown_sha256':sha,
             'source_word_filename':word_path.name,'source_word_sha256':hashlib.sha256(word).hexdigest(),
             'generated_by_model':bool(result.get('generated_by_model')),
             'risk_report_mode':result.get('risk_report_mode'),
             'model_provider':result.get('model_provider'),'model':result.get('model'),
             'created_at':datetime.now().astimezone().isoformat(timespec='seconds'),
             'model_scope':'五、其他需要注意的事项 / 大模型风险提示',
             'deterministic_scope':'原Word正文及表格，原匹配摘要和结构化复核事实'}
    atomic_write(versions/(sha+'.json'),json.dumps(receipt,ensure_ascii=False,indent=2).encode('utf-8'))
    atomic_write(directory/'risk-report.md',data)
    atomic_write(directory/'risk-report-source.json',json.dumps(receipt,ensure_ascii=False,indent=2).encode('utf-8'))
    return {'risk_report_markdown':markdown,'markdown_filename':'risk-report.md','markdown_sha256':sha,
            'risk_report_markdown_filename':'risk-report.md','risk_report_markdown_sha256':sha}
