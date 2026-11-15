"""Independent, in-memory web speech. Never dispatches or changes Watch settings."""
import asyncio
from collections import OrderedDict
from functools import wraps
import queue
import re
import threading
import time

import gork_config as config
from gork_notifications import timestamp
from gork_speech import SpeechMirror


class WebSpeech:
    def __init__(self, *, feed=lambda: [], approval_feed=None, clock=time.time, settings=config.load):
        self.feed, self.approval_feed = feed, approval_feed
        self.clock, self.settings = clock, settings
        self.mirror = SpeechMirror(clock)
        self.lock = threading.Lock()
        self.inbox = queue.Queue(maxsize=128)
        self.seen = OrderedDict()
        self.cutoff = clock()
        self.closed = threading.Event()
        self.worker = None
        self.next_feed = 0

    def observe(self, event, job_id, round_id='', *, settings=None, manual=False):
        # The existing publisher/sender must never wait for disk, network or this worker.
        try:
            self.inbox.put_nowait(({**event, 'job_id': job_id}, settings, manual, False))
        except queue.Full:
            pass

    def start(self):
        if self.worker is not None:
            return
        self.cutoff = self.clock()
        if self.approval_feed:
            self.approval_feed.reset()
        self.closed.clear()
        self.worker = threading.Thread(target=self._run, name='astra-web-speech', daemon=True)
        self.worker.start()

    def stop(self):
        self.closed.set()
        if self.worker:
            self.worker.join(timeout=4)
            self.worker = None

    def _run(self):
        while not self.closed.is_set():
            try:
                self.step()
            except Exception:
                pass  # Optional presentation cannot stop business or hardware workers.
            self.closed.wait(.2)

    def step(self):
        now = self.clock()
        if now >= self.next_feed:
            self.next_feed = now + 2
            # Independent read-only feeds; do not consume the sender's inbox or baseline.
            for read, approval in [(self.feed, False),
                                   (self.approval_feed.read if self.approval_feed else lambda: [], True)]:
                try:
                    for event in read():
                        if approval or event.get('stage') == 'review_sent':
                            self._publish(event, None, False, approval)
                except Exception:
                    pass
        for _ in range(128):
            try:
                event, settings, manual, approval = self.inbox.get_nowait()
            except queue.Empty:
                break
            try:
                self._publish(event, settings, manual, approval)
            except Exception:
                continue

    def _publish(self, event, settings, manual, approval):
        key = config.stage_key(event)
        producer = str(event.get('event_id') or '')
        job = str(event.get('job_id') or '')
        occurred, now = timestamp(event.get('occurred_at')), self.clock()
        if not key or not producer or not re.fullmatch(r'(?:debug-)?[a-f0-9]{32}', job):
            return
        if occurred <= 0 or occurred > now + 30 or now - occurred >= 90:
            return
        if not manual and occurred <= self.cutoff and not (approval and occurred >= int(self.cutoff)):
            return
        identity = (job, event.get('_review_scope') or producer) if key == 'review_sent' else (job, producer)
        if identity in self.seen:
            return
        stage = (settings or self.settings()).stages[key]
        # Share only the speech formatter/template. Hardware enablement, targets,
        # stage switches, sound, permissions and receipts never gate web presentation.
        text = config.render_text(event, stage.model_copy(update={'text': stage.speech_text or stage.text}), spoken=True)
        if not text.strip():
            return
        with self.lock:
            self.mirror.sequence += 1
            self.mirror.items.append(dict(sequence=self.mirror.sequence,
                                          event_id=f'{job}:{producer}', text=text, created_at=now))
        self.seen[identity] = None
        if len(self.seen) > 4096:
            self.seen.popitem(last=False)

    def snapshot(self, stream='', after=0):
        with self.lock:
            return self.mirror.snapshot(stream, after)


def attach(web, notifications):
    """Tap completed local calls; preserve original arguments, result and exceptions."""
    original_observe, original_enqueue = notifications.observe, notifications.enqueue

    @wraps(original_observe)
    def observe(event, job_id, round_id=''):
        result = original_observe(event, job_id, round_id)
        try:
            web.observe(event, job_id, round_id)
        except Exception:
            pass
        return result

    @wraps(original_enqueue)
    def enqueue(event, **kwargs):
        result = original_enqueue(event, **kwargs)
        # Preserve explicit replay/debug bubbles without changing admission or dispatch.
        if result is None and (kwargs.get('manual') or event.get('_debug')):
            try:
                web.observe(event, event.get('job_id', ''), settings=kwargs.get('settings') or notifications.settings, manual=True)
            except Exception:
                pass
        return result

    notifications.observe, notifications.enqueue = observe, enqueue


def install(app, engine, runtime, notifications):
    from app import feishu_app_bot
    from gork_review import ApprovalFeed
    web = WebSpeech(feed=lambda: engine.get_current_monitored_task()['events'],
                    approval_feed=ApprovalFeed(feishu_app_bot.DB_PATH, runtime))
    attach(web, notifications)

    @app.get('/api/astra/gork/web-speech')
    async def snapshot(stream: str = '', after: int = 0):
        return await asyncio.to_thread(web.snapshot, stream, after)

    return web
