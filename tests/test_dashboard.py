"""Astra dashboard adapters use only the isolated ledger and preserve restoration state."""
import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
import server


@pytest.fixture
def dashboard(tmp_path, monkeypatch):
    runtime=tmp_path/'astra';runtime.mkdir()
    monkeypatch.setattr(server.paths, 'RUNTIME_DIR', runtime)
    monkeypatch.setattr(server.engine, 'RUNTIME_DIR', runtime)
    with TestClient(server.app) as client:
        yield client, runtime, server.engine._project_ledger()


def record(runtime, ledger, job='a'*32, project_id=None, name='同名勘察项目', source='web', review=0, warning=False):
    directory=runtime/job;directory.mkdir(exist_ok=True)
    state={'input_filename':'input.xlsx','project_name':name,'output_excel':'result.xlsx',
           'output_report':'report.docx','created_at':'2026-10-05T12:00:00+08:00',
           'updated_at':'2026-10-06T12:00:00+08:00',
           'skill_snapshot':{'id':'survey-measurement-limit-price','version':'1.0.0'},
           'summary':{'total_data_rows':12,'matched_rows':12-review,'filled_rows':12-review,
                      'review_rows':review,'matching_status':'completed',
                      'warning_summary':{'executed':warning,'high_rows':1 if warning else 0,'low_rows':0}}}
    (directory/'result.xlsx').write_bytes(b'isolated Excel fixture')
    (directory/'report.docx').write_bytes(b'isolated Word fixture')
    tracking=ledger.record_process_state(job_id=job,state=state,project_id=project_id,
             project_name=name,source_type=source,create_project=True)
    state['project_tracking']=tracking
    (directory/'process-state.json').write_text(json.dumps(state),encoding='utf-8')
    return tracking


def test_statistics_are_deduplicated_by_identity_and_filters_match_history(dashboard):
    client, root, ledger=dashboard
    first=record(root,ledger)
    record(root,ledger,'b'*32,first['project_id'],review=2,warning=True)
    second=record(root,ledger,'c'*32,source='agent')
    assert first['project_id']!=second['project_id']  # Same names are not identity.
    reply=client.get('/api/projects/dashboard').json()
    assert reply['kpis']['total_projects']==2
    assert ledger.counts()['runs']==3
    assert reply['kpis']['total_runs']==2  # Original dashboard counts latest run summaries.
    assert reply['kpis']['warning_not_run']==1
    for query, count in [('status=pending_review',1),('risk=high',1),('source_type=agent',1),('keyword=不存在',0),('date_from=2027-01-01',0)]:
        totals=client.get('/api/projects/dashboard?'+query).json()
        history=client.get('/api/projects?'+query).json()
        assert totals['kpis']['total_projects']==history['total']==count
    assert len(reply['lifecycle_funnel'])==5


def test_detail_versions_pagination_and_local_telemetry(dashboard):
    client, root, ledger=dashboard
    first=record(root,ledger);record(root,ledger,'b'*32,first['project_id'])
    record(root,ledger,'c'*32,name='另一项目')
    detail=client.get('/api/projects/'+first['project_id']).json()
    assert len(detail['runs'])==2
    assert detail['latest_version']==2
    page=client.get('/api/projects?page=2&page_size=1').json()
    assert page['pages']==2 and len(page['items'])==1
    telemetry=client.get('/api/projects/dashboard').json()['llm_usage']
    assert telemetry['scope']=='local_instance' and telemetry['total_requests']==0
    assert str(root) not in json.dumps(detail,ensure_ascii=False)


def test_run_restoration_preserves_pending_recalculation_and_project_ownership(dashboard):
    client, root, ledger=dashboard
    first=record(root,ledger);other=record(root,ledger,'b'*32)
    (root/('a'*32)/'astra-edit-state.json').write_text('{"needs_recalculate":true}')
    url=f"/api/projects/{first['project_id']}/runs/{first['run_id']}/result"
    data=client.get(url).json()
    assert data['needs_recalculate'] is True and data['job_id']=='a'*32
    assert data['downloads']['excel']=='/api/download/'+('a'*32)+'/excel'
    assert client.get(url.replace(first['project_id'],other['project_id'])).status_code==404
    (root/('a'*32)/'process-state.json').unlink()
    assert client.get(url).status_code==404


def test_artifact_download_and_expiry(dashboard):
    client, root, ledger=dashboard;entry=record(root,ledger)
    detail=client.get('/api/projects/'+entry['project_id']).json()
    artifact=next(a for a in detail['artifacts'] if a['type']=='excel')
    assert client.get(artifact['download_url']).content==b'isolated Excel fixture'
    (root/('a'*32)/'result.xlsx').unlink()
    assert client.get(artifact['download_url']).status_code==404
    detail=client.get('/api/projects/'+entry['project_id']).json()
    assert not next(a for a in detail['artifacts'] if a['type']=='excel')['exists']


@pytest.mark.parametrize('identifier',['invalid', 'prj_'+'f'*24])
def test_unknown_project_fails_closed(dashboard,identifier):
    client,_,_=dashboard
    assert client.get(f'/api/projects/{identifier}/runs/run_'+('e'*24)+'/result').status_code in (400,404)


def test_backfill_is_isolated_idempotent_and_does_not_invent_project_ids(dashboard):
    client,root,ledger=dashboard
    record(root,ledger)
    foreign=root.parent/'original';foreign.mkdir()
    (foreign/'process-state.json').write_text('{"private":"do not touch"}')
    legacy=root/('d'*32);legacy.mkdir()
    legacy_state={'input_filename':'legacy.xlsx','summary':{'matching_status':'pending'}}
    (legacy/'process-state.json').write_text(json.dumps(legacy_state))
    first=client.post('/api/projects/backfill').json()
    second=client.post('/api/projects/backfill').json()
    assert first['totals']==second['totals']
    assert first['totals']['projects']==1
    assert first['totals']['unclassified_tasks']==0
    classified=client.post('/api/projects/backfill?include_unclassified_legacy=true').json()
    assert classified['totals']['projects']==1 and classified['totals']['unclassified_tasks']==1
    assert json.loads((legacy/'process-state.json').read_text())==legacy_state
    assert (foreign/'process-state.json').read_text()=='{"private":"do not touch"}'
