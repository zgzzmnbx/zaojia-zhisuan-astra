"""Optional output observer: durable identity, bounded retry and request-scoped leases.

No business mutation or BLE client. A worker thread keeps leases independent of
the frozen engine's synchronous work on the HTTP loop.
"""
from __future__ import annotations
import asyncio
from contextvars import ContextVar
from datetime import datetime, timezone
import functools
import hashlib
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
import httpx

from fastapi import HTTPException
import gork_config as config

_spec = importlib.util.spec_from_file_location('astra_gork_sdk', Path(__file__).parent / 'vendor/gork-output/external_client.py')
sdk = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sdk)
request_round = ContextVar('astra_gork_request', default='')
LIVE = {'queued', 'dispatching', 'active', 'partial'}


def read_console_health():
    with httpx.Client(trust_env=False, follow_redirects=False, timeout=2) as client:
        reply = client.get('http://127.0.0.1:8766/api/health')
        reply.raise_for_status()
        return reply.json()


def timestamp(value):
    try:
        date = datetime.fromisoformat(value)
        return date.timestamp() if date.tzinfo else 0
    except (ValueError, TypeError):
        return 0


def error_code(exc):
    code = getattr(exc, 'code', '')
    return code if isinstance(code, str) and re.fullmatch(r'[A-Z_]{1,80}', code) else 'CONNECTION_UNAVAILABLE'


def review_delivery_event(event, job_id, database, requested_at=None):
    """Read verified delivery identity; approval updates are not new deliveries."""
    identifier = str(event.get('event_id') or '')
    if not identifier.endswith(':sent') or not database or not Path(database).is_file():
        return None
    collaboration = identifier[:-5]
    try:
        with sqlite3.connect(Path(database).resolve().as_uri() + '?mode=ro', uri=True, timeout=2) as db:
            db.row_factory = sqlite3.Row
            task = db.execute("""SELECT submission_hash,review_round,platform_profile_id,submission_received_at
                FROM tasks WHERE task_id=? AND source_task_id=? AND task_kind='external_dispatch'
                AND submission_delivery_status='sent' AND review_card_status='sent'""", (collaboration, job_id)).fetchone()
            if not task or not re.fullmatch(r'[a-f0-9]{64}', task['submission_hash']) or task['review_round'] < 1:
                return None
            sent = db.execute("""SELECT MAX(created_at) FROM dispatch_attempts WHERE task_id=? AND status='sent'
                AND (step IN ('review_file','review_card') OR step LIKE 'review_file:%' OR step LIKE 'review_card:%')
                AND created_at>=?""", (collaboration, task['submission_received_at'])).fetchone()[0]
    except (sqlite3.Error, TypeError, ValueError):
        return None
    scope = hashlib.sha256(f"{job_id}:{task['submission_hash']}:r{task['review_round']}".encode()).hexdigest()
    delivered_at = sent or task['submission_received_at']
    if timestamp(requested_at) > timestamp(delivered_at):
        delivered_at = requested_at  # The committed producer milestone retains subsecond precision.
    return {**event, 'job_id': job_id, 'event_id': f"{collaboration}:r{task['review_round']}:sent",
            'occurred_at': delivered_at, 'platform': task['platform_profile_id'],
            '_review_scope': scope}


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
        self.next_connect = 0
        self.platform = {'state': 'checking', 'message': '正在连接 Gork', 'checked_at': 0}

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
                CREATE TABLE IF NOT EXISTS review_notices(scope TEXT PRIMARY KEY, event_id TEXT NOT NULL);
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
            self.next_connect = 0
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

    def reconnect(self):
        # Read-only health/authentication renewal; never launches Gork or takes its owner.
        now = self.clock()
        if now < self.next_connect:
            return
        self.next_connect = now + 10
        previous = self.platform['state']
        result = {'state': 'error', 'message': 'Gork 连接异常，正在自动重试', 'checked_at': now}
        try:
            health = read_console_health()
            if (not isinstance(health, dict) or health.get('app') != 'stopwatch-voice-companion'
                    or health.get('external_protocol') != '1.0' or not isinstance(health.get('instance'), str)
                    or not isinstance(health.get('robot'), dict)):
                raise ValueError('identity')
            client = self.client_factory(self.settings)
            state = self.validate_remote(client, self.settings)
            self.client = client  # Reload the already authorized token after console restart/rotation.
            result.update(state='connected', message='Gork 已连接',
                          robot_connected=health['robot'].get('connected') is True,
                          notifications_enabled=self.settings.enabled, instance=health['instance'])
            if previous != 'connected':
                self.cached_status = {'state': 'ready' if self.settings.enabled else 'disabled',
                                      'message': '等待新阶段，历史事件不补播' if self.settings.enabled else '阶段通知已关闭'}
        except httpx.ConnectError:
            result.update(state='offline', message='Gork 未打开，启动后将自动连接')
        except HTTPException as exc:
            result['message'] = str(exc.detail)
        except sdk.GorkError as exc:
            result['message'] = 'Gork 授权或接口异常：' + error_code(exc)
        except Exception:
            pass
        if result['state'] != 'connected':
            self.client = None
        self.platform = result

    def platform_status(self):
        with self.lock:
            result = dict(self.platform)
            result['worker_running'] = self.worker is not None and self.worker.is_alive()
            if not result['worker_running']:
                result.update(state='error', message='通知连接线程未运行')
            elif result['checked_at'] and self.clock() - result['checked_at'] > 20:
                result.update(state='error', message='Gork 连接检测超时，正在自动恢复')
            return result

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
            # Saving cancels the old policy's output, including its debug attempt.
            # Keep that cancellation for late events; new manual output has a new identity.
            self.debug_attempt = 'debug-' + uuid4().hex
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
        if not key or not valid_job or occurred <= 0 or occurred > self.clock() + 30:
            return 'ASTRA_GORK_INVALID_EVENT'
        if not debug and occurred <= self.cutoff:
            return 'ASTRA_GORK_OLD_EVENT'
        if event.get('_request') in self.cancelled_requests:
            return 'ASTRA_GORK_TASK_CANCELLED'
        stage = self.settings.stages[key]
        if not stage.enabled:
            return 'ASTRA_GORK_STAGE_DISABLED'
        if occurred + stage.ttl_ms / 1000 <= self.clock():
            return 'ASTRA_GORK_EVENT_EXPIRED'
        db = self.db()
        producer = str(event.get('event_id') or '')
        if not producer or db.execute('SELECT 1 FROM events WHERE producer=?', (producer,)).fetchone():
            return 'ASTRA_GORK_DUPLICATE_EVENT'
        review_scope = event.get('_review_scope') if key == 'review_sent' and not debug else None
        if review_scope and re.fullmatch(r'[a-f0-9]{64}', review_scope):
            previous = db.execute('SELECT event_id FROM review_notices WHERE scope=?', (review_scope,)).fetchone()
            if previous:
                notice = db.execute('SELECT status,receipt FROM events WHERE id=?', (previous['event_id'],)).fetchone()
                # Retry an output that never reached either endpoint; retained watermarks prevent historical replay.
                if not notice or notice['status'] not in {'failed','expired','cancelled','superseded','interrupted'} or json.loads(notice['receipt']).get('delivery'):
                    return 'ASTRA_GORK_DUPLICATE_EVENT'
        else:
            review_scope = None
        attempt = event.get('attempt') or 'event:' + producer
        if db.execute('SELECT 1 FROM cancellations WHERE task=? AND attempt=? AND expires>?', (job, attempt, self.clock())).fetchone():
            return 'ASTRA_GORK_TASK_CANCELLED'
        # Expired unsent entries must not consume capacity while the worker reconnects.
        db.execute("UPDATE events SET status='expired' WHERE status='pending' AND deadline<=?", (self.clock(),))
        db.commit()
        if db.execute("SELECT count(*) FROM events WHERE status='pending'").fetchone()[0] >= 64:
            self.cached_status = {'state': 'error', 'message': '阶段通知队列已满，专业处理继续'}
            return 'ASTRA_GORK_QUEUE_FULL'
        db.execute('INSERT INTO sequences(task,value) VALUES(?,1) ON CONFLICT(task) DO UPDATE SET value=value+1', (job,))
        sequence = db.execute('SELECT value FROM sequences WHERE task=?', (job,)).fetchone()[0]
        text = config.render_text(event, stage)
        speech = None
        if self.settings.sound and stage.speech:
            speech_stage = stage.model_copy(update={'text': stage.speech_text or stage.text})
            speech = {'text': config.render_text(event, speech_stage, spoken=True), 'mode': self.settings.speech_mode,
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
        if review_scope:
            db.execute('INSERT OR REPLACE INTO review_notices(scope,event_id) VALUES(?,?)', (review_scope, payload['event_id']))
        db.commit()

    def debug_send(self, stage_id, include_amount=False, amount='9447173.00'):
        with self.lock:
            settings = config.load()
            # Explicit manual output can be tested while automatic notifications are off.
            client = self.client_factory(settings)
            self.validate_remote(client, settings)
            self.settings, self.client = settings, client
            if self.db().execute('SELECT 1 FROM cancellations WHERE task=? AND attempt=? AND expires>?',
                                 (self.debug_task, self.debug_attempt, self.clock())).fetchone():
                self.debug_attempt = 'debug-' + uuid4().hex
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
            rejection = self.enqueue(event)
            if rejection:
                reasons = {'ASTRA_GORK_STAGE_DISABLED': '此阶段未启用，请在阶段设置中开启并保存',
                           'ASTRA_GORK_QUEUE_FULL': '本地通知队列已满，请稍后重试',
                           'ASTRA_GORK_TASK_CANCELLED': '该轮调试已取消，请发送新信号',
                           'ASTRA_GORK_EVENT_EXPIRED': '调试信号已过期，请检查本机时间后重试'}
                raise HTTPException(409, reasons.get(rejection, '调试信号校验未通过，请重新检测后重试') + '：' + rejection)
            row = self.db().execute('SELECT id FROM events WHERE producer=?', (event['event_id'],)).fetchone()
            if not row:
                raise HTTPException(409, '调试提交结果尚未确认，请重新读取回执：ASTRA_GORK_SUBMISSION_UNCONFIRMED')
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
            self.reconnect()
            now = self.clock()
            if self.platform['state'] != 'connected':
                self.db().execute("UPDATE events SET status='expired' WHERE status='pending' AND deadline<=?", (now,))
                self.db().commit()
                return
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
            result['worker_running'] = self.worker is not None and self.worker.is_alive()
            try:
                client = self.client_factory(settings)
                if settings.enabled:
                    state = self.validate_remote(client, settings)
                else:
                    caps, state = client.capabilities(), client.status()
                    if caps.get('protocol_version') != '1.0' or state.get('source') != 'astra':
                        raise ValueError()
                result.update(policy=state.get('policy'), current_sound_target=state.get('current_sound_target'), paused=state.get('paused'))
                if not settings.enabled:
                    result.update(state='disabled', message='阶段通知已关闭，可配置后保存')
                elif not result['worker_running']:
                    result.update(state='error', message='通知发送线程未运行，请重新启动智算服务')
                elif result['state'] in {'disabled', 'unavailable'}:
                    result.update(state='ready', message='等待新阶段，历史事件不补播')
            except HTTPException as exc:
                if not settings.enabled:
                    result.update(state='unconfigured', message='尚未登记 Astra 程序凭据')
                else:
                    result.update(state='error', message=str(exc.detail))
            except Exception as exc:
                result.update(state='unavailable', message='通用通知接口未就绪：' + error_code(exc))
            rows = self.db().execute('SELECT id,payload,status,receipt,error FROM events ORDER BY rowid DESC LIMIT 8').fetchall()
            result['history'] = [{'event_id': row['id'], 'stage': json.loads(row['payload'])['stage'], 'status': row['status'],
                                  'delivery': json.loads(row['receipt']).get('delivery', {}), 'error': row['error']} for row in rows]
            return result


def install(app, engine, runtime, *, manage_lifecycle=True):
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
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', str(job_id)):
            return []
        requested = {}
        for path in sorted((Path(runtime_dir) / job_id / 'sentinel-events').glob('*.json'), reverse=True)[:100]:
            try:
                if path.stat().st_size > 2_000_000:
                    continue
                raw = json.loads(path.read_text(encoding='utf-8'))
                if raw.get('stage') == 'review_requested':
                    identifier = str(raw.get('collaboration_task_id') or '')
                    if timestamp(raw.get('occurred_at')) > timestamp(requested.get(identifier)):
                        requested[identifier] = raw['occurred_at']
            except (OSError, ValueError, AttributeError):
                continue
        events = []
        for event in old_events(row, job_id, runtime_dir, dispatch_db_path):
            linked = review_delivery_event(event, job_id, dispatch_db_path, requested.get(event['event_id'][:-5])) if event.get('stage') == 'review_sent' else {**event, 'job_id': job_id}
            if linked:
                events.append(linked)
        return events
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
    if manage_lifecycle:
        app.add_event_handler('startup', instance.start)
        app.add_event_handler('shutdown', instance.stop)
    return instance
