from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from uuid import uuid4

from .paths import DEFAULT_KNOWLEDGE_MEMORY_DB_PATH


KNOWLEDGE_MEMORY_STATUSES = {
    "candidate",
    "pending",
    "confirmed",
    "rejected",
    "revoked",
    "suspected_stale",
}
GENERAL_KNOWLEDGE_PROJECT_KEY = "通用知识"
GENERAL_KNOWLEDGE_PROJECT_NAME = "通用知识"
GENERAL_KNOWLEDGE_AUTO_APPROVER = "系统自动审核"
KNOWLEDGE_MEMORY_SCOPE_TYPES = {"general", "task", "project"}
KNOWLEDGE_MEMORY_TYPES = {
    "operation",
    "general_explanation",
    "project_rule",
    "price_factor",
    "standard_policy",
}
DEFAULT_AUTO_APPROVE_KNOWLEDGE_TYPES = {"operation", "general_explanation"}
CONFIRM_ROLES = {"project_owner", "reviewer", "rule_maintainer", "admin"}
EDITABLE_FIELDS = {
    "knowledge_type",
    "scope_type",
    "task_id",
    "job_id",
    "title",
    "question",
    "conclusion",
    "conditions",
    "exceptions",
    "expires_at",
    "source_type",
    "source_reference",
    "evidence_summary",
}
TRANSITIONS = {
    ("candidate", "submit"): "pending",
    ("candidate", "reject"): "rejected",
    ("pending", "confirm"): "confirmed",
    ("pending", "reject"): "rejected",
    ("confirmed", "revoke"): "revoked",
    ("confirmed", "mark_stale"): "suspected_stale",
    ("suspected_stale", "revoke"): "revoked",
}


class KnowledgeMemoryError(ValueError):
    pass


class KnowledgeMemoryNotFound(KnowledgeMemoryError):
    pass


class KnowledgeMemoryConflict(KnowledgeMemoryError):
    pass


class KnowledgeMemoryPermissionError(KnowledgeMemoryError):
    pass


def normalize_project_key(value: object) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    normalized: list[str] = []
    pending_separator = False
    for character in text:
        if character.isalnum() or "\u4e00" <= character <= "\u9fff":
            if pending_separator and normalized:
                normalized.append("-")
            normalized.append(character)
            pending_separator = False
        else:
            pending_separator = True
    return "".join(normalized).strip("-")[:120]


def resolve_project_scope(payload: dict[str, Any]) -> tuple[str, str]:
    project_name = str(payload.get("project_name") or "").strip()
    project_key = normalize_project_key(payload.get("project_key") or project_name)
    if not project_key:
        raise KnowledgeMemoryError("请填写项目名称或 project_key")
    if not project_name:
        project_name = project_key
    return project_key, project_name


class KnowledgeMemoryStore:
    def __init__(
        self,
        db_path: Path = DEFAULT_KNOWLEDGE_MEMORY_DB_PATH,
        *,
        auto_approve_types: set[str] | None = None,
        duplicate_threshold: float = 0.92,
    ):
        self.db_path = Path(db_path)
        self.auto_approve_types = (
            set(DEFAULT_AUTO_APPROVE_KNOWLEDGE_TYPES)
            if auto_approve_types is None
            else set(auto_approve_types) & KNOWLEDGE_MEMORY_TYPES
        )
        self.duplicate_threshold = max(0.8, min(float(duplicate_threshold), 1.0))

    def _connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA journal_mode=WAL")
        self._ensure_schema(connection)
        return connection

    @staticmethod
    def _ensure_schema(connection: sqlite3.Connection) -> None:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS knowledge_items (
                id TEXT PRIMARY KEY,
                parent_id TEXT,
                parent_relation TEXT NOT NULL DEFAULT '',
                project_key TEXT NOT NULL,
                project_name TEXT NOT NULL,
                scope_type TEXT NOT NULL,
                knowledge_type TEXT NOT NULL DEFAULT 'general_explanation',
                review_policy TEXT NOT NULL DEFAULT 'legacy',
                review_reason TEXT NOT NULL DEFAULT '',
                task_id TEXT,
                job_id TEXT,
                title TEXT NOT NULL,
                question TEXT NOT NULL,
                conclusion TEXT NOT NULL,
                conditions TEXT NOT NULL DEFAULT '',
                exceptions TEXT NOT NULL DEFAULT '',
                expires_at TEXT,
                source_type TEXT NOT NULL,
                source_reference TEXT NOT NULL,
                evidence_summary TEXT NOT NULL DEFAULT '',
                source_event_id TEXT NOT NULL DEFAULT '',
                source_project_id TEXT NOT NULL DEFAULT '',
                source_metadata_json TEXT NOT NULL DEFAULT '{}',
                submitter TEXT NOT NULL,
                confirmer TEXT,
                status TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                confirmed_at TEXT,
                revoked_at TEXT,
                FOREIGN KEY(parent_id) REFERENCES knowledge_items(id)
            );
            CREATE INDEX IF NOT EXISTS idx_knowledge_items_project_status
                ON knowledge_items(project_key, status, updated_at DESC);
            CREATE TABLE IF NOT EXISTS knowledge_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT NOT NULL,
                version INTEGER NOT NULL,
                snapshot_json TEXT NOT NULL,
                change_reason TEXT NOT NULL DEFAULT '',
                actor TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(item_id, version),
                FOREIGN KEY(item_id) REFERENCES knowledge_items(id)
            );
            CREATE TABLE IF NOT EXISTS knowledge_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT NOT NULL,
                project_key TEXT NOT NULL,
                action TEXT NOT NULL,
                actor TEXT NOT NULL,
                reason TEXT NOT NULL DEFAULT '',
                from_status TEXT,
                to_status TEXT,
                version INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(item_id) REFERENCES knowledge_items(id)
            );
            CREATE INDEX IF NOT EXISTS idx_knowledge_audit_item
                ON knowledge_audit(item_id, id);
            """
        )
        columns = {
            str(row[1])
            for row in connection.execute("PRAGMA table_info(knowledge_items)").fetchall()
        }
        for name, definition in (
            ("knowledge_type", "TEXT NOT NULL DEFAULT 'general_explanation'"),
            ("review_policy", "TEXT NOT NULL DEFAULT 'legacy'"),
            ("review_reason", "TEXT NOT NULL DEFAULT ''"),
            ("parent_relation", "TEXT NOT NULL DEFAULT ''"),
            ("source_event_id", "TEXT NOT NULL DEFAULT ''"),
            ("source_project_id", "TEXT NOT NULL DEFAULT ''"),
            ("source_metadata_json", "TEXT NOT NULL DEFAULT '{}'"),
        ):
            if name not in columns:
                connection.execute(f"ALTER TABLE knowledge_items ADD COLUMN {name} {definition}")

    def create_candidate(self, payload: dict[str, Any]) -> dict[str, Any]:
        scope_type = str(payload.get("scope_type") or "general").strip()
        if scope_type not in KNOWLEDGE_MEMORY_SCOPE_TYPES:
            raise KnowledgeMemoryError("scope_type 仅支持 general、task 或 project")
        if scope_type == "general":
            project_key = GENERAL_KNOWLEDGE_PROJECT_KEY
            project_name = GENERAL_KNOWLEDGE_PROJECT_NAME
        else:
            project_key, project_name = resolve_project_scope(payload)
        task_id = _optional_text(payload.get("task_id"))
        job_id = _optional_text(payload.get("job_id"))
        if scope_type == "general":
            task_id = None
            job_id = None
        if scope_type == "task" and not (task_id or job_id):
            raise KnowledgeMemoryError("任务范围知识必须提供 task_id 或 job_id")
        required = {
            "title": "标题",
            "question": "原问题",
            "conclusion": "待确认结论",
            "source_type": "来源类型",
            "source_reference": "来源定位",
            "submitter": "提交人",
        }
        values: dict[str, str] = {}
        for key, label in required.items():
            values[key] = str(payload.get(key) or "").strip()
            if not values[key]:
                raise KnowledgeMemoryError(f"请填写{label}")
        expires_at = _normalize_optional_datetime(payload.get("expires_at"), "expires_at")
        knowledge_type = classify_knowledge_type(payload)
        source_event_id = str(payload.get("source_event_id") or "").strip()
        source_project_id = str(payload.get("source_project_id") or "").strip()
        source_metadata_json = _source_metadata_json(payload.get("source_metadata"))
        review_policy, review_reason = self._resolve_review_policy(
            scope_type,
            knowledge_type,
            conflicts=[],
            event_sourced=bool(source_event_id),
        )
        now = _utc_now()
        item_id = f"KM-{uuid4().hex[:12].upper()}"
        item = {
            "id": item_id,
            "parent_id": _optional_text(payload.get("parent_id")),
            "parent_relation": str(payload.get("parent_relation") or "").strip(),
            "project_key": project_key,
            "project_name": project_name,
            "scope_type": scope_type,
            "knowledge_type": knowledge_type,
            "review_policy": review_policy,
            "review_reason": review_reason,
            "task_id": task_id,
            "job_id": job_id,
            "title": values["title"],
            "question": values["question"],
            "conclusion": values["conclusion"],
            "conditions": str(payload.get("conditions") or "").strip(),
            "exceptions": str(payload.get("exceptions") or "").strip(),
            "expires_at": expires_at,
            "source_type": values["source_type"],
            "source_reference": values["source_reference"],
            "evidence_summary": str(payload.get("evidence_summary") or "").strip(),
            "source_event_id": source_event_id,
            "source_project_id": source_project_id,
            "source_metadata_json": source_metadata_json,
            "submitter": values["submitter"],
            "confirmer": None,
            "status": "candidate",
            "version": 1,
            "created_at": now,
            "updated_at": now,
            "confirmed_at": None,
            "revoked_at": None,
        }
        with self._connect() as connection:
            analysis = self._analyze_existing(connection, item)
            duplicate = analysis["duplicate"]
            if duplicate:
                self._record_audit(
                    connection,
                    duplicate,
                    action="reuse",
                    actor=values["submitter"],
                    reason="检测到同范围重复知识，复用已有记录",
                    from_status=duplicate["status"],
                    to_status=duplicate["status"],
                )
                duplicate.update(
                    {
                        "duplicate_reused": True,
                        "duplicate_of": duplicate["id"],
                        "similar_items": analysis["similar_items"],
                        "conflicts": analysis["conflicts"],
                        "quality_warnings": ["已存在相同知识，未重复创建。"],
                    }
                )
                return duplicate
            review_policy, review_reason = self._resolve_review_policy(
                scope_type,
                knowledge_type,
                conflicts=analysis["conflicts"],
                event_sourced=bool(source_event_id),
            )
            item["review_policy"] = review_policy
            item["review_reason"] = review_reason
            connection.execute(
                """
                INSERT INTO knowledge_items (
                    id,parent_id,parent_relation,project_key,project_name,scope_type,knowledge_type,
                    review_policy,review_reason,task_id,job_id,
                    title,question,conclusion,conditions,exceptions,expires_at,
                    source_type,source_reference,evidence_summary,
                    source_event_id,source_project_id,source_metadata_json,submitter,confirmer,
                    status,version,created_at,updated_at,confirmed_at,revoked_at
                ) VALUES (
                    :id,:parent_id,:parent_relation,:project_key,:project_name,:scope_type,:knowledge_type,
                    :review_policy,:review_reason,:task_id,:job_id,
                    :title,:question,:conclusion,:conditions,:exceptions,:expires_at,
                    :source_type,:source_reference,:evidence_summary,
                    :source_event_id,:source_project_id,:source_metadata_json,:submitter,:confirmer,
                    :status,:version,:created_at,:updated_at,:confirmed_at,:revoked_at
                )
                """,
                item,
            )
            self._record_version(connection, item, actor=values["submitter"], reason="创建知识候选")
            self._record_audit(
                connection,
                item,
                action="create",
                actor=values["submitter"],
                reason="创建知识候选",
                from_status=None,
                to_status="candidate",
            )
            if scope_type == "general":
                now = _utc_now()
                connection.execute(
                    """
                    UPDATE knowledge_items SET status='pending',updated_at=? WHERE id=?
                    """,
                    (now, item_id),
                )
                item.update({"status": "pending", "updated_at": now})
                self._record_audit(
                    connection,
                    item,
                    action="submit",
                    actor=values["submitter"],
                    reason="通用知识候选默认提交",
                    from_status="candidate",
                    to_status="pending",
                )
                if review_policy == "auto_approve":
                    connection.execute(
                        """
                        UPDATE knowledge_items
                        SET status='confirmed',confirmer=?,confirmed_at=?,updated_at=?
                        WHERE id=?
                        """,
                        (GENERAL_KNOWLEDGE_AUTO_APPROVER, now, now, item_id),
                    )
                    item.update(
                        {
                            "status": "confirmed",
                            "confirmer": GENERAL_KNOWLEDGE_AUTO_APPROVER,
                            "confirmed_at": now,
                            "updated_at": now,
                        }
                    )
                    self._record_audit(
                        connection,
                        item,
                        action="confirm",
                        actor=GENERAL_KNOWLEDGE_AUTO_APPROVER,
                        reason=f"按知识类型策略自动通过：{knowledge_type}",
                        from_status="pending",
                        to_status="confirmed",
                    )
            item.update(
                {
                    "duplicate_reused": False,
                    "duplicate_of": None,
                    "similar_items": analysis["similar_items"],
                    "conflicts": analysis["conflicts"],
                    "quality_warnings": self._quality_warnings(item, analysis),
                }
            )
        if item["status"] == "confirmed" and item.get("parent_id"):
            self._mark_parent_superseded(item)
        return item

    def list_items(
        self,
        project_key: str,
        *,
        statuses: set[str] | None = None,
        query: str = "",
    ) -> list[dict[str, Any]]:
        normalized_key = _require_project_key(project_key)
        clauses = ["project_key=?"]
        parameters: list[Any] = [normalized_key]
        if statuses:
            invalid = statuses - KNOWLEDGE_MEMORY_STATUSES
            if invalid:
                raise KnowledgeMemoryError(f"未知知识状态：{', '.join(sorted(invalid))}")
            placeholders = ",".join("?" for _ in statuses)
            clauses.append(f"status IN ({placeholders})")
            parameters.extend(sorted(statuses))
        clean_query = query.strip()
        if clean_query:
            clauses.append("(title LIKE ? OR question LIKE ? OR conclusion LIKE ? OR evidence_summary LIKE ?)")
            marker = f"%{clean_query}%"
            parameters.extend([marker, marker, marker, marker])
        with self._connect() as connection:
            rows = connection.execute(
                f"SELECT * FROM knowledge_items WHERE {' AND '.join(clauses)} ORDER BY updated_at DESC",
                parameters,
            ).fetchall()
        return [_row_dict(row) for row in rows]

    def revise_item(
        self,
        item_id: str,
        project_key: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        actor = str(payload.get("actor") or "").strip()
        if not actor:
            raise KnowledgeMemoryError("请填写操作人")
        current = self.get_item(item_id, project_key)
        conclusion = str(payload.get("conclusion") or "").strip()
        if not conclusion:
            raise KnowledgeMemoryError("请填写更正后的结论")
        if current["status"] in {"candidate", "pending"}:
            return self.update_item(
                item_id,
                project_key,
                {
                    "actor": actor,
                    "reason": str(payload.get("reason") or "更正未确认知识"),
                    "conclusion": conclusion,
                },
            )
        if current["status"] not in {"confirmed", "suspected_stale"}:
            raise KnowledgeMemoryConflict("当前状态不能创建更正版本")
        revised = self.create_candidate(
            {
                **current,
                "parent_id": current["id"],
                "parent_relation": "revision",
                "project_key": current["project_key"],
                "project_name": current["project_name"],
                "title": str(payload.get("title") or current["title"]).strip(),
                "question": str(payload.get("question") or current["question"]).strip(),
                "conclusion": conclusion,
                "knowledge_type": payload.get("knowledge_type") or current["knowledge_type"],
                "source_reference": (
                    f"{current['source_reference']}\n更正来源：{current['id']}"
                ),
                "submitter": actor,
            }
        )
        with self._connect() as connection:
            source = _row_dict(self._get_row(connection, current["id"], current["project_key"]))
            self._record_audit(
                connection,
                source,
                action="revise",
                actor=actor,
                reason=str(payload.get("reason") or f"创建更正版本 {revised['id']}"),
                from_status=source["status"],
                to_status=source["status"],
            )
        return revised

    def promote_to_general(
        self,
        item_id: str,
        project_key: str,
        *,
        actor: str,
        reason: str = "",
    ) -> dict[str, Any]:
        clean_actor = actor.strip()
        if not clean_actor:
            raise KnowledgeMemoryError("请填写操作人")
        current = self.get_item(item_id, project_key)
        if current["scope_type"] == "general":
            raise KnowledgeMemoryConflict("该知识已是通用知识")
        if current["status"] != "confirmed":
            raise KnowledgeMemoryConflict("只有已确认的项目或任务知识可申请提升")
        promoted = self.create_candidate(
            {
                **current,
                "parent_id": current["id"],
                "parent_relation": "promotion",
                "project_name": "",
                "project_key": "",
                "scope_type": "general",
                "task_id": None,
                "job_id": None,
                "source_reference": (
                    f"{current['source_reference']}\n提升来源：{current['project_name']} / {current['id']}"
                ),
                "submitter": clean_actor,
            }
        )
        with self._connect() as connection:
            source = _row_dict(self._get_row(connection, current["id"], current["project_key"]))
            self._record_audit(
                connection,
                source,
                action="promote_general",
                actor=clean_actor,
                reason=reason.strip() or f"申请提升为通用知识 {promoted['id']}",
                from_status=source["status"],
                to_status=source["status"],
            )
        return promoted

    def get_item(self, item_id: str, project_key: str) -> dict[str, Any]:
        normalized_key = _require_project_key(project_key)
        with self._connect() as connection:
            row = self._get_row(connection, item_id, normalized_key)
        return _row_dict(row)

    def update_item(
        self,
        item_id: str,
        project_key: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        actor = str(payload.get("actor") or "").strip()
        if not actor:
            raise KnowledgeMemoryError("请填写操作人")
        normalized_key = _require_project_key(project_key)
        reason = str(payload.get("reason") or "编辑知识候选").strip()
        with self._connect() as connection:
            current_row = self._get_row(connection, item_id, normalized_key)
            current = _row_dict(current_row)
            if current["status"] not in {"candidate", "pending"}:
                raise KnowledgeMemoryConflict("已确认或已结束的知识不能直接覆盖，请创建新候选版本")
            updates: dict[str, Any] = {}
            for key in EDITABLE_FIELDS:
                if key not in payload:
                    continue
                if key == "scope_type":
                    value = str(payload.get(key) or "").strip()
                    if value not in KNOWLEDGE_MEMORY_SCOPE_TYPES:
                        raise KnowledgeMemoryError("scope_type 仅支持 general、task 或 project")
                    if value == "general" and current["scope_type"] != "general":
                        raise KnowledgeMemoryError("项目或任务候选不能通过编辑改为通用知识，请新建通用候选")
                    if value != "general" and current["scope_type"] == "general":
                        raise KnowledgeMemoryError("通用知识不能通过编辑改为项目范围，请新建项目候选")
                elif key == "knowledge_type":
                    value = str(payload.get(key) or "").strip()
                    if value not in KNOWLEDGE_MEMORY_TYPES:
                        raise KnowledgeMemoryError("未知知识类型")
                elif key == "expires_at":
                    value = _normalize_optional_datetime(payload.get(key), "expires_at")
                else:
                    value = str(payload.get(key) or "").strip()
                updates[key] = (
                    value or None
                    if key in {"task_id", "job_id", "expires_at"}
                    else value
                )
            for required_key, label in (
                ("title", "标题"),
                ("question", "原问题"),
                ("conclusion", "结论"),
                ("source_type", "来源类型"),
                ("source_reference", "来源定位"),
            ):
                if required_key in updates and not updates[required_key]:
                    raise KnowledgeMemoryError(f"{label}不能为空")
            next_item = {**current, **updates}
            if next_item["scope_type"] == "task" and not (next_item.get("task_id") or next_item.get("job_id")):
                raise KnowledgeMemoryError("任务范围知识必须提供 task_id 或 job_id")
            next_item["version"] = int(current["version"]) + 1
            next_item["updated_at"] = _utc_now()
            if "knowledge_type" in updates:
                policy, policy_reason = self._resolve_review_policy(
                    next_item["scope_type"],
                    next_item["knowledge_type"],
                    conflicts=[],
                    event_sourced=bool(next_item.get("source_event_id")),
                )
                updates["review_policy"] = policy
                updates["review_reason"] = policy_reason
                next_item["review_policy"] = policy
                next_item["review_reason"] = policy_reason
            assignments = ",".join(f"{key}=?" for key in [*updates, "version", "updated_at"])
            parameters = [next_item[key] for key in [*updates, "version", "updated_at"]]
            parameters.extend([item_id, normalized_key])
            connection.execute(
                f"UPDATE knowledge_items SET {assignments} WHERE id=? AND project_key=?",
                parameters,
            )
            self._record_version(connection, next_item, actor=actor, reason=reason)
            self._record_audit(
                connection,
                next_item,
                action="edit",
                actor=actor,
                reason=reason,
                from_status=current["status"],
                to_status=current["status"],
            )
        return self.get_item(item_id, normalized_key)

    def transition(
        self,
        item_id: str,
        project_key: str,
        action: str,
        *,
        actor: str,
        reason: str = "",
        actor_role: str = "",
    ) -> dict[str, Any]:
        clean_actor = actor.strip()
        if not clean_actor:
            raise KnowledgeMemoryError("请填写操作人")
        normalized_key = _require_project_key(project_key)
        clean_action = action.strip()
        with self._connect() as connection:
            current_row = self._get_row(connection, item_id, normalized_key)
            current = _row_dict(current_row)
            next_status = TRANSITIONS.get((current["status"], clean_action))
            if not next_status:
                raise KnowledgeMemoryConflict(
                    f"不允许从 {current['status']} 执行 {clean_action}"
                )
            if clean_action == "confirm" and actor_role not in CONFIRM_ROLES:
                raise KnowledgeMemoryPermissionError("当前本地试点身份没有确认角色")
            if clean_action in {"reject", "revoke", "mark_stale"} and not reason.strip():
                raise KnowledgeMemoryError("该状态变更必须填写原因")
            now = _utc_now()
            updates: dict[str, Any] = {
                "status": next_status,
                "updated_at": now,
            }
            if clean_action == "confirm":
                updates["confirmer"] = clean_actor
                updates["confirmed_at"] = now
            if clean_action == "revoke":
                updates["revoked_at"] = now
            assignments = ",".join(f"{key}=?" for key in updates)
            connection.execute(
                f"UPDATE knowledge_items SET {assignments} WHERE id=? AND project_key=?",
                [*updates.values(), item_id, normalized_key],
            )
            next_item = {**current, **updates}
            self._record_audit(
                connection,
                next_item,
                action=clean_action,
                actor=clean_actor,
                reason=reason.strip(),
                from_status=current["status"],
                to_status=next_status,
            )
        result = self.get_item(item_id, normalized_key)
        if clean_action == "confirm" and result.get("parent_id"):
            self._mark_parent_superseded(result)
        return result

    def audit(self, item_id: str, project_key: str) -> list[dict[str, Any]]:
        normalized_key = _require_project_key(project_key)
        with self._connect() as connection:
            self._get_row(connection, item_id, normalized_key)
            rows = connection.execute(
                """
                SELECT id,item_id,project_key,action,actor,reason,from_status,to_status,version,created_at
                FROM knowledge_audit
                WHERE item_id=? AND project_key=?
                ORDER BY id
                """,
                (item_id, normalized_key),
            ).fetchall()
        return [_row_dict(row) for row in rows]

    def search_confirmed(
        self,
        question: str,
        project_key: str,
        *,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        normalized_key = normalize_project_key(project_key)
        clean_question = question.strip()
        if not clean_question:
            return []
        with self._connect() as connection:
            allowed_keys = [GENERAL_KNOWLEDGE_PROJECT_KEY]
            if normalized_key and normalized_key != GENERAL_KNOWLEDGE_PROJECT_KEY:
                allowed_keys.append(normalized_key)
            placeholders = ",".join("?" for _ in allowed_keys)
            rows = connection.execute(
                f"""
                SELECT * FROM knowledge_items
                WHERE project_key IN ({placeholders}) AND status='confirmed'
                ORDER BY CASE WHEN project_key=? THEN 0 ELSE 1 END, updated_at DESC
                """,
                [*allowed_keys, normalized_key],
            ).fetchall()
            active_rows: list[sqlite3.Row] = []
            now = datetime.now(timezone.utc)
            for row in rows:
                expires_at = _parse_datetime(row["expires_at"])
                if expires_at and expires_at <= now:
                    item = _row_dict(row)
                    connection.execute(
                        "UPDATE knowledge_items SET status='suspected_stale',updated_at=? WHERE id=?",
                        (_utc_now(), item["id"]),
                    )
                    item["status"] = "suspected_stale"
                    self._record_audit(
                        connection,
                        item,
                        action="mark_stale",
                        actor="system",
                        reason="知识已超过 expires_at，自动转为疑似失效",
                        from_status="confirmed",
                        to_status="suspected_stale",
                    )
                    continue
                active_rows.append(row)
        if _requires_project_specific_memory(clean_question):
            active_rows = [
                row
                for row in active_rows
                if normalize_project_key(row["project_key"]) == normalized_key
            ]
        if _is_memory_inventory_query(clean_question):
            inventory: list[dict[str, Any]] = []
            for row in active_rows[: max(1, min(limit, 20))]:
                item = _row_dict(row)
                item["score"] = 1.0
                inventory.append(item)
            return inventory
        query_terms = _search_terms(clean_question)
        query_identifiers = set(re.findall(r"\d{6,}", clean_question))
        normalized_question = _normalized_content(clean_question)
        minimum_score = 12.0 if len(normalized_question) <= 18 else 48.0
        scored: list[tuple[float, dict[str, Any]]] = []
        for row in active_rows:
            item = _row_dict(row)
            if query_identifiers:
                searchable_text = " ".join(
                    str(item.get(field) or "")
                    for field in (
                        "title",
                        "question",
                        "conclusion",
                        "conditions",
                        "exceptions",
                        "evidence_summary",
                        "source_reference",
                    )
                )
                if not any(identifier in searchable_text for identifier in query_identifiers):
                        continue
            score = _memory_score(item, query_terms)
            if score >= minimum_score:
                item["score"] = round(score, 3)
                scored.append((score, item))
        scored.sort(key=lambda pair: (pair[0], pair[1]["updated_at"]), reverse=True)
        return [item for _, item in scored[: max(1, min(limit, 20))]]

    def _resolve_review_policy(
        self,
        scope_type: str,
        knowledge_type: str,
        *,
        conflicts: list[dict[str, Any]],
        event_sourced: bool = False,
    ) -> tuple[str, str]:
        if scope_type != "general":
            return "manual_review", "项目或任务知识需人工确认"
        if event_sourced:
            return "manual_review", "事件来源知识提升为通用候选后必须再次人工确认"
        if conflicts:
            return "manual_review", "检测到同范围已有知识结论可能冲突"
        if knowledge_type in self.auto_approve_types:
            return "auto_approve", "该知识类型按当前配置自动通过"
        return "manual_review", "涉及项目口径、价格系数或正式标准，需人工复核"

    def _analyze_existing(
        self,
        connection: sqlite3.Connection,
        item: dict[str, Any],
    ) -> dict[str, Any]:
        rows = connection.execute(
            """
            SELECT * FROM knowledge_items
            WHERE project_key=? AND status IN ('candidate','pending','confirmed')
            ORDER BY updated_at DESC
            """,
            (item["project_key"],),
        ).fetchall()
        normalized_question = _normalized_content(item["question"])
        normalized_conclusion = _normalized_content(item["conclusion"])
        normalized_title = _normalized_content(item["title"])
        duplicate: dict[str, Any] | None = None
        similar_items: list[dict[str, Any]] = []
        conflicts: list[dict[str, Any]] = []
        for row in rows:
            existing = _row_dict(row)
            question_score = _similarity(normalized_question, _normalized_content(existing["question"]))
            title_score = _similarity(normalized_title, _normalized_content(existing["title"]))
            conclusion_score = _similarity(
                normalized_conclusion,
                _normalized_content(existing["conclusion"]),
            )
            anchor_score = max(question_score, title_score)
            summary = {
                "id": existing["id"],
                "title": existing["title"],
                "status": existing["status"],
                "project_key": existing["project_key"],
                "scope_type": existing["scope_type"],
                "score": round((anchor_score + conclusion_score) / 2, 3),
                "conclusion": existing["conclusion"],
            }
            if anchor_score >= self.duplicate_threshold and conclusion_score >= self.duplicate_threshold:
                duplicate = existing
                break
            if anchor_score >= 0.75:
                similar_items.append(summary)
            if anchor_score >= 0.88 and conclusion_score < 0.55:
                conflicts.append(summary)
        return {
            "duplicate": duplicate,
            "similar_items": similar_items[:5],
            "conflicts": conflicts[:5],
        }

    @staticmethod
    def _quality_warnings(
        item: dict[str, Any],
        analysis: dict[str, Any],
    ) -> list[str]:
        warnings: list[str] = []
        if analysis["conflicts"]:
            warnings.append("检测到同范围相似问题存在不同结论，已转人工复核。")
        elif analysis["similar_items"]:
            warnings.append("已发现相似知识，可在知识记忆中继续比对或撤销重复项。")
        if item["review_policy"] == "manual_review":
            warnings.append(item["review_reason"])
        return list(dict.fromkeys(warnings))

    def _mark_parent_superseded(self, item: dict[str, Any]) -> None:
        parent_id = str(item.get("parent_id") or "").strip()
        if (
            not parent_id
            or parent_id == item["id"]
            or item.get("parent_relation") != "revision"
        ):
            return
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM knowledge_items WHERE id=?",
                (parent_id,),
            ).fetchone()
            if not row or row["status"] != "confirmed":
                return
            parent = _row_dict(row)
            now = _utc_now()
            connection.execute(
                "UPDATE knowledge_items SET status='suspected_stale',updated_at=? WHERE id=?",
                (now, parent_id),
            )
            parent.update({"status": "suspected_stale", "updated_at": now})
            self._record_audit(
                connection,
                parent,
                action="supersede",
                actor=str(item.get("confirmer") or GENERAL_KNOWLEDGE_AUTO_APPROVER),
                reason=f"已由确认版本 {item['id']} 替代",
                from_status="confirmed",
                to_status="suspected_stale",
            )

    @staticmethod
    def _get_row(
        connection: sqlite3.Connection,
        item_id: str,
        project_key: str,
    ) -> sqlite3.Row:
        row = connection.execute(
            "SELECT * FROM knowledge_items WHERE id=? AND project_key=?",
            (item_id, project_key),
        ).fetchone()
        if not row:
            raise KnowledgeMemoryNotFound("未找到该项目范围内的知识")
        return row

    @staticmethod
    def _record_version(
        connection: sqlite3.Connection,
        item: dict[str, Any],
        *,
        actor: str,
        reason: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO knowledge_versions(item_id,version,snapshot_json,change_reason,actor,created_at)
            VALUES (?,?,?,?,?,?)
            """,
            (
                item["id"],
                item["version"],
                json.dumps(item, ensure_ascii=False, sort_keys=True),
                reason,
                actor,
                _utc_now(),
            ),
        )

    @staticmethod
    def _record_audit(
        connection: sqlite3.Connection,
        item: dict[str, Any],
        *,
        action: str,
        actor: str,
        reason: str,
        from_status: str | None,
        to_status: str | None,
    ) -> None:
        connection.execute(
            """
            INSERT INTO knowledge_audit(
                item_id,project_key,action,actor,reason,from_status,to_status,version,created_at
            ) VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (
                item["id"],
                item["project_key"],
                action,
                actor,
                reason,
                from_status,
                to_status,
                item["version"],
                _utc_now(),
            ),
        )


def search_confirmed_project_memory(
    question: str,
    project_key: str,
    *,
    limit: int = 5,
    db_path: Path = DEFAULT_KNOWLEDGE_MEMORY_DB_PATH,
) -> list[dict[str, Any]]:
    return KnowledgeMemoryStore(db_path).search_confirmed(
        question,
        project_key,
        limit=limit,
    )


def _require_project_key(value: object) -> str:
    normalized = normalize_project_key(value)
    if not normalized:
        raise KnowledgeMemoryError("缺少有效 project_key")
    return normalized


def _row_dict(row: sqlite3.Row) -> dict[str, Any]:
    item = {key: row[key] for key in row.keys()}
    if "source_metadata_json" in item:
        try:
            metadata = json.loads(str(item.get("source_metadata_json") or "{}"))
        except (TypeError, json.JSONDecodeError):
            metadata = {}
        item["source_metadata"] = metadata if isinstance(metadata, dict) else {}
    return item


def _source_metadata_json(value: object) -> str:
    if not isinstance(value, dict):
        return "{}"
    allowed = {
        "event_type",
        "classification_status",
        "project_id",
        "task_id",
        "skill_id",
        "skill_version",
        "sheet_name",
        "row_number",
        "field_name",
        "artifact_version",
        "artifact_hash",
        "reviewer_name",
        "review_round",
    }
    sanitized: dict[str, Any] = {}
    for key in allowed:
        raw = value.get(key)
        if raw is None:
            continue
        if key in {"row_number", "review_round"}:
            try:
                sanitized[key] = max(0, int(raw))
            except (TypeError, ValueError):
                continue
            continue
        text = str(raw).replace("\x00", "").strip()
        if re.match(r"^[a-zA-Z]:[\\/]", text) or text.startswith(("/", "\\\\")):
            continue
        sanitized[key] = text[:240]
    return json.dumps(sanitized, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _optional_text(value: object) -> str | None:
    text = str(value or "").strip()
    return text or None


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _normalize_optional_datetime(value: object, field_name: str) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    parsed = _parse_datetime(text)
    if not parsed:
        raise KnowledgeMemoryError(f"{field_name} 不是有效时间")
    return parsed.astimezone(timezone.utc).isoformat(timespec="seconds")


def _parse_datetime(value: object) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _search_terms(text: str) -> set[str]:
    clean = re.sub(r"\s+", "", text.lower())
    terms = {
        token
        for token in re.findall(r"[a-z0-9.%_-]{2,}|[\u4e00-\u9fff]{2,}", clean)
        if token
    }
    chinese = "".join(re.findall(r"[\u4e00-\u9fff]", clean))
    for width in (2, 3, 4):
        terms.update(
            chinese[index : index + width]
            for index in range(max(0, len(chinese) - width + 1))
        )
    return terms


def _requires_project_specific_memory(question: str) -> bool:
    clean = re.sub(r"\s+", "", question)
    if "本项目" not in clean and "当前任务" not in clean:
        return False
    return any(
        marker in clean
        for marker in (
            "已经确认",
            "已确认",
            "之前确认",
            "特殊处理",
            "例外规则",
            "列映射",
            "输出约定",
            "计价口径",
        )
    )


def _is_memory_inventory_query(question: str) -> bool:
    clean = re.sub(r"\s+", "", question)
    return any(
        marker in clean
        for marker in (
            "列出当前所有已确认且未失效",
            "当前有哪些已确认知识",
            "检查当前有效知识记忆",
            "某条已确认知识经历过哪些版本变化",
        )
    )


def classify_knowledge_type(payload: dict[str, Any]) -> str:
    text = " ".join(
        str(payload.get(key) or "")
        for key in ("title", "question", "conclusion", "conditions", "exceptions")
    ).lower()
    operation_terms = (
        "如何使用",
        "怎么操作",
        "点击",
        "按钮",
        "上传",
        "下载",
        "页面",
        "弹窗",
        "报错",
        "设置项",
    )
    standard_terms = (
        "正式标准",
        "国家标准",
        "行业标准",
        "企业标准",
        "政策",
        "规范条款",
        "文件号",
        "标准规定",
    )
    price_terms = (
        "单价",
        "基价",
        "价格",
        "调整系数",
        "费率",
        "费用金额",
        "计价",
    )
    project_rule_terms = (
        "项目口径",
        "本项目采用",
        "复杂程度",
        "工作内容归类",
        "特殊处理原则",
        "适用边界",
    )
    if any(term in text for term in standard_terms):
        detected = "standard_policy"
    elif any(term in text for term in price_terms):
        detected = "price_factor"
    elif any(term in text for term in project_rule_terms):
        detected = "project_rule"
    elif any(term in text for term in operation_terms):
        detected = "operation"
    else:
        detected = "general_explanation"
    requested = str(payload.get("knowledge_type") or "").strip()
    if detected in {"standard_policy", "price_factor", "project_rule"}:
        return detected
    return requested if requested in KNOWLEDGE_MEMORY_TYPES else detected


def _normalized_content(value: object) -> str:
    return re.sub(r"[^a-z0-9一-鿿]+", "", str(value or "").lower())


def _similarity(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def _memory_score(item: dict[str, Any], query_terms: set[str]) -> float:
    if not query_terms:
        return 0.0
    weighted_fields = (
        ("title", 4.0),
        ("question", 3.0),
        ("conclusion", 3.0),
        ("conditions", 2.0),
        ("exceptions", 1.0),
        ("evidence_summary", 1.0),
    )
    score = 0.0
    for field, weight in weighted_fields:
        text = re.sub(r"\s+", "", str(item.get(field) or "").lower())
        score += sum(weight for term in query_terms if term in text)
    return score
