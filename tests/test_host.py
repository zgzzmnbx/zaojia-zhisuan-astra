import io
import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
import server


@pytest.fixture
def host(tmp_path, monkeypatch):
    monkeypatch.setattr(server.paths, 'RUNTIME_DIR', tmp_path)
    monkeypatch.setattr(server.engine, 'RUNTIME_DIR', tmp_path)
    with TestClient(server.app) as client:
        yield client, tmp_path


def test_host_exposes_its_own_identity(host):
    client, _ = host
    reply = client.get('/api/health')
    assert reply.json()['isolated'] is True
    assert reply.json()['model_connected'] is False
    assert reply.headers['X-Astra-Workspace'] == 'isolated'


def test_rejects_foreign_origin(host):
    client, _ = host
    assert client.get('/api/health', headers={'Origin': 'https://example.com'}).status_code == 403


@pytest.mark.parametrize('route', ['/api/weact/send', '/api/ai/settings'])
def test_unapproved_external_actions_are_not_mounted(host, route):
    client, _ = host
    assert client.post(route, json={}).status_code in (404, 405)


@pytest.mark.parametrize('job', ['../outside', 'a'*31, 'G'*32])
def test_invalid_job_ids_rejected_before_engine(host, job):
    client, _ = host
    assert client.post('/api/preview/cell', json={'job_id': job}).status_code == 400


def test_upload_path_and_file_type_are_validated(host):
    client, root = host
    for filename in ('../outside.xlsx', 'C:outside.xlsx', '.hidden.xlsx', 'file.txt'):
        assert client.post('/api/inspect', files={'file': (filename, b'bad')}).status_code == 400
    assert client.post('/api/inspect', files={'file': ('data.xlsx', b'not a zip')}).status_code == 400
    assert not list(root.iterdir())


def test_real_excel_inspection_only_writes_local_runtime(host):
    client, root = host
    wb = Workbook(); sheet = wb.active; sheet.title = '表2-工程测量'
    sheet.append(['要素1', '单位', '数量', '单价']); sheet.append(['工程测量', 'km', 2, None])
    buffer = io.BytesIO(); wb.save(buffer); wb.close()
    response = client.post('/api/inspect', files={'file': ('local.xlsx', buffer.getvalue())})
    assert response.status_code == 200, response.text
    assert len(list(root.glob('inspect/*/local.xlsx'))) == 1
    assert response.json()['columns']


def test_processing_validates_modes_and_explicit_two_phase(host):
    client, root = host
    assert client.post('/api/process', data={'matching_mode':'unsupported','defer_matching':'true'}).status_code == 400
    assert client.post('/api/process', data={'matching_mode':'mechanical'}).status_code == 400
    assert not list(root.iterdir())


def test_pending_restore_and_recalculation_state_survive_reload(host, monkeypatch):
    client, root = host
    job = 'a'*32; directory = root/job; directory.mkdir()
    (directory/'output.xlsx').write_bytes(b'fixture')
    state = {'summary': {'matching_status':'pending'}, 'output_excel':'output.xlsx',
             'business_task': {'task_id':'task-fixture'}}
    (directory/'process-state.json').write_text(json.dumps(state), encoding='utf-8')
    restored = client.get(f'/api/astra/runs/{job}').json()
    assert restored['downloads'] == {'excel':f'/api/download/{job}/excel'}
    assert restored['task_tracking']['task']['task_id'] == 'task-fixture'

    async def edit(_): return {'needs_recalculate':True, 'formula_recalculated':False}
    async def failed_recalc(_): return {'needs_recalculate':False, 'formula_recalculated':False}
    async def good_recalc(_): return {'needs_recalculate':False, 'formula_recalculated':True}
    monkeypatch.setattr(server.engine, 'update_preview_cell', edit)
    monkeypatch.setattr(server.engine, 'recalculate_preview_workbook', failed_recalc)
    assert client.post('/api/preview/cell', json={'job_id':job}).json()['needs_recalculate'] is True
    assert client.get(f'/api/astra/runs/{job}').json()['needs_recalculate'] is True
    assert client.post('/api/preview/recalculate', json={'job_id':job}).json()['needs_recalculate'] is True
    monkeypatch.setattr(server.engine, 'recalculate_preview_workbook', good_recalc)
    assert client.post('/api/preview/recalculate', json={'job_id':job}).json()['needs_recalculate'] is False
    assert client.get(f'/api/astra/runs/{job}').json()['needs_recalculate'] is False
    assert json.loads((directory/'process-state.json').read_text()) == state


def test_non_demo_risk_report_does_not_call_model(host):
    client, root = host
    job = 'b'*32; directory = root/job; directory.mkdir()
    (directory/'process-state.json').write_text(json.dumps({'input_filename':'真实项目.xlsx'}),encoding='utf-8')
    response = client.post('/api/risk-report', data={'job_id':job})
    assert response.status_code == 409
    assert '未配置模型' in response.json()['detail']
