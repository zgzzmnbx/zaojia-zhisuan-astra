import hashlib
import json
from pathlib import Path

import pytest
from test_gork_notifications import fixture,event
from gork_project import freeze_project


def job_state(tmp_path):
    job=tmp_path/('a'*32);job.mkdir()
    (job/'output.xlsx').write_bytes(b'isolated workbook version')
    state={'project_id':'prj-test','project_name':'联调示例 · 独立数据',
           'batch_attempt':'attempt-1','output_excel':'output.xlsx','artifact_version':1,
           'artifact_sha256':hashlib.sha256((job/'output.xlsx').read_bytes()).hexdigest(),
           'manual_edit_revision':0,'summary':{'matching_status':'completed',
           'table_preview':{'sheet_name':'费用汇总','headers':['项目','金额(元)'],
                            'rows':[['合计(含税)','26728491.00']]}}}
    (job/'process-state.json').write_text(json.dumps(state),encoding='utf-8')
    return job,state


def save(job,state):
    (job/'process-state.json').write_text(json.dumps(state),encoding='utf-8')


def enable_cards(remote):
    remote.capabilities=lambda:{'protocol_version':'1.1','protocol_versions':['1.0','1.1'],
                                'transport':'loopback_http','project_card':{'template':'cost_result'}}


def match(job,clock):
    raw=freeze_project(event(clock,'match_result','completed'),job,'real-request')
    raw['amount_summary']={**raw['_project_snapshot']['amount_summary'],'calculation_status':'recalculated'}
    (job/'sentinel-events').mkdir(exist_ok=True)
    (job/'sentinel-events/match.json').write_text(json.dumps(raw),encoding='utf-8')
    return raw


def test_new_controller_receives_project_card_and_old_controller_keeps_original_output(fixture,tmp_path):
    obj,remote,clock=fixture;job,state=job_state(tmp_path)
    first=match(job,clock);obj.enqueue(first);obj.step()
    old=remote.sent[-1]
    assert old['protocol_version']=='1.0' and 'project_card' not in old
    clock[0]+=11;enable_cards(remote);obj.step()
    raw=match(job,clock);obj.enqueue(raw);obj.step()
    new=remote.sent[-1]
    assert new['protocol_version']=='1.1'
    assert new['project_card']=={'template':'cost_result','project_id':'prj-test',
        'project_name':state['project_name'],'result_status':'completed','risk_status':'not_checked','risk_count':None}
    assert new['amount_summary']==raw['amount_summary']
    assert (new['text'],new['speech'])==(old['text'],old['speech'])


@pytest.mark.parametrize('count',[0,2])
def test_risk_card_carries_same_result_amount_without_adding_it_to_existing_speech(fixture,tmp_path,count):
    obj,remote,clock=fixture;job,state=job_state(tmp_path)
    match(job,clock);clock[0]+=11;enable_cards(remote);obj.settings.sound=True;obj.step()
    state['summary']['warning_summary']={'executed':True,'warning_rows':count};save(job,state)
    risk=event(clock,'warning_result','completed',warning_rows=count);risk['attempt']=''
    frozen=freeze_project(risk,job,'risk-round')
    obj.observe(frozen,job.name,'risk-round');obj.step();payload=remote.sent[-1]
    assert payload['project_card']['risk_status']=='checked' and payload['project_card']['risk_count']==count
    assert payload['amount_summary']['value']=='26728491.00'
    assert payload['amount_summary']['attempt']==payload['attempt']=='request:risk-round'
    assert payload['amount_summary']['calculation_status']=='recalculated'
    assert '26728491' not in payload['text'] and '2672万' not in payload['speech']['text']


@pytest.mark.parametrize('change',['attempt','edited','amount'])
def test_risk_cannot_inherit_confirmation_from_a_different_result(fixture,tmp_path,change):
    obj,remote,clock=fixture;job,state=job_state(tmp_path);match(job,clock)
    if change=='attempt':state['batch_attempt']='new-batch'
    if change=='edited':state['manual_edit_revision']=1
    if change=='amount':state['summary']['table_preview']['rows'][0][1]='12.00'
    state['summary']['warning_summary']={'executed':True,'warning_rows':2};save(job,state)
    clock[0]+=11;enable_cards(remote);obj.step()
    raw=event(clock,'warning_result','completed',warning_rows=2);raw['attempt']=''
    obj.observe(freeze_project(raw,job,'risk-round'),job.name,'risk-round');obj.step()
    assert remote.sent[-1]['amount_summary']['calculation_status']=='unconfirmed'


@pytest.mark.parametrize('revision,expected',[(0,'recalculated'),(1,'unconfirmed')])
def test_pre_upgrade_amount_requires_same_batch_value_and_never_edited_result(tmp_path,revision,expected):
    job,state=job_state(tmp_path);raw=match(job,[101]);raw.pop('_project_snapshot')
    (job/'sentinel-events/match.json').write_text(json.dumps(raw),encoding='utf-8')
    state['manual_edit_revision']=revision
    state['summary']['warning_summary']={'executed':True,'warning_rows':2};save(job,state)
    risk=event([102],'warning_result','completed',warning_rows=2);risk['attempt']=''
    snapshot=freeze_project(risk,job,'risk-round')['_project_snapshot']
    assert snapshot['amount_summary']['calculation_status']==expected


@pytest.mark.parametrize('change',['hash','failed','mismatched_attempt','outside'])
def test_invalid_or_failed_result_never_gets_a_success_card(tmp_path,change):
    job,state=job_state(tmp_path);raw=event([101],'match_result','completed')
    if change=='hash':(job/'output.xlsx').write_bytes(b'changed elsewhere')
    if change=='failed':raw['status']='failed'
    if change=='mismatched_attempt':raw['attempt']='other'
    if change=='outside':state['output_excel']='../outside.xlsx';save(job,state)
    assert '_project_snapshot' not in freeze_project(raw,job,'real-request')


def test_snapshot_stays_frozen_and_cannot_cross_job_or_event(fixture,tmp_path):
    obj,remote,clock=fixture;job,state=job_state(tmp_path);raw=match(job,clock)
    enable_cards(remote);obj.next_connect=0;obj.step()
    state['project_name']='later name';save(job,state)
    obj.enqueue(raw);obj.step();assert remote.sent[-1]['project_card']['project_name']!='later name'
    clock[0]+=1;raw={**raw,'event_id':'different-event'};obj.enqueue(raw);obj.step()
    assert 'project_card' not in remote.sent[-1]


@pytest.mark.parametrize('count,executed',[(None,True),(True,True),(10000,True),(0,False)])
def test_unknown_risk_is_never_presented_as_checked_zero(tmp_path,count,executed):
    job,state=job_state(tmp_path)
    state['summary']['warning_summary']={'executed':executed,'warning_rows':count};save(job,state)
    raw=event([101],'warning_result','completed',warning_rows=count);raw['attempt']=''
    frozen=freeze_project(raw,job,'risk-round')
    assert frozen['_project_snapshot']['card']['risk_status']=='unavailable'
    assert frozen['_project_snapshot']['card']['risk_count'] is None


def test_project_retry_preserves_identical_request_and_does_not_refresh_lifetime(fixture,tmp_path):
    obj,remote,clock=fixture;job,state=job_state(tmp_path);enable_cards(remote);obj.step()
    raw=match(job,clock);obj.enqueue(raw)
    remote.fail=TimeoutError('response lost');obj.step();first=remote.sent[-1]
    clock[0]+=4;remote.fail=None;obj.step()
    assert len(remote.sent)==2 and remote.sent[0]==remote.sent[1]
    assert first['project_card']['risk_status']=='not_checked'


def test_real_publisher_and_host_worker_send_frozen_match_and_checked_zero(fixture,tmp_path,monkeypatch):
    import time
    import server
    from app import sentinel_events
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    obj,remote,clock=fixture;job,state=job_state(tmp_path);enable_cards(remote)
    original=server.gork_output
    monkeypatch.setattr(original,'observe',obj.observe)
    monkeypatch.setattr(server,'gork_output',obj)
    monkeypatch.setattr(server.professional_host,'config',lambda:{'external_enabled':False})
    def wait_for_count(count):
        for _ in range(120):
            if len(remote.sent)>=count:return
            time.sleep(.02)
        assert len(remote.sent)>=count
    clock[0]=time.time()
    with TestClient(FastAPI(lifespan=server.host_lifespan)):
        clock[0]+=1;sentinel_events.publish(job,'match_result',attempt='attempt-1')
        wait_for_count(1)
        assert remote.sent[-1]['protocol_version']=='1.1'
        assert remote.sent[-1]['amount_summary']['value']=='26728491.00'
        committed=json.loads(next((job/'sentinel-events').glob('*.json')).read_text('utf-8'))
        assert committed['_project_snapshot']['artifact_sha256']==state['artifact_sha256']
        state['summary']['warning_summary']={'executed':True,'warning_rows':0};save(job,state)
        clock[0]+=1;sentinel_events.publish(job,'warning_result',warning_rows=0)
        wait_for_count(2)
        risk=remote.sent[-1]
        assert risk['project_card']['risk_status']=='checked' and risk['project_card']['risk_count']==0
        assert risk['amount_summary']['attempt']==risk['attempt']
        assert risk['speech'] is None and '26728491' not in risk['text']
