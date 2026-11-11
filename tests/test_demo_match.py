import hashlib
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'03-Src'))
import server
import demo_match
import demo_settings

SAMPLE = ROOT/'03-Src/studio/project-import-assets/v31.xlsx'
MANIFEST = json.loads((demo_match.ASSETS/'manifest.json').read_text('utf-8'))
OPTIONS = {**MANIFEST['expected_options'], 'sheet_configs': MANIFEST['sheet_configs']}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(server.paths, 'RUNTIME_DIR', tmp_path)
    monkeypatch.setattr(server.engine, 'RUNTIME_DIR', tmp_path)
    return TestClient(server.app)


def process(client, deferred=True):
    return client.post('/api/process', files={'file': ('3.1【演示】.xlsx', SAMPLE.read_bytes())}, data={
        'defer_matching': str(deferred).lower(), 'only_match_rows_with_value':'true',
        'sheet_configs':json.dumps(OPTIONS['sheet_configs'],ensure_ascii=False)})


def test_api_replays_without_reading_price_database_or_coefficient_rules(client, monkeypatch):
    deferred = True
    def forbidden(*args, **kwargs):
        raise AssertionError('Demo matching must not query price database or coefficient rules')
    monkeypatch.setattr(server.engine.KnowledgeBase, 'from_excel', forbidden)
    monkeypatch.setattr(server.engine.AdjustmentEngine, 'from_rule_assets', forbidden)
    converted = process(client,deferred)
    assert converted.status_code==200,converted.text
    job=converted.json()['job_id']
    response = client.post('/api/process/batch-match',json={'job_id':job}) if deferred else converted
    assert response.status_code==200,response.text
    data=response.json();summary=data['summary']
    assert summary['matching_source']=='demo_standard_answer'
    assert summary['generated_by_model'] is False
    assert summary['total_data_rows']==100 and summary['filled_rows']==99
    from openpyxl import load_workbook
    path=server.paths.RUNTIME_DIR/job/summary['output_excel']
    book=load_workbook(path)
    assert book['表2-通用工程测量费用']['H5'].value==50000
    assert book['表2-通用工程测量费用']['H6'].value==3203
    book.close()
    before=path.read_bytes()
    repeated=client.post('/api/process/batch-match',json={'job_id':job})
    assert repeated.status_code==200 and repeated.json()['summary']==summary
    assert path.read_bytes()==before
    refreshed=client.get(f'/api/astra/runs/{job}')
    assert refreshed.status_code==200 and '演示标准答案' in refreshed.json()['summary']['report_text']


@pytest.mark.parametrize('switch', ['enabled','matchPreset'])
def test_off_switch_invokes_original_factory_and_preserves_existing_results(client,tmp_path,switch):
    demo_settings.save({**demo_settings.read(), switch:False})
    calls=[]
    fallback=SimpleNamespace(fill_workbook=lambda *a,**k:calls.append(k) or 'normal')
    proxy=demo_match.DemoFillEngine(lambda c:fallback,None)
    assert proxy.fill_workbook(SAMPLE,tmp_path/'output.xlsx',**OPTIONS)=='normal'
    assert len(calls)==1 and not (tmp_path/'output.xlsx').exists()


@pytest.mark.parametrize('change',['bytes','mapping','header','disabled_sheet','filter','candidates','duplicate_sheet'])
def test_non_exact_input_or_changed_user_choices_never_receive_fixed_answers(client,tmp_path,change):
    options=json.loads(json.dumps(OPTIONS));sample=SAMPLE
    if change=='bytes':
        sample=tmp_path/'3.1【演示】.xlsx'; sample.write_bytes(SAMPLE.read_bytes()+b'changed')
    elif change=='mapping':options['sheet_configs'][0]['column_mapping']['输出-价格列']='I'
    elif change=='header':options['sheet_configs'][0]['header_row']=5
    elif change=='disabled_sheet':options['sheet_configs'][0]['enabled']=False
    elif change=='filter':options['sheet_configs'][0]['only_match_rows_with_value']=False
    elif change=='candidates':options['confirmed_candidates']=[{'price':1}]
    elif change=='duplicate_sheet':options['sheet_configs'][1]=options['sheet_configs'][0]
    calls=[]
    fallback=SimpleNamespace(fill_workbook=lambda *a,**k:calls.append(k) or 'normal')
    result=demo_match.DemoFillEngine(lambda c:fallback,None).fill_workbook(sample,tmp_path/'out.xlsx',**options)
    assert result=='normal' and len(calls)==1 and not (tmp_path/'out.xlsx').exists()


def test_corrupt_answers_stop_without_publishing_or_overwriting_original(client,tmp_path,monkeypatch):
    converted=process(client).json();job=converted['job_id']
    folder=server.paths.RUNTIME_DIR/job
    state_before=(folder/'process-state.json').read_bytes()
    state=json.loads(state_before);original=folder/state['output_excel'];before=original.read_bytes()
    broken=tmp_path/'broken-assets';broken.mkdir();(broken/'manifest.json').write_text('{}')
    monkeypatch.setattr(demo_match,'ASSETS',broken)
    result=client.post('/api/process/batch-match',json={'job_id':job})
    assert result.status_code==400 and '校验失败' in result.text
    after=json.loads((folder/'process-state.json').read_bytes())
    for key in ['input_excel','output_excel','output_report','artifact_sha256','artifact_version','summary']:
        assert after.get(key)==state.get(key),key
    assert original.read_bytes()==before


def test_legacy_config_keeps_disabled_master_and_defaults_new_option(client):
    legacy={k:v for k,v in demo_settings.DEFAULT.items() if k!='matchPreset'}
    legacy['enabled']=False
    path=demo_settings.filename();path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(legacy),'utf-8')
    assert demo_settings.read()['matchPreset'] is True
    assert not demo_settings.enabled('matchPreset')


def test_host_still_requires_structure_confirmation_before_matching(client):
    response=process(client,False)
    assert response.status_code==400 and '请先转换' in response.text


def test_disabled_preset_runs_real_matching_for_full_v31_input(client):
    demo_settings.save({**demo_settings.read(), 'matchPreset':False})
    converted=process(client)
    assert converted.status_code==200,converted.text
    response=client.post('/api/process/batch-match',json={'job_id':converted.json()['job_id']})
    assert response.status_code==200,response.text
    summary=response.json()['summary']
    assert summary.get('matching_source')!='demo_standard_answer'
    assert not summary['report_text'].startswith('演示标准答案')
    assert summary['total_data_rows']==100 and summary['filled_rows']==99
    from openpyxl import load_workbook
    book=load_workbook(server.paths.RUNTIME_DIR/converted.json()['job_id']/summary['output_excel'])
    assert book['表2-通用工程测量费用']['H5'].value==50000
    assert book['表2-通用工程测量费用']['H6'].value==3203
    book.close()


def test_exact_batch_uses_verified_formula_cache_without_starting_excel(client, monkeypatch):
    converted=process(client).json();job=converted['job_id']
    import win32com.client
    starts=[]
    def forbidden(*args, **kwargs):
        starts.append(True)
        raise AssertionError('Excel must not start for the exact cached demo batch')
    monkeypatch.setattr(win32com.client,'DispatchEx',forbidden)
    result=client.post('/api/process/batch-match',json={'job_id':job})
    assert result.status_code==200,result.text
    assert starts==[]
    summary=result.json()['summary']
    from openpyxl import load_workbook
    path=server.paths.RUNTIME_DIR/job/summary['output_excel']
    cached=load_workbook(path,data_only=True)
    assert cached['表2-通用工程测量费用']['H5'].value==50000
    assert cached['表2-通用工程测量费用']['N6'].value is not None
    assert not any(c.data_type=='e' for s in cached for row in s for c in row)
    cached.close()
    # Outside this batch, even the same answer must go through real Excel.
    server.engine.recalculate_workbook(path)
    assert len(starts)==1
    assert demo_match._batch_cache.get() is None


@pytest.mark.parametrize('tamper',[False,True])
def test_cache_permission_is_one_use_and_rejects_changed_workbook(tmp_path,tamper):
    calls=[];path=tmp_path/'answer.xlsx'
    fake=SimpleNamespace(_build_skill_fill_engine=lambda c:None,
        _require_skill_capability=lambda *a:None,
        recalculate_workbook=lambda p:calls.append(str(p)) or True,
        _summary_from_dict=lambda raw:None)
    def batch():
        demo_match.DemoFillEngine(lambda c:None,None).fill_workbook(SAMPLE,path,**OPTIONS)
        if tamper:path.write_bytes(path.read_bytes()+b'changed')
        fake.recalculate_workbook(path)
        fake.recalculate_workbook(path)
    fake._execute_batch_match=batch
    demo_match.install(fake)
    fake._execute_batch_match()
    assert len(calls)==(2 if tamper else 1)
    assert demo_match._batch_cache.get() is None


def test_reference_origin_survives_risk_save_and_reload(client):
    job=process(client).json()['job_id']
    assert client.post('/api/process/batch-match',json={'job_id':job}).status_code==200
    risk=client.post('/api/experience-warnings/run',data={'job_id':job})
    assert risk.status_code==200,risk.text
    restored=client.get(f'/api/astra/runs/{job}').json()
    assert restored['summary']['matching_source']=='demo_standard_answer'
    assert restored['summary']['generated_by_model'] is False


def test_legacy_provenance_restores_read_only_without_marking_ordinary_results(client):
    job=process(client).json()['job_id']
    assert client.post('/api/process/batch-match',json={'job_id':job}).status_code==200
    path=server.paths.RUNTIME_DIR/job/'process-state.json'
    state=json.loads(path.read_text('utf-8'))
    for key in ['matching_source','matching_source_label','generated_by_model','demo_answer_version','demo_input_sha256']:
        state['summary'].pop(key,None)
    path.write_text(json.dumps(state,ensure_ascii=False),encoding='utf-8');before=path.read_bytes()
    restored=client.get(f'/api/astra/runs/{job}').json()['summary']
    assert restored['matching_source']=='demo_standard_answer'
    assert restored['demo_answer_version']=='1.0.0'
    assert path.read_bytes()==before
    state['summary']['price_logs']=[]
    path.write_text(json.dumps(state,ensure_ascii=False),encoding='utf-8')
    assert not server.engine._load_process_state(path.parent)['summary'].get('matching_source')
