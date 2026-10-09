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
    assert payload['text'].startswith('【调试·模拟数据】')
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


def test_long_debug_templates_keep_prefix_and_full_amount_caveat(fixture):
    obj,remote,clock=fixture
    settings=obj.settings.model_copy(deep=True);settings.sound=True
    settings.stages['match_completed'].text='说明'*145+'{amount}'
    settings.stages['match_completed'].speech_text='语音'*145+'{amount}'
    obj._configure(settings);clock[0]+=1
    obj.debug_send('match_completed',True);obj.step()
    payload=remote.sent[-1]
    assert payload['text'].startswith('【调试·模拟数据】')
    assert payload['speech']['text'].startswith('调试消息，模拟数据。')
    for text in [payload['text'],payload['speech']['text']]:
        assert len(text)<=300 and text.endswith('9447173元。公式重算未确认。')
