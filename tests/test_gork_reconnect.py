import httpx
import pytest
from test_gork_notifications import fixture,event
import gork_notifications as bridge


def capabilities(version='1.1', versions=('1.0','1.1')):
    return {'protocol_version':version,'protocol_versions':list(versions),'transport':'loopback_http'}


@pytest.mark.parametrize('version',['1.1','1.2'])
def test_new_protocol_advertising_10_preserves_existing_output_and_read_only_probes(fixture,monkeypatch,version):
    obj,remote,clock=fixture
    before=bridge.config.CONFIG.read_bytes()
    remote.capabilities=lambda:capabilities(version,('1.0',version))
    monkeypatch.setattr(bridge,'read_console_health',lambda:{'app':'stopwatch-voice-companion','external_protocol':version,'instance':'upgraded','robot':{'connected':True}})
    obj.step()
    assert obj.platform['state']=='connected' and not remote.sent
    obj.enqueue(event(clock,'match_result','completed'));obj.step()
    assert len(remote.sent)==1 and remote.sent[0]['protocol_version']=='1.0'
    assert bridge.config.CONFIG.read_bytes()==before
    obj.start()
    assert obj._status(obj.settings)['state']=='ready'
    disabled=obj.settings.model_copy(update={'enabled':False})
    assert obj._status(disabled)['state']=='disabled'


@pytest.mark.parametrize('caps',[
    capabilities('2.0',('2.0',)),capabilities('1.1',()),
    {'protocol_version':'1.1','transport':'loopback_http'},
    {**capabilities(),'transport':'remote_http'},
])
def test_incompatible_contracts_stay_red_and_never_output(fixture,caps):
    obj,remote,clock=fixture
    remote.capabilities=lambda:caps
    obj.step()
    assert obj.platform['state']=='error' and obj.client is None and not remote.sent


@pytest.mark.parametrize('reason',['source','paused','disabled','display','speech','priority'])
def test_protocol_11_does_not_bypass_source_authorization(fixture,reason):
    obj,remote,clock=fixture
    remote.capabilities=lambda:capabilities()
    if reason=='source':remote.status=lambda:{'source':'other','enabled':True,'paused':False,'policy':remote.policy}
    if reason=='paused':remote.paused=True
    if reason=='disabled':remote.enabled=False
    if reason=='display':remote.policy['display_targets']=[]
    if reason=='speech':remote.policy['speech_targets']=[];obj.settings.sound=True
    if reason=='priority':remote.policy['max_priority']=0
    obj.step()
    assert obj.platform['state']=='error' and obj.client is None and not remote.sent


def test_timeout_recovery_and_console_upgrade_reloads_credentials_on_ten_second_probe(fixture,monkeypatch):
    obj,remote,clock=fixture
    created=[]
    obj.client_factory=lambda settings:created.append(settings.revision) or remote
    obj.step();assert obj.platform['state']=='connected'
    def timeout():raise httpx.ReadTimeout('private endpoint')
    monkeypatch.setattr(bridge,'read_console_health',timeout)
    clock[0]+=10;obj.step()
    assert obj.platform['state']=='error' and obj.client is None
    assert '超时' in obj.platform['message'] and 'private' not in obj.platform['message']
    remote.capabilities=lambda:capabilities()
    monkeypatch.setattr(bridge,'read_console_health',lambda:{'app':'stopwatch-voice-companion','external_protocol':'1.1','instance':'new-console','robot':{'connected':False}})
    clock[0]+=9;obj.step();assert obj.platform['state']=='error'
    clock[0]+=1;obj.step()
    assert obj.platform['state']=='connected' and obj.platform['instance']=='new-console'
    assert not obj.platform['robot_connected'] and len(created)==2 and not remote.sent


def test_host_worker_recovers_11_link_and_expires_old_output_without_manual_steps(fixture,monkeypatch):
    import time
    import server
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    obj,remote,clock=fixture
    saved=bridge.config.CONFIG.read_bytes()
    health={'app':'stopwatch-voice-companion','external_protocol':'1.1','instance':'first','robot':{'connected':True}}
    unavailable=[False]
    def probe():
        if unavailable[0]:raise httpx.ConnectError('private detail')
        return health
    def wait_for(predicate):
        for _ in range(150):
            if predicate():return
            time.sleep(.02)
        assert predicate()
    remote.capabilities=lambda:capabilities()
    monkeypatch.setattr(bridge,'read_console_health',probe)
    monkeypatch.setattr(server,'gork_output',obj)
    monkeypatch.setattr(server.professional_host,'config',lambda:{'external_enabled':False})
    with TestClient(FastAPI(lifespan=server.host_lifespan)):
        wait_for(lambda:obj.platform['state']=='connected')
        assert obj.worker.is_alive()
        unavailable[0]=True;clock[0]+=10
        wait_for(lambda:obj.platform['state']=='offline')
        obj.observe(event(clock),'a'*32)
        clock[0]+=100
        wait_for(lambda:obj.next_connect>clock[0])
        unavailable[0]=False;health['instance']='restarted';clock[0]+=10
        wait_for(lambda:obj.platform['state']=='connected')
        assert obj.platform['instance']=='restarted' and not remote.sent
        clock[0]+=1
        obj.observe(event(clock,'match_result','completed'),'a'*32)
        wait_for(lambda:len(remote.sent)==1)
        assert remote.sent[0]['protocol_version']=='1.0'
        assert bridge.config.CONFIG.read_bytes()==saved
    assert obj.worker is None


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
