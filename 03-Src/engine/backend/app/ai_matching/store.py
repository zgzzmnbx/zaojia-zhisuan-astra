from __future__ import annotations

import json
import os
from pathlib import Path
import threading
from contextlib import contextmanager
from typing import Any

from .contracts import empty_ai_state, now_iso


AI_STATE_FILENAME = "ai-matching-state.json"
AI_PROPOSALS_FILENAME = "ai-matching-proposals.json"
AI_AUDIT_FILENAME = "ai-matching-audit.jsonl"
AI_CACHE_FILENAME = "ai-matching-cache.json"

_JOB_LOCKS: dict[str, threading.RLock] = {}
_JOB_LOCKS_GUARD = threading.Lock()


def _job_lock(job_dir: Path) -> threading.RLock:
    key = str(job_dir.resolve())
    with _JOB_LOCKS_GUARD:
        lock = _JOB_LOCKS.get(key)
        if lock is None:
            lock = threading.RLock()
            _JOB_LOCKS[key] = lock
        return lock


@contextmanager
def job_state_lock(job_dir: Path):
    """Serialize state transitions for one run inside this process."""
    lock = _job_lock(job_dir)
    lock.acquire()
    try:
        yield
    finally:
        lock.release()


def _atomic_write(path: Path, payload: str) -> None:
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(payload, encoding="utf-8")
    os.replace(temporary, path)


def ai_state_path(job_dir: Path) -> Path:
    return job_dir / AI_STATE_FILENAME


def load_ai_state(job_dir: Path) -> dict[str, Any]:
    path = ai_state_path(job_dir)
    if not path.exists():
        return empty_ai_state()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        state = empty_ai_state(
            requested_mode="mechanical",
            effective_mode="mechanical",
            mode_reason="AI 状态文件不可读，已安全回到机械模式。",
        )
        state["ai_stage"] = "degraded_needs_review"
        return state
    if not isinstance(payload, dict):
        return empty_ai_state()
    return payload


def save_ai_state(job_dir: Path, state: dict[str, Any]) -> dict[str, Any]:
    job_dir.mkdir(parents=True, exist_ok=True)
    updated = dict(state)
    updated["updated_at"] = now_iso()
    _atomic_write(
        ai_state_path(job_dir),
        json.dumps(updated, ensure_ascii=False, indent=2),
    )
    _atomic_write(
        job_dir / AI_PROPOSALS_FILENAME,
        json.dumps(list(updated.get("proposals") or []), ensure_ascii=False, indent=2),
    )
    return updated


def load_ai_cache(job_dir: Path) -> dict[str, Any] | None:
    path = job_dir / AI_CACHE_FILENAME
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def save_ai_cache(job_dir: Path, payload: dict[str, Any]) -> dict[str, Any]:
    job_dir.mkdir(parents=True, exist_ok=True)
    updated = dict(payload)
    updated["updated_at"] = now_iso()
    _atomic_write(
        job_dir / AI_CACHE_FILENAME,
        json.dumps(updated, ensure_ascii=False, indent=2),
    )
    return updated


def append_audit(job_dir: Path, event: str, **payload: Any) -> None:
    job_dir.mkdir(parents=True, exist_ok=True)
    record = {"timestamp": now_iso(), "event": event, **payload}
    path = job_dir / AI_AUDIT_FILENAME
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
