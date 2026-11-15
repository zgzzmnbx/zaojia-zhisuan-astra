import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from test_gork_notifications import fixture, event
import gork_config as config
from gork_web_speech import WebSpeech, attach


def make_web(obj, clock, **kwargs):
    web = WebSpeech(clock=lambda: clock[0], settings=lambda: obj.settings, **kwargs)
    web.cutoff = 100
    attach(web, obj)
    return web


@pytest.mark.parametrize('disabled', ['automatic', 'sound', 'stage', 'speech', 'offline', 'paused'])
def test_web_independent_of_hardware_gates(fixture, disabled):
    obj, remote, clock = fixture
    obj.settings.sound = True
    obj.settings.speech_target = 'watch'
    stage = obj.settings.stages['match_start']
    stage.speech_text = '同一份语音文案。'
    if disabled == 'automatic': obj.settings.enabled = False
    if disabled == 'sound': obj.settings.sound = False
    if disabled == 'stage': stage.enabled = False
    if disabled == 'speech': stage.speech = False
    if disabled in {'offline', 'paused'}:
        obj.client_factory = Mock(side_effect=RuntimeError(disabled))
    before = obj.settings.model_dump()
    web = make_web(obj, clock)
    first = web.snapshot()
    obj.observe(event(clock), 'a'*32, 'real-request')
    web.step()
    assert web.snapshot(first['stream'])['items'][0]['text'] == stage.speech_text
    assert not remote.sent and obj.settings.model_dump() == before
    if disabled == 'automatic': assert obj.inbox.empty()


def test_attached_observer_preserves_watch_payload_receipt_and_dedup(fixture):
    obj, remote, clock = fixture
    obj.settings.sound = True
    obj.settings.speech_target = 'watch'
    obj.settings.stages['match_start'].speech_text = '开始规则匹配。'
    web = make_web(obj, clock)
    first = web.snapshot()
    obj.begin('real-request')
    item = event(clock)
    original = dict(item)
    obj.observe(item, 'a'*32, 'real-request')
    web.step()
    obj.step()
    assert len(remote.sent) == 1
    assert remote.sent[0]['speech']['text'] == web.snapshot(first['stream'])['items'][0]['text']
    assert item == original
    clock[0] += 3
    obj.observe(item, 'a'*32, 'real-request')
    obj.step(); web.step()
    assert len(remote.sent) == 1 and len(web.snapshot(first['stream'])['items']) == 1
    row = obj.db().execute('SELECT receipt FROM events').fetchone()
    assert json.loads(row['receipt'])['status'] in {'active', 'completed'}


def test_web_failure_never_changes_original_calls_returns_or_exceptions():
    failure = RuntimeError('web broken')
    web = SimpleNamespace(observe=Mock(side_effect=failure))
    observe = Mock(return_value='original-result')
    enqueue = Mock(return_value=None)
    obj = SimpleNamespace(observe=observe, enqueue=enqueue, settings=config.Settings())
    attach(web, obj)
    item = {'job_id': 'a'*32}
    assert obj.observe(item, 'job', 'round') == 'original-result'
    observe.assert_called_once_with(item, 'job', 'round')
    assert obj.enqueue(item, manual=True) is None
    enqueue.assert_called_once_with(item, manual=True)
    original_error = ValueError('original failure')
    observe.side_effect = original_error
    with pytest.raises(ValueError) as error: obj.observe(item, 'job')
    assert error.value is original_error
    assert web.observe.call_count == 2


def test_web_history_expiry_invalid_input_and_first_read(fixture):
    obj, remote, clock = fixture
    web = make_web(obj, clock)
    for invalid in [event([99]), {**event(clock), 'event_id': ''}, {**event(clock), 'job_id': '../unsafe'}, event([150])]:
        web.observe(invalid, invalid['job_id'])
    web.step()
    assert web.mirror.sequence == 0
    first = web.snapshot()
    web.observe(event(clock), 'a'*32); web.step()
    assert web.snapshot()['items'] == []
    assert len(web.snapshot(first['stream'])['items']) == 1
    clock[0] += 91
    assert web.snapshot(first['stream'])['items'] == []


def test_review_feed_runs_without_watch_and_isolated_from_feed_failure(fixture):
    obj, remote, clock = fixture
    obj.settings.enabled = False
    approved = {**event(clock, 'review_approved', 'approved'), 'task_name': '测试任务'}
    feed = SimpleNamespace(read=lambda: [approved])
    web = make_web(obj, clock, feed=Mock(side_effect=RuntimeError('monitor unavailable')), approval_feed=feed)
    first = web.snapshot(); web.step()
    assert '测试任务' in web.snapshot(first['stream'])['items'][0]['text']
    clock[0] += 3; web.step()
    assert len(web.snapshot(first['stream'])['items']) == 1
    assert not remote.sent


def test_explicit_manual_replay_remains_visible(fixture):
    obj, remote, clock = fixture
    web = make_web(obj, clock)
    first = web.snapshot()
    obj.enqueue(event(clock), manual=True)
    web.step()
    assert len(web.snapshot(first['stream'])['items']) == 1
    assert not remote.sent  # Browser collection alone never dispatches.


def test_web_endpoint_read_only_without_hardware_start(monkeypatch):
    import server
    from fastapi.testclient import TestClient
    read = Mock(return_value={'stream': 'test', 'cursor': 0, 'items': []})
    monkeypatch.setattr(server.gork_web, 'snapshot', read)
    monkeypatch.setattr(server.gork_output, 'start', Mock(side_effect=AssertionError('must not start Watch')))
    route = next(r for r in server.app.routes if getattr(r, 'path', '') == '/api/astra/gork/web-speech')
    client = TestClient(server.app)
    response = client.get(route.path)
    assert response.status_code == 200 and response.json()['items'] == []
    read.assert_called_once_with('', 0)
    assert client.post(route.path).status_code == 405


def test_real_web_worker_collects_when_watch_disabled(fixture):
    import time
    obj, remote, clock = fixture
    obj.settings.enabled = False
    web = make_web(obj, clock)
    web.start()
    try:
        first = web.snapshot()
        clock[0] += 1
        obj.observe(event(clock), 'a'*32)
        deadline = time.monotonic() + 2
        while not web.snapshot(first['stream'])['items'] and time.monotonic() < deadline:
            time.sleep(.02)
        assert len(web.snapshot(first['stream'])['items']) == 1
        assert obj.inbox.empty() and not remote.sent
    finally:
        web.stop()
    assert web.worker is None
