"""Two allowlisted Watch commands, bound to a live, unique browser context.

No engine writes here: the active workspace claims once and uses its existing
business handlers. Commands and leases are ephemeral; restart never replays.
"""
import secrets
import time
import json
from pathlib import Path
from threading import RLock
from typing import Literal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

PREFIX = '/api/astra/gork/commands'

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')

class Context(Strict):
    client: str = Field(pattern=r'^[a-f0-9-]{36}$')
    context: str = Field(min_length=1, max_length=200)
    job: str = Field(pattern=r'^(?:[a-f0-9]{32})?$')

class Command(Strict):
    request_id: str = Field(pattern=r'^[a-f0-9]{32}$')
    binding: str = Field(min_length=1, max_length=100)
    action: Literal['check_risk', 'query_progress']

class Ack(Context):
    request_id: str = Field(pattern=r'^[a-f0-9]{32}$')
    message: str = Field(min_length=1, max_length=160)

class CommandBridge:
    def __init__(self, credential, clock=time.monotonic):
        self.credential = Path(credential)
        self.clock = clock
        self.lock = RLock()
        self.clients = {}
        self.commands = {}

    def token(self):
        try:
            data = json.loads(self.credential.read_text(encoding='utf-8'))
            token = data.get('token', '') if data.get('enabled') is True else ''
            return token if isinstance(token, str) and len(token) >= 40 else ''
        except (OSError, ValueError, AttributeError):
            return ''

    def authorize(self, request):
        token = self.token()
        if not token or not secrets.compare_digest(request.headers.get('authorization', ''), 'Bearer '+token):
            raise HTTPException(403, 'Watch 语音控制未授权')

    def active(self):
        now = self.clock()
        self.clients = {k:v for k,v in self.clients.items() if now-v['seen'] < 7}
        # Distinct windows are ambiguous even if they display the same project.
        if len(self.clients) != 1:
            raise HTTPException(409, '请只保留一个可见的智算工作页面，再说一次')
        return next(iter(self.clients.values()))

    def poll(self, payload):
        with self.lock:
            if not self.token():
                return {'enabled': False, 'command': None}
            previous = self.clients.get(payload.client, {})
            identity = (payload.context, payload.job)
            binding = previous.get('binding') if previous.get('identity') == identity else secrets.token_hex(24)
            self.clients[payload.client] = dict(identity=identity, binding=binding, seen=self.clock(), client=payload.client)
            try:
                active = self.active()
            except HTTPException:
                return {'enabled': True, 'command': None}
            for row in self.commands.values():
                if row['status']=='pending' and row['binding']==active['binding'] and self.clock()<row['deadline']:
                    row['status']='claimed'
                    return {'enabled': True, 'command': {k:row[k] for k in ('request_id','action','binding')}}
            return {'enabled': True, 'command': None}

    def context(self):
        with self.lock:
            return {'protocol': 'astra-watch-commands/1', 'binding': self.active()['binding']}

    def submit(self, payload):
        with self.lock:
            existing = self.commands.get(payload.request_id)
            if existing:
                if any(existing[k]!=getattr(payload,k) for k in ('binding','action')):
                    raise HTTPException(409, '同一指令编号不能更换内容')
                return self.receipt(payload.request_id)
            active = self.active()
            if payload.binding != active['binding']:
                raise HTTPException(409, '当前项目已切换，请重新说一次')
            now = self.clock()
            self.commands = {k:v for k,v in self.commands.items() if now-v['created']<600}
            if len(self.commands)>=200 or any(v['status'] in ('pending','claimed') and now<v['deadline'] for v in self.commands.values()):
                raise HTTPException(409, '上一条语音指令仍在处理，请稍后再说')
            self.commands[payload.request_id] = dict(**payload.model_dump(),status='pending',message='',created=now,deadline=now+12)
            return self.receipt(payload.request_id)

    def receipt(self, request_id):
        with self.lock:
            row = self.commands.get(request_id)
            if not row:
                raise HTTPException(404, '未找到语音指令')
            if row['status'] in ('pending','claimed') and self.clock()>=row['deadline']:
                row.update(status='expired',message='指令响应超时，请查看电脑状态；不会自动重复执行。')
            return {k:row[k] for k in ('request_id','status','message')}

    def ack(self, payload):
        with self.lock:
            row = self.commands.get(payload.request_id)
            self.receipt(payload.request_id)
            active = self.active()
            if (row['status'] not in ('claimed','completed') or active['client']!=payload.client
                    or active['identity']!=(payload.context,payload.job) or row['binding']!=active['binding']):
                raise HTTPException(409, '指令上下文已失效，不接受迟到回执')
            row.update(status='completed',message=payload.message)
            return self.receipt(payload.request_id)

    def cancel(self, request_id):
        with self.lock:
            row = self.commands.get(request_id)
            if row and row['status']=='pending':
                row.update(status='cancelled',message='语音指令已取消')
            return {'cancelled': bool(row and row['status']=='cancelled')}

def install(app, credential):
    bridge = CommandBridge(credential)
    router = APIRouter(prefix=PREFIX)

    def ui(request):
        if request.headers.get('x-astra-voice-ui')!='1':
            raise HTTPException(403, '需要智算工作页面')

    @router.post('/workspace')
    def poll(payload: Context, request: Request):
        ui(request)
        return bridge.poll(payload)

    @router.post('/ack')
    def ack(payload: Ack, request: Request):
        ui(request)
        return bridge.ack(payload)

    @router.get('/context')
    def context(request: Request):
        bridge.authorize(request)
        return bridge.context()

    @router.post('')
    def submit(payload: Command, request: Request):
        bridge.authorize(request)
        return bridge.submit(payload)

    @router.get('/{request_id}')
    def receipt(request_id: str, request: Request):
        bridge.authorize(request)
        return bridge.receipt(request_id)

    @router.delete('/{request_id}')
    def cancel(request_id: str, request: Request):
        bridge.authorize(request)
        return bridge.cancel(request_id)

    app.include_router(router)
    return bridge
