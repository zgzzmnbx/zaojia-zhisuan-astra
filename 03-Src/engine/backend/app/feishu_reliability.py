"""Durable inbound text processing and replies, independent of the browser."""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
import hashlib
import json
from pathlib import Path
import sqlite3
import threading
import time

import httpx


REPLY_CONTEXT: ContextVar[dict | None] = ContextVar("feishu_reply_context", default=None)
RETRY_WINDOW_SECONDS = 30 * 60  # Strictly shorter than the platform's one-hour UUID window.


def defer_reply(receive_id, msg_type, content, receive_id_type):
    context = REPLY_CONTEXT.get()
    if context is None:
        return None
    if receive_id_type != "chat_id" or receive_id != context["chat_id"]:
        raise ValueError("可靠回复不得离开原消息会话")
    if msg_type not in {"text", "interactive"}:
        return None
    slot = context["slot"]
    context["slot"] += 1
    return context["queue"].reply(context["job_id"], slot, receive_id, msg_type, content)


def retryable(exc):
    return (isinstance(exc, sqlite3.OperationalError) and "locked" in str(exc).lower()) or isinstance(exc, httpx.TransportError) or (
        isinstance(exc, httpx.HTTPStatusError) and
        (exc.response.status_code == 429 or exc.response.status_code >= 500)
    )


class MessageQueue:
    def __init__(self, path: Path, profile_id: str, log=None):
        self.path, self.profile_id = Path(path), profile_id
        self.log = log or (lambda *a, **kw: None)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS bot_inbox (
                    id TEXT PRIMARY KEY, profile TEXT NOT NULL, payload TEXT NOT NULL,
                    chat_id TEXT NOT NULL, received_at TEXT NOT NULL, created REAL NOT NULL,
                    state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
                    due REAL NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '');
                CREATE TABLE IF NOT EXISTS bot_outbox (
                    id TEXT PRIMARY KEY, profile TEXT NOT NULL, job_id TEXT NOT NULL,
                    slot INTEGER NOT NULL, chat_id TEXT NOT NULL, msg_type TEXT NOT NULL,
                    content TEXT NOT NULL, created REAL NOT NULL,
                    state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
                    due REAL NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '',
                    message_id TEXT NOT NULL DEFAULT '');
                CREATE INDEX IF NOT EXISTS bot_inbox_ready ON bot_inbox(profile,state,due);
                CREATE INDEX IF NOT EXISTS bot_outbox_ready ON bot_outbox(profile,state,due);
            """)

    @contextmanager
    def connect(self, timeout=5):
        db = sqlite3.connect(self.path, timeout=timeout)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def enqueue(self, payload, envelope, received_at):
        """Claim both legacy IDs and persist work atomically before SDK acknowledgement."""
        if not envelope.event_id or not envelope.message_id:
            return False
        key = hashlib.sha256(f"{self.profile_id}:{envelope.message_id}".encode()).hexdigest()
        with self.connect(timeout=0.25) as db:
            db.execute("BEGIN IMMEDIATE")
            claimed = db.execute(
                "INSERT OR IGNORE INTO inbound_message_events VALUES (?,?,?,?)",
                (envelope.event_id, envelope.message_id, envelope.message_created_at, received_at),
            )
            if not claimed.rowcount:
                return False
            db.execute("INSERT INTO bot_inbox(id,profile,payload,chat_id,received_at,created) VALUES (?,?,?,?,?,?)",
                       (key, self.profile_id, json.dumps(payload, ensure_ascii=False), envelope.chat_id,
                        received_at, time.time()))
        return True

    def recover(self):
        # Called once after exclusive runner ownership; never reset another profile's work.
        with self.connect() as db:
            for table in ("bot_inbox", "bot_outbox"):
                db.execute(f"UPDATE {table} SET state='pending' WHERE profile=? AND state='processing'", (self.profile_id,))

    def claim(self, table):
        assert table in {"bot_inbox", "bot_outbox"}
        now = time.time()
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute(f"UPDATE {table} SET state='pending' WHERE profile=? AND state='processing' AND due<?",
                       (self.profile_id, now))
            db.execute(f"UPDATE {table} SET state='failed',error='超过自动恢复期限，需人工核查' "
                       "WHERE profile=? AND state='pending' AND created<?",
                       (self.profile_id, now - RETRY_WINDOW_SECONDS))
            # Preserve each question's acknowledgement/answer order, without blocking other chats.
            order = (" AND NOT EXISTS (SELECT 1 FROM bot_outbox earlier WHERE earlier.job_id=t.job_id "
                     "AND earlier.slot<t.slot AND earlier.state IN ('pending','processing'))"
                     if table == "bot_outbox" else
                     " AND NOT EXISTS (SELECT 1 FROM bot_inbox earlier WHERE earlier.profile=t.profile "
                     "AND earlier.chat_id=t.chat_id AND earlier.created<t.created "
                     "AND earlier.state IN ('pending','processing'))")
            row = db.execute(f"SELECT * FROM {table} t WHERE profile=? AND state='pending' AND due<=?"
                             + order + " ORDER BY created, id LIMIT 1", (self.profile_id, now)).fetchone()
            if row is None:
                return None
            db.execute(f"UPDATE {table} SET state='processing',attempts=attempts+1,due=? WHERE id=?",
                       (now + (600 if table == "bot_inbox" else 90), row["id"]))
            return {**dict(row), "attempts": row["attempts"] + 1}

    def finish(self, table, row, *, error=None, message_id=""):
        assert table in {"bot_inbox", "bot_outbox"}
        if error is None:
            state, text = "done", ""
        else:
            state = "pending" if retryable(error) and row["attempts"] < 20 else "failed"
            # Errors may contain URLs/tickets. Persist only the exception class.
            text = type(error).__name__
        with self.connect() as db:
            db.execute(f"UPDATE {table} SET state=?,error=?,due=? WHERE id=?",
                       (state, text, time.time() + min(30, 2 ** min(row["attempts"], 5)), row["id"]))
            if table == "bot_outbox" and message_id:
                db.execute("UPDATE bot_outbox SET message_id=? WHERE id=?", (message_id, row["id"]))

    def reply(self, job_id, slot, chat_id, msg_type, content):
        key = hashlib.sha256(f"{job_id}:{slot}".encode()).hexdigest()[:40]
        with self.connect() as db:
            db.execute("INSERT OR IGNORE INTO bot_outbox "
                       "(id,profile,job_id,slot,chat_id,msg_type,content,created) VALUES (?,?,?,?,?,?,?,?)",
                       (key, self.profile_id, job_id, slot, chat_id, msg_type,
                        json.dumps(content, ensure_ascii=False), time.time()))
        return "queued:" + key

    def process_once(self, handler):
        row = self.claim("bot_inbox")
        if row is None:
            return False
        token = REPLY_CONTEXT.set({"queue": self, "job_id": row["id"], "chat_id": row["chat_id"], "slot": 0})
        try:
            handler(json.loads(row["payload"]), received_at=row["received_at"], durable=True)
        except Exception as exc:
            self.finish("bot_inbox", row, error=exc)
        else:
            self.finish("bot_inbox", row)
        finally:
            REPLY_CONTEXT.reset(token)
        return True

    def deliver_once(self, api):
        row = self.claim("bot_outbox")
        if row is None:
            return False
        try:
            message_id = api._send_message(row["chat_id"], row["msg_type"], json.loads(row["content"]), uuid=row["id"])
            if not message_id:
                raise RuntimeError("平台未返回消息编号")
        except Exception as exc:
            self.finish("bot_outbox", row, error=exc)
            self.log("message", f"回复投递未完成，记录 {row['id'][:12]}：{type(exc).__name__}",
                     level="warning", profile_id=self.profile_id)
        else:
            self.finish("bot_outbox", row, message_id=message_id)
            self.log("message", f"回复已确认送达，记录 {row['id'][:12]}", level="success", profile_id=self.profile_id)
        return True

    def counts(self):
        with self.connect() as db:
            return {table.removeprefix("bot_"): {r["state"]: r["n"] for r in db.execute(
                f"SELECT state,COUNT(*) n FROM {table} WHERE profile=? GROUP BY state", (self.profile_id,))}
                for table in ("bot_inbox", "bot_outbox")}

    def start(self, handler, api):
        self.recover()
        stop = threading.Event()
        def run(action):
            last_error_log = 0.0
            while not stop.is_set():
                try:
                    busy = action()
                except Exception as exc:
                    busy = False
                    if time.monotonic() - last_error_log > 60:
                        last_error_log = time.monotonic()
                        self.log("message", f"消息队列暂不可用，将继续恢复：{type(exc).__name__}",
                                 level="error", profile_id=self.profile_id)
                if not busy:
                    stop.wait(0.25)
        # Fixed concurrency: a slow knowledge request cannot monopolize greeting delivery.
        for index in range(3):
            threading.Thread(target=run, args=(lambda: self.process_once(handler),),
                             name=f"bot-inbox-{index}", daemon=True).start()
        threading.Thread(target=run, args=(lambda: self.deliver_once(api),), name="bot-outbox", daemon=True).start()
        return stop
