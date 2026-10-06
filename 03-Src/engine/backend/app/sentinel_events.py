"""Durable, bounded, business-originated milestones for the local Gork sentinel."""
from __future__ import annotations

from datetime import datetime
import logging
from pathlib import Path
from uuid import uuid4

from .batch_operation import atomic_json


STAGES = frozenset({"conversion_start", "match_start", "match_result", "warning_start",
                    "warning_result", "report_generated", "review_requested"})


def publish(job_dir: Path, stage: str, *, status: str = "completed", attempt: str = "",
            review_rows: int | None = None, warning_rows: int | None = None,
            collaboration_task_id: str = "", platform: str = "") -> None:
    """Never let an optional observer alter the professional operation."""
    if stage not in STAGES:
        raise ValueError(stage)
    try:
        event_dir = job_dir / "sentinel-events"
        event_dir.mkdir(exist_ok=True)
        timestamp = datetime.now().astimezone().isoformat(timespec="microseconds")
        event_id = uuid4().hex
        atomic_json(event_dir / f"{timestamp.replace(':', '-')}-{event_id}.json", {
            "event_id": event_id, "stage": stage, "status": status,
            "attempt": attempt, "occurred_at": timestamp,
            "review_rows": review_rows if type(review_rows) is int and review_rows >= 0 else None,
            "warning_rows": warning_rows if type(warning_rows) is int and warning_rows >= 0 else None,
            "collaboration_task_id": collaboration_task_id,
            "platform": "feishu" if platform.lower().startswith("feishu") else "other",
        })
    except OSError:
        logging.getLogger(__name__).exception("Could not record sentinel stage job=%s stage=%s", job_dir.name, stage)
