"""Read-only, business-originated snapshots and milestones for Gork."""
from __future__ import annotations

import json
from contextlib import closing
from datetime import datetime, timedelta
import os
from pathlib import Path
import re
import sqlite3

from .business_tasks import BusinessTaskNotFound, validate_task_id


JOB_ID = re.compile(r"^[A-Za-z0-9_-]{1,100}$")
STAGES = frozenset({"conversion_start", "match_start", "match_result", "warning_start",
                    "warning_result", "report_generated", "review_requested", "review_sent"})


def _read_json(path: Path) -> dict:
    if not path.is_file() or path.stat().st_size > 2_000_000:
        return {}
    value = json.loads(path.read_text(encoding="utf-8"))
    return value if isinstance(value, dict) else {}


def _lock_held(path: Path) -> bool:
    """Probe the existing producer lock without creating or changing files."""
    if not path.is_file():
        return False
    with path.open("r+b") as stream:
        stream.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            return True
        stream.seek(0)
        if os.name == "nt":
            msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
        return False


def _connection(db_path: Path) -> sqlite3.Connection | None:
    if not db_path.is_file():
        return None
    connection = sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True, timeout=2)
    connection.row_factory = sqlite3.Row
    return connection


def _events(row: sqlite3.Row, job_id: str, runtime_dir: Path,
            dispatch_db_path: Path | None = None) -> list[dict]:
    if not JOB_ID.fullmatch(job_id):
        return []
    event_dir = runtime_dir / job_id / "sentinel-events"
    if not event_dir.is_dir():
        return []
    result = []
    for path in sorted(event_dir.glob("*.json"), reverse=True)[:100]:
        try:
            raw = _read_json(path)
        except (OSError, ValueError, json.JSONDecodeError):
            continue
        if raw.get("stage") not in STAGES or not re.fullmatch(r"[a-f0-9]{32}", str(raw.get("event_id") or "")):
            continue
        event = {"event_id": raw["event_id"], "task_id": row["task_id"],
                 "task_name": row["task_name"], "stage": raw["stage"],
                 "status": str(raw.get("status") or "")[:24],
                 "platform": "feishu" if raw.get("platform") == "feishu" else "other",
                 "attempt": str(raw.get("attempt") or "")[:80],
                 "occurred_at": str(raw.get("occurred_at") or "")[:50],
                 "review_rows": raw.get("review_rows") if type(raw.get("review_rows")) is int else None,
                 "warning_rows": raw.get("warning_rows") if type(raw.get("warning_rows")) is int else None}
        result.append(event)
        collaboration_id = str(raw.get("collaboration_task_id") or "")
        if (raw["stage"] == "review_requested" and collaboration_id and dispatch_db_path
                and dispatch_db_path.is_file()):
            with closing(_connection(dispatch_db_path)) as dispatch:
                try:
                    delivered = dispatch.execute(
                        "SELECT submission_delivery_status,review_card_status,updated_at "
                        "FROM tasks WHERE task_id=? AND source_task_id=? AND task_kind='external_dispatch'",
                        (collaboration_id, job_id),
                    ).fetchone()
                except sqlite3.Error:
                    delivered = None
                if (delivered and delivered["submission_delivery_status"] == "sent"
                        and delivered["review_card_status"] == "sent"):
                    try:
                        sent_at = max(datetime.fromisoformat(event["occurred_at"]),
                                      datetime.fromisoformat(str(delivered["updated_at"]))) + timedelta(microseconds=1)
                        occurred_at = sent_at.isoformat(timespec="microseconds")
                    except (ValueError, TypeError):
                        occurred_at = event["occurred_at"]
                    result.append({**event, "event_id": collaboration_id + ":sent",
                                   "stage": "review_sent", "status": "sent",
                                   "occurred_at": occurred_at})
    return result


def _snapshot(row: sqlite3.Row, job_id: str, runtime_dir: Path) -> dict:
    job_dir = runtime_dir / job_id if JOB_ID.fullmatch(job_id) else None
    operation = _read_json(job_dir / "batch-match-status.json") if job_dir and job_dir.is_dir() else {}
    state = _read_json(job_dir / "process-state.json") if job_dir and job_dir.is_dir() else {}
    # A new attempt may run beside the previous committed result. Counts from
    # that older result must never be attributed to the active attempt.
    same_attempt = bool(operation.get("attempt") and operation.get("attempt") == state.get("batch_attempt"))
    summary = state.get("summary") if same_attempt and isinstance(state.get("summary"), dict) else {}
    warning = summary.get("warning_summary") if isinstance(summary.get("warning_summary"), dict) else {}
    recorded = str(operation.get("status") or "")
    if recorded == "running" and job_dir:
        if _lock_held(job_dir / "batch-match.lock"):
            activity = "running"
        else:
            # The producer can publish its terminal record between our JSON
            # read and lock probe. Recheck before calling this an interruption.
            latest = _read_json(job_dir / "batch-match-status.json")
            if (latest.get("attempt") == operation.get("attempt")
                    and latest.get("status") in {"completed", "failed"}):
                operation = latest
                activity = latest["status"]
            else:
                activity = "interrupted"
    else:
        activity = recorded
    if activity not in {"running", "completed", "failed", "interrupted"}:
        activity = "unknown"
    checked = warning.get("executed") is True
    def known_count(value):
        return value if type(value) is int and value >= 0 else None
    return {
        "task_id": row["task_id"], "task_name": row["task_name"],
        "project_id": row["project_id"], "task_status": row["status"],
        "task_status_label": row["status_label"] if "status_label" in row.keys() else row["status"],
        "task_updated_at": row["updated_at"],
        "activity": {"type": "batch_match", "status": activity,
                     "attempt": str(operation.get("attempt") or ""),
                     "started_at": str(operation.get("started_at") or operation.get("updated_at") or ""),
                     "updated_at": str(operation.get("updated_at") or "")},
        "attention": {"review_rows": known_count(summary.get("review_rows")) if summary else None,
                      "warning_rows": known_count(warning.get("warning_rows")) if checked else None,
                      "warning_checked": checked},
        "data_status": "linked" if job_dir and job_dir.is_dir() else "job_unavailable",
        "source": "batch-match-status.json",
    }


def task_snapshot(db_path: Path, runtime_dir: Path, task_id: str) -> dict:
    validate_task_id(task_id)
    connection = _connection(db_path)
    if connection is None:
        raise BusinessTaskNotFound("业务 Task 不存在")
    with closing(connection):
        row = connection.execute(
            "SELECT task_id,task_name,project_id,status,updated_at FROM business_tasks WHERE task_id=?",
            (task_id,),
        ).fetchone()
        if row is None:
            raise BusinessTaskNotFound("业务 Task 不存在")
        link = connection.execute(
            "SELECT external_id FROM task_links WHERE task_id=? AND link_type='job_id' "
            "AND source_system='professional' ORDER BY created_at DESC LIMIT 1", (task_id,),
        ).fetchone()
        return _snapshot(row, str(link["external_id"]) if link else "", runtime_dir)


def current_task(db_path: Path, runtime_dir: Path, dispatch_db_path: Path | None = None) -> dict:
    """Return the active operation and recent terminal attempts for short runs."""
    connection = _connection(db_path)
    if connection is None:
        return {"task": None, "recent": [], "events": [], "supported_activity": "batch_match"}
    with closing(connection):
        rows = connection.execute(
            "SELECT t.task_id,t.task_name,t.project_id,t.status,t.updated_at,l.external_id "
            "FROM business_tasks t JOIN task_links l ON l.task_id=t.task_id "
            "WHERE l.link_type='job_id' AND l.source_system='professional'"
        ).fetchall()
        active, recent, events = [], [], []
        for row in rows:
            item = _snapshot(row, str(row["external_id"]), runtime_dir)
            events.extend(_events(row, str(row["external_id"]), runtime_dir, dispatch_db_path))
            if item["activity"]["status"] == "running":
                active.append(item)
            elif (item["activity"]["status"] in {"completed", "failed", "interrupted"}
                  and item["activity"]["attempt"]):
                recent.append(item)
        active.sort(key=lambda item: (item["activity"]["started_at"], item["task_id"]), reverse=True)
        recent.sort(key=lambda item: (max(str(item["task_updated_at"] or ""), item["activity"]["updated_at"]),
                                      item["task_id"]), reverse=True)
        events.sort(key=lambda item: (item["occurred_at"], item["event_id"]), reverse=True)
        return {"task": active[0] if active else None, "recent": recent[:20], "events": events[:50],
                "supported_activity": "batch_match"}
