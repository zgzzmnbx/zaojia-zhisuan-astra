"""Bounded, read-only host diagnostics. Never capture request/response contents."""
from collections import deque
from datetime import datetime, timezone
import asyncio
import logging
import re
import threading
import time
import uuid

from fastapi import APIRouter, Query
from starlette.routing import Match

ENDPOINT = '/api/astra/runtime-console'


def stack_locations(tb):
    frames = []
    while tb:
        frames.append({'module': tb.tb_frame.f_globals.get('__name__', 'python'), 'line': tb.tb_lineno})
        tb = tb.tb_next
    return frames[-8:]


def operation(path):
    for token, title in (
        ('batch-match', '规则匹配'), ('risk-report', '风险报告'),
        ('row-assist', '行级 AI 填价'), ('documents', '公文处理'),
        ('knowledge', '知识检索'), ('weknora', '知识库'),
        ('collaboration', '协同服务'), ('gork', '机器人联动'),
        ('workspace', '工作空间'), ('inspect', '工作簿识别'),
        ('preview', '表格处理'), ('process', '工作簿编制'),
        ('projects', '项目看板'), ('health', '宿主检测'),
    ):
        if token in path:
            return title
    return '宿主接口'


class ConsoleStore:
    def __init__(self, capacity=1000):
        self.events = deque(maxlen=capacity)
        self.active = {}
        self.lock = threading.RLock()
        self.cursor = 0
        self.instance = uuid.uuid4().hex
        self.started = time.time()
        self.add('info', '宿主', '运行记录已开启')

    def add(self, level, source, message, **fields):
        with self.lock:
            self.cursor += 1
            self.events.append(dict(id=self.cursor, time=datetime.now(timezone.utc).isoformat(),
                                    level=level, source=source, message=message, **fields))

    def snapshot(self, after=0, instance=''):
        with self.lock:
            reset = bool(instance and instance != self.instance) or after > self.cursor
            oldest = self.events[0]['id'] if self.events else self.cursor
            return dict(instance=self.instance, cursor=self.cursor, reset=reset,
                        truncated=bool(after and not reset and after < oldest-1),
                        capacity=self.events.maxlen, uptime=int(time.time()-self.started),
                        events=[dict(e) for e in self.events if reset or e['id'] > after],
                        active=[dict(v, elapsed_ms=round((time.monotonic()-v['started'])*1000))
                                for v in self.active.values()])


class ConsoleMiddleware:
    """ASGI wrapper measures the complete stream, not just response headers."""
    def __init__(self, app, store, routes):
        self.app, self.store, self.routes = app, store, routes

    async def __call__(self, scope, receive, send):
        raw_path = scope.get('path', '')
        if scope['type'] != 'http' or not raw_path.startswith('/api/') or raw_path == ENDPOINT:
            return await self.app(scope, receive, send)
        # Route templates are safe; dynamic IDs, query strings and unknown URLs are never logged.
        route = next((r for r in self.routes if r.matches(scope)[0] == Match.FULL), None)
        path = getattr(route, 'path', '') or '/api/[未注册接口]'
        method = scope['method'] if scope['method'] in {'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'} else 'OTHER'
        request_id = uuid.uuid4().hex[:12]
        started = time.monotonic()
        source = operation(path)
        quiet = method in {'GET', 'HEAD', 'OPTIONS'}
        fields = dict(request_id=request_id, method=method, path=path)
        with self.store.lock:
            self.store.active[request_id] = dict(**fields, source=source, started=started, quiet=quiet)
        self.store.add('debug' if quiet else 'info', source, '请求开始', **fields)
        status = 500
        outcome = '请求结束'
        failure = False

        async def observed_send(message):
            nonlocal status
            if message['type'] == 'http.response.start':
                status = message['status']
            await send(message)

        try:
            await self.app(scope, receive, observed_send)
        except asyncio.CancelledError:
            outcome, failure = '请求已取消或连接中断', True
            raise
        except Exception as exc:
            # Error values can contain credentials or document text. Keep only the exception class.
            outcome, failure = '请求异常：'+type(exc).__name__, True
            fields.update(exception=type(exc).__name__, frames=stack_locations(exc.__traceback__))
            raise
        finally:
            duration = round((time.monotonic()-started)*1000)
            with self.store.lock:
                self.store.active.pop(request_id, None)
            level = 'error' if failure or status >= 500 else 'warning' if status >= 400 else 'debug' if quiet else 'info'
            self.store.add(level, source, outcome, **fields, status=status, duration_ms=duration)


class SafeLogHandler(logging.Handler):
    def __init__(self, store):
        super().__init__(logging.WARNING)
        self.store = store

    def emit(self, record):
        # Avoid raw log formatting: libraries may embed prompts, tokens, payloads or URLs.
        name = record.name if re.fullmatch(r'[a-zA-Z0-9_.-]{1,80}', record.name) else 'python'
        fields = {'logger': name}
        if record.exc_info and record.exc_info[0]:
            fields['exception'] = record.exc_info[0].__name__
            fields['frames'] = stack_locations(record.exc_info[2])
        self.store.add('error' if record.levelno >= logging.ERROR else 'warning', 'Python',
                       '模块报告异常；原始消息未采集', **fields)


def install(app):
    store = ConsoleStore()
    router = APIRouter()

    @router.get(ENDPOINT)
    def read_console(after: int = Query(0, ge=0), instance: str = Query('', max_length=64)):
        from fastapi.responses import JSONResponse
        return JSONResponse(store.snapshot(after, instance), headers={'Cache-Control': 'no-store'})

    app.include_router(router)
    app.add_middleware(ConsoleMiddleware, store=store, routes=app.router.routes)
    handler = SafeLogHandler(store)
    logging.getLogger().addHandler(handler)
    return store
