import hashlib
import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
import server
import demo_settings
from app.knowledge_demo_answers import DEMO_QUESTION_TECHNICAL_FEE
from test_migration_six import local, row, candidate
from test_risk_report_model import report, transport, ANSWER


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(server.paths, 'RUNTIME_DIR', tmp_path)
    monkeypatch.setattr(server.engine, 'RUNTIME_DIR', tmp_path)
    monkeypatch.setattr(server.professional_host, 'model_key', lambda *a: '')
    return TestClient(server.app)


def update(client, **changes):
    value = client.get('/api/astra/demo-settings').json()
    reply = client.put('/api/astra/demo-settings', json={**value, **changes})
    assert reply.status_code == 200, reply.text
    return reply.json()


def test_defaults_and_persistence_preserve_current_demo_behaviour(client):
    default = client.get('/api/astra/demo-settings').json()
    assert default == demo_settings.DEFAULT
    assert server.engine.get_demo_answer(DEMO_QUESTION_TECHNICAL_FEE)
    assert server.engine._is_demo_report_task({'input_filename': '样例【演示】.xlsx'})
    saved = update(client, enabled=False, rowPreset=False)
    assert demo_settings.read() == saved == json.loads(demo_settings.filename().read_text('utf-8'))
    assert not server.engine.get_demo_answer(DEMO_QUESTION_TECHNICAL_FEE)
    assert not server.engine._is_demo_report_task({'input_filename': '样例【演示】.xlsx'})
    restored = update(client, enabled=True)
    assert restored['rowPreset'] is False and restored['reportPreset'] is True


def test_stale_window_cannot_overwrite_new_settings(client):
    old = client.get('/api/astra/demo-settings').json()
    saved = update(client, reportPreset=False)
    assert client.put('/api/astra/demo-settings', json={**old, 'enabled': False}).status_code == 409
    assert demo_settings.read() == saved


def test_legacy_configuration_migrates_without_enabling_disabled_presets(client):
    legacy = {'revision': 3, 'enabled': False, 'rowPreset': False, 'reportPreset': True, 'knowledgePreset': False}
    path = demo_settings.filename(); path.parent.mkdir(parents=True); path.write_text(json.dumps(legacy), 'utf-8')
    value = demo_settings.read()
    assert all(value[key] == item for key, item in legacy.items())
    assert value['parkedProject'] and value['parkedStation'] == 'report'
    saved = update(client, parkedName='北线工程', parkedStation='risk')
    # An older open page may still save the original fields; retain new options.
    reply = client.put('/api/astra/demo-settings', json={**legacy, 'revision': saved['revision']})
    assert reply.status_code == 200
    assert reply.json()['parkedName'] == '北线工程' and reply.json()['parkedStation'] == 'risk'


@pytest.mark.parametrize('change', [{'parkedName': ''}, {'parkedName': '字' * 13}, {'parkedName': 'a\nb'}, {'parkedStation': 'missing'}, {'parkedStation': []}, {'parkedProject': 'true'}])
def test_invalid_parked_settings_preserve_saved_values(client, change):
    value = client.get('/api/astra/demo-settings').json()
    response = client.put('/api/astra/demo-settings', json={**value, **change})
    assert response.status_code == 400
    assert demo_settings.read() == value


@pytest.mark.parametrize('bad', ['false', 0, None, []])
def test_switch_types_are_strict_and_failed_save_preserves_previous(client, bad):
    value = client.get('/api/astra/demo-settings').json()
    assert client.put('/api/astra/demo-settings', json={**value, 'enabled': bad}).status_code == 400
    assert demo_settings.read() == value


def test_invalid_settings_fail_closed_without_silently_restoring_demo(client):
    file = demo_settings.filename(); file.parent.mkdir(parents=True); file.write_text('{bad', 'utf-8')
    assert client.get('/api/astra/demo-settings').status_code == 503
    assert server.engine.get_demo_answer(DEMO_QUESTION_TECHNICAL_FEE) is None
    assert not server.engine._is_demo_report_task({'input_filename': '样例【演示】.xlsx'})


def test_failed_disk_write_does_not_report_success(client, monkeypatch):
    value = update(client, enabled=False)
    def fail(*args): raise PermissionError('readonly')
    monkeypatch.setattr(server.engine, 'atomic_json', fail)
    assert client.put('/api/astra/demo-settings', json={**value, 'enabled': True}).status_code == 503
    assert demo_settings.read() == value


def test_disabled_knowledge_preset_uses_real_fallback_and_does_not_affect_report(client, monkeypatch):
    async def search(payload): return {'results': [], 'evidence_found': False}
    monkeypatch.setattr(server.engine, 'knowledge_search', search)
    enabled = client.post('/api/astra/knowledge/ask', json={'question': DEMO_QUESTION_TECHNICAL_FEE})
    assert enabled.json()['answer_mode'] == 'curated_demo'
    update(client, knowledgePreset=False)
    disabled = client.post('/api/astra/knowledge/ask', json={'question': DEMO_QUESTION_TECHNICAL_FEE})
    assert disabled.json()['answer_mode'] == 'evidence_only'
    assert disabled.json()['generated_by_model'] is False
    assert server.engine._is_demo_report_task({'input_filename': '样例【演示】.xlsx'})


@pytest.mark.parametrize('switch', ['enabled', 'rowPreset'])
def test_row_switch_restores_normal_path_and_never_writes_price(row, monkeypatch, switch):
    client, root, output, payload = row
    headers = ['要素1','要素2','要素3','要素4','要素5','单位','基价','实物工作费调整系数','技术工作费调整系数']
    values = ['控制测量','首级控制测量','','GPS测量E级','中等','个',3203,1,0.22]
    book = Workbook(); sheet = book.active; sheet.title = '表2-通用工程测量费用'; sheet.append(headers)
    for _ in range(4): sheet.append([None] * len(headers))
    sheet.append(values); book.save(output); book.close()
    book = Workbook(); sheet = book.active; sheet.append(headers); sheet.append(values); book.save(root/'kb.xlsx'); book.close()
    payload.update(sheet_name='表2-通用工程测量费用', row_number=6)
    data = candidate(row); before = hashlib.sha256(output.read_bytes()).hexdigest()
    calls = []
    async def normal(payload): calls.append(payload); return {'answer': 'normal-path', 'generated_by_model': False}
    monkeypatch.setattr(server, 'knowledge_answer', normal)
    assert client.post('/api/astra/row-assist/ask', json=data).json()['answer_mode'] == 'curated_demo'
    assert not calls
    update(client, **{switch: False})
    assert client.post('/api/astra/row-assist/ask', json=data).json()['answer'] == 'normal-path'
    assert len(calls) == 1
    assert hashlib.sha256(output.read_bytes()).hexdigest() == before


@pytest.mark.parametrize('switch', ['enabled', 'reportPreset'])
def test_report_switch_uses_normal_model_path_when_disabled(report, monkeypatch, switch):
    job, folder, state, events = report
    state['input_filename'] = '演示样例【演示】.xlsx'
    calls = transport(monkeypatch, ANSWER)
    preset = server._risk_report_sync(job, 'deepseek', 'deepseek-flash', 'https://test.invalid')
    assert preset['risk_report_mode'] == 'demo_preset' and not calls
    demo_settings.save({**demo_settings.read(), switch: False})
    normal = server._risk_report_sync(job, 'deepseek', 'deepseek-flash', 'https://test.invalid')
    assert normal['risk_report_mode'] == 'model_generated' and len(calls) == 1


def test_disabled_report_requires_model_even_for_demo_filename(client):
    job = 'e' * 32; folder = server.paths.RUNTIME_DIR/job; folder.mkdir()
    (folder/'process-state.json').write_text(json.dumps({'input_filename':'样例【演示】.xlsx'}), 'utf-8')
    update(client, reportPreset=False)
    reply = client.post('/api/risk-report', data={'job_id':job})
    assert reply.status_code == 409 and '未配置模型' in reply.json()['detail']
