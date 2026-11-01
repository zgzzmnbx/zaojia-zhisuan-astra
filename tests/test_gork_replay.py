import json
from uuid import uuid4
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from test_gork_notifications import fixture
from test_gork_project import job_state, match, enable_cards, save
from gork_replay import ReplayRequest, replay, receipt, install
import gork_config as config
import gork_notifications as notifications


def request(version=1):
    return ReplayRequest(artifact_version=version, request_id=uuid4().hex)


def test_manual_replay_uses_real_snapshot_watch_and_normal_completion_without_business_writes(fixture,tmp_path):
    obj,remote,clock=fixture;job,state=job_state(tmp_path);original=match(job,clock);enable_cards(remote)
    before={p.name:p.read_bytes() for p in job.rglob('*') if p.is_file()}
    settings=config.load();settings.enabled=False;config.write(settings);obj.settings=settings
    first=request();answer=replay(obj,tmp_path,job.name,first)
    assert answer==replay(obj,tmp_path,job.name,first)
    assert answer==replay(obj,tmp_path,job.name,request()),'pending double clicks coalesce'
    obj.step();payload=remote.sent[-1]
    assert payload['stage']=='match_completed' and payload['kind']=='notice'
    assert payload['display_target']=='watch' and payload['speech']['target']=='watch'
    assert '2672万' in payload['speech']['text']
    assert payload['amount_summary']['value']==original['amount_summary']['value']
    assert payload['amount_summary']['calculation_status']=='recalculated'
    assert payload['project_card']['project_id']=='prj-test'
    assert payload['attempt'].startswith('replay:') and payload['protocol_version']=='1.1'
    assert config.load()==settings and obj.settings==settings
    assert before=={p.name:p.read_bytes() for p in job.rglob('*') if p.is_file()}
    assert receipt(obj,job.name,answer['event_id'])['status']=='completed'
    assert replay(obj,tmp_path,job.name,first)['event_id']==answer['event_id']
    assert replay(obj,tmp_path,job.name,request())['event_id']!=answer['event_id']


@pytest.mark.parametrize('case',['pending','version','dirty','hash','no_amount','active','offline','permission','paused'])
def test_replay_rejects_unavailable_or_changed_results_without_output(fixture,tmp_path,monkeypatch,case):
    obj,remote,clock=fixture;job,state=job_state(tmp_path);match(job,clock)
    if case=='pending':state['summary']['matching_status']='pending';save(job,state)
    if case=='version':state['artifact_version']=2;save(job,state)
    if case=='dirty':(job/'astra-edit-state.json').write_text('{"needs_recalculate":true}')
    if case=='hash':(job/'output.xlsx').write_bytes(b'changed')
    if case=='no_amount':state['summary']['table_preview']['rows']=[];save(job,state)
    if case=='active':obj.begin('working')
    if case=='offline':monkeypatch.setattr(notifications,'read_console_health',lambda:{'app':'stopwatch-voice-companion','instance':'x','robot':{'connected':False}})
    if case=='permission':remote.policy['speech_targets']=['pc']
    if case=='paused':remote.paused=True
    with pytest.raises(HTTPException):replay(obj,tmp_path,job.name,request())
    assert not remote.sent and not obj.db().execute('SELECT 1 FROM events WHERE manual=1').fetchone()


def test_unconfirmed_amount_retains_caveat_and_api_validates_request(fixture,tmp_path):
    obj,remote,clock=fixture;job,state=job_state(tmp_path)
    app=FastAPI();install(app,obj,tmp_path);client=TestClient(app);url=f'/api/astra/gork/notifications/match/{job.name}/replay'
    assert client.post(url,json={**request().model_dump(),'amount':'123'}).status_code==422
    assert client.post(url,json=request(2).model_dump()).status_code==409
    response=client.post(url,json=request().model_dump());assert response.status_code==200
    obj.step();assert '公式重算未确认' in remote.sent[-1]['speech']['text']
    event=response.json()['event_id'];assert client.get(url+'/'+event).status_code==200
    assert client.get(url.replace(job.name,'b'*32)+'/'+event).status_code==404
    assert client.post(url.replace(job.name,'invalid'),json=request().model_dump()).status_code==400


def test_result_changed_during_connection_is_not_sent(fixture,tmp_path):
    obj,remote,clock=fixture;job,state=job_state(tmp_path);match(job,clock)
    old=remote.status
    def changed():
        state['artifact_version']=2;save(job,state);return old()
    remote.status=changed
    with pytest.raises(HTTPException):replay(obj,tmp_path,job.name,request())
    assert not obj.db().execute('SELECT 1 FROM events WHERE manual=1').fetchone()
