import sqlite3
import time
from fastapi import FastAPI
from fastapi.testclient import TestClient
from datetime import datetime,timezone
from test_gork_notifications import fixture,event
from gork_notifications import review_delivery_event


def iso(seconds):
    return datetime.fromtimestamp(seconds,timezone.utc).isoformat()


def delivery_db(path):
    with sqlite3.connect(path) as db:
        db.executescript('''CREATE TABLE tasks(task_id TEXT,source_task_id TEXT,task_kind TEXT,
            submission_hash TEXT,review_round INTEGER,platform_profile_id TEXT,submission_received_at TEXT,
            submission_delivery_status TEXT,review_card_status TEXT);
            CREATE TABLE dispatch_attempts(task_id TEXT,step TEXT,status TEXT,created_at TEXT);''')
        for task,platform in [('feishu-1','default'),('weact-1','weact_cost')]:
            db.execute('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?)',
                (task,'a'*32,'external_dispatch','b'*64,1,platform,iso(101),'sent','sent'))
            db.execute('INSERT INTO dispatch_attempts VALUES (?,?,?,?)',(task,'review_card','sent',iso(102)))


def test_live_feed_groups_verified_platforms_without_modifying_business_db(fixture,tmp_path):
    obj,remote,clock=fixture;obj.settings.sound=True;clock[0]=103
    path=tmp_path/'tasks.sqlite3';delivery_db(path);before=path.read_bytes()
    raw=event(clock,'review_sent','sent')
    first=review_delivery_event({**raw,'event_id':'feishu-1:sent'},'a'*32,path)
    second=review_delivery_event({**raw,'event_id':'weact-1:sent'},'a'*32,path)
    assert first['_review_scope']==second['_review_scope'] and first['platform']!=second['platform']
    assert first['event_id']=='feishu-1:r1:sent' and first['occurred_at']==iso(102)
    obj.feed=lambda:[first,second];obj.step()
    assert len(remote.sent)==1 and remote.sent[0]['speech']
    assert path.read_bytes()==before
    precise=review_delivery_event({**raw,'event_id':'feishu-1:sent'},'a'*32,path,iso(102.9))
    assert precise['occurred_at']==iso(102.9)


def test_new_round_has_new_identity_and_approval_updates_do_not_replay(fixture,tmp_path):
    obj,remote,clock=fixture;clock[0]=103
    path=tmp_path/'tasks.sqlite3';delivery_db(path)
    raw=event([200],'review_sent','sent');raw['event_id']='feishu-1:sent'
    old=review_delivery_event(raw,'a'*32,path)
    assert old['occurred_at']==iso(102)  # Frozen feed updated_at may have changed with approval.
    obj.cutoff=150;clock[0]=200;obj.feed=lambda:[old];obj.step()
    assert not remote.sent
    with sqlite3.connect(path) as db:
        db.execute('UPDATE tasks SET review_round=2,submission_received_at=? WHERE task_id=?',(iso(201),'feishu-1'))
        db.execute('INSERT INTO dispatch_attempts VALUES (?,?,?,?)',('feishu-1','review_card','sent',iso(202)))
    current=review_delivery_event(raw,'a'*32,path)
    assert current['_review_scope']!=old['_review_scope'] and current['event_id']=='feishu-1:r2:sent'
    clock[0]=203;obj.enqueue(current);obj.step()
    assert len(remote.sent)==1


def test_missing_or_partial_delivery_and_wrong_job_are_never_announced(tmp_path):
    path=tmp_path/'tasks.sqlite3';delivery_db(path)
    raw={'stage':'review_sent','event_id':'feishu-1:sent'}
    assert review_delivery_event(raw,'c'*32,path) is None
    assert review_delivery_event(raw,'a'*32,tmp_path/'missing.sqlite3') is None
    with sqlite3.connect(path) as db:db.execute("UPDATE tasks SET review_card_status='failed'")
    assert review_delivery_event(raw,'a'*32,path) is None


def test_host_lifespan_automatically_dispatches_two_verified_platforms_once(fixture,tmp_path,monkeypatch):
    import server
    obj,remote,clock=fixture
    path=tmp_path/'tasks.sqlite3';delivery_db(path)
    raw=event(clock,'review_sent','sent')
    deliveries=[review_delivery_event({**raw,'event_id':task+':sent'},'a'*32,path) for task in ['feishu-1','weact-1']]
    obj._configure(obj.settings.model_copy(update={'sound':True}))
    obj.feed=lambda:deliveries
    monkeypatch.setattr(server,'gork_output',obj)
    monkeypatch.setattr(server.professional_host,'config',lambda:{'external_enabled':False})
    with TestClient(FastAPI(lifespan=server.host_lifespan)):
        clock[0]=103
        for _ in range(100):
            if remote.sent:break
            time.sleep(.02)
        assert obj.worker.is_alive() and len(remote.sent)==1 and remote.sent[0]['speech']
        worker=obj.worker
        clock[0]=110
        for _ in range(100):
            if obj.next_feed>110:break
            time.sleep(.02)
        assert obj.next_feed>110 and len(remote.sent)==1
    assert obj.worker is None and not worker.is_alive()
