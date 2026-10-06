from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .knowledge_memory import KnowledgeMemoryStore, normalize_project_key
from .paths import DEFAULT_KNOWLEDGE_MEMORY_DB_PATH


TRUSTED_EVENT_TYPES = {"cell_edit", "review_opinion"}
EVENT_TEXT_LIMIT = 500
REVIEW_TEXT_LIMIT = 500


class TrustedExperienceError(ValueError):
    pass


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _clean(value: object, limit: int = EVENT_TEXT_LIMIT) -> str:
    return str(value or "").replace("\x00", "").strip()[:limit]


def _json_value(value: object) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    except (TypeError, ValueError):
        return json.dumps(str(value), ensure_ascii=False)


def _decoded_value(value: object) -> object:
    try:
        return json.loads(str(value or "null"))
    except json.JSONDecodeError:
        return None


def _same_value(left: object, right: object) -> bool:
    return _json_value(left) == _json_value(right)


def _safe_hash(value: object) -> str:
    text = _clean(value, 128).lower()
    return text if re.fullmatch(r"[a-f0-9]{64}", text) else ""


class TrustedExperienceStore:
    def __init__(self, db_path: Path = DEFAULT_KNOWLEDGE_MEMORY_DB_PATH) -> None:
        self.db_path = Path(db_path)

    def _connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.db_path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA journal_mode=WAL")
        self._ensure_schema(connection)
        return connection

    @staticmethod
    def _ensure_schema(connection: sqlite3.Connection) -> None:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS trusted_experience_events (
                id TEXT PRIMARY KEY,
                event_key TEXT NOT NULL UNIQUE,
                event_type TEXT NOT NULL,
                project_id TEXT NOT NULL DEFAULT '',
                project_key TEXT NOT NULL,
                project_name TEXT NOT NULL DEFAULT '',
                classification_status TEXT NOT NULL,
                task_id TEXT NOT NULL,
                skill_id TEXT NOT NULL DEFAULT '',
                skill_version TEXT NOT NULL DEFAULT '',
                sheet_name TEXT NOT NULL DEFAULT '',
                row_number INTEGER NOT NULL DEFAULT 0,
                field_name TEXT NOT NULL DEFAULT '',
                old_value_json TEXT NOT NULL DEFAULT 'null',
                new_value_json TEXT NOT NULL DEFAULT 'null',
                reason TEXT NOT NULL DEFAULT '',
                artifact_version TEXT NOT NULL DEFAULT '',
                artifact_hash TEXT NOT NULL DEFAULT '',
                reviewer_name TEXT NOT NULL DEFAULT '',
                review_round INTEGER NOT NULL DEFAULT 0,
                review_opinion TEXT NOT NULL DEFAULT '',
                candidate_id TEXT NOT NULL DEFAULT '',
                capture_status TEXT NOT NULL DEFAULT 'capturing',
                capture_error TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_trusted_events_project
                ON trusted_experience_events(project_id, task_id, created_at DESC);
            CREATE TABLE IF NOT EXISTS trusted_experience_hits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                knowledge_id TEXT NOT NULL,
                source_project_id TEXT NOT NULL DEFAULT '',
                source_project_key TEXT NOT NULL DEFAULT '',
                target_project_id TEXT NOT NULL DEFAULT '',
                target_project_key TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_trusted_hits_knowledge
                ON trusted_experience_hits(knowledge_id, created_at DESC);
            CREATE TABLE IF NOT EXISTS trusted_experience_capsules (
                project_id TEXT PRIMARY KEY,
                project_name TEXT NOT NULL,
                project_status TEXT NOT NULL,
                summary_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )

    def capture_event(
        self,
        payload: dict[str, Any],
        *,
        memory_store: KnowledgeMemoryStore | None = None,
    ) -> dict[str, Any]:
        event_type = _clean(payload.get("event_type"), 40)
        if event_type not in TRUSTED_EVENT_TYPES:
            raise TrustedExperienceError("event_type 仅支持 cell_edit 或 review_opinion")
        event_key = _clean(payload.get("event_key"), 240)
        task_id = _clean(payload.get("task_id"), 160)
        if not event_key or not task_id:
            raise TrustedExperienceError("可信经验事件必须提供 event_key 和 task_id")
        old_value = payload.get("old_value")
        new_value = payload.get("new_value")
        review_opinion = _clean(payload.get("review_opinion"), REVIEW_TEXT_LIMIT)
        if event_type == "cell_edit" and _same_value(old_value, new_value):
            return {"status": "no_change", "created": False, "event": None, "candidate": None}
        if event_type == "review_opinion" and not review_opinion:
            return {"status": "empty_opinion", "created": False, "event": None, "candidate": None}

        project_id = _clean(payload.get("project_id"), 160)
        if project_id:
            project_key = normalize_project_key(project_id)
            scope_type = "project"
            classification_status = "classified"
        else:
            project_key = normalize_project_key(f"待归类-{task_id}")
            scope_type = "task"
            classification_status = "pending_classification"
        if not project_key:
            raise TrustedExperienceError("无法形成隔离的项目或任务范围")

        now = _utc_now()
        event_id = "TE-" + hashlib.sha256(event_key.encode("utf-8")).hexdigest()[:16].upper()
        event = {
            "id": event_id,
            "event_key": event_key,
            "event_type": event_type,
            "project_id": project_id,
            "project_key": project_key,
            "project_name": _clean(payload.get("project_name"), 160),
            "classification_status": classification_status,
            "task_id": task_id,
            "skill_id": _clean(payload.get("skill_id"), 120),
            "skill_version": _clean(payload.get("skill_version"), 80),
            "sheet_name": _clean(payload.get("sheet_name"), 160),
            "row_number": max(0, int(payload.get("row_number") or 0)),
            "field_name": _clean(payload.get("field_name"), 160),
            "old_value_json": _json_value(old_value),
            "new_value_json": _json_value(new_value),
            "reason": _clean(payload.get("reason")),
            "artifact_version": _clean(payload.get("artifact_version"), 120),
            "artifact_hash": _safe_hash(payload.get("artifact_hash")),
            "reviewer_name": _clean(payload.get("reviewer_name"), 160),
            "review_round": max(0, int(payload.get("review_round") or 0)),
            "review_opinion": review_opinion,
            "candidate_id": "",
            "capture_status": "capturing",
            "capture_error": "",
            "created_at": now,
            "updated_at": now,
        }
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO trusted_experience_events(
                    id,event_key,event_type,project_id,project_key,project_name,classification_status,
                    task_id,skill_id,skill_version,sheet_name,row_number,field_name,
                    old_value_json,new_value_json,reason,artifact_version,artifact_hash,
                    reviewer_name,review_round,review_opinion,candidate_id,capture_status,capture_error,
                    created_at,updated_at
                ) VALUES(
                    :id,:event_key,:event_type,:project_id,:project_key,:project_name,:classification_status,
                    :task_id,:skill_id,:skill_version,:sheet_name,:row_number,:field_name,
                    :old_value_json,:new_value_json,:reason,:artifact_version,:artifact_hash,
                    :reviewer_name,:review_round,:review_opinion,:candidate_id,:capture_status,:capture_error,
                    :created_at,:updated_at
                )
                """,
                event,
            )
            created = cursor.rowcount == 1
            stored = connection.execute(
                "SELECT * FROM trusted_experience_events WHERE event_key=?",
                (event_key,),
            ).fetchone()
        if not stored:
            raise sqlite3.DatabaseError("可信经验事件未能持久化")
        event = self._event_dict(stored)
        memory_store = memory_store or KnowledgeMemoryStore(self.db_path)
        if event["capture_status"] == "captured" and event["candidate_id"]:
            candidate = self._load_candidate(memory_store, event)
            return {"status": "captured", "created": False, "event": event, "candidate": candidate}

        try:
            candidate = memory_store.create_candidate(
                self._candidate_payload(event, payload, scope_type=scope_type)
            )
            with self._connect() as connection:
                connection.execute(
                    """
                    UPDATE trusted_experience_events
                    SET candidate_id=?,capture_status='captured',capture_error='',updated_at=?
                    WHERE id=?
                    """,
                    (candidate["id"], _utc_now(), event["id"]),
                )
            event = self.get_event(event["id"])
            return {"status": "captured", "created": created, "event": event, "candidate": candidate}
        except Exception as exc:
            with self._connect() as connection:
                connection.execute(
                    """
                    UPDATE trusted_experience_events
                    SET capture_status='failed',capture_error=?,updated_at=? WHERE id=?
                    """,
                    (type(exc).__name__, _utc_now(), event["id"]),
                )
            raise

    def get_event(self, event_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM trusted_experience_events WHERE id=?",
                (_clean(event_id, 80),),
            ).fetchone()
        if not row:
            raise TrustedExperienceError("可信经验事件不存在")
        return self._event_dict(row)

    def retry_event(
        self,
        event_id: str,
        *,
        memory_store: KnowledgeMemoryStore | None = None,
        actor: str = "事件审计重试",
    ) -> dict[str, Any]:
        event = self.get_event(event_id)
        return self.capture_event(
            {
                **event,
                "old_value": event.get("old_value"),
                "new_value": event.get("new_value"),
                "actor": actor,
                "knowledge_type": "price_factor" if any(
                    token in str(event.get("field_name") or "")
                    for token in ("基价", "单价", "价格", "系数", "费率", "金额")
                ) else "project_rule",
            },
            memory_store=memory_store,
        )

    def list_events(
        self,
        *,
        project_id: str = "",
        task_id: str = "",
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        clauses = ["1=1"]
        parameters: list[Any] = []
        if _clean(project_id, 160):
            clauses.append("project_id=?")
            parameters.append(_clean(project_id, 160))
        if _clean(task_id, 160):
            clauses.append("task_id=?")
            parameters.append(_clean(task_id, 160))
        parameters.append(max(1, min(int(limit), 500)))
        with self._connect() as connection:
            rows = connection.execute(
                f"SELECT * FROM trusted_experience_events WHERE {' AND '.join(clauses)} ORDER BY created_at DESC LIMIT ?",
                parameters,
            ).fetchall()
        return [self._event_dict(row) for row in rows]

    def record_memory_hits(
        self,
        memories: list[dict[str, Any]],
        *,
        target_project_id: str = "",
        target_project_key: str = "",
    ) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        now = _utc_now()
        with self._connect() as connection:
            for memory in memories:
                source_project_id = _clean(memory.get("source_project_id"), 160)
                source_project_key = _clean(memory.get("project_key"), 160)
                cursor = connection.execute(
                    """
                    INSERT INTO trusted_experience_hits(
                        knowledge_id,source_project_id,source_project_key,
                        target_project_id,target_project_key,created_at
                    ) VALUES(?,?,?,?,?,?)
                    """,
                    (
                        _clean(memory.get("id"), 80),
                        source_project_id,
                        source_project_key,
                        _clean(target_project_id, 160),
                        normalize_project_key(target_project_key),
                        now,
                    ),
                )
                records.append(
                    {
                        "id": int(cursor.lastrowid),
                        "knowledge_id": _clean(memory.get("id"), 80),
                        "source_project_id": source_project_id,
                        "source_project_key": source_project_key,
                        "target_project_id": _clean(target_project_id, 160),
                        "target_project_key": normalize_project_key(target_project_key),
                        "created_at": now,
                    }
                )
        return records

    def refresh_capsule(
        self,
        project_snapshot: dict[str, Any],
        *,
        memory_store: KnowledgeMemoryStore | None = None,
    ) -> dict[str, Any]:
        project_id = _clean(project_snapshot.get("project_id"), 160)
        project_name = _clean(project_snapshot.get("project_name"), 160)
        project_status = _clean(project_snapshot.get("status"), 40)
        if not project_id or not project_name:
            raise TrustedExperienceError("项目胶囊必须提供可靠 project_id 和项目名称")
        if project_status != "completed":
            raise TrustedExperienceError("只有已完成项目可以生成或刷新项目记忆胶囊")
        memory_store = memory_store or KnowledgeMemoryStore(self.db_path)
        events = self.list_events(project_id=project_id, limit=500)
        items = memory_store.list_items(normalize_project_key(project_id))
        artifacts = project_snapshot.get("artifacts") if isinstance(project_snapshot.get("artifacts"), list) else []
        skill = project_snapshot.get("skill") if isinstance(project_snapshot.get("skill"), dict) else {}
        summary = {
            "project_reference": {
                "project_id": project_id,
                "status": project_status,
                "latest_version": max(1, int(project_snapshot.get("latest_version") or 1)),
            },
            "skill_reference": {
                "id": _clean(skill.get("id"), 120),
                "version": _clean(skill.get("version"), 80),
            },
            "artifact_references": [
                {
                    "artifact_id": _clean(item.get("artifact_id"), 80),
                    "type": _clean(item.get("type"), 40),
                    "version": max(1, int(item.get("version") or 1)),
                }
                for item in artifacts
                if isinstance(item, dict) and _clean(item.get("artifact_id"), 80)
            ],
            "event_references": [self._capsule_event_reference(item) for item in events],
            "knowledge_references": [
                {
                    "knowledge_id": item["id"],
                    "title": _clean(item.get("title"), 200),
                    "status": item["status"],
                    "version": int(item["version"]),
                    "source_event_id": _clean(item.get("source_event_id"), 80),
                }
                for item in items
            ],
            "counts": {
                "events": len(events),
                "confirmed": sum(item["status"] == "confirmed" for item in items),
                "candidates": sum(item["status"] in {"candidate", "pending"} for item in items),
                "inactive": sum(item["status"] in {"rejected", "revoked", "suspected_stale"} for item in items),
                "review_opinions": sum(item["event_type"] == "review_opinion" for item in events),
            },
        }
        now = _utc_now()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO trusted_experience_capsules(
                    project_id,project_name,project_status,summary_json,created_at,updated_at
                ) VALUES(?,?,?,?,?,?)
                ON CONFLICT(project_id) DO UPDATE SET
                    project_name=excluded.project_name,
                    project_status=excluded.project_status,
                    summary_json=excluded.summary_json,
                    updated_at=excluded.updated_at
                """,
                (
                    project_id,
                    project_name,
                    project_status,
                    json.dumps(summary, ensure_ascii=False, sort_keys=True),
                    now,
                    now,
                ),
            )
        return self.get_capsule(project_id) or {}

    def get_capsule(self, project_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM trusted_experience_capsules WHERE project_id=?",
                (_clean(project_id, 160),),
            ).fetchone()
        if not row:
            return None
        item = dict(row)
        try:
            summary = json.loads(str(item.pop("summary_json") or "{}"))
        except json.JSONDecodeError:
            summary = {}
        item["summary"] = summary if isinstance(summary, dict) else {}
        return item

    def metrics(self, *, project_id: str = "") -> dict[str, Any]:
        # Metrics is also the empty-state entrypoint.  Ensure the governed
        # memory tables exist even when this is the first API called against a
        # fresh database.
        with KnowledgeMemoryStore(self.db_path)._connect():
            pass
        clean_project_id = _clean(project_id, 160)
        event_where = " WHERE project_id=?" if clean_project_id else ""
        event_params: list[Any] = [clean_project_id] if clean_project_id else []
        audit_where = ""
        audit_params: list[Any] = []
        if clean_project_id:
            audit_where = " WHERE i.source_project_id=? OR i.project_key=?"
            audit_params = [clean_project_id, normalize_project_key(clean_project_id)]
        with self._connect() as connection:
            event_rows = connection.execute(
                f"SELECT event_type,COUNT(*) AS total FROM trusted_experience_events{event_where} GROUP BY event_type",
                event_params,
            ).fetchall()
            audit_rows = connection.execute(
                f"""
                SELECT a.action,COUNT(*) AS total
                FROM knowledge_audit a JOIN knowledge_items i ON i.id=a.item_id
                {audit_where}
                GROUP BY a.action
                """,
                audit_params,
            ).fetchall()
            hit_total = connection.execute(
                "SELECT COUNT(*) FROM trusted_experience_hits"
                + (" WHERE source_project_id=? OR target_project_id=?" if clean_project_id else ""),
                [clean_project_id, clean_project_id] if clean_project_id else [],
            ).fetchone()[0]
        events = {"cell_edit": 0, "review_opinion": 0}
        events.update({str(row["event_type"]): int(row["total"]) for row in event_rows})
        actions = {str(row["action"]): int(row["total"]) for row in audit_rows}
        return {
            "project_id": clean_project_id or None,
            "events": events,
            "candidate_sources": sum(events.values()),
            "governance": {
                "confirmed": actions.get("confirm", 0),
                "rejected": actions.get("reject", 0),
                "revoked": actions.get("revoke", 0),
            },
            "retrieval_hits": int(hit_total),
            "version_corrections": actions.get("revise", 0),
            "suspected_stale": actions.get("mark_stale", 0) + actions.get("supersede", 0),
        }

    @staticmethod
    def _candidate_payload(
        event: dict[str, Any],
        source_payload: dict[str, Any],
        *,
        scope_type: str,
    ) -> dict[str, Any]:
        if event["event_type"] == "review_opinion":
            title = f"第{event['review_round']}轮复核意见：{event['reviewer_name'] or '复核人'}"
            question = f"任务 {event['task_id']} 的复核意见是什么？"
            conclusion = event["review_opinion"]
            source_reference = f"可信经验事件 {event['id']}；第{event['review_round']}轮复核"
        else:
            location = f"{event['sheet_name']} 第{event['row_number']}行 {event['field_name']}".strip()
            title = f"人工修正：{location}"
            question = f"{location}为何需要人工修正？"
            conclusion = (
                f"由「{_clean(event['old_value'], 180)}」调整为「{_clean(event['new_value'], 180)}」。"
                + (f"原因：{event['reason']}" if event["reason"] else "原因待人工补充。")
            )
            source_reference = f"可信经验事件 {event['id']}；{location}"
        metadata = {
            "event_type": event["event_type"],
            "classification_status": event["classification_status"],
            "project_id": event["project_id"],
            "task_id": event["task_id"],
            "skill_id": event["skill_id"],
            "skill_version": event["skill_version"],
            "sheet_name": event["sheet_name"],
            "row_number": event["row_number"],
            "field_name": event["field_name"],
            "artifact_version": event["artifact_version"],
            "artifact_hash": event["artifact_hash"],
            "reviewer_name": event["reviewer_name"],
            "review_round": event["review_round"],
        }
        return {
            "project_key": event["project_key"],
            "project_name": event["project_name"] or ("待归类" if scope_type == "task" else event["project_id"]),
            "scope_type": scope_type,
            "task_id": event["task_id"],
            "job_id": event["task_id"] if event["event_type"] == "cell_edit" else None,
            "title": title,
            "question": question,
            "conclusion": conclusion,
            "conditions": _clean(source_payload.get("conditions")),
            "exceptions": _clean(source_payload.get("exceptions")),
            "source_type": "trusted_experience_event",
            "source_reference": source_reference,
            "evidence_summary": _clean(source_payload.get("evidence_summary")) or "来源事件已结构化留痕，待人工审核适用范围。",
            "submitter": _clean(source_payload.get("actor"), 160) or "业务事件捕获",
            "knowledge_type": _clean(source_payload.get("knowledge_type"), 40),
            "source_event_id": event["id"],
            "source_project_id": event["project_id"],
            "source_metadata": metadata,
        }

    @staticmethod
    def _event_dict(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
        item = dict(row)
        item["old_value"] = _decoded_value(item.pop("old_value_json", "null"))
        item["new_value"] = _decoded_value(item.pop("new_value_json", "null"))
        return item

    @staticmethod
    def _load_candidate(
        memory_store: KnowledgeMemoryStore,
        event: dict[str, Any],
    ) -> dict[str, Any] | None:
        try:
            return memory_store.get_item(event["candidate_id"], event["project_key"])
        except Exception:
            return None

    @staticmethod
    def _capsule_event_reference(event: dict[str, Any]) -> dict[str, Any]:
        reference = {
            "event_id": event["id"],
            "event_type": event["event_type"],
            "task_id": event["task_id"],
            "skill_id": event["skill_id"],
            "skill_version": event["skill_version"],
            "candidate_id": event["candidate_id"],
            "artifact_version": event["artifact_version"],
            "artifact_hash": event["artifact_hash"],
        }
        if event["event_type"] == "cell_edit":
            reference.update(
                {
                    "sheet_name": event["sheet_name"],
                    "row_number": event["row_number"],
                    "field_name": event["field_name"],
                }
            )
        else:
            reference.update(
                {
                    "reviewer_name": event["reviewer_name"],
                    "review_round": event["review_round"],
                    "opinion_excerpt": event["review_opinion"][:160],
                }
            )
        return reference
