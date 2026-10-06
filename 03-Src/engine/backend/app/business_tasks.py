from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any


TASK_ID_PATTERN = re.compile(r"^tsk_[a-f0-9]{24}$")
SAFE_REFERENCE_PATTERN = re.compile(r"^[A-Za-z0-9_.:-]{1,200}$")
LINK_TYPES = {"job_id", "run_id", "collaboration_task_id", "source_task_id"}
TASK_STATUSES = {"defined", "processing", "pending_review", "completed", "returned", "failed"}
EVENT_STATUSES = {"completed", "in_progress", "pending_review", "failed", "not_run", "not_applicable", "no_candidate"}
EVENT_TYPES = (
    "task_defined",
    "skill_frozen",
    "input_received",
    "structure_recognized",
    "rules_executed",
    "risk_checked",
    "human_reviewed",
    "artifact_generated",
    "collaboration_completed",
    "experience_governed",
)
EVENT_LABELS = {
    "task_defined": "任务已定义",
    "skill_frozen": "Skill 已冻结",
    "input_received": "输入已接收",
    "structure_recognized": "结构已识别",
    "rules_executed": "规则已执行",
    "risk_checked": "风险已检查",
    "human_reviewed": "人工已复核",
    "artifact_generated": "成果已生成",
    "collaboration_completed": "协同已完成",
    "experience_governed": "Experience 已治理",
}
STATUS_LABELS = {
    "defined": "已定义",
    "processing": "处理中",
    "pending_review": "待人工",
    "completed": "已完成",
    "returned": "已退回",
    "failed": "失败",
}
SENSITIVE_KEYS = {
    "app_secret", "secret", "token", "access_token", "refresh_token", "ticket",
    "chat_id", "group_id", "user_id", "open_id", "file_key", "tenant_key",
}


class BusinessTaskError(ValueError):
    pass


class BusinessTaskNotFound(BusinessTaskError):
    pass


class BusinessTaskConflict(BusinessTaskError):
    pass


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def validate_task_id(task_id: str) -> str:
    value = str(task_id or "").strip()
    if not TASK_ID_PATTERN.fullmatch(value):
        raise BusinessTaskNotFound("业务 Task 编号无效")
    return value


def validate_reference(value: object, label: str = "关联编号") -> str:
    clean = str(value or "").strip()
    if not SAFE_REFERENCE_PATTERN.fullmatch(clean) or ".." in clean:
        raise BusinessTaskError(f"{label}格式无效")
    return clean


def _clean(value: object, limit: int = 500) -> str:
    return str(value or "").replace("\x00", "").strip()[:limit]


def _canonical(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def _hash(value: object) -> str:
    return hashlib.sha256(_canonical(value).encode("utf-8")).hexdigest()


def _json(value: object, fallback: object) -> object:
    if isinstance(value, (dict, list)):
        return value
    try:
        parsed = json.loads(str(value or ""))
    except json.JSONDecodeError:
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _safe_payload(value: object, *, depth: int = 0) -> object:
    if depth > 5:
        return ""
    if isinstance(value, dict):
        return {
            _clean(key, 80): _safe_payload(item, depth=depth + 1)
            for key, item in value.items()
            if str(key).strip().lower() not in SENSITIVE_KEYS
        }
    if isinstance(value, list):
        return [_safe_payload(item, depth=depth + 1) for item in value[:50]]
    text = _clean(value, 500)
    if re.match(r"^[A-Za-z]:[\\/]", text) or text.startswith(("/", "\\\\")):
        return Path(text).name
    return value if isinstance(value, (int, float, bool)) or value is None else text


class BusinessTaskStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA journal_mode=WAL")
        return connection

    def _init_db(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS business_tasks (
                    task_id TEXT PRIMARY KEY,
                    identity_digest TEXT NOT NULL UNIQUE,
                    definition_digest TEXT NOT NULL,
                    skill_digest TEXT NOT NULL,
                    project_id TEXT NOT NULL DEFAULT '',
                    source_type TEXT NOT NULL,
                    source_reference TEXT NOT NULL DEFAULT '',
                    task_name TEXT NOT NULL,
                    objective TEXT NOT NULL,
                    instructions TEXT NOT NULL DEFAULT '',
                    definition_json TEXT NOT NULL,
                    skill_snapshot_json TEXT NOT NULL,
                    input_snapshot_json TEXT NOT NULL,
                    responsibility_json TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'defined',
                    stage TEXT NOT NULL DEFAULT 'task_defined',
                    current_run_id TEXT NOT NULL DEFAULT '',
                    artifact_version INTEGER NOT NULL DEFAULT 0,
                    review_round INTEGER NOT NULL DEFAULT 0,
                    classification_status TEXT NOT NULL DEFAULT 'classified',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT NOT NULL DEFAULT ''
                );
                CREATE INDEX IF NOT EXISTS idx_business_tasks_project
                    ON business_tasks(project_id, updated_at DESC);
                CREATE TABLE IF NOT EXISTS task_links (
                    link_id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    link_type TEXT NOT NULL,
                    external_id TEXT NOT NULL,
                    source_system TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    UNIQUE(link_type, external_id, source_system),
                    FOREIGN KEY(task_id) REFERENCES business_tasks(task_id)
                );
                CREATE INDEX IF NOT EXISTS idx_task_links_task ON task_links(task_id, created_at);
                CREATE TABLE IF NOT EXISTS task_events (
                    event_id TEXT PRIMARY KEY,
                    event_key TEXT NOT NULL UNIQUE,
                    task_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    title TEXT NOT NULL,
                    detail TEXT NOT NULL DEFAULT '',
                    source_module TEXT NOT NULL,
                    reference_type TEXT NOT NULL DEFAULT '',
                    reference_id TEXT NOT NULL DEFAULT '',
                    payload_json TEXT NOT NULL DEFAULT '{}',
                    occurred_at TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(task_id) REFERENCES business_tasks(task_id)
                );
                CREATE INDEX IF NOT EXISTS idx_task_events_task
                    ON task_events(task_id, occurred_at, event_id);
                """
            )

    def ensure_task(
        self,
        *,
        identity_key: str,
        project_id: str = "",
        source_type: str,
        source_reference: str = "",
        task_name: str,
        objective: str,
        instructions: str = "",
        definition: dict[str, Any],
        skill_snapshot: dict[str, Any],
        input_snapshot: dict[str, Any],
        responsibility: dict[str, Any] | None = None,
        classification_status: str = "classified",
        created_at: str | None = None,
    ) -> tuple[dict[str, Any], bool]:
        clean_identity = _clean(identity_key, 1000)
        if not clean_identity:
            raise BusinessTaskError("Task 幂等键不能为空")
        clean_name = _clean(task_name, 180)
        clean_objective = _clean(objective, 1000)
        if not clean_name or not clean_objective:
            raise BusinessTaskError("Task 名称和目标不能为空")
        identity_digest = hashlib.sha256(clean_identity.encode("utf-8")).hexdigest()
        task_id = f"tsk_{identity_digest[:24]}"
        safe_definition = _safe_payload(definition)
        safe_skill = _safe_payload(skill_snapshot)
        safe_input = _safe_payload(input_snapshot)
        safe_responsibility = _safe_payload(responsibility or {})
        definition_digest = _hash({
            "definition": safe_definition,
            "input_snapshot": safe_input,
            "responsibility": safe_responsibility,
        })
        skill_digest = _hash(safe_skill)
        timestamp = created_at or now_iso()
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM business_tasks WHERE identity_digest=?", (identity_digest,)
            ).fetchone()
            if row:
                if str(row["definition_digest"]) != definition_digest or str(row["skill_digest"]) != skill_digest:
                    raise BusinessTaskConflict("既有 Task 定义或 Skill 快照不可漂移")
                return self._public_task(row, connection), False
            connection.execute(
                """
                INSERT INTO business_tasks(
                    task_id,identity_digest,definition_digest,skill_digest,project_id,
                    source_type,source_reference,task_name,objective,instructions,
                    definition_json,skill_snapshot_json,input_snapshot_json,responsibility_json,
                    classification_status,created_at,updated_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    task_id, identity_digest, definition_digest, skill_digest,
                    _clean(project_id, 160), _clean(source_type, 80) or "web",
                    _clean(source_reference, 200), clean_name, clean_objective,
                    _clean(instructions, 2000), _canonical(safe_definition),
                    _canonical(safe_skill), _canonical(safe_input), _canonical(safe_responsibility),
                    "pending_classification" if classification_status == "pending_classification" else "classified",
                    timestamp, timestamp,
                ),
            )
            row = connection.execute("SELECT * FROM business_tasks WHERE task_id=?", (task_id,)).fetchone()
            if not row:
                raise sqlite3.DatabaseError("业务 Task 未能持久化")
            return self._public_task(row, connection), True

    def link(self, task_id: str, link_type: str, external_id: str, *, source_system: str = "") -> dict[str, Any]:
        clean_task_id = validate_task_id(task_id)
        if link_type not in LINK_TYPES:
            raise BusinessTaskError("Task 关联类型无效")
        clean_external_id = validate_reference(external_id)
        clean_source = _clean(source_system, 80)
        link_id = "lnk_" + hashlib.sha256(
            f"{link_type}\n{clean_external_id}\n{clean_source}".encode("utf-8")
        ).hexdigest()[:24]
        with self._connect() as connection:
            self._require_task(connection, clean_task_id)
            existing = connection.execute(
                "SELECT * FROM task_links WHERE link_type=? AND external_id=? AND source_system=?",
                (link_type, clean_external_id, clean_source),
            ).fetchone()
            if existing and str(existing["task_id"]) != clean_task_id:
                raise BusinessTaskConflict("该旧编号已经关联其他业务 Task")
            connection.execute(
                "INSERT OR IGNORE INTO task_links(link_id,task_id,link_type,external_id,source_system,created_at) VALUES(?,?,?,?,?,?)",
                (link_id, clean_task_id, link_type, clean_external_id, clean_source, now_iso()),
            )
            row = connection.execute("SELECT * FROM task_links WHERE link_id=?", (link_id,)).fetchone()
        return dict(row) if row else {}

    def find_by_link(self, link_type: str, external_id: str, *, source_system: str = "") -> dict[str, Any] | None:
        if link_type not in LINK_TYPES:
            raise BusinessTaskError("Task 关联类型无效")
        clean_external_id = validate_reference(external_id)
        with self._connect() as connection:
            row = connection.execute(
                """SELECT t.* FROM business_tasks t JOIN task_links l ON l.task_id=t.task_id
                WHERE l.link_type=? AND l.external_id=? AND l.source_system=?""",
                (link_type, clean_external_id, _clean(source_system, 80)),
            ).fetchone()
            return self._public_task(row, connection) if row else None

    def update_progress(
        self,
        task_id: str,
        *,
        status: str | None = None,
        stage: str | None = None,
        current_run_id: str | None = None,
        artifact_version: int | None = None,
        review_round: int | None = None,
        completed_at: str | None = None,
        project_id: str | None = None,
    ) -> dict[str, Any]:
        clean_task_id = validate_task_id(task_id)
        if status is not None and status not in TASK_STATUSES:
            raise BusinessTaskError("Task 状态无效")
        if stage is not None and stage not in EVENT_TYPES:
            raise BusinessTaskError("Task 阶段无效")
        fields: list[str] = ["updated_at=?"]
        values: list[object] = [now_iso()]
        for name, value in (
            ("status", status), ("stage", stage), ("current_run_id", current_run_id),
            ("completed_at", completed_at), ("project_id", project_id),
        ):
            if value is not None:
                fields.append(f"{name}=?")
                values.append(_clean(value, 200))
        for name, value in (("artifact_version", artifact_version), ("review_round", review_round)):
            if value is not None:
                fields.append(f"{name}=?")
                values.append(max(0, int(value)))
        values.append(clean_task_id)
        with self._connect() as connection:
            self._require_task(connection, clean_task_id)
            connection.execute(f"UPDATE business_tasks SET {','.join(fields)} WHERE task_id=?", values)
            row = connection.execute("SELECT * FROM business_tasks WHERE task_id=?", (clean_task_id,)).fetchone()
            return self._public_task(row, connection)

    def record_event(
        self,
        task_id: str,
        *,
        event_key: str,
        event_type: str,
        status: str,
        source_module: str,
        title: str | None = None,
        detail: str = "",
        reference_type: str = "",
        reference_id: str = "",
        payload: dict[str, Any] | None = None,
        occurred_at: str | None = None,
    ) -> dict[str, Any]:
        clean_task_id = validate_task_id(task_id)
        if event_type not in EVENT_TYPES or status not in EVENT_STATUSES:
            raise BusinessTaskError("Task 事件类型或状态无效")
        clean_key = _clean(event_key, 500)
        if not clean_key:
            raise BusinessTaskError("Task 事件幂等键不能为空")
        clean_reference = validate_reference(reference_id) if reference_id else ""
        event_digest = hashlib.sha256(f"{clean_task_id}\n{clean_key}".encode("utf-8")).hexdigest()
        event_id = f"evt_{event_digest[:24]}"
        timestamp = occurred_at or now_iso()
        with self._connect() as connection:
            self._require_task(connection, clean_task_id)
            connection.execute(
                """
                INSERT OR IGNORE INTO task_events(
                    event_id,event_key,task_id,event_type,status,title,detail,source_module,
                    reference_type,reference_id,payload_json,occurred_at,created_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    event_id, f"{clean_task_id}:{clean_key}", clean_task_id, event_type, status,
                    _clean(title, 180) or EVENT_LABELS[event_type], _clean(detail, 1000),
                    _clean(source_module, 120), _clean(reference_type, 80), clean_reference,
                    _canonical(_safe_payload(payload or {})), timestamp, now_iso(),
                ),
            )
            row = connection.execute("SELECT * FROM task_events WHERE event_id=?", (event_id,)).fetchone()
        return self._public_event(row) if row else {}

    def get_task(self, task_id: str) -> dict[str, Any]:
        clean_task_id = validate_task_id(task_id)
        with self._connect() as connection:
            row = self._require_task(connection, clean_task_id)
            return self._public_task(row, connection)

    def list_project_tasks(self, project_id: str) -> list[dict[str, Any]]:
        clean_project_id = _clean(project_id, 160)
        if not re.fullmatch(r"prj_[a-f0-9]{24}", clean_project_id):
            raise BusinessTaskError("项目编号无效")
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM business_tasks WHERE project_id=? ORDER BY updated_at DESC,task_id",
                (clean_project_id,),
            ).fetchall()
            return [self._public_task(row, connection) for row in rows]

    def list_recent_tasks(self, *, skill_id: str = "", limit: int = 20) -> list[dict[str, Any]]:
        clean_skill_id = _clean(skill_id, 120)
        clean_limit = max(1, min(int(limit), 100))
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM business_tasks ORDER BY updated_at DESC,task_id LIMIT 500"
            ).fetchall()
            items = [self._public_task(row, connection) for row in rows]
        if clean_skill_id:
            items = [
                item
                for item in items
                if str((item.get("skill_snapshot") or {}).get("id") or "") == clean_skill_id
            ]
        return items[:clean_limit]

    def timeline(self, task_id: str) -> dict[str, Any]:
        task = self.get_task(task_id)
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM task_events WHERE task_id=? ORDER BY occurred_at,event_id", (task["task_id"],)
            ).fetchall()
        actual = [self._public_event(row) for row in rows]
        latest_by_type = {event["event_type"]: event for event in actual}
        human_expected = bool(task["definition"].get("human_gates"))
        collaboration_expected = bool(task["definition"].get("collaboration_required"))
        items: list[dict[str, Any]] = []
        for event_type in EVENT_TYPES:
            if event_type in latest_by_type:
                items.append(latest_by_type[event_type])
                continue
            status = "not_run"
            detail = "尚未产生该阶段的真实后端事件。"
            if event_type == "human_reviewed" and not human_expected:
                status = "not_applicable"
                detail = "当前任务定义未要求该环节。"
            if event_type == "collaboration_completed" and not collaboration_expected:
                status = "not_applicable"
                detail = "当前任务定义未要求该环节。"
            if event_type == "experience_governed":
                status = "no_candidate"
                detail = "当前尚未形成可治理的 Experience 候选。"
            items.append({
                "event_id": "", "event_type": event_type, "title": EVENT_LABELS[event_type],
                "status": status, "detail": detail, "source_module": "task_aggregator",
                "reference": None, "payload": {}, "occurred_at": "", "is_placeholder": True,
            })
        return {"task_id": task["task_id"], "items": items, "actual_event_count": len(actual)}

    def event_count(self, task_id: str, event_type: str) -> int:
        clean_task_id = validate_task_id(task_id)
        if event_type not in EVENT_TYPES:
            raise BusinessTaskError("Task 事件类型无效")
        with self._connect() as connection:
            self._require_task(connection, clean_task_id)
            return int(connection.execute(
                "SELECT COUNT(*) FROM task_events WHERE task_id=? AND event_type=?",
                (clean_task_id, event_type),
            ).fetchone()[0])

    @staticmethod
    def _require_task(connection: sqlite3.Connection, task_id: str) -> sqlite3.Row:
        row = connection.execute("SELECT * FROM business_tasks WHERE task_id=?", (task_id,)).fetchone()
        if not row:
            raise BusinessTaskNotFound("业务 Task 不存在")
        return row

    def _public_task(self, row: sqlite3.Row, connection: sqlite3.Connection) -> dict[str, Any]:
        links = [dict(item) for item in connection.execute(
            "SELECT link_type,external_id,source_system,created_at FROM task_links WHERE task_id=? ORDER BY created_at,link_id",
            (str(row["task_id"]),),
        ).fetchall()]
        definition = _json(row["definition_json"], {})
        return {
            "task_id": str(row["task_id"]),
            "project_id": str(row["project_id"] or ""),
            "source": {"type": str(row["source_type"]), "reference": str(row["source_reference"] or "")},
            "task_name": str(row["task_name"]),
            "objective": str(row["objective"]),
            "instructions": str(row["instructions"] or ""),
            "definition": definition,
            "skill_snapshot": _json(row["skill_snapshot_json"], {}),
            "input_snapshot": _json(row["input_snapshot_json"], {}),
            "responsibility": _json(row["responsibility_json"], {}),
            "status": str(row["status"]),
            "status_label": STATUS_LABELS.get(str(row["status"]), str(row["status"])),
            "stage": str(row["stage"]),
            "stage_label": EVENT_LABELS.get(str(row["stage"]), str(row["stage"])),
            "current_run_id": str(row["current_run_id"] or ""),
            "artifact_version": int(row["artifact_version"] or 0),
            "review_round": int(row["review_round"] or 0),
            "classification_status": str(row["classification_status"]),
            "links": links,
            "created_at": str(row["created_at"]),
            "updated_at": str(row["updated_at"]),
            "completed_at": str(row["completed_at"] or ""),
        }

    @staticmethod
    def _public_event(row: sqlite3.Row) -> dict[str, Any]:
        reference = None
        if row["reference_id"]:
            reference = {"type": str(row["reference_type"] or ""), "id": str(row["reference_id"])}
        return {
            "event_id": str(row["event_id"]),
            "event_type": str(row["event_type"]),
            "title": str(row["title"]),
            "status": str(row["status"]),
            "detail": str(row["detail"] or ""),
            "source_module": str(row["source_module"]),
            "reference": reference,
            "payload": _json(row["payload_json"], {}),
            "occurred_at": str(row["occurred_at"]),
            "is_placeholder": False,
        }
