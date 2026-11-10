"""Run a byte-identical host copy with a test-only, external-free lifespan."""
import os
import socket
import sys
from pathlib import Path
from contextlib import asynccontextmanager

ROOT = Path(sys.argv[1]).resolve()
PORT = int(sys.argv[2])
DIGITAL_PORT = int(sys.argv[3])
assert ROOT.name == 'app' and ROOT.parent.parent.name == 'demo-regression'
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / '03-Src'))
import server
import gork_link
from modules.digital_cost import gateway
import uvicorn

@asynccontextmanager
async def isolated_lifespan(app):
    yield

async def offline_console(transport=None):
    return {'state':'offline', 'tracking':False, 'robot_connected':False,
            'source':'astra', 'message':'回归测试副本：未连接实体设备'}

# The production server and security checks remain unchanged on disk.
server.app.router.lifespan_context = isolated_lifespan
gork_link.console_status = offline_console
gateway.UPSTREAM = f'http://127.0.0.1:{DIGITAL_PORT}'
gateway.module_root = lambda: ROOT.parent/'digital'

@server.app.middleware('http')
async def isolated_origin(request, call_next):
    if request.url.path == '/api/astra/digital/start':
        # Never let the stock launcher start a formal module on 18768.
        from fastapi.responses import JSONResponse
        return JSONResponse(await gateway.health())
    request.scope['headers'] = [(k, b'http://127.0.0.1:5189' if k == b'origin' and v == f'http://127.0.0.1:{PORT}'.encode() else v)
                               for k, v in request.scope['headers']]
    # Gateway validates its actual isolated origin, unlike legacy host endpoints.
    if request.url.path.startswith('/modules/digital-cost'):
        request.scope['headers'] = [(k, f'http://127.0.0.1:{PORT}'.encode() if k == b'origin' and v == b'http://127.0.0.1:5189' else v)
                                   for k, v in request.scope['headers']]
    return await call_next(request)

original_connect = socket.socket.connect
def local_only(sock, address):
    if isinstance(address, tuple) and (address[0] not in ('127.0.0.1','localhost','::1') or address[1] in (5189,18768)):
        raise OSError('Regression sandbox blocks outbound connections')
    return original_connect(sock, address)
socket.socket.connect = local_only
assert server.ROOT == ROOT and server.paths.RUNTIME_DIR.is_relative_to(ROOT)
assert not server.professional_host.config().get('external_enabled')
uvicorn.run(server.app, host='127.0.0.1', port=PORT, access_log=False)
