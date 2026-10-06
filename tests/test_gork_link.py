import asyncio
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
from gork_link import console_status


@pytest.mark.parametrize('monitor,state', [
    ({'source': 'legacy', 'enabled': True}, 'other_source'),
    ({'source': 'astra', 'enabled': False}, 'paused'),
    ({'source': 'astra', 'enabled': True}, 'connecting'),
    ({'source': 'astra', 'enabled': True, 'last_success_at': '2026-10-06T12:00:00+08:00'}, 'tracking'),
    ({'source': 'astra', 'enabled': True, 'last_success_at': 'old', 'connection_error': 'private-error'}, 'error'),
])
def test_truthful_status_and_read_only_requests(monitor, state):
    requests = []
    def respond(request):
        requests.append(request)
        data = {'/api/health': {'version': '0.20.26-dev', 'robot': {'connected': True}, 'secret': 'private-key'},
                '/api/cost/sources': {'service': 'gork-console', 'schema_version': 1},
                '/api/cost/sentinel': monitor}[request.url.path]
        return httpx.Response(200, json=data)
    status = asyncio.run(console_status(httpx.MockTransport(respond)))
    assert status['state'] == state
    assert status['tracking'] is (state == 'tracking')
    assert status['robot_connected']
    assert 'private-' not in str(status)
    assert all(r.method == 'GET' and r.url.host == '127.0.0.1' and r.url.port == 8766 for r in requests)


def test_old_console_requires_restart_without_claiming_tracking():
    def respond(request):
        return httpx.Response(200, json={'version': 'old', 'robot': {'connected': True}}) if request.url.path == '/api/health' else httpx.Response(404)
    status = asyncio.run(console_status(httpx.MockTransport(respond)))
    assert status['state'] == 'upgrade_required' and not status['tracking']


@pytest.mark.parametrize('bad', [[], None, {'service': 'other'}, {'service': 'gork-console', 'schema_version': 99}])
def test_wrong_identity_is_not_a_connection(bad):
    def respond(request):
        data = {'version': 'test', 'robot': {}} if request.url.path == '/api/health' else bad
        return httpx.Response(200, json=data)
    assert asyncio.run(console_status(httpx.MockTransport(respond)))['state'] == 'offline'


def test_no_redirect_follow_and_timeout_is_safe():
    for timeout in (False, True):
        calls = []
        def respond(request):
            calls.append(request)
            if timeout:
                raise httpx.ReadTimeout('private-url', request=request)
            return httpx.Response(302, headers={'Location': 'https://example.com'})
        status = asyncio.run(console_status(httpx.MockTransport(respond)))
        assert status['state'] == 'offline' and 'private-url' not in str(status)
        assert all(r.url.host == '127.0.0.1' for r in calls)
