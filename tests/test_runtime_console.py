import asyncio
import json
import logging
from pathlib import Path
import sys

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
from runtime_console import ConsoleStore, ConsoleMiddleware, SafeLogHandler, install, ENDPOINT


def test_cursor_gap_restart_and_bounded_memory():
    store = ConsoleStore(3)
    for _ in range(5):
        store.add('info', 'test', 'event')
    snapshot = store.snapshot(1, store.instance)
    assert len(snapshot['events']) == 3 and snapshot['truncated']
    assert not store.snapshot(snapshot['cursor'])['events']
    assert store.snapshot(999, 'old')['reset']
    assert len(store.snapshot(999, 'old')['events']) == 3


def test_request_logs_only_templates_and_safe_metadata():
    app = FastAPI()

    @app.post('/api/items/{item_id}')
    async def item(item_id: str, request: Request):
        return {'secret': await request.json()}

    store = install(app)
    with TestClient(app) as client:
        client.post('/api/items/secret-path?key=secret-query', json={'key': 'secret-body'}, headers={'Authorization': 'Bearer secret-header'})
        client.get('/api/secret-unknown')
        before = store.cursor
        reply = client.get(ENDPOINT)
        assert reply.headers['cache-control'] == 'no-store'
        assert before == store.cursor  # Polling does not log itself.
        output = json.dumps(reply.json())
        assert '/api/items/{item_id}' in output
        for secret in ['secret-path', 'secret-query', 'secret-body', 'secret-header', 'secret-unknown']:
            assert secret not in output
        assert any(e.get('status') == 404 and e['level'] == 'warning' for e in reply.json()['events'])


def test_stream_remains_active_until_final_body():
    async def check():
        app = FastAPI()
        started, release = asyncio.Event(), asyncio.Event()

        @app.post('/api/knowledge/ask-stream')
        async def stream():
            async def chunks():
                started.set()
                yield b'first'
                await release.wait()
                yield b'last'
            return StreamingResponse(chunks())

        store = install(app)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://test') as client:
            pending = asyncio.create_task(client.post('/api/knowledge/ask-stream'))
            await started.wait()
            assert len(store.snapshot()['active']) == 1
            assert not any(e['message'] == '请求结束' for e in store.snapshot()['events'])
            release.set()
            assert (await pending).content == b'firstlast'
            assert store.snapshot()['active'] == []
            assert store.snapshot()['events'][-1]['status'] == 200
    asyncio.run(check())


def test_cancel_and_exception_release_active_requests():
    async def check(exc):
        store = ConsoleStore()
        async def app(scope, receive, send):
            raise exc
        middleware = ConsoleMiddleware(app, store, [])
        try:
            await middleware({'type': 'http', 'path': '/api/error', 'method': 'POST'}, None, None)
        except (ValueError, asyncio.CancelledError):
            pass
        snapshot = store.snapshot()
        assert not snapshot['active']
        assert snapshot['events'][-1]['level'] == 'error'
        assert 'secret-exception' not in json.dumps(snapshot)
    asyncio.run(check(ValueError('secret-exception')))
    asyncio.run(check(asyncio.CancelledError()))


def test_python_diagnostics_do_not_format_sensitive_messages():
    store = ConsoleStore()
    handler = SafeLogHandler(store)
    try:
        raise ValueError('secret-error')
    except ValueError:
        record = logging.LogRecord('httpx', logging.ERROR, __file__, 1, 'Bearer %s', ('secret-token',), sys.exc_info())
    handler.emit(record)
    value = json.dumps(store.snapshot())
    assert 'secret-error' not in value and 'secret-token' not in value
    assert 'ValueError' in value and 'frames' in value


def test_real_host_console_keeps_origin_boundary_without_starting_receivers():
    import server
    # No lifespan context: integration checks must not start external receivers.
    client = TestClient(server.app)
    assert client.get(ENDPOINT, headers={'Origin': 'https://example.com'}).status_code == 403
    reply = client.get(ENDPOINT, headers={'Origin': 'http://127.0.0.1:5189'})
    assert reply.status_code == 200
    assert reply.json()['instance'] == server.runtime_console_store.instance
    assert 'runtime_console.py' in server.HOST_SOURCES
