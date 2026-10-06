import hashlib
import importlib.util
import io
import json
import shutil
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook,load_workbook

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'03-Src'))
import server
import professional_host
from app import settlement_audit_api

def legacy_helpers(name):
    spec=importlib.util.spec_from_file_location(name,server.ENGINE/'backend/tests'/f'{name}.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

@pytest.fixture
def client(tmp_path,monkeypatch):
    for module in (server.paths,server.engine):monkeypatch.setattr(module,'RUNTIME_DIR',tmp_path)
    monkeypatch.setattr(server.engine,'DEFAULT_KNOWLEDGE_MEMORY_DB_PATH',tmp_path/'memory.sqlite3')
    monkeypatch.setattr(settlement_audit_api,'SETTLEMENT_AUDIT_RUNTIME_DIR',tmp_path/'settlement')
    monkeypatch.setattr(professional_host,'CONFIG',tmp_path/'connections.json')
    with TestClient(server.app) as c:yield c

def test_all_professional_read_contracts(client):
    for endpoint in ['professional-skills/management','professional-skills/open-format','experience-pool/field-preferences',
        'workload-capture/field-preferences','workload-capture/target-field-preferences','experience-warnings/settings',
        'settlement-audit/profile','projects/map','projects/unlocated','projects/spatial-candidates','ui-preferences','preview-column-preferences']:
        r=client.get('/api/'+endpoint);assert r.status_code==200,(endpoint,r.text)

def test_settlement_sample_produces_three_readable_artifacts(client):
    sample=client.get('/api/settlement-audit/sample');assert sample.status_code==200
    r=client.post('/api/settlement-audit/review',files={'file':('sample.xlsx',sample.content)})
    assert r.status_code==200,r.text
    result=r.json();assert result['risks']
    for kind,url in result['downloads'].items():
        artifact=client.get(url);assert artifact.status_code==200
        assert len(artifact.content)>100
        if kind=='excel':
            book=load_workbook(io.BytesIO(artifact.content));assert book.sheetnames;book.close()

def test_workload_same_names_preserve_two_inputs_and_downloads(client,tmp_path):
    helper=legacy_helpers('test_workload_capture')
    source=tmp_path/'source.xlsx';target=tmp_path/'target.xlsx'
    helper._write_source(source);helper._write_target(target)
    r=client.post('/api/workload-capture/run',files={'workload_file':('same.xlsx',source.read_bytes()),'target_file':('same.xlsx',target.read_bytes())},data={
        'source_sheet_configs':json.dumps(helper._source_configs()),'target_sheet_configs':json.dumps(helper._target_configs()),'selected_fields':json.dumps(['数量(信息抓取)'])})
    assert r.status_code==200,r.text
    data=r.json();assert data['summary']['filled_rows']==1
    for url in data['downloads'].values():assert client.get(url).status_code==200
    book=load_workbook(io.BytesIO(client.get(data['downloads']['target']).content));assert book.active['F2'].value==26;book.close()

def test_memory_manual_review_audit_and_project_scope(client):
    helper=legacy_helpers('test_knowledge_memory')
    r=client.post('/api/knowledge-memory/candidates',json=helper.candidate_payload())
    assert r.status_code==200,r.text
    item=r.json()['item'];identifier=item['id'];key=item['project_key']
    assert item['status']!='confirmed'
    base=f'/api/knowledge-memory/items/{identifier}'
    assert client.get(base,params={'project_key':'different-project'}).status_code==404
    for action in ['submit','confirm','revoke']:
        response=client.post(base+'/'+action,json={'project_key':key,'actor':'迁移验收','actor_role':'reviewer','reason':'独立测试资料核验'})
        assert response.status_code==200,response.text
    assert response.json()['item']['status']=='revoked'
    audit=client.get(base+'/audit',params={'project_key':key});assert audit.status_code==200
    assert 'revoke' in audit.text

def test_experience_import_writes_only_working_pool(client,tmp_path,monkeypatch):
    frozen=server.ENGINE/'05-经验池-预警数据/【经验池】-管勘智算-【codex】.xlsx'
    before=hashlib.sha256(frozen.read_bytes()).hexdigest()
    pool=tmp_path/'pool.xlsx';shutil.copy2(frozen,pool);monkeypatch.setattr(server.engine,'DEFAULT_EXPERIENCE_POOL_PATH',pool)
    book=Workbook();ws=book.active;ws.title='历史数据'
    ws.append(['要素1','要素2','要素3','要素4','单位','基价','工程量','实物工作费调整系数','技术工作费调整系数'])
    ws.append(['控制测量','首级控制测量','GPS测量C级','中等','个',123,26,0.6,0.22])
    out=io.BytesIO();book.save(out);book.close()
    inspect=client.post('/api/experience-pool/inspect',files={'file':('history.xlsx',out.getvalue())});assert inspect.status_code==200
    sheets=inspect.json()['sheets'];configs=[{**s,'enabled':True,'column_mapping':s['suggested_mapping']} for s in sheets]
    r=client.post('/api/experience-pool/import',files={'file':('history.xlsx',out.getvalue())},data={'sheet_configs':json.dumps(configs),'selected_fields':json.dumps(['要素1','要素2','要素3','要素4','单位','基价','工程量','实物工作费调整系数','技术工作费调整系数'])})
    assert r.status_code==200,r.text
    assert hashlib.sha256(frozen.read_bytes()).hexdigest()==before
    assert hashlib.sha256(pool.read_bytes()).hexdigest()!=before

def test_model_credentials_do_not_inherit_original_env_or_leak(client,tmp_path,monkeypatch):
    monkeypatch.setenv('DEEPSEEK_API_KEY','original-project-secret')
    from app.llm import LlmConfig
    assert LlmConfig().resolved_api_key()==''
    key=tmp_path/'model.key';key.write_text('astra-test-secret')
    reply=client.put('/api/astra/connections',json={'models':{'deepseek':{'enabled':True,'key_file':str(key)}}})
    assert reply.status_code==200 and reply.json()['models']['deepseek']['configured']
    assert 'astra-test-secret' not in reply.text
    assert LlmConfig().resolved_api_key()=='astra-test-secret'
    assert client.post('/api/collaboration/feishu-webhook/test',json={}).status_code==409

def test_candidate_adoption_persists_pending_state(client,tmp_path,monkeypatch):
    job='d'*32;(tmp_path/job).mkdir();(tmp_path/job/'process-state.json').write_text('{}')
    async def adopt(_):return {'job_id':job,'formula_recalculated':False}
    monkeypatch.setattr(server.engine,'confirm_fill_assist',adopt)
    r=client.post('/api/fill-assist/confirm',json={'job_id':job});assert r.status_code==200
    assert server.read_edit_state(tmp_path/job)


def test_rejected_connection_form_is_not_partially_saved(client,tmp_path):
    previous={'models':{'deepseek':{'enabled':False,'key_file':''}}}
    professional_host.CONFIG.write_text(json.dumps(previous),encoding='utf-8')
    response=client.put('/api/astra/connections',json={'external_enabled':True,'weknora':{'base_url':'https://external.example'}})
    assert response.status_code==400
    assert professional_host.config()==previous
    (tmp_path/('d'*32)).mkdir()
    (tmp_path/('d'*32)/'process-state.json').write_text('{}')
    assert client.post('/api/collaboration/external-dispatch/web-review',json={'job_id':'d'*32}).status_code==409
    assert client.get('/api/settlement-audit/profile').json()['max_file_mb']==30
