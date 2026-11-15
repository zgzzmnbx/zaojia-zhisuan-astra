import time

from fastapi import FastAPI
from fastapi.testclient import TestClient

from test_gork_notifications import fixture
import server
from gork_speech import SpeechMirror


def test_speech_read_route_has_no_dispatch_or_history_replay(monkeypatch):
    mirror = SpeechMirror(lambda: 100)
    monkeypatch.setattr(server.gork_output, 'speech_mirror', mirror)
    # No lifespan: this read endpoint must not start a worker or contact the console.
    client = TestClient(server.app)
    route = '/api/astra/gork/notifications/speech'
    first = client.get(route).json()
    mirror.accepted({'event_id': 'read-only', 'speech': {'target': 'watch', 'text': '任务已完成。'}}, {'status': 'queued'}, 'watch')
    assert client.get(route).json()['items'] == []
    response = client.get(route, params={'stream': first['stream'], 'after': first['cursor']})
    assert response.status_code == 200
    assert response.json()['items'][0]['text'] == '任务已完成。'
    assert client.post(route).status_code == 405


def test_real_host_lifespan_dispatches_debug_without_manual_step(fixture,monkeypatch):
    obj,remote,clock=fixture
    obj.stop()
    monkeypatch.setattr(server,'gork_output',obj)
    monkeypatch.setattr(server.professional_host,'config',lambda:{'external_enabled':False})
    monkeypatch.setattr(server.collaboration_lifecycle,'resume_receivers',lambda *args:None)
    app=FastAPI(lifespan=server.host_lifespan)
    @app.post('/debug')
    def send():return obj.debug_send('warning_completed')
    @app.get('/receipt/{identifier}')
    def receipt(identifier:str):return obj.debug_receipt(identifier)
    with TestClient(app) as client:
        assert obj.worker.is_alive()
        clock[0]+=1
        # No obj.step(): the actual host lifecycle must start the sender.
        response=client.post('/debug')
        assert response.status_code==200, response.text
        record=response.json()
        deadline=time.monotonic()+3
        while time.monotonic()<deadline:
            record=client.get('/receipt/'+record['event_id']).json()
            if record['status']=='completed':break
            time.sleep(.02)
        assert record['status']=='completed'
        assert len(remote.sent)==1 and remote.sent[0]['task_id'].startswith('debug-')
    assert obj.worker is None and obj.closed.is_set()
