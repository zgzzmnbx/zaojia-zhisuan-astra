from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path
from typing import Any

from .project_ledger import ProjectLedger

_PROCESS_JOB_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")


def _has_explicit_project_identity(state_path: Path) -> bool:
    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    if not isinstance(state, dict):
        return False
    relation = state.get("project_relation")
    relation_data = relation if isinstance(relation, dict) else {}
    return bool(str(state.get("project_id") or relation_data.get("project_id") or "").strip())


def backfill_project_ledger(
    ledger: ProjectLedger,
    *,
    runtime_root: Path,
    collaboration_db_path: Path | None = None,
    collaboration_runtime_root: Path | None = None,
    include_unclassified_legacy: bool = False,
) -> dict[str, Any]:
    process_state_paths = sorted(
        path
        for path in runtime_root.glob("*/process-state.json")
        # Production processing jobs are always uuid4().hex directories.
        # Keeping this boundary prevents ad-hoc fixture folders from being
        # mistaken for historical business tasks.
        if _PROCESS_JOB_ID_PATTERN.fullmatch(path.parent.name)
    )
    eligible_process_states = [
        path
        for path in process_state_paths
        if include_unclassified_legacy or _has_explicit_project_identity(path)
    ]
    process_result = ledger.backfill_process_states(
        eligible_process_states
    )
    process_result["skipped_without_project_identity"] = (
        len(process_state_paths) - len(eligible_process_states)
    )
    collaboration = {"scanned": 0, "recorded": 0, "failed": 0}
    if (
        collaboration_db_path
        and collaboration_runtime_root
        and collaboration_db_path.is_file()
    ):
        try:
            connection = sqlite3.connect(collaboration_db_path, timeout=10)
            connection.row_factory = sqlite3.Row
            try:
                tables = {
                    str(row[0])
                    for row in connection.execute(
                        "SELECT name FROM sqlite_master WHERE type='table'"
                    )
                }
                if "tasks" in tables:
                    columns = {
                        str(row[1])
                        for row in connection.execute("PRAGMA table_info(tasks)")
                    }
                    if {"task_id", "task_kind", "project_name"}.issubset(columns):
                        rows = connection.execute(
                            "SELECT * FROM tasks WHERE task_kind='external_dispatch'"
                        ).fetchall()
                        collaboration["scanned"] = len(rows)
                        for row in rows:
                            try:
                                ledger.record_external_task(
                                    dict(row),
                                    feishu_runtime_root=collaboration_runtime_root,
                                )
                                collaboration["recorded"] += 1
                            except Exception:
                                collaboration["failed"] += 1
            finally:
                connection.close()
        except sqlite3.Error:
            collaboration["failed"] += 1
    return {
        "process_states": process_result,
        "collaboration_tasks": collaboration,
        "totals": ledger.counts(),
    }
