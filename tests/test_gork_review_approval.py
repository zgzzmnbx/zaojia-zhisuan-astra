import json
import sqlite3
import time
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from test_gork_notifications import fixture
from gork_review import ApprovalFeed
import gork_config as config
from review_approval_fixture import seed, approve, TEXT, JOB
from app import feishu_app_bot
from app.external_task_dispatch import DispatchValidationError


@pytest.fixture
def review(fixture, tmp_path, monkeypatch):
    obj, remote, clock = fixture
    monkeypatch.setattr(feishu_app_bot, 'utc_now', lambda: datetime.fromtimestamp(clock[0], timezone.utc).isoformat(timespec='seconds'))
    runtime = tmp_path / 'business'
    runtime.mkdir()
    store = seed(runtime/'tasks.sqlite3', runtime, created_at='1970-01-01T00:01:40+00:00', reviewers=('石萌','另一位复核人'))
    obj.approval_feed = ApprovalFeed(store.db_path, runtime)
    obj.approval_feed.reset()
    obj.settings.sound = True
    obj.settings.speech_target = 'watch'
    return obj, remote, clock, store


def test_committed_person_approval_automatically_speaks_once_without_waiting_for_everyone(review):
    obj, remote, clock, store = review
    result, changed = approve(store)
    assert changed and result['status'] == 'pending_review'
    before = store.db_path.read_bytes()
    obj.step()
    assert len(remote.sent) == 1
    assert remote.sent[0]['stage'] == 'review_approved'
    assert remote.sent[0]['speech'] == {'text': TEXT, 'mode': 'auto', 'target': 'watch'}
    assert store.db_path.read_bytes() == before
    assert approve(store)[1] is False
    clock[0] += 6
    obj.step()
    assert len(remote.sent) == 1
    approve(store, 1)
    clock[0] += 6
    obj.step()
    assert len(remote.sent) == 2 and remote.sent[1]['text'].startswith('同事已通过')


def test_startup_second_distinguishes_history_from_new_callback(review):
    obj, remote, clock, store = review
    approve(store)
    clock[0] = 101.5
    obj.cutoff = clock[0]
    obj.approval_feed.reset()
    approve(store, 1)  # Same second as history, but after the new baseline.
    obj.step()
    assert len(remote.sent) == 1 and remote.sent[0]['text'].startswith('同事已通过')


def test_rejected_unauthorized_and_uncommitted_results_are_not_announced(review):
    obj, remote, clock, store = review
    with pytest.raises(DispatchValidationError):
        store.review_task('preset-review', operator_open_id='outsider', platform_profile_id='preset', decision='approve')
    with pytest.raises(DispatchValidationError):
        store.review_task('preset-review', operator_open_id='user-0', platform_profile_id='wrong', decision='approve')
    with store._connect() as db:
        db.execute("UPDATE dispatch_reviewers SET status='approved',decided_at=?", ('1970-01-01T00:01:41+00:00',))
        assert obj.approval_feed.read() == []  # Neither committed nor backed by an action.
        db.rollback()
    store.review_task('preset-review', operator_open_id='user-0', platform_profile_id='preset', decision='reject', comment='退回')
    obj.step()
    assert not remote.sent


def test_new_round_rejects_stale_actions_and_gets_new_identity(review):
    obj, remote, clock, store = review
    approve(store); obj.step()
    clock[0] += 6
    seed(store.db_path, obj.approval_feed.runtime, reviewers=('石萌','另一位复核人'), review_round=2,
         created_at=datetime.fromtimestamp(clock[0], timezone.utc).isoformat(timespec='seconds'))
    obj.step()
    assert len(remote.sent) == 1
    approve(store)
    clock[0] += 6; obj.step()
    assert len(remote.sent) == 2 and remote.sent[0]['attempt'] != remote.sent[1]['attempt']


@pytest.mark.parametrize('mutation', ["source_task_id='"+'c'*32+"'", "source_system='other'", "submission_hash=''", "review_round=2"])
def test_wrong_scope_and_incomplete_evidence_are_ignored(review, mutation):
    obj, remote, clock, store = review
    approve(store)
    with store._connect() as db: db.execute('UPDATE tasks SET '+mutation)
    obj.step()
    assert not remote.sent


def test_expired_callback_disabled_stage_and_restart_do_not_replay(review):
    obj, remote, clock, store = review
    approve(store)
    clock[0] += 100
    obj.step()
    assert not remote.sent
    obj.approval_feed.reset()
    assert obj.approval_feed.read() == []
    approve(store, 1)
    obj.settings.stages['review_approved'].enabled = False
    clock[0] += 6; obj.step()
    assert not remote.sent


def test_original_host_lifespan_observes_callback_with_no_open_page(review, monkeypatch):
    import server
    obj, remote, clock, store = review
    config.write(obj.settings)
    monkeypatch.setattr(server, 'gork_output', obj)
    monkeypatch.setattr(server.professional_host, 'config', lambda: {'external_enabled': False})
    with TestClient(FastAPI(lifespan=server.host_lifespan)):
        clock[0] = 102
        approve(store)
        clock[0] = 110
        for _ in range(150):
            if remote.sent: break
            time.sleep(.02)
        assert len(remote.sent) == 1 and remote.sent[0]['speech']['text'] == TEXT
    assert obj.worker is None


def test_previous_settings_upgrade_preserves_policy_and_file(tmp_path, monkeypatch):
    old = config.Settings(enabled=False, sound=False).model_dump()
    del old['stages']['review_approved']
    old['stages']['review_sent']['text'] = '原有设置'
    path = tmp_path/'old.json'; path.write_text(json.dumps(old), encoding='utf-8')
    monkeypatch.setattr(config, 'CONFIG', path)
    before = path.read_bytes()
    current = config.load()
    assert current.stages['review_approved'].text == '同事已通过“{task}”复核。'
    assert not current.enabled and not current.sound and current.stages['review_sent'].text == '原有设置'
    assert before == path.read_bytes()
    del old['stages']['review_sent']
    path.write_text(json.dumps(old), encoding='utf-8')
    with pytest.raises(HTTPException): config.load()


def test_unavailable_database_does_not_interrupt_host(tmp_path):
    path = tmp_path/'bad.sqlite3'; path.write_bytes(b'broken')
    reader = ApprovalFeed(path, tmp_path); reader.reset()
    assert reader.read() == []


def test_approval_payload_contains_no_reviewer_name_or_template_variable(review):
    obj, remote, clock, store = review
    approve(store)
    events = obj.approval_feed.read()
    assert len(events) == 1 and 'reviewer' not in events[0]
    obj.step()
    payload = json.dumps(remote.sent, ensure_ascii=False)
    assert '石萌' not in payload and '另一位复核人' not in payload
    assert remote.sent[0]['speech']['text'] == TEXT
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        config.Stage(**{**config.default_stages()['review_approved'], 'speech_text': '{reviewer}已通过复核'})
