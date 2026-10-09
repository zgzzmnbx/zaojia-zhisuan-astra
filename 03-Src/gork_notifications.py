"""Optional output observer: durable identity, bounded retry and request-scoped leases.

No business mutation or BLE client. A worker thread keeps leases independent of
the frozen engine's synchronous work on the HTTP loop.
"""
from __future__ import annotations
import asyncio
from contextvars import ContextVar
from datetime import datetime, timezone
import functools
import importlib.util
import inspect
import json
from pathlib import Path
import queue
import re
import sqlite3
import threading
import time
from uuid import uuid4

from fastapi import HTTPException
import gork_config as config

_spec = importlib.util.spec_from_file_location('astra_gork_sdk', Path(__file__).parent / 'vendor/gork-output/external_client.py')
sdk = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sdk)
request_round = ContextVar('astra_gork_request', default='')
LIVE = {'queued', 'dispatching', 'active', 'partial'}


def timestamp(value):
    try:
        date = datetime.fromisoformat(value)
        return date.timestamp() if date.tzinfo else 0
    except (ValueError, TypeError):
        return 0


def error_code(exc):
    code = getattr(exc, 'code', '')
    return code if isinstance(code, str) and re.fullmatch(r'[A-Z_]{1,80}', code) else 'CONNECTION_UNAVAILABLE'


class Notifications:
    def __init__(self, database, *, feed=lambda: [], client_factory=None, clock=time.time):
        self.database, self.feed, self.clock = Path(database), feed, clock
        self.client_factory = client_factory or self._client
        self.lock = threading.RLock()
        self.inbox = queue.Queue(maxsize=128)
        self.active = set()
        self.cancelled_requests = set()
        self.closed = threading.Event()
        self.worker = None
        self.cached_status = {'state': 'disabled', 'message': '阶段通知已关闭'}
        self.client = None
        self.settings = config.Settings()
        self.cutoff = clock()
        self.next_feed = 0
        self.debug_task = 'debug-' + uuid4().hex
        self.debug_attempt = 'debug-' + uuid4().hex
        self.connection = None

    def _client(self, settings):
        config.token(settings)  # Validate independent source; never return secret to UI.
        path = Path(settings.token_file)
        return sdk.GorkClient(path if path.is_absolute() else config.ROOT / path)

    def db(self):
        if self.connection is None:
            self.database.parent.mkdir(parents=True, exist_ok=True)
            self.connection = sqlite3.connect(self.database, check_same_thread=False)
            self.connection.row_factory = sqlite3.Row
            self.connection.executescript('''
                CREATE TABLE IF NOT EXISTS sequences(task TEXT PRIMARY KEY, value INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, producer TEXT UNIQUE,
                    payload TEXT NOT NULL, status TEXT NOT NULL, deadline REAL NOT NULL,
                    next_try REAL NOT NULL, heartbeat REAL NOT NULL, request_round TEXT NOT NULL,
                    receipt TEXT NOT NULL DEFAULT '{}', error TEXT NOT NULL DEFAULT '');
                CREATE TABLE IF NOT EXISTS cancellations(task TEXT, attempt TEXT, expires REAL,
                    PRIMARY KEY(task,attempt));
            ''')
            if 'debug' not in {row[1] for row in self.connection.execute('PRAGMA table_info(events)')}:
                self.connection.execute('ALTER TABLE events ADD COLUMN debug INTEGER NOT NULL DEFAULT 0')
            cancel_columns={row[1] for row in self.connection.execute('PRAGMA table_info(cancellations)')}
            for name, declaration in [('confirmed','INTEGER NOT NULL DEFAULT 0'),('next_try','REAL NOT NULL DEFAULT 0')]:
                if name not in cancel_columns:
                    self.connection.execute(f'ALTER TABLE cancellations ADD COLUMN {name} {declaration}')
            # This process does not take over old leases or replay a saved queue.
            self.connection.execute("UPDATE events SET status='interrupted' WHERE status IN ('pending','queued','dispatching','active','partial')")
            self.connection.commit()
        return self.connection

    def start(self):
        with self.lock:
            self.closed.clear()
            self.db()
            try:
                self.settings = config.load()
            except HTTPException:
                self.cached_status = {'state': 'error', 'message': '阶段通知设置无法读取，已停止输出'}
            self.cutoff = self.clock()
            if self.worker is None:
                self.worker = threading.Thread(target=self._run, name='astra-gork-output', daemon=True)
                self.worker.start()

    def stop(self):
        self.closed.set()
        if self.worker:
            self.worker.join(timeout=4)
        with self.lock:
            self.active.clear()
            if self.connection:
                self.connection.close()
                self.connection = None
            self.worker = None
            self.client = None

    def begin(self, identifier):
        with self.lock:
            self.active.add(identifier)

    def end(self, identifier, cancelled=False):
        with self.lock:
            self.active.discard(identifier)
            if cancelled:
                self.cancelled_requests.add(identifier)
                rows = self.db().execute("SELECT payload FROM events WHERE request_round=?", (identifier,)).fetchall()
                for row in rows:
                    payload = json.loads(row['payload'])
                    self.cancel(payload['task_id'], payload['attempt'])

    def observe(self, event, job_id, round_id=''):
        # Business publisher never waits on network / SQLite / configuration locks.
        if not self.settings.enabled:
            return
        event = {**event, 'job_id': job_id, '_request': round_id,
                 'attempt': event.get('attempt') or ('request:' + round_id if round_id else 'event:' + str(event.get('event_id', '')))}
        try:
            self.inbox.put_nowait(event)
        except queue.Full:
            self.cached_status = {'state': 'error', 'message': '阶段通知缓冲已满，专业处理继续'}

    def validate_remote(self, client, settings):
        caps, state = client.capabilities(), client.status()
        if (caps.get('protocol_version') != '1.0' or caps.get('transport') != 'loopback_http'
                or state.get('source') != 'astra'):
            raise HTTPException(409, 'Gork 控制台通用通知接口尚未就绪，请使用支持协议 1.0 的版本')
        if not state.get('enabled'):
            raise HTTPException(409, '请先在 Gork 控制台启用 Astra 程序权限')
        if state.get('paused'):
            raise HTTPException(409, '通知哨兵已暂停，请在 Gork 控制台恢复')
        policy = state.get('policy') or {}
        for stage in settings.stages.values():
            if not stage.enabled:
                continue
            display = settings.display_target if stage.display_target == 'inherit' else stage.display_target
            needed = {'desktop', 'watch'} if display == 'both' else set() if display == 'none' else {display}
            if not needed.issubset(set(policy.get('display_targets') or [])) or stage.priority > policy.get('max_priority', -1):
                raise HTTPException(409, '阶段显示端或优先级超过 Gork 授予的权限')
            target = settings.speech_target if stage.speech_target == 'inherit' else stage.speech_target
            if target == 'current':
                target = state.get('current_sound_target')
            if settings.sound and stage.speech and target not in (policy.get('speech_targets') or []):
                raise HTTPException(409, '阶段声音位置未获 Gork 授权')
        return state

    async def configure(self, settings):
        return await asyncio.to_thread(self._configure, settings)

    def _configure(self, settings):
        with self.lock:
            if settings.revision != config.load().revision:
                raise HTTPException(409, '设置已在其他窗口修改，请重新载入后保存')
            client = None
            if settings.enabled:
                try:
                    client = self.client_factory(settings)
                    self.validate_remote(client, settings)
                except HTTPException:
                    raise
                except Exception as exc:
                    raise HTTPException(409, 'Gork 通知接口未就绪：' + error_code(exc)) from None
            # Cancel only this source's accepted output before replacing its policy.
            rows = self.db().execute("SELECT payload FROM events WHERE status IN ('pending','queued','dispatching','active','partial')").fetchall()
            for row in rows:
                payload = json.loads(row['payload'])
                self.cancel(payload['task_id'], payload['attempt'])
            settings = settings.model_copy(update={'revision': settings.revision + 1})
            config.write(settings)
            self.settings, self.client = settings, client
            self.cutoff = self.clock()
            while not self.inbox.empty():
                try:
                    self.inbox.get_nowait()
                except queue.Empty:
                    break
            self.cached_status = {'state': 'ready' if settings.enabled else 'disabled',
                                  'message': '等待新阶段，历史事件不补播' if settings.enabled else '阶段通知已关闭'}

    def cancel(self, task_id, attempt):
        with self.lock:
            self.db().execute('INSERT OR REPLACE INTO cancellations(task,attempt,expires) VALUES(?,?,?)', (task_id, attempt, self.clock() + 86400))
            confirmed = False
            code = ''
            try:
                if self.client:
                    self.client.cancel_task(task_id, attempt)
                    confirmed = True
            except Exception as exc:
                code = error_code(exc)
                # Lease bounds remote state even if the controller is unavailable.
                self.cached_status = {'state': 'error', 'message': '本地已停止通知，控制台取消未确认'}
            self.db().execute("UPDATE events SET status='cancelled',error=? WHERE json_extract(payload,'$.task_id')=? AND json_extract(payload,'$.attempt')=?",
                              ('' if confirmed else code or 'CANCEL_UNCONFIRMED', task_id, attempt))
            self.db().execute('UPDATE cancellations SET confirmed=?,next_try=? WHERE task=? AND attempt=?', (int(confirmed), self.clock()+3,task_id,attempt))
            self.db().commit()
            return confirmed

    def enqueue(self, event):
        key = config.stage_key(event)
        job = str(event.get('job_id') or '')
        occurred = timestamp(event.get('occurred_at'))
        debug = event.get('_debug') is True
        valid_job = re.fullmatch(r'debug-[a-f0-9]{32}' if debug else r'[a-f0-9]{32}', job)
        if not key or not valid_job or occurred <= self.cutoff or occurred > self.clock() + 30:
            return
        if event.get('_request') in self.cancelled_requests:
            return
        stage = self.settings.stages[key]
        if not stage.enabled or occurred + stage.ttl_ms / 1000 <= self.clock():
            return
        db = self.db()
        producer = str(event.get('event_id') or '')
        if not producer or db.execute('SELECT 1 FROM events WHERE producer=?', (producer,)).fetchone():
            return
        if db.execute("SELECT count(*) FROM events WHERE status='pending'").fetchone()[0] >= 64:
            self.cached_status = {'state': 'error', 'message': '阶段通知队列已满，专业处理继续'}
            return
        attempt = event.get('attempt') or 'event:' + producer
        if db.execute('SELECT 1 FROM cancellations WHERE task=? AND attempt=? AND expires>?', (job, attempt, self.clock())).fetchone():
            return
        db.execute('INSERT INTO sequences(task,value) VALUES(?,1) ON CONFLICT(task) DO UPDATE SET value=value+1', (job,))
        sequence = db.execute('SELECT value FROM sequences WHERE task=?', (job,)).fetchone()[0]
        text_stage = stage.model_copy(update={'text': '【调试·模拟数据】' + stage.text}) if debug else stage
        text = config.render_text(event, text_stage)
        speech = None
        if self.settings.sound and stage.speech:
            speech_stage = stage.model_copy(update={'text': ('调试消息，模拟数据。' if debug else '') + (stage.speech_text or stage.text)})
            speech = {'text': config.render_text(event, speech_stage), 'mode': self.settings.speech_mode,
                      'target': self.settings.speech_target if stage.speech_target == 'inherit' else stage.speech_target}
            if not speech['text'].strip():
                speech = None
        payload = dict(protocol_version='1.0', source='astra', event_id=uuid4().hex,
                       task_id=job, attempt=attempt, stage=key, sequence=sequence,
                       kind=stage.kind, occurred_at=event['occurred_at'], expression=stage.expression,
                       expression_mode=stage.expression_mode, text=text, speech=speech,
                       display_target=self.settings.display_target if stage.display_target == 'inherit' else stage.display_target,
                       duration_ms=stage.duration_ms, ttl_ms=stage.ttl_ms, priority=stage.priority,
                       lease_ms=self.settings.lease_ms)
        from gork_stages import amount_text
        if amount_text(event):
            payload['amount_summary'] = event['amount_summary']
        # Skip obsolete unsent states; accepted states are superseded by the server
        # with the new sequence, without stopping speech already in progress.
        db.execute("UPDATE events SET status='superseded' WHERE json_extract(payload,'$.task_id')=? AND status='pending'", (job,))
        db.execute('INSERT INTO events(id,producer,payload,status,deadline,next_try,heartbeat,request_round,debug) VALUES(?,?,?,?,?,?,?,?,?)',
                   (payload['event_id'], producer, json.dumps(payload, ensure_ascii=False), 'pending',
                    occurred + stage.ttl_ms / 1000, 0, 0, event.get('_request', ''), int(debug)))
        db.commit()

    def debug_send(self, stage_id, include_amount=False, amount='9447173.00'):
        with self.lock:
            settings = config.load()
            # Explicit manual output can be tested while automatic notifications are off.
            client = self.client_factory(settings)
            self.validate_remote(client, settings)
            self.settings, self.client = settings, client
            key = {'match_completed':'match_result','match_failed':'match_result',
                   'warning_completed':'warning_result','warning_found':'warning_result',
                   'warning_failed':'warning_result'}.get(stage_id, stage_id)
            status = 'running' if stage_id.endswith('_start') else 'failed' if stage_id.endswith('_failed') else 'sent' if stage_id=='review_sent' else 'completed'
            event = {'event_id': uuid4().hex, 'job_id': self.debug_task, 'attempt': self.debug_attempt,
                     'stage': key, 'status': status, 'warning_rows': 2 if stage_id=='warning_found' else 0,
                     'review_rows': 1, 'task_name': '独立调试任务', '_debug': True,
                     'occurred_at': datetime.fromtimestamp(self.clock(), timezone.utc).isoformat()}
            if include_amount and stage_id=='match_completed':
                from gork_stages import amount_text
                event['amount_summary'] = {'value': amount, 'currency':'CNY','unit':'yuan','basis':'tax_included',
                                          'attempt':self.debug_attempt,'calculation_status':'unconfirmed'}
                if not amount_text(event):
                    raise HTTPException(422, '请输入有效的模拟金额（元），不使用真实任务数据')
            self.enqueue(event)
            row = self.db().execute('SELECT id FROM events WHERE producer=?', (event['event_id'],)).fetchone()
            if not row:
                raise HTTPException(409, '此阶段已关闭或队列已满，未发送调试通知')
            return self.debug_receipt(row['id'])

    def debug_receipt(self, event_id):
        with self.lock:
            row = self.db().execute('SELECT * FROM events WHERE id=? AND debug=1', (event_id,)).fetchone()
            if not row:
                raise HTTPException(404, '当前工作区未找到该调试通知')
            payload = json.loads(row['payload'])
            return {'event_id': row['id'], 'task_id': payload['task_id'], 'attempt': payload['attempt'],
                    'status': row['status'], 'request': payload, 'delivery': json.loads(row['receipt']).get('delivery', {}), 'error': row['error']}

    def debug_cancel(self):
        with self.lock:
            confirmed = self.cancel(self.debug_task, self.debug_attempt)
            self.debug_attempt = 'debug-' + uuid4().hex
            return {'status':'cancelled','source':'astra','remote_confirmed':confirmed}

    def debug_heartbeat(self, event_id):
        with self.lock:
            record = self.debug_receipt(event_id)
            if record['request']['kind']!='state' or record['status'] not in {'active','partial'}:
                raise HTTPException(409, '仅对仍有效的调试状态报活')
            self.client.heartbeat(event_id, record['task_id'], record['attempt'])
            return record

    def step(self):
        with self.lock:
            now = self.clock()
            cancellations=self.db().execute('SELECT task,attempt FROM cancellations WHERE confirmed=0 AND expires>? AND next_try<=? LIMIT 8',(now,now)).fetchall()
            if cancellations:
                if self.client is None:
                    self.client=self.client_factory(self.settings)
                for item in cancellations:
                    try:
                        self.client.cancel_task(item['task'],item['attempt'])
                        self.db().execute('UPDATE cancellations SET confirmed=1 WHERE task=? AND attempt=?',(item['task'],item['attempt']))
                        self.db().execute("UPDATE events SET error='' WHERE status='cancelled' AND json_extract(payload,'$.task_id')=? AND json_extract(payload,'$.attempt')=?",(item['task'],item['attempt']))
                    except Exception:
                        self.db().execute('UPDATE cancellations SET next_try=? WHERE task=? AND attempt=?',(now+3,item['task'],item['attempt']))
                self.db().commit()
            if not self.settings.enabled and not self.db().execute("SELECT 1 FROM events WHERE debug=1 AND status IN ('pending','queued','dispatching','active','partial')").fetchone():
                return
            if self.client is None:
                self.client = self.client_factory(self.settings)
            now = self.clock()
            if self.settings.enabled and now >= self.next_feed:
                self.next_feed = now + 5
                for event in sorted(self.feed(), key=lambda e: e.get('occurred_at', '')):
                    if event.get('stage') == 'review_sent':
                        self.enqueue(event)
            for _ in range(128 if self.settings.enabled else 0):
                try:
                    self.enqueue(self.inbox.get_nowait())
                except queue.Empty:
                    break
            db = self.db()
            rows = db.execute("SELECT * FROM events WHERE status IN ('pending','queued','dispatching','active','partial') AND next_try<=? AND (debug=1 OR ?=1) ORDER BY next_try,rowid LIMIT 8", (now, int(self.settings.enabled))).fetchall()
            for row in rows:
                payload = json.loads(row['payload'])
                if row['status'] == 'pending' and now >= row['deadline']:
                    db.execute("UPDATE events SET status='expired' WHERE id=?", (row['id'],))
                    continue
                if now < row['next_try']:
                    continue
                try:
                    receipt = self.client.send(payload) if row['status'] == 'pending' else self.client.receipt(row['id'])
                    status = receipt.get('status', 'queued')
                    if status not in LIVE | {'completed', 'failed', 'cancelled', 'superseded', 'expired', 'interrupted'}:
                        status = 'failed'
                    if (payload['kind'] == 'state' and status in {'active', 'partial'}
                            and row['request_round'] in self.active and now >= row['heartbeat']):
                        self.client.heartbeat(row['id'], payload['task_id'], payload['attempt'])
                        db.execute('UPDATE events SET heartbeat=? WHERE id=?', (now + self.settings.heartbeat_ms / 1000, row['id']))
                    safe_receipt = {'status': status, 'delivery': {k: str(v)[:80] for k, v in (receipt.get('delivery') or {}).items() if k in {'desktop', 'watch', 'speech'}}}
                    db.execute('UPDATE events SET status=?,receipt=?,next_try=?,error=? WHERE id=?',
                               (status, json.dumps(safe_receipt), now + 2, '', row['id']))
                    self.cached_status = {'state': 'ready', 'message': '通知接口可用，回执按输出端记录'}
                except Exception as exc:
                    code = error_code(exc)
                    retry = not isinstance(exc, sdk.GorkError) or exc.status in {429, 500, 502, 503, 504}
                    db.execute('UPDATE events SET status=?,error=?,next_try=? WHERE id=?',
                               (row['status'] if retry else 'failed', code, now + 3, row['id']))
                    self.cached_status = {'state': 'error', 'message': '通知未确认：' + code}
            # Bounded receipt retention; monotonic sequence watermarks are never removed.
            db.execute("DELETE FROM events WHERE deadline<? AND status NOT IN ('pending','queued','dispatching','active','partial')", (now - 86400,))
            db.execute('DELETE FROM cancellations WHERE expires<?', (now,))
            db.commit()

    def _run(self):
        while not self.closed.wait(.5):
            try:
                self.step()
            except Exception as exc:
                self.cached_status = {'state': 'error', 'message': '通知接口未就绪：' + error_code(exc)}

    async def status(self, settings):
        return await asyncio.to_thread(self._status, settings)

    def _status(self, settings):
        with self.lock:
            result = dict(self.cached_status)
            result['active_operations'] = len(self.active)
            try:
                client = self.client_factory(settings)
                caps, state = client.capabilities(), client.status()
                if caps.get('protocol_version') != '1.0' or state.get('source') != 'astra':
                    raise ValueError()
                result.update(policy=state.get('policy'), current_sound_target=state.get('current_sound_target'), paused=state.get('paused'))
                if not settings.enabled:
                    result.update(state='disabled', message='阶段通知已关闭，可配置后保存')
            except HTTPException:
                if not settings.enabled:
                    result.update(state='unconfigured', message='尚未登记 Astra 程序凭据')
            except Exception as exc:
                result.update(state='unavailable', message='通用通知接口未就绪：' + error_code(exc))
            rows = self.db().execute('SELECT id,payload,status,receipt,error FROM events ORDER BY rowid DESC LIMIT 8').fetchall()
            result['history'] = [{'event_id': row['id'], 'stage': json.loads(row['payload'])['stage'], 'status': row['status'],
                                  'delivery': json.loads(row['receipt']).get('delivery', {}), 'error': row['error']} for row in rows]
            return result


def install(app, engine, runtime):
    from app import sentinel_events, task_monitoring
    instance = Notifications(config.ROOT / 'runtime/astra-gork-notifications/outbox.sqlite3',
                             feed=lambda: engine.get_current_monitored_task()['events'])
    config.bridge = instance
    original_write = sentinel_events.atomic_json
    def observe_write(path, event):
        result = original_write(path, event)
        try:
            committed = json.loads(Path(path).read_text(encoding='utf-8'))
            instance.observe(committed, Path(path).parent.parent.name, request_round.get())
        except Exception:
            pass  # Optional output cannot change a committed professional result.
        return result
    sentinel_events.atomic_json = observe_write
    old_events = task_monitoring._events
    def linked_events(row, job_id, runtime_dir, dispatch_db_path=None):
        return [{**event, 'job_id': job_id} for event in old_events(row, job_id, runtime_dir, dispatch_db_path)]
    task_monitoring._events = linked_events
    # Replace whole routes: FastAPI caches coroutine classification in handlers.
    for route in list(app.router.routes):
        if getattr(route, 'path', '') not in {'/api/process', '/api/process/batch-match', '/api/experience-warnings/run', '/api/risk-report'}:
            continue
        original = route.endpoint
        report = route.path == '/api/risk-report'
        def wrap(original, report):
            @functools.wraps(original)
            async def call(**kwargs):
                identifier = uuid4().hex
                marker = request_round.set(identifier)
                instance.begin(identifier)
                job = (kwargs.get('payload') or {}).get('job_id', '') or kwargs.get('job_id', '')
                def report_event(stage, status):
                    instance.observe({'event_id': uuid4().hex, 'stage': stage, 'status': status,
                                      'occurred_at': datetime.now(timezone.utc).isoformat()}, job, identifier)
                try:
                    if report:
                        report_event('report_start', 'running')
                    response = await original(**kwargs) if inspect.iscoroutinefunction(original) else await asyncio.to_thread(original, **kwargs)
                    return response
                except asyncio.CancelledError:
                    instance.end(identifier, cancelled=True)
                    raise
                except Exception:
                    if report:
                        report_event('report_failed', 'failed')
                    raise
                finally:
                    instance.end(identifier)
                    request_round.reset(marker)
            call.__signature__ = inspect.signature(original, eval_str=True)
            return call
        app.router.routes.remove(route)
        app.add_api_route(route.path, wrap(original, report), methods=list(route.methods), response_model=route.response_model)
    app.add_event_handler('startup', instance.start)
    app.add_event_handler('shutdown', instance.stop)
    return instance
