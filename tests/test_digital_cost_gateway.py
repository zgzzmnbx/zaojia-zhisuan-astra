"""Isolation contracts; never imports the business engine or starts a real process."""
import importlib.util
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock
import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

spec = importlib.util.spec_from_file_location('gateway', Path(__file__).parents[1]/'03-Src/modules/digital_cost/gateway.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
app = FastAPI()
app.include_router(g.router)
client = TestClient(app)
AsyncClient = httpx.AsyncClient


def upstream(handler):
    return patch.object(g.httpx, 'AsyncClient', side_effect=lambda **kw: AsyncClient(transport=httpx.MockTransport(handler), **kw))


def test_allowlist():
    assert g.allowed_path('demo/settlement-review.docx', 'GET')
    assert g.allowed_path('demo/customer-management.md', 'GET')
    assert not g.allowed_path('demo/customer-management.md', 'POST')
    assert not g.allowed_path('demo/model.key', 'GET')
    assert not g.allowed_path('demo/settlement-review.docx', 'POST')
    assert g.allowed_path('api/digital-cost/v1/pricing/catalog', 'GET')
    assert g.allowed_path('api/digital-cost/v1/tasks/task_1/assets/file_1/preview-content', 'GET')
    for path in ['../secret', 'assets/../secret', 'api/process', 'http://evil', 'assets/%2e%2e/secret', 'model-config.json']:
        assert not g.allowed_path(path, 'GET')
    assert not g.allowed_path('assets/code.js', 'POST')


def test_cross_site_rejected_before_forward():
    with upstream(lambda r: (_ for _ in ()).throw(AssertionError('must not forward'))):
        assert client.get(g.PREFIX+'/', headers={'Origin':'https://evil.example'}).status_code == 403
        assert client.post('/api/astra/digital/start', headers={'x-astra-module':'digital-cost'}).status_code == 403


def test_business_session_and_cookie_scope():
    def handler(request):
        assert request.url.host == '127.0.0.1'
        return httpx.Response(200, json={'csrf_token':'test-token'}, headers={'set-cookie':'digital_cost_session=test-cookie; Path=/api/digital-cost/v1; HttpOnly; SameSite=strict'})
    with upstream(handler):
        r=client.get(g.PREFIX+g.API+'/session')
    assert r.status_code == 200
    assert 'Path=/modules/digital-cost/api/digital-cost/v1' in r.headers['set-cookie']


def test_writes_keep_csrf_idempotency_and_origin():
    calls=[]
    def handler(r):
        calls.append(r)
        assert r.headers['origin']==g.UPSTREAM
        assert r.headers['x-csrf-token']=='csrf'
        assert r.headers['idempotency-key']=='once'
        return httpx.Response(409,json={'message':'revision conflict'})
    with upstream(handler):
        r=client.put(g.PREFIX+g.API+'/tasks/task_1',headers={'Origin':'http://testserver','x-csrf-token':'csrf','idempotency-key':'once'},json={'expected_revision':1})
    assert r.status_code==409 and len(calls)==1


def test_failure_is_bounded_and_not_retried():
    calls=[]
    def handler(r):
        calls.append(r)
        raise httpx.ReadTimeout('timeout')
    with upstream(handler):
        r=client.get(g.PREFIX+g.API+'/tasks')
    assert r.status_code==503 and len(calls)==1


def test_health_requires_identity_version_rules():
    for data in [{'service':'other'}, {'service':'digital-cost','api_version':'v1','version':g.VERSION,'rules_available':True}]:
        with upstream(lambda r: httpx.Response(200,json=data)):
            assert client.get('/api/astra/digital/status').json()['available'] is False
    data={'service':'digital-cost','api_version':'v1','version':g.VERSION,'rules_available':True,'instance_id':'astra-digital-cost'}
    with upstream(lambda r: httpx.Response(200,json=data)):
        assert client.get('/api/astra/digital/status').json()['available'] is True


def test_disabled_does_not_forward_or_launch():
    with patch.object(g,'enabled',return_value=False), upstream(lambda r: (_ for _ in ()).throw(AssertionError('must not forward'))):
        assert client.get(g.PREFIX+'/').status_code==503
        assert client.post('/api/astra/digital/start',headers={'Origin':'http://testserver','x-astra-module':'digital-cost'}).status_code==503


def test_occupied_port_is_not_taken_over():
    probe=MagicMock()
    probe.__enter__.return_value.connect_ex.return_value=0
    with patch.object(g,'health',AsyncMock(return_value={'available':False})), patch.object(g,'process',None), patch.object(g,'socket',MagicMock(socket=MagicMock(return_value=probe))), patch.object(g.subprocess,'Popen') as spawn:
        r=client.post('/api/astra/digital/start',headers={'Origin':'http://testserver','x-astra-module':'digital-cost'})
        assert r.status_code==503
        spawn.assert_not_called()


def test_ready_module_is_reused_without_process_launch():
    with patch.object(g,'health',AsyncMock(return_value={'available':True,'version':g.VERSION})), patch.object(g.subprocess,'Popen') as spawn:
        r=client.post('/api/astra/digital/start',headers={'Origin':'http://testserver','x-astra-module':'digital-cost'})
        assert r.status_code==200
        spawn.assert_not_called()
