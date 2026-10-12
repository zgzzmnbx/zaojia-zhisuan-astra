import httpx
import pytest
import gork_notifications as bridge
from test_gork_notifications import fixture,event


def test_offline_then_running_reconnects_without_save_or_history_replay(fixture,monkeypatch):
    obj,remote,clock=fixture
    before=bridge.config.CONFIG.read_bytes()
    def offline():raise httpx.ConnectError('private endpoint detail')
    monkeypatch.setattr(bridge,'read_console_health',offline)
    obj.enqueue(event(clock));obj.step()
    assert obj.platform['state']=='offline' and not remote.sent
    clock[0]+=100  # An old signal must expire while offline, rather than replay on return.
    obj.step()
    assert obj.db().execute('SELECT status FROM events').fetchone()[0]=='expired'
    monkeypatch.setattr(bridge,'read_console_health',lambda:{'app':'stopwatch-voice-companion','external_protocol':'1.0','instance':'restarted','robot':{'connected':True}})
    clock[0]+=10;obj.step()
    assert obj.platform['state']=='connected' and obj.platform['instance']=='restarted'
    assert obj.client is remote and not remote.sent
    assert bridge.config.CONFIG.read_bytes()==before
    obj.enqueue(event(clock,stage='match_result',status='completed'));obj.step()
    assert len(remote.sent)==1


@pytest.mark.parametrize('reason',['identity','timeout','paused','disabled'])
def test_connection_faults_are_red_and_do_not_change_permissions(fixture,monkeypatch,reason):
    obj,remote,clock=fixture
    before=bridge.config.CONFIG.read_bytes()
    if reason=='identity':monkeypatch.setattr(bridge,'read_console_health',lambda:{'app':'other','private':'secret'})
    if reason=='timeout':
        def timeout():raise httpx.ReadTimeout('private timeout detail')
        monkeypatch.setattr(bridge,'read_console_health',timeout)
    if reason=='paused':remote.paused=True
    if reason=='disabled':remote.enabled=False
    obj.step()
    assert obj.platform['state']=='error' and 'private' not in str(obj.platform)
    assert not remote.sent and bridge.config.CONFIG.read_bytes()==before
    if reason=='paused':assert remote.paused
    if reason=='disabled':assert not remote.enabled


def test_periodic_probe_rebuilds_authorized_client_with_bounded_frequency(fixture):
    obj,remote,clock=fixture
    created=[]
    obj.client_factory=lambda settings:created.append(settings.revision) or remote
    obj.step();obj.step()
    assert len(created)==1
    clock[0]+=5;obj.step()
    assert len(created)==1
    clock[0]+=5;obj.step()
    assert len(created)==2
    assert not remote.sent


def test_platform_http_endpoint_reads_connection_snapshot_without_sending(fixture,monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    obj,remote,clock=fixture
    obj.start();obj.reconnect()
    monkeypatch.setattr(bridge.config,'bridge',obj)
    app=FastAPI();app.include_router(bridge.config.router)
    with TestClient(app) as client:
        response=client.get('/api/astra/gork/notifications/platform')
        assert response.status_code==200, response.text
        assert response.json()['state']=='connected'
        assert response.json()['worker_running']
        assert not remote.sent
