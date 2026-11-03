import json
from uuid import uuid4
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from gork_commands import CommandBridge, Context, Command, Ack, install, PREFIX

@pytest.fixture
def bridge(tmp_path):
    p=tmp_path/'token.json';p.write_text(json.dumps(dict(enabled=True,token='x'*48)))
    now=[100.0]
    return CommandBridge(p,lambda:now[0]),now

def context(**kwargs):
    return Context(client=str(uuid4()),context='conversation',job='a'*32,**kwargs)

def command(b,**kwargs):
    return Command(request_id=uuid4().hex,binding=b.context()['binding'],action='check_risk',**kwargs)

def test_claim_once_and_idempotent_receipt(bridge):
    b,clock=bridge;c=context();b.poll(c);cmd=command(b)
    assert b.submit(cmd)['status']=='pending'
    assert b.submit(cmd)['status']=='pending'
    assert b.poll(c)['command']['action']=='check_risk'
    assert b.poll(c)['command'] is None
    ack=Ack(**c.model_dump(),request_id=cmd.request_id,message='已提交检查')
    assert b.ack(ack)['status']=='completed'
    assert b.submit(cmd)['message']=='已提交检查'

def test_switch_during_recording_rejects_and_never_replays(bridge):
    b,clock=bridge;c=context();b.poll(c);cmd=command(b)
    b.poll(c.model_copy(update={'context':'another'}))
    with pytest.raises(HTTPException):b.submit(cmd)
    b.poll(c)
    with pytest.raises(HTTPException):b.submit(cmd)

def test_two_visible_windows_fail_closed(bridge):
    b,clock=bridge;c=context();b.poll(c);cmd=command(b);b.submit(cmd)
    assert b.poll(context())['command'] is None
    assert b.poll(c)['command'] is None
    with pytest.raises(HTTPException):b.context()

def test_timeout_cancel_restart_and_lease_expiry(bridge):
    b,clock=bridge;c=context();b.poll(c);cmd=command(b);b.submit(cmd);b.cancel(cmd.request_id)
    assert b.poll(c)['command'] is None
    cmd=command(b);b.submit(cmd);clock[0]+=13
    assert b.poll(c)['command'] is None
    assert b.receipt(cmd.request_id)['status']=='expired'
    fresh=CommandBridge(b.credential)
    with pytest.raises(HTTPException):fresh.receipt(cmd.request_id)
    clock[0]+=8
    with pytest.raises(HTTPException):b.context()

def test_wrong_ack_and_changed_payload_rejected(bridge):
    b,clock=bridge;c=context();b.poll(c);cmd=command(b);b.submit(cmd);b.poll(c)
    with pytest.raises(HTTPException):b.submit(cmd.model_copy(update={'action':'query_progress'}))
    with pytest.raises(HTTPException):b.ack(Ack(**context().model_dump(),request_id=cmd.request_id,message='伪造'))

def test_http_auth_and_action_allowlist(bridge):
    b,_=bridge;app=FastAPI();install(app,b.credential)
    with TestClient(app) as client:
        assert client.get(PREFIX+'/context').status_code==403
        assert client.post(PREFIX+'/workspace',json=context().model_dump()).status_code==403
        assert client.post(PREFIX,headers={'Authorization':'Bearer '+'x'*48},json=dict(request_id=uuid4().hex,binding='a',action='send_report')).status_code==422

def test_disabled_bridge_does_not_publish_context(bridge):
    b,_=bridge;b.credential.write_text('{}');assert b.poll(context())['enabled'] is False
