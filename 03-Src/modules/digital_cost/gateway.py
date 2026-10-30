"""Bounded same-origin gateway and on-demand launcher for one pinned local module."""
from __future__ import annotations
import asyncio
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import time

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, Response

ROOT = Path(__file__).resolve().parents[3]
PREFIX = '/modules/digital-cost'
API = '/api/digital-cost/v1'
UPSTREAM = 'http://127.0.0.1:18768'
VERSION = '0.9.0'
MAX_REQUEST = 12 * 1024 * 1024
MAX_RESPONSE = 64 * 1024 * 1024
router = APIRouter()
start_lock = asyncio.Lock()
slots = asyncio.Semaphore(4)
process = None


def module_root():
    return (ROOT.parent / 'modules/digital-cost' if ROOT.name == 'astra-service'
            else ROOT / 'runtime/modules/digital-cost').resolve()


def enabled():
    config = ROOT / 'config/digital-cost.local.json'
    try:
        return not config.exists() or json.loads(config.read_text('utf-8-sig')).get('enabled') is True
    except (OSError, ValueError):
        return False


def require_local(request):
    origin = request.headers.get('origin')
    if request.headers.get('sec-fetch-site') == 'cross-site' or (origin and origin != str(request.base_url).rstrip('/')):
        raise HTTPException(403, '拒绝跨站模块请求')
    if request.method not in {'GET', 'HEAD'} and not origin:
        raise HTTPException(403, '模块写操作需要同源页面')


async def health():
    if not enabled():
        return {'available': False, 'detail': '数字化造价已单独停用'}
    try:
        async with httpx.AsyncClient(timeout=2, trust_env=False) as client:
            reply = await client.get(UPSTREAM + API + '/health')
        data = reply.json()
        valid = (reply.status_code == 200 and data.get('service') == 'digital-cost'
                 and data.get('api_version') == 'v1' and data.get('version') == VERSION
                 and data.get('instance_id') == 'astra-digital-cost' and data.get('rules_available') is True)
        return {'available': valid, 'version': data.get('version') if valid else None,
                'model_configured': data.get('model_configured', False) if valid else False,
                'detail': '' if valid else '模块身份或版本不匹配，未接管该服务'}
    except (httpx.HTTPError, ValueError):
        return {'available': False, 'detail': '数字化造价服务未就绪，可重新连接'}


@router.get('/api/astra/digital/status')
async def status():
    return await health()


@router.post('/api/astra/digital/start')
async def start(request: Request):
    global process
    require_local(request)
    if request.headers.get('x-astra-module') != 'digital-cost':
        raise HTTPException(403, '模块启动请求无效')
    if not enabled():
        raise HTTPException(503, '数字化造价已单独停用')
    async with start_lock:
        state = await health()
        if state['available']:
            return state
        # Never stop an occupied port or launch a second copy while the first boots.
        if process is None or process.poll() is not None:
            with socket.socket() as probe:
                if probe.connect_ex(('127.0.0.1', 18768)) == 0:
                    raise HTTPException(503, '模块端口被占用，未停止任何服务')
            folder = module_root()
            python = folder / '.venv/Scripts/python.exe'
            if not python.is_file() or not (folder / 'frontend/index.html').is_file():
                raise HTTPException(503, '模块运行包尚未安装')
            logs = folder / 'logs'
            logs.mkdir(exist_ok=True)
            env = os.environ.copy()
            env.pop('PYTHONPATH', None)
            env['DIGITAL_COST_INSTANCE'] = 'astra-digital-cost'
            flags = (subprocess.CREATE_NO_WINDOW | subprocess.BELOW_NORMAL_PRIORITY_CLASS) if os.name == 'nt' else 0
            with (logs / f'service-{time.time_ns()}.log').open('ab') as log:
                process = subprocess.Popen([str(python), '-I', '-m', 'digital_cost.server',
                    '--data-dir', str(folder / 'data'), '--frontend-dir', str(folder / 'frontend'), '--port', '18768'],
                    cwd=folder, env=env, stdout=log, stderr=log, creationflags=flags)
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline:
            await asyncio.sleep(.3)
            state = await health()
            if state['available']:
                return state
            if process.poll() is not None:
                break
        raise HTTPException(503, '模块未能就绪，请重新检测；其他功能可继续使用')


def allowed_path(path, method):
    if any(part in {'.', '..'} for part in path.split('/')) or '\\' in path or '%' in path:
        return False
    if path.startswith('api/digital-cost/v1/'):
        tail = path[len('api/digital-cost/v1/'):]
        return bool(re.fullmatch(r'(session|health|rule-sets|pricing/catalog|ai/config|tasks(?:/[A-Za-z0-9_/-]+)?|snapshots/[A-Za-z0-9_/-]+|artifacts/[A-Za-z0-9_/-]+)', tail))
    return method in {'GET', 'HEAD'} and (path in {'', 'index.html', 'favicon.svg', 'demo/settlement-review.docx'} or path.startswith(('assets/', 'pdfjs/', 'fonts/')))


@router.api_route(PREFIX + '/{path:path}', methods=['GET', 'HEAD', 'POST', 'PUT', 'DELETE'])
async def proxy(path: str, request: Request):
    require_local(request)
    if not enabled():
        raise HTTPException(503, '数字化造价已单独停用')
    if not allowed_path(path, request.method):
        raise HTTPException(404, '模块路径不可用')
    # Bound input, concurrency, time, output; no retry of paid or mutating requests.
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_REQUEST:
            raise HTTPException(413, '请求超过12MB限制')
    try:
        await asyncio.wait_for(slots.acquire(), timeout=.2)
    except TimeoutError:
        raise HTTPException(503, '模块正在处理其他请求，请稍后重试')
    try:
        headers = {key: request.headers[key] for key in ('content-type', 'x-csrf-token', 'idempotency-key', 'range') if key in request.headers}
        cookie = request.cookies.get('digital_cost_session')
        if cookie:
            headers['cookie'] = 'digital_cost_session=' + cookie
        if request.headers.get('origin'):
            headers['origin'] = UPSTREAM
        async with httpx.AsyncClient(timeout=httpx.Timeout(150, connect=2, pool=2), trust_env=False, follow_redirects=False) as client:
            async with client.stream(request.method, UPSTREAM + '/' + path, params=request.query_params,
                                     headers=headers, content=bytes(body)) as reply:
                payload = bytearray()
                async for chunk in reply.aiter_bytes():
                    payload.extend(chunk)
                    if len(payload) > MAX_RESPONSE:
                        raise HTTPException(502, '模块返回内容超过限制')
                outgoing = {k: v for k, v in reply.headers.items() if k in {
                    'content-type', 'content-disposition', 'content-range', 'accept-ranges',
                    'x-content-type-options', 'referrer-policy', 'content-security-policy'}}
                outgoing['cache-control'] = 'no-store'
                response = Response(bytes(payload), reply.status_code, outgoing)
                if path == 'api/digital-cost/v1/session' and reply.status_code == 200:
                    value = reply.cookies.get('digital_cost_session')
                    if value:
                        response.set_cookie('digital_cost_session', value, httponly=True, samesite='strict', path=PREFIX + API)
                return response
    except httpx.HTTPError:
        return JSONResponse({'detail': '数字化造价连接中断或超时，请检查当前任务状态后再操作'}, 503)
    finally:
        slots.release()
