import json

from app.batch_operation import batch_lock, record_operation
from app.business_tasks import BusinessTaskStore
from app.task_monitoring import current_task, task_snapshot
from app.sentinel_events import publish
from app import task_monitoring
from app import main as main_module
from fastapi.testclient import TestClient


def test_current_task_requires_real_batch_lock_and_monitor_is_read_only(tmp_path):
    db = tmp_path / 'tasks.sqlite3'
    store = BusinessTaskStore(db)
    task, _ = store.ensure_task(identity_key='sentinel-test', source_type='web',
        task_name='批量匹配', objective='核对结果', definition={}, skill_snapshot={}, input_snapshot={})
    job = tmp_path / 'abcdef1234567890abcdef1234567890'
    job.mkdir()
    store.link(task['task_id'], 'job_id', job.name, source_system='professional')
    (job / 'process-state.json').write_text(json.dumps({'batch_attempt': 'previous', 'summary': {'review_rows': 2,
        'warning_summary': {'executed': False, 'warning_rows': 0}}}), encoding='utf-8')
    record_operation(job, status='running', attempt='first', stage='规则匹配')
    before = {p.name: (p.stat().st_size, p.stat().st_mtime_ns) for p in (db, job / 'process-state.json', job / 'batch-match-status.json')}
    assert current_task(db, tmp_path)['task'] is None  # stale status is not running
    with batch_lock(job):
        found = current_task(db, tmp_path)['task']
        assert found['task_id'] == task['task_id']
        assert found['activity']['status'] == 'running'
        assert found['attention'] == {'review_rows': None, 'warning_rows': None, 'warning_checked': False}
    assert task_snapshot(db, tmp_path, task['task_id'])['activity']['status'] == 'interrupted'
    after = {p.name: (p.stat().st_size, p.stat().st_mtime_ns) for p in (db, job / 'process-state.json', job / 'batch-match-status.json')}
    assert before == after


def test_completion_keeps_unchecked_warning_unknown(tmp_path):
    db = tmp_path / 'tasks.sqlite3'
    store = BusinessTaskStore(db)
    task, _ = store.ensure_task(identity_key='completed', source_type='web',
        task_name='批量匹配', objective='核对结果', definition={}, skill_snapshot={}, input_snapshot={})
    job = tmp_path / '0123456789abcdef0123456789abcdef'
    job.mkdir()
    store.link(task['task_id'], 'job_id', job.name, source_system='professional')
    record_operation(job, status='completed', attempt='done', stage='完成')
    (job / 'process-state.json').write_text(json.dumps({'batch_attempt': 'done', 'summary': {
        'review_rows': 0, 'warning_summary': {'executed': False, 'warning_rows': 0}}}), encoding='utf-8')
    snapshot = task_snapshot(db, tmp_path, task['task_id'])
    assert snapshot['activity']['status'] == 'completed'
    assert snapshot['attention']['review_rows'] == 0
    assert snapshot['attention']['warning_rows'] is None
    feed = current_task(db, tmp_path)
    assert feed['task'] is None
    assert [(item['task_id'], item['activity']['attempt']) for item in feed['recent']] == [(task['task_id'], 'done')]


def test_completion_published_during_lock_probe_is_not_called_interrupted(tmp_path, monkeypatch):
    db = tmp_path / 'tasks.sqlite3'
    store = BusinessTaskStore(db)
    task, _ = store.ensure_task(identity_key='finish-race', source_type='web',
        task_name='批量匹配', objective='核对结果', definition={}, skill_snapshot={}, input_snapshot={})
    job = tmp_path / 'fedcba9876543210fedcba9876543210'
    job.mkdir()
    store.link(task['task_id'], 'job_id', job.name, source_system='professional')
    record_operation(job, status='running', attempt='race', stage='规则匹配')

    def finish_before_probe(_path):
        record_operation(job, status='completed', attempt='race', stage='完成')
        return False

    monkeypatch.setattr(task_monitoring, '_lock_held', finish_before_probe)
    assert task_snapshot(db, tmp_path, task['task_id'])['activity']['status'] == 'completed'


def test_read_only_http_contract(monkeypatch, tmp_path):
    monkeypatch.setattr(main_module, 'RUNTIME_DIR', tmp_path)
    db = tmp_path / main_module.DEFAULT_BUSINESS_TASK_DB_PATH.name
    store = BusinessTaskStore(db)
    task, _ = store.ensure_task(identity_key='http-contract', source_type='web',
        task_name='接口任务', objective='查询', definition={}, skill_snapshot={}, input_snapshot={})
    with TestClient(main_module.app) as client:
        response = client.get('/api/task-monitor/current')
        assert response.status_code == 200 and response.json()['task'] is None
        assert response.json()['recent'] == []
        response = client.get(f"/api/tasks/{task['task_id']}/monitor")
        assert response.status_code == 200
        assert response.json()['activity']['status'] == 'unknown'
        assert client.get('/api/tasks/invalid/monitor').status_code == 404


def test_milestones_survive_short_runs_and_sent_requires_both_delivery_receipts(tmp_path):
    db = tmp_path / 'business-tasks.sqlite3'
    store = BusinessTaskStore(db)
    task, _ = store.ensure_task(identity_key='stages', source_type='web', task_name='阶段任务',
                                objective='核对', definition={}, skill_snapshot={}, input_snapshot={})
    job = tmp_path / ('a' * 32)
    job.mkdir()
    store.link(task['task_id'], 'job_id', job.name, source_system='professional')
    publish(job, 'conversion_start', status='running')
    publish(job, 'match_start', status='running', attempt='one')
    publish(job, 'match_result', attempt='one', review_rows=2)
    publish(job, 'warning_start', status='running')
    publish(job, 'warning_result', warning_rows=1)
    publish(job, 'report_generated')
    publish(job, 'review_requested', collaboration_task_id='review-1')
    dispatch = tmp_path / 'dispatch.sqlite3'
    import sqlite3
    with sqlite3.connect(dispatch) as connection:
        connection.execute('CREATE TABLE tasks (task_id TEXT, source_task_id TEXT, task_kind TEXT, '
                           'submission_delivery_status TEXT, review_card_status TEXT, updated_at TEXT)')
        connection.execute('INSERT INTO tasks VALUES (?,?,?,?,?,?)',
                           ('review-1', job.name, 'external_dispatch', 'sent', 'pending', '2026-09-28T10:00:00+08:00'))
    feed = current_task(db, tmp_path, dispatch)
    assert feed['task'] is None
    assert {event['stage'] for event in feed['events']} == {
        'conversion_start', 'match_start', 'match_result', 'warning_start',
        'warning_result', 'report_generated', 'review_requested'}
    assert next(event for event in feed['events'] if event['stage'] == 'match_result')['review_rows'] == 2
    with sqlite3.connect(dispatch) as connection:
        connection.execute("UPDATE tasks SET review_card_status='sent'")
    delivered = current_task(db, tmp_path, dispatch)['events']
    assert 'review_sent' in {event['stage'] for event in delivered}
    assert delivered[0]['stage'] == 'review_sent'
