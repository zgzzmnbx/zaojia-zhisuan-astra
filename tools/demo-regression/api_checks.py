"""Exercise real local business services; no mocked price/risk/report results."""
import importlib.util
import io
import json
import socket
import sys
from pathlib import Path
from common import Results, require, sha, write

OUT = Path(sys.argv[1]).resolve()
ROOT = OUT/'app'
assert ROOT.parent.parent.name == 'demo-regression'
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT/'03-Src'))
import server
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from app.knowledge_demo_answers import DEMO_QUESTION_BRIDGE_CHART

assert server.ROOT == ROOT and server.paths.RUNTIME_DIR.is_relative_to(ROOT)
assert not server.professional_host.config().get('external_enabled')
# TestClient without context does not start the receiver/notification lifespan.
client = TestClient(server.app, raise_server_exceptions=False)
original_connect=socket.socket.connect
def isolated_connect(sock,address):
    # Windows asyncio uses a loopback socket pair for its own wakeup pipe.
    if isinstance(address,tuple) and (address[0] not in ('127.0.0.1','localhost','::1') or address[1] in (5189,18768)):
        raise OSError('External/formal transport disabled in regression API checks')
    return original_connect(sock,address)
socket.socket.connect = isolated_connect
results = Results(OUT, 'api')
state = {}
sample = ROOT/'03-Src/studio/project-import-assets/v31.xlsx'
meta = json.loads((sample.parent/'v31-source.json').read_text('utf-8'))
spec = importlib.util.spec_from_file_location('comparison', ROOT/'03-Src/engine/tools/verify_v31_task_acceptance.py')
comparison = importlib.util.module_from_spec(spec)
spec.loader.exec_module(comparison)

def call(method, url, **kwargs):
    reply = client.request(method, url, **kwargs)
    require(reply.status_code == 200, f'{url}: HTTP {reply.status_code}: {reply.text[:300]}')
    return reply

def inspect():
    require(sha(sample) == meta['sha256'], 'Bundled input does not match its provenance manifest')
    original=Path(__file__).resolve().parents[2]/meta['source']
    require(original.is_file() and sha(original)==sha(sample),'Current user sample differs from deployed bundled input')
    book = load_workbook(sample, read_only=True)
    require(book['表2-通用工程测量费用']['H5'].value == 50000, 'Expected user-approved 50000 sample')
    book.close()
    state['inspect'] = call('POST','/api/inspect', files={'file':(meta['filename'],sample.read_bytes())}).json()
    write(OUT/'inspect.json',state['inspect'])
    require([s['sheet_name'] for s in state['inspect']['sheets']]==['表2-通用工程测量费用','表3-地质测绘','表4-通用工程勘察费用'], 'Unexpected business worksheet mapping')
    return {'sha256':sha(sample),'sheets':len(state['inspect']['sheets'])}

def convert():
    configs = [dict(sheet_name=s['sheet_name'], enabled=bool(s.get('enabled',True)), header_row=int(s['header_row']),
                    column_mapping=s['suggested_mapping'], output_match_report=True,merge_vertical_cells=True,
                    merge_horizontal_cells=True,only_match_rows_with_value=True,match_value_filter_field='数量')
               for s in state['inspect']['sheets']]
    state['configs'] = configs
    reply = call('POST','/api/process',files={'file':(meta['filename'],sample.read_bytes())},data={
        'project_name':'演示回归-API独立样例','source_type':'web','defer_matching':'true',
        'sheet_configs':json.dumps(configs,ensure_ascii=False),'only_match_rows_with_value':'true','match_value_filter_field':'数量'}).json()
    state['job'] = reply['job_id']
    require(reply['summary']['total_data_rows'] == 100, str(reply['summary']))
    write(OUT/'converted.json',reply)
    return {'job_id':state['job'],'total_rows':reply['summary']['total_data_rows'],'evidence':'converted.json'}

def match():
    state['matched'] = call('POST','/api/process/batch-match',json={'job_id':state['job']}).json()
    summary = state['matched']['summary']
    require(summary['total_data_rows']==100 and summary['filled_rows']==99, str(summary))
    require(call('POST','/api/process/batch-match',json={'job_id':state['job']}).json()['summary']==summary,'Repeat changed summary')
    write(OUT/'matched.json',state['matched'])
    return {'total_rows':summary['total_data_rows'],'filled_rows':summary['filled_rows'],'evidence':'matched.json'}

def workbook():
    reply=call('GET',f'/api/download/{state["job"]}/excel',params={'hide_empty_rows':'true','value_filter_field':'数量'})
    path=OUT/'actual.xlsx';path.write_bytes(reply.content);state['excel']=path
    book=load_workbook(path,data_only=False)
    sheet=book['表2-通用工程测量费用']
    require(sheet['H5'].value==50000 and sheet['H6'].value==3203,'Price result changed')
    formulas=sum(c.data_type=='f' for s in book for row in s for c in row)
    require(formulas>0,'Missing formulas')
    book.close()
    return {'price':50000,'row6':3203,'formulas':formulas,'file':path.name}

def risks():
    risk=call('POST','/api/experience-warnings/run',data={'job_id':state['job']}).json();write(OUT/'risk.json',risk)
    text=json.dumps(risk,ensure_ascii=False)
    require('50000' in text and '4274' in text and '1.15' in text,'Expected risk evidence missing')
    counts=risk['summary']['warning_summary']
    require(counts['warning_rows']==2 and counts['high_rows']==1 and counts['low_rows']==1, str(counts))
    state['risk']=risk
    return {'counts':counts,'evidence':'risk.json'}

def report():
    response=call('POST','/api/risk-report',data={'job_id':state['job']}).json()
    path=OUT/'actual.docx';path.write_bytes(call('GET',f'/api/download/{state["job"]}/report').content)
    text='\n'.join(comparison._word_lines(path));(OUT/'report-text.txt').write_text(text,encoding='utf-8')
    require('50000' in text and '500000' not in text,'Report uses wrong demo price')
    require('4274' in text and '1069.9%' in text and '1.15' in text,'Report risk evidence mismatch')
    require(response.get('risk_report_mode')=='demo_preset',f'Unexpected report mode: {response}')
    state['word']=path
    return {'file':path.name,'mode':response.get('risk_report_mode'),'price':50000,'deviation':'1069.9%'}

def excel_compare():
    # Historical answer is immutable. Apply ONLY the explicit user decision to a
    # private reference copy; all other values/formulas/styles remain the oracle.
    workbook()  # Re-download the latest artifact after risk/report updates.
    answer=OUT/'reference-50000.xlsx'
    book=load_workbook(comparison.ANSWER_EXCEL)
    before=book['表2-通用工程测量费用']['H5'].value
    require(before in (50000,500000),'Unrecognized reference price; cannot normalize')
    book['表2-通用工程测量费用']['H5']=50000
    # Risk explanation is a direct arithmetic consequence of the same approved
    # input adjustment. Only this row's fixed numerical substrings are adapted.
    text=book['表2-通用工程测量费用']['S5'].value
    if isinstance(text,str):
        text=text.replace('500000','50000').replace('11598.642957%',f'{(50000-4274)/4274*100:.6f}%').replace('11598.6%',f'{(50000-4274)/4274*100:.6g}%')
        book['表2-通用工程测量费用']['S5']=text
    book.save(answer);book.close()
    diff=comparison.compare_excel(state['excel'],answer)
    write(OUT/'excel-comparison.json',{'reference_sha256':sha(comparison.ANSWER_EXCEL),
        'explicit_reference_adjustment':{'cells':['表2-通用工程测量费用!H5','表2-通用工程测量费用!S5'],
            'before':before,'after':50000,'risk_deviation_formula':'(50000-4274)/4274*100; 6 significant / 6 decimal digits',
            'reason':'用户已指定统一50000；仅同一行价格与直接算术派生的风险数值，其他字段不变'},'comparison':diff})
    keys=['three_number_difference_count','formula_difference_count','target_fill_difference_count',
          'review_status_difference_count','hidden_row_difference_count','full_value_difference_count']
    require(not diff['missing_sheets'] and all(diff[k]==0 for k in keys),f'Unexplained reference differences: { {k:diff[k] for k in keys} }; see excel-comparison.json')
    return diff

def knowledge():
    answer=call('POST','/api/astra/knowledge/ask',json={'question':DEMO_QUESTION_BRIDGE_CHART}).json()
    write(OUT/'knowledge.json',answer);state['knowledge']=answer
    require(answer.get('answer_mode')=='curated_demo' and answer.get('sources'),'Preset/source missing')
    return {'mode':answer['answer_mode'],'sources':len(answer['sources']),'question':DEMO_QUESTION_BRIDGE_CHART}

def chart():
    chart=state['knowledge']['chart'];items=chart['items']
    require(chart['type']=='bar' and len(items)==16,'Missing bar-chart series')
    require(next(x['value'] for x in items if x['label']=='D1422')==4500,'Wrong known price')
    return chart

def graph():
    graph=call('GET','/api/knowledge-articles/graph').json();write(OUT/'graph.json',graph)
    require(graph.get('nodes') and (graph.get('links') or graph.get('edges')),'Empty knowledge graph')
    return {'nodes':len(graph['nodes']),'links':len(graph.get('links',graph.get('edges',[])))}

def dashboard():
    data=call('GET','/api/projects/dashboard').json();write(OUT/'dashboard.json',data)
    require(data['kpis']['total_projects']>=1,'Converted project not in dashboard')
    return data['kpis']

def recovery():
    for name,payload in [('broken.xlsx',b'not zip'),('wrong.txt',b'bad'),('../escape.xlsx',b'bad')]:
        response=client.post('/api/inspect',files={'file':(name,payload)})
        require(response.status_code==400,f'{name}: {response.status_code}')
    restored=call('GET',f'/api/astra/runs/{state["job"]}').json()
    require(restored['job_id']==state['job'],'Restore crossed job')
    # Ordinary file must not silently take the demo report branch.
    import demo_settings
    old=demo_settings.read();demo_settings.save({**old,'reportPreset':False})
    try:
        response=client.post('/api/risk-report',data={'job_id':state['job']})
        require(response.status_code==409,'Disabled preset unexpectedly generated report without model')
    finally:demo_settings.save({**demo_settings.read(),'reportPreset':old['reportPreset']})
    return {'invalid_files':3,'restored_job':state['job'],'report_off_requires_model':True}

for case,action in [('D03',inspect),('D04',convert),('D07',match),('D08',workbook),('D09',risks),
                    ('D10',report),('D11',lambda: {'word_bytes':state['word'].stat().st_size}),
                    ('D12',excel_compare),('D14',dashboard),('D16',knowledge),('D17',chart),('D19',graph),('D23',recovery)]:
    results.check(case,action)
write(OUT/'api-context.json',{'job_id':state.get('job'),'question':DEMO_QUESTION_BRIDGE_CHART})
sys.exit(any(x['status']=='failed' for x in results.items))
