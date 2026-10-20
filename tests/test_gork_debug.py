import json
import pytest
from fastapi import HTTPException
from test_gork_notifications import fixture


def test_manual_signal_allowed_with_automatic_off_no_business_event(fixture):
    obj,remote,clock=fixture
    obj._configure(obj.settings.model_copy(update={'enabled':False}))
    clock[0]+=1
    record=obj.debug_send('match_completed',True,'9447173.00')
    assert record['status']=='pending' and record['delivery']=={}
    obj.step()
    assert not obj.settings.enabled
    payload=remote.sent[-1]
    assert payload['task_id'].startswith('debug-')
    assert payload['attempt'].startswith('debug-')
    assert payload['text'].startswith('匹配完成，')
    assert '9447173元。公式重算未确认。' in payload['text']
    assert payload['amount_summary']['attempt']==payload['attempt']
    assert obj.debug_receipt(record['event_id'])['status']=='completed'


def test_all_thirteen_stages_use_same_mapper_and_strict_sequence(fixture):
    obj,remote,clock=fixture
    from gork_config import DEFINITIONS
    for key,*_ in DEFINITIONS:
        clock[0]+=3
        record=obj.debug_send(key)
        obj.step()
        assert remote.sent[-1]['stage']==key
        assert record['task_id'].startswith('debug-')
    assert [x['sequence'] for x in remote.sent]==list(range(1,14))
    assert all(x['speech'] is None for x in remote.sent)


def test_debug_manual_heartbeat_and_cancel_new_round(fixture):
    obj,remote,clock=fixture
    record=obj.debug_send('match_start');obj.step()
    obj.debug_heartbeat(record['event_id'])
    assert len(remote.heartbeats)==1
    old=record['attempt'];obj.debug_cancel();clock[0]+=1
    second=obj.debug_send('match_completed');obj.step()
    assert second['attempt']!=old and remote.cancelled[-1][1]==old
    with pytest.raises(HTTPException):obj.debug_receipt('business-event')
    with pytest.raises(HTTPException):obj.debug_heartbeat(second['event_id'])


def test_saving_settings_during_debug_starts_a_fresh_debug_attempt(fixture):
    obj,remote,clock=fixture
    first=obj.debug_send('match_start');obj.step()
    old_attempt=first['attempt']
    clock[0]+=1
    obj._configure(obj.settings.model_copy(update={'sound':False}))
    clock[0]+=1
    second=obj.debug_send('match_completed');obj.step()
    assert second['attempt']!=old_attempt
    assert remote.cancelled[-1][1]==old_attempt
    assert remote.sent[-1]['stage']=='match_completed'


def test_cancelled_debug_attempt_recovers_without_releasing_old_cancellation(fixture):
    obj,remote,clock=fixture
    old=obj.debug_attempt
    obj.cancel(obj.debug_task,old)
    record=obj.debug_send('match_completed');obj.step()
    assert record['attempt']!=old
    assert obj.db().execute('SELECT 1 FROM cancellations WHERE task=? AND attempt=?',
                            (obj.debug_task,old)).fetchone()
    assert len(remote.sent)==1 and remote.sent[0]['speech'] is None


def test_immediate_debug_after_save_is_new_but_business_history_stays_blocked(fixture):
    from test_gork_notifications import event
    obj,remote,clock=fixture
    obj._configure(obj.settings.model_copy(update={'sound':False}))
    assert obj.enqueue(event(clock))=='ASTRA_GORK_OLD_EVENT'
    record=obj.debug_send('match_completed');obj.step()
    assert len(remote.sent)==1 and remote.sent[0]['event_id']==record['event_id']


def test_closed_stage_and_full_queue_report_distinct_reasons(fixture):
    from test_gork_notifications import event
    obj,remote,clock=fixture
    settings=obj.settings.model_copy(deep=True);settings.stages['match_completed'].enabled=False
    obj._configure(settings)
    with pytest.raises(HTTPException,match='ASTRA_GORK_STAGE_DISABLED'):
        obj.debug_send('match_completed')
    settings=obj.settings.model_copy(deep=True);settings.stages['match_completed'].enabled=True
    obj._configure(settings);clock[0]+=1
    for index in range(64):
        item=event(clock);item.update(job_id=f'{index:032x}',event_id=f'queued-{index}')
        assert obj.enqueue(item) is None
    with pytest.raises(HTTPException,match='ASTRA_GORK_QUEUE_FULL'):
        obj.debug_send('match_completed')
    assert not remote.sent
    clock[0]+=91
    record=obj.debug_send('match_completed');obj.step()
    assert len(remote.sent)==1 and remote.sent[0]['event_id']==record['event_id']
    assert obj.db().execute("SELECT count(*) FROM events WHERE status='expired'").fetchone()[0]==64


def test_host_worker_dispatches_new_debug_after_http_settings_save(fixture,monkeypatch):
    import time
    import server, gork_config, gork_link
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    obj,remote,clock=fixture
    monkeypatch.setattr(server,'gork_output',obj)
    monkeypatch.setattr(gork_config,'bridge',obj)
    monkeypatch.setattr(server.professional_host,'config',lambda:{'external_enabled':False})
    async def legacy_status():return {'tracking':False,'message':'测试控制台'}
    monkeypatch.setattr(gork_link,'console_status',legacy_status)
    app=FastAPI(lifespan=server.host_lifespan);app.include_router(gork_config.router)
    route='/api/astra/gork/notifications'
    with TestClient(app) as client:
        clock[0]+=1
        first=client.post(route+'/debug/send',json={'stage':'match_start'})
        assert first.status_code==200
        for _ in range(100):
            if remote.sent:break
            time.sleep(.02)
        assert remote.sent and obj.worker.is_alive()
        saved=client.put(route,json=obj.settings.model_dump())
        assert saved.status_code==200
        second=client.post(route+'/debug/send',json={'stage':'match_completed'})
        assert second.status_code==200 and second.json()['attempt']!=first.json()['attempt']
        for _ in range(100):
            receipt=client.get(route+'/debug/'+second.json()['event_id']).json()
            if receipt['status']=='completed':break
            time.sleep(.02)
        assert receipt['status']=='completed' and receipt['delivery']=={'desktop':'displayed'}
        assert remote.sent[-1]['stage']=='match_completed' and remote.sent[-1]['speech'] is None


@pytest.mark.parametrize('amount',['NaN','-1','1e4','invalid','1000000000001'])
def test_debug_invalid_amount_not_output(fixture,amount):
    obj,remote,clock=fixture
    with pytest.raises(HTTPException):obj.debug_send('match_completed',True,amount)
    obj.step();assert not remote.sent


def test_debug_cannot_bypass_source_policy_or_closed_stage(fixture):
    obj,remote,clock=fixture
    remote.enabled=False
    with pytest.raises(HTTPException):obj.debug_send('match_completed')
    remote.enabled=True
    settings=obj.settings.model_copy(deep=True);settings.stages['match_completed'].enabled=False
    obj._configure(settings);clock[0]+=1
    with pytest.raises(HTTPException):obj.debug_send('match_completed')
    assert not remote.sent


def test_long_debug_templates_use_stage_copy_and_keep_full_amount_caveat(fixture):
    obj,remote,clock=fixture
    settings=obj.settings.model_copy(deep=True);settings.sound=True
    settings.stages['match_completed'].text='说明'*145+'{amount}'
    settings.stages['match_completed'].speech_text='语音'*145+'{amount}'
    obj._configure(settings);clock[0]+=1
    obj.debug_send('match_completed',True);obj.step()
    payload=remote.sent[-1]
    assert payload['text'].startswith('说明')
    assert payload['speech']['text'].startswith('语音')
    assert len(payload['text'])<=300 and payload['text'].endswith('9447173元。公式重算未确认。')
    assert len(payload['speech']['text'])<=300 and payload['speech']['text'].endswith('944万。公式重算未确认。')


def test_debug_and_business_copy_match_but_keep_separate_identity(fixture):
    from test_gork_notifications import event
    obj,remote,clock=fixture
    settings=obj.settings.model_copy(deep=True);settings.sound=True
    obj._configure(settings);clock[0]+=1
    record=obj.debug_send('warning_found');obj.step()
    debug=remote.sent[-1]
    clock[0]+=1
    obj.enqueue(event(clock,stage='warning_result',status='completed',warning_rows=2,review_rows=1));obj.step()
    actual=remote.sent[-1]
    assert debug['text']==actual['text']=='风险检查完成，2项需复核。'
    assert debug['speech']['text']==actual['speech']['text']==debug['text']
    assert debug['task_id'].startswith('debug-') and debug['task_id']!=actual['task_id']
    assert obj.db().execute('SELECT debug FROM events WHERE id=?',(record['event_id'],)).fetchone()[0]==1


def test_debug_and_business_amount_speech_use_wan_with_exact_yuan_snapshot(fixture):
    from test_gork_notifications import event
    obj,remote,clock=fixture
    settings=obj.settings.model_copy(deep=True);settings.sound=True
    obj._configure(settings);clock[0]+=1
    obj.debug_send('match_completed',True,'26728500.00');obj.step()
    debug=remote.sent[-1]
    clock[0]+=1
    actual_event=event(clock,stage='match_result',status='completed',review_rows=1)
    actual_event['amount_summary']={'attempt':actual_event['attempt'],'value':'26728500.00',
        'unit':'yuan','currency':'CNY','basis':'tax_included','calculation_status':'unconfirmed'}
    obj.enqueue(actual_event);obj.step()
    actual=remote.sent[-1]
    for payload in (debug,actual):
        assert payload['speech']['text']=='匹配完成，表内含税总额2672万。公式重算未确认。1项待复核。'
        assert '26728500元' in payload['text']
        assert payload['amount_summary']['value']=='26728500.00'
        assert payload['amount_summary']['unit']=='yuan'


def project_support(remote):
    remote.capabilities=lambda:{'protocol_version':'1.1','protocol_versions':['1.0','1.1'],
        'transport':'loopback_http','project_card':{'template':'cost_result'}}


def test_watch_card_is_opt_in_and_preserves_ordinary_amount_speech(fixture):
    obj,remote,clock=fixture;project_support(remote)
    settings=obj.settings.model_copy(deep=True);settings.sound=True
    obj._configure(settings);clock[0]+=1
    ordinary=obj.debug_send('match_completed',True,'9474173.00');obj.step()
    first=remote.sent[-1]
    clock[0]+=1
    card=obj.debug_send('match_completed',True,'9474173.00',watch_card=True);obj.step()
    payload=remote.sent[-1]
    assert 'project_card' not in first and first['amount_summary']['calculation_status']=='unconfirmed'
    assert payload['protocol_version']=='1.1' and '调试示例' in payload['project_card']['project_name']
    assert payload['project_card']['risk_status']=='not_checked' and payload['project_card']['risk_count'] is None
    assert payload['amount_summary']['value']=='9474173.00' and payload['amount_summary']['calculation_status']=='recalculated'
    assert payload['text']==first['text'] and payload['speech']==first['speech']
    assert '公式重算未确认' in payload['speech']['text']
    assert card['event_id']!=ordinary['event_id']


@pytest.mark.parametrize('reason',['unsupported','desktop','permission','state','failed'])
def test_watch_card_cannot_bypass_capability_display_or_stage_gate(fixture,reason):
    obj,remote,clock=fixture;project_support(remote)
    stage='match_completed'
    settings=obj.settings.model_copy(deep=True)
    if reason=='unsupported':remote.capabilities=lambda:{'protocol_version':'1.0','transport':'loopback_http'}
    if reason=='desktop':settings.display_target='desktop'
    if reason=='permission':settings.display_target='desktop';remote.policy['display_targets']=['desktop']
    if reason=='state':settings.stages[stage].kind='state'
    if reason=='failed':stage='match_failed'
    obj._configure(settings);clock[0]+=1
    before=bridge_settings_bytes(obj)
    with pytest.raises(HTTPException):obj.debug_send(stage,True,'9474173.00',watch_card=True)
    assert not remote.sent and obj.db().execute('SELECT count(*) FROM events').fetchone()[0]==0
    assert bridge_settings_bytes(obj)==before


def bridge_settings_bytes(obj):
    import gork_config
    return gork_config.CONFIG.read_bytes()


@pytest.mark.parametrize('stage,status,count',[('warning_completed','checked',0),('warning_found','checked',2)])
def test_watch_risk_debug_keeps_zero_distinct_and_amount_out_of_voice(fixture,stage,status,count):
    obj,remote,clock=fixture;project_support(remote)
    obj.debug_send(stage,True,'9474173.00',watch_card=True);obj.step();payload=remote.sent[-1]
    assert payload['project_card']['risk_status']==status and payload['project_card']['risk_count']==count
    assert payload['amount_summary']['value']=='9474173.00'
    assert '9474173' not in payload['text'] and payload['speech'] is None


def test_watch_card_without_amount_is_not_invented_zero(fixture):
    obj,remote,clock=fixture;project_support(remote)
    obj.debug_send('match_completed',watch_card=True);obj.step();payload=remote.sent[-1]
    assert 'amount_summary' not in payload and payload['project_card']['risk_status']=='not_checked'


def test_watch_debug_api_routes_opt_in_without_changing_saved_policy(fixture,monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    import gork_config
    obj,remote,clock=fixture;project_support(remote)
    monkeypatch.setattr(gork_config,'bridge',obj)
    app=FastAPI();app.include_router(gork_config.router)
    before=bridge_settings_bytes(obj)
    with TestClient(app) as client:
        r=client.post('/api/astra/gork/notifications/debug/send',json={
            'stage':'match_completed','include_amount':True,'amount':'9474173.00','watch_card':True})
        assert r.status_code==200
        payload=r.json()['request']
        assert payload['project_card']['project_name'].startswith('调试示例')
        assert payload['amount_summary']['value']=='9474173.00'
        assert payload['task_id'].startswith('debug-') and payload['speech'] is None
    assert bridge_settings_bytes(obj)==before


def test_read_only_status_exposes_screen_capability_without_sending(fixture):
    obj,remote,clock=fixture
    assert obj._status(obj.settings)['project_card_supported'] is False
    project_support(remote)
    assert obj._status(obj.settings)['project_card_supported'] is True
    assert not remote.sent
