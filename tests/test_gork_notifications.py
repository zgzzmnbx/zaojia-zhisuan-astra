import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
import gork_config as config
import gork_notifications as bridge


class Controller:
    def __init__(self):
        self.sent, self.heartbeats, self.cancelled = [], [], []
        self.records = {}
        self.fail = None
        self.enabled, self.paused = True, False
        self.policy = {'display_targets': ['desktop','watch'], 'speech_targets': ['pc','watch'], 'max_priority': 5}
    def capabilities(self):
        return {'protocol_version':'1.0','transport':'loopback_http'}
    def status(self):
        return {'source':'astra','enabled':self.enabled,'paused':self.paused,'policy':self.policy,'current_sound_target':'pc'}
    def send(self, payload):
        self.sent.append(dict(payload))
        self.records.setdefault(payload['event_id'], {'status':'active' if payload['kind']=='state' else 'completed','delivery':{'desktop':'displayed'}})
        if self.fail:
            raise self.fail
        return self.records[payload['event_id']]
    def receipt(self, identifier):
        return self.records[identifier]
    def heartbeat(self, *args):
        self.heartbeats.append(args)
    def cancel_task(self, *args):
        self.cancelled.append(args)


@pytest.fixture
def fixture(tmp_path, monkeypatch):
    monkeypatch.setattr(config, 'CONFIG', tmp_path/'config.json')
    monkeypatch.setattr(bridge, 'read_console_health', lambda: {'app':'stopwatch-voice-companion','external_protocol':'1.0','instance':'test-console','robot':{'connected':True}})
    clock=[100.0]
    remote=Controller()
    obj=bridge.Notifications(tmp_path/'outbox.sqlite3',client_factory=lambda settings:remote,clock=lambda:clock[0])
    obj.db()
    settings=config.Settings(enabled=True)
    obj._configure(settings)
    clock[0]=101.0
    yield obj,remote,clock
    obj.stop()


def event(clock, stage='match_start', status='running', **patch):
    return dict(event_id='producer-'+str(clock[0]), job_id='a'*32, attempt='attempt-1',stage=stage,status=status,
                occurred_at=datetime.fromtimestamp(clock[0],timezone.utc).isoformat(),_request='real-request',**patch)


def test_no_history_first_enable_or_disabled_output(fixture):
    obj,remote,clock=fixture
    old=event([99])
    obj.enqueue(old);obj.step()
    assert not remote.sent
    obj.settings.enabled=False
    obj.observe(event(clock),'a'*32);obj.step()
    assert obj.inbox.empty() and not remote.sent


def test_enabled_restart_status_checks_connection_without_sending(fixture):
    obj,remote,clock=fixture
    obj.stop()
    restarted=bridge.Notifications(obj.database,client_factory=lambda settings:remote,clock=lambda:clock[0])
    restarted.start()
    try:
        status=restarted._status(config.load())
        assert status['state']=='ready'
        assert '等待新阶段' in status['message']
        assert not remote.sent
        remote.paused=True
        assert '已暂停' in restarted._status(config.load())['message']
        remote.paused=False
        assert restarted._status(config.load())['state']=='ready'
    finally:
        restarted.stop()


@pytest.mark.parametrize('reason',['disabled','paused','display','speech','priority'])
def test_status_does_not_report_ready_when_permission_is_missing(fixture,reason):
    obj,remote,clock=fixture
    if reason=='disabled':remote.enabled=False
    if reason=='paused':remote.paused=True
    if reason=='display':remote.policy['display_targets']=[]
    if reason=='speech':remote.policy['speech_targets']=[]
    if reason=='priority':remote.policy['max_priority']=0
    obj.settings.sound=True
    result=obj._status(obj.settings)
    assert result['state']=='error'
    assert not remote.sent


def test_disabled_configuration_and_unreachable_console_are_distinct(fixture):
    obj,remote,clock=fixture
    disabled=obj.settings.model_copy(update={'enabled':False})
    assert obj._status(disabled)['state']=='disabled'
    def unavailable(settings):raise TimeoutError('private connection detail')
    obj.client_factory=unavailable
    result=obj._status(obj.settings)
    assert result['state']=='unavailable'
    assert 'private' not in result['message']


def test_reachable_console_without_sending_worker_is_not_ready(fixture):
    obj,remote,clock=fixture
    result=obj._status(obj.settings)
    assert result['state']=='error' and not result['worker_running']
    assert '发送线程未运行' in result['message']
    assert not remote.sent


def test_precise_retry_after_response_lost_is_same_identity(fixture):
    obj,remote,clock=fixture
    obj.enqueue(event(clock));remote.fail=TimeoutError('private secret payload never echoed')
    obj.step();clock[0]+=4;remote.fail=None;obj.step()
    assert len(remote.sent)==2 and remote.sent[0]==remote.sent[1]
    assert 'private' not in str(obj.cached_status)


def test_sequence_survives_restart_and_no_pending_replay(fixture):
    obj,remote,clock=fixture
    obj.enqueue(event(clock));obj.step()
    clock[0]+=1;obj.enqueue(event(clock,'match_result','completed'))
    saved=obj.settings
    obj.stop()
    other=bridge.Notifications(obj.database,client_factory=lambda s:remote,clock=lambda:clock[0])
    other.settings=saved;other.db();other.cutoff=clock[0];other.client=remote
    other.step()
    assert len(remote.sent)==1
    clock[0]+=1;other.enqueue(event(clock,'match_result','completed'));other.step()
    assert remote.sent[-1]['sequence']==3
    other.stop()


def test_new_stage_skips_unsent_start_and_duplicate_producer(fixture):
    obj,remote,clock=fixture
    obj.enqueue(event(clock));clock[0]+=.1
    complete=event(clock,'match_result','completed')
    obj.enqueue(complete);obj.enqueue(complete);obj.step()
    assert len(remote.sent)==1 and remote.sent[0]['stage']=='match_completed'
    assert remote.sent[0]['sequence']==2


def test_lease_only_while_actual_request_running_never_repeats_speech(fixture):
    obj,remote,clock=fixture
    obj.settings.sound=True
    obj.begin('real-request');obj.enqueue(event(clock));obj.step()
    clock[0]+=11;obj.step()
    assert len(remote.sent)==1 and len(remote.heartbeats)==2
    obj.end('real-request');clock[0]+=11;obj.step()
    assert len(remote.heartbeats)==2


def test_expired_notice_does_not_send(fixture):
    obj,remote,clock=fixture
    obj.enqueue(event(clock,'match_result','completed'));clock[0]+=91;obj.step()
    assert not remote.sent
    assert obj.db().execute('SELECT status FROM events').fetchone()[0]=='expired'


def test_own_cancel_tombstone_rejects_late_even_after_restart(fixture):
    obj,remote,clock=fixture
    obj.enqueue(event(clock));obj.step();obj.cancel('a'*32,'attempt-1')
    clock[0]+=1;obj.enqueue(event(clock,'match_result','completed'));obj.step()
    assert len(remote.sent)==1 and remote.cancelled==[('a'*32,'attempt-1')]
    assert obj.db().execute('SELECT status FROM events').fetchone()[0]=='cancelled'


def test_cancelled_request_drops_buffered_and_late_start(fixture):
    obj,remote,clock=fixture
    obj.begin('real-request');obj.observe(event(clock),'a'*32,'real-request')
    obj.end('real-request',cancelled=True);obj.step()
    assert not remote.sent


def test_amount_basis_caveat_required_in_custom_speech_and_attempt(fixture):
    obj,remote,clock=fixture
    obj.settings.sound=True
    obj.settings.stages['match_completed'].speech_text='处理完毕。'
    summary={'value':'9447173.00','currency':'CNY','unit':'yuan','basis':'tax_included','attempt':'attempt-1','calculation_status':'unconfirmed'}
    obj.enqueue(event(clock,'match_result','completed',amount_summary=summary));obj.step()
    p=remote.sent[-1]
    assert p['amount_summary']==summary
    assert p['speech']['mode']=='auto'
    assert '表内含税总额944.7173万元。公式重算未确认。' in p['speech']['text']
    clock[0]+=1;summary['attempt']='old'
    obj.enqueue(event(clock,'match_result','completed',amount_summary=summary));obj.step()
    assert 'amount_summary' not in remote.sent[-1]
    assert '9447173' not in remote.sent[-1]['speech']['text']


def test_rendered_amount_count_and_task_text_preserve_the_selected_cache_mode(fixture):
    obj,remote,clock=fixture
    obj.settings.sound=True
    obj.settings.speech_mode='cached'
    obj.enqueue(event(clock));obj.step()
    assert remote.sent[-1]['speech']['mode']=='cached'
    for template in ['发现 {warnings}','待复核 {review}','{task} 处理完成']:
        clock[0]+=1
        obj.settings.stages['match_completed'].speech_text=template
        obj.enqueue(event(clock,'match_result','completed'));obj.step()
        assert remote.sent[-1]['speech']['mode']=='cached'
        assert not any(token in remote.sent[-1]['speech']['text'] for token in ['{warnings}','{review}','{task}'])


@pytest.mark.parametrize('reason',['disabled','paused','display','speech','priority'])
def test_enable_fails_closed_when_source_permissions_do_not_allow(fixture,reason):
    obj,remote,clock=fixture
    proposal=obj.settings.model_copy(deep=True)
    if reason=='disabled':remote.enabled=False
    if reason=='paused':remote.paused=True
    if reason=='display':remote.policy['display_targets']=[]
    if reason=='speech':proposal.sound=True;remote.policy['speech_targets']=[]
    if reason=='priority':remote.policy['max_priority']=0
    with pytest.raises(HTTPException):obj._configure(proposal)
    assert not remote.sent


def test_revision_conflict_and_reenable_no_history_or_sequence_reset(fixture):
    obj,remote,clock=fixture
    obj.enqueue(event(clock));obj.step()
    with pytest.raises(HTTPException):obj._configure(config.Settings(enabled=False,revision=0))
    obj._configure(obj.settings.model_copy(update={'enabled':False}))
    clock[0]+=1
    old=event(clock);obj.observe(old,'a'*32)
    obj._configure(obj.settings.model_copy(update={'enabled':True}));obj.enqueue(old);obj.step()
    assert len(remote.sent)==1
    clock[0]+=1;fresh=event(clock);fresh['attempt']='attempt-2';obj.enqueue(fresh);obj.step()
    assert remote.sent[-1]['sequence']==2


def test_derived_review_sent_only_fresh_verified_feed(fixture):
    obj,remote,clock=fixture
    fresh=event(clock,'review_sent','sent')
    obj.feed=lambda:[event([99],'review_sent','sent'),fresh]
    obj.step();clock[0]+=6;obj.step()
    assert len(remote.sent)==1 and remote.sent[0]['stage']=='review_sent'


def test_two_platform_delivery_notifications_are_one_per_result_round(fixture):
    obj,remote,clock=fixture
    obj.settings.sound=True
    first=event(clock,'review_sent','sent',_review_scope='b'*64)
    second={**first,'event_id':'weact-delivery','platform':'weact_cost'}
    obj.feed=lambda:[first,second]
    obj.step()
    assert len(remote.sent)==1 and remote.sent[0]['speech']['text']=='复核资料已送达，等待同事反馈。'
    assert obj.db().execute('SELECT count(*) FROM review_notices').fetchone()[0]==1
    clock[0]+=6;obj.step()
    assert len(remote.sent)==1
    clock[0]+=1
    obj.enqueue(event(clock,'review_sent','sent',_review_scope='c'*64));obj.step()
    assert len(remote.sent)==2  # Explicit next round or different result gets its own notice.


def test_delivery_watermark_survives_restart_and_outbox_retention(fixture):
    obj,remote,clock=fixture
    obj.enqueue(event(clock,'review_sent','sent',_review_scope='b'*64));obj.step()
    obj.db().execute('DELETE FROM events');obj.db().commit()
    restarted=bridge.Notifications(obj.database,client_factory=lambda settings:remote,clock=lambda:clock[0])
    restarted.settings=obj.settings
    clock[0]+=1
    try:
        restarted.enqueue(event(clock,'review_sent','sent',_review_scope='b'*64))
        assert restarted.db().execute('SELECT count(*) FROM events').fetchone()[0]==0
    finally:restarted.stop()


def test_unsent_failed_delivery_notice_can_recover_from_other_platform(fixture):
    obj,remote,clock=fixture
    obj.enqueue(event(clock,'review_sent','sent',_review_scope='b'*64))
    remote.fail=bridge.sdk.GorkError(403,'EXTERNAL_OUTPUT_DENIED');obj.step()
    remote.fail=None;clock[0]+=1
    obj.enqueue(event(clock,'review_sent','sent',_review_scope='b'*64));obj.step()
    assert len(remote.sent)==2 and obj.db().execute("SELECT count(*) FROM events WHERE status='completed'").fetchone()[0]==1


def test_manual_delivery_debug_clicks_remain_repeatable(fixture):
    obj,remote,clock=fixture
    obj._configure(obj.settings.model_copy(update={'sound':True}))
    clock[0]+=1
    obj.debug_send('review_sent');obj.step();clock[0]+=1
    obj.debug_send('review_sent');obj.step()
    assert len(remote.sent)==2 and all(p['speech'] for p in remote.sent)


def test_non_retryable_error_retains_safe_code(fixture):
    obj,remote,clock=fixture
    obj.enqueue(event(clock));remote.fail=bridge.sdk.GorkError(403,'EXTERNAL_OUTPUT_DENIED')
    obj.step();clock[0]+=10;obj.step()
    assert len(remote.sent)==1
    assert obj.db().execute('SELECT error FROM events').fetchone()[0]=='EXTERNAL_OUTPUT_DENIED'


def test_settings_routes_drafts_cannot_enable_uninstalled_bridge(tmp_path,monkeypatch):
    monkeypatch.setattr(config,'CONFIG',tmp_path/'settings.json');monkeypatch.setattr(config,'bridge',None)
    app=FastAPI();app.include_router(config.router)
    with TestClient(app) as client:
        settings=client.get('/api/astra/gork/notifications').json()['settings']
        settings['enabled']=True
        assert client.put('/api/astra/gork/notifications',json=settings).status_code==409
        assert client.post('/api/astra/gork/notifications/cancel',json={'task_id':'other-source','attempt':'1'}).status_code==422


def test_cancel_retry_is_durable_and_does_not_replay_output(fixture):
    obj,remote,clock=fixture
    obj.enqueue(event(clock));obj.step()
    original=remote.cancel_task
    def offline(*args):raise TimeoutError('untrusted private response')
    remote.cancel_task=offline
    assert obj.cancel('a'*32,'attempt-1') is False
    obj.settings.enabled=False
    remote.cancel_task=original;clock[0]+=4;obj.step()
    assert remote.cancelled==[('a'*32,'attempt-1')]
    assert len(remote.sent)==1
    assert obj.db().execute('SELECT confirmed FROM cancellations').fetchone()[0]==1
