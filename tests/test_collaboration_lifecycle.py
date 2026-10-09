import sqlite3
from types import SimpleNamespace
from contextlib import asynccontextmanager
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'03-Src'))
import server
from collaboration_lifecycle import resume_receivers, unfinished_queue


def bot(tmp_path, enabled=('default', 'weact_cost'), running=()):
    calls = []
    value = SimpleNamespace(
        RUNTIME_ROOT=tmp_path, DB_PATH=tmp_path/'tasks.sqlite3', ACTIVE_STATES={'matching'},
        credential_profiles=lambda: [{'profile_id': p} for p in ('default', 'weact_cost')],
        is_bot_enabled=lambda p: p in enabled, bot_process_running=lambda p: p in running,
        _pid_is_running=lambda _:False, append_runtime_event=lambda *args,**kwargs:None,
        start_local_bot_supervisor=lambda: calls.append('supervisor') or True,
    )
    return value, calls


def queue_db(path, table='bot_inbox', profile='weact_cost', state='pending'):
    column='platform_profile_id' if table=='tasks' else 'profile'
    status='status' if table=='tasks' else 'state'
    with sqlite3.connect(path) as db:
        db.execute(f'CREATE TABLE {table} ({column} TEXT, {status} TEXT)')
        db.execute(f'INSERT INTO {table} VALUES (?,?)', (profile,state))


def test_disabled_host_never_launches_or_creates_runtime(tmp_path):
    receiver,calls=bot(tmp_path)
    assert resume_receivers(receiver,False)['status']=='disabled'
    assert calls==[] and list(tmp_path.iterdir())==[]


def test_resume_only_opted_in_profiles_and_keep_running_receiver(tmp_path):
    receiver,calls=bot(tmp_path,enabled=('default',),running=('default',))
    result=resume_receivers(receiver,True)
    assert result['status']=='supervised' and result['profiles']==[]
    assert calls==['supervisor']


@pytest.mark.parametrize('table,state',[('bot_inbox','pending'),('bot_inbox','processing'),('bot_outbox','pending'),('bot_outbox','processing'),('tasks','queued'),('tasks','retryable_failed'),('tasks','matching')])
def test_restart_blocks_unfinished_old_queue_without_mutation(tmp_path,table,state):
    receiver,calls=bot(tmp_path)
    queue_db(receiver.DB_PATH,table=table,state=state)
    before=receiver.DB_PATH.read_bytes()
    result=resume_receivers(receiver,True)
    assert result['status']=='blocked_old_queue' and result['unfinished']=={table:1}
    assert calls==[] and receiver.DB_PATH.read_bytes()==before


def test_completed_queue_and_disabled_profile_do_not_block_resume(tmp_path):
    receiver,calls=bot(tmp_path,enabled=('default',))
    queue_db(receiver.DB_PATH)
    result=resume_receivers(receiver,True)
    assert result['status']=='supervised' and result['profiles']==['default']
    assert calls==['supervisor']


def test_live_receiver_queue_is_not_classed_as_old_work(tmp_path):
    receiver,calls=bot(tmp_path,running=('weact_cost',))
    queue_db(receiver.DB_PATH)
    assert resume_receivers(receiver,True)['status']=='supervised'
    assert calls==['supervisor']


def test_bad_queue_schema_fails_closed(tmp_path):
    receiver,calls=bot(tmp_path)
    with sqlite3.connect(receiver.DB_PATH) as db:db.execute('CREATE TABLE bot_inbox (unknown TEXT)')
    assert resume_receivers(receiver,True)['status']=='start_failed'
    assert calls==[]


def test_only_http_lifespan_resumes_receivers(monkeypatch):
    calls=[]
    monkeypatch.setattr(server.professional_host,'config',lambda:{'external_enabled':True})
    monkeypatch.setattr(server.collaboration_lifecycle,'resume_receivers',lambda bot,enabled:calls.append(enabled))
    assert calls==[]
    with TestClient(FastAPI(lifespan=server.host_lifespan)):
        assert calls==[True]
    assert calls==[True]


@pytest.mark.parametrize('missing', ['running','enabled','fresh','connected','identity_ready','backend_ok'])
def test_no_review_is_sent_when_callback_receiver_is_not_ready(monkeypatch,missing):
    from app import feishu_app_bot
    from fastapi import HTTPException
    profile={'profile_id':'weact_cost','enabled':True,'running':True,'health':{'fresh':True,'connected':True,'identity_ready':True,'backend_ok':True}}
    (profile if missing in ('running','enabled') else profile['health'])[missing]=False
    monkeypatch.setattr(feishu_app_bot,'bot_status',lambda:{'profiles':[profile]})
    sent=[]
    monkeypatch.setattr(server.engine,'create_web_result_review',lambda payload:sent.append(payload))
    with pytest.raises(HTTPException) as error:server.connected_web_review({'platform_profile_id':'weact_cost'})
    assert error.value.status_code==409 and 'WeAct' in error.value.detail and sent==[]


def test_healthy_selected_platform_can_send_without_other_platform(monkeypatch):
    from app import feishu_app_bot
    profile={'profile_id':'weact_cost','enabled':True,'running':True,'health':{'fresh':True,'connected':True,'identity_ready':True,'backend_ok':True}}
    monkeypatch.setattr(feishu_app_bot,'bot_status',lambda:{'profiles':[profile,{'profile_id':'default','running':False}]})
    sent=[]
    monkeypatch.setattr(server.engine,'create_web_result_review',lambda payload:sent.append(payload) or {'created':True})
    assert server.connected_web_review({'platform_profile_id':'weact_cost'})=={'created':True}
    assert sent==[{'platform_profile_id':'weact_cost'}]


def test_live_supervisor_does_not_inspect_or_replay_receiver_queue(tmp_path):
    receiver,calls=bot(tmp_path)
    receiver._pid_is_running=lambda _:True
    queue_db(receiver.DB_PATH)
    assert resume_receivers(receiver,True)['status']=='supervised'
    assert calls==[]


def test_host_watchdog_recovers_lost_supervisor_once_and_respects_disable(tmp_path):
    import asyncio
    from collaboration_lifecycle import monitor_receivers
    receiver,calls=bot(tmp_path)
    supervised=False
    enabled=True
    receiver._pid_is_running=lambda _:supervised
    def start():
        nonlocal supervised
        supervised=True;calls.append('start');return True
    receiver.start_local_bot_supervisor=start
    async def scenario():
        nonlocal supervised,enabled
        task=asyncio.create_task(monitor_receivers(receiver,lambda:enabled,interval=0.005))
        try:
            for _ in range(100):
                if len(calls)==1:break
                await asyncio.sleep(0.005)
            assert calls==['start']
            await asyncio.sleep(0.02)
            assert len(calls)==1
            supervised=False
            for _ in range(100):
                if len(calls)==2:break
                await asyncio.sleep(0.005)
            assert len(calls)==2
            enabled=False;supervised=False
            await asyncio.sleep(0.025)
            assert len(calls)==2
        finally:
            task.cancel()
            try:await task
            except asyncio.CancelledError:pass
        assert task.cancelled()
    asyncio.run(scenario())
