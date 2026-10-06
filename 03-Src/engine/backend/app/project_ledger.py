from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable
from uuid import uuid4


PROJECT_ID_PATTERN = re.compile(r"^prj_[a-f0-9]{24}$")
SOURCE_TYPES = {"web", "agent", "feishu", "weact", "external"}
PROJECT_STATUSES = {"processing", "pending_review", "completed", "returned", "failed"}
SOURCE_LABELS = {
    "web": "网页上传",
    "agent": "智算助手",
    "feishu": "飞书",
    "weact": "企业 WeAct",
    "external": "外部系统",
}
STATUS_LABELS = {
    "processing": "处理中",
    "pending_review": "待复核",
    "completed": "已完成",
    "returned": "已退回",
    "failed": "失败",
}
LIFECYCLE_STAGES = (
    ("entered", "项目进入"),
    ("matched", "完成匹配"),
    ("warned", "完成预警"),
    ("reported", "生成报告"),
    ("reviewed", "完成复核"),
)


class ProjectLedgerError(RuntimeError):
    pass


class ProjectNotFoundError(ProjectLedgerError):
    pass


class ProjectArtifactNotFoundError(ProjectLedgerError):
    pass


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def new_project_id() -> str:
    return f"prj_{uuid4().hex[:24]}"


def stable_external_project_id(business_key: str) -> str:
    return f"prj_{hashlib.sha256(business_key.encode('utf-8')).hexdigest()[:24]}"


def validate_project_id(project_id: str) -> str:
    value = str(project_id or "").strip()
    if not PROJECT_ID_PATTERN.fullmatch(value):
        raise ProjectNotFoundError("项目编号无效")
    return value


def _clean_text(value: object, limit: int = 240) -> str:
    return str(value or "").replace("\x00", "").strip()[:limit]


def _parse_json(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    try:
        parsed = json.loads(str(value or "{}"))
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _int(value: object) -> int:
    try:
        return max(0, int(float(value or 0)))
    except (TypeError, ValueError):
        return 0


def _warning_counts(summary: dict[str, Any]) -> tuple[str, int, int]:
    warning = _parse_json(summary.get("warning_summary"))
    if not bool(warning.get("executed")):
        return "not_run", 0, 0
    return (
        "completed",
        _int(
            warning.get("high_rows")
            or warning.get("high_risk_rows")
            or warning.get("high_risk_count")
        ),
        _int(
            warning.get("low_rows")
            or warning.get("low_risk_rows")
            or warning.get("low_risk_count")
        ),
    )


def _run_status(summary: dict[str, Any], fallback: str = "processing") -> str:
    matching_status = _clean_text(summary.get("matching_status"), 40)
    if matching_status == "pending":
        return "processing"
    if _int(summary.get("review_rows")) > 0:
        return "pending_review"
    if matching_status == "completed" or _int(summary.get("filled_rows")) > 0:
        return "completed"
    return fallback if fallback in PROJECT_STATUSES else "processing"


def _has_existing_artifact(item: dict[str, Any], artifact_type: str) -> bool:
    return any(
        artifact.get("type") == artifact_type and bool(artifact.get("exists"))
        for artifact in item.get("artifacts", [])
    )


def _lifecycle_stage_completed(item: dict[str, Any], stage: str) -> bool:
    if item.get("record_type") != "project":
        return False
    matched = (
        _int(item.get("input_rows")) > 0
        and _int(item.get("matched_rows")) + _int(item.get("review_rows")) > 0
        and str(item.get("status")) in {"pending_review", "completed", "returned"}
    )
    warned = matched and str(item.get("warning_status")) == "completed"
    reported = warned and _has_existing_artifact(item, "word")
    reviewed = (
        reported
        and str(item.get("status")) == "completed"
        and _int(item.get("review_rows")) == 0
    )
    return {
        "entered": True,
        "matched": matched,
        "warned": warned,
        "reported": reported,
        "reviewed": reviewed,
    }.get(stage, False)


class ProjectLedger:
    def __init__(self, db_path: Path, runtime_root: Path) -> None:
        self.db_path = Path(db_path)
        self.runtime_root = Path(runtime_root)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.runtime_root.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def _init_db(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS projects (
                    project_id TEXT PRIMARY KEY,
                    project_name TEXT NOT NULL,
                    project_code TEXT NOT NULL DEFAULT '',
                    source_type TEXT NOT NULL,
                    source_reference TEXT NOT NULL DEFAULT '',
                    skill_id TEXT NOT NULL DEFAULT '',
                    skill_version TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'processing',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    latest_run_id TEXT NOT NULL DEFAULT '',
                    latest_version INTEGER NOT NULL DEFAULT 1,
                    archived INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS project_runs (
                    run_id TEXT PRIMARY KEY,
                    project_id TEXT,
                    job_id TEXT NOT NULL DEFAULT '',
                    source_type TEXT NOT NULL,
                    source_task_id TEXT NOT NULL DEFAULT '',
                    input_filename TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'processing',
                    stage TEXT NOT NULL DEFAULT '',
                    input_rows INTEGER NOT NULL DEFAULT 0,
                    matched_rows INTEGER NOT NULL DEFAULT 0,
                    standard_hit_rows INTEGER NOT NULL DEFAULT 0,
                    experience_hint_rows INTEGER NOT NULL DEFAULT 0,
                    review_rows INTEGER NOT NULL DEFAULT 0,
                    warning_status TEXT NOT NULL DEFAULT 'not_run',
                    risk_high INTEGER NOT NULL DEFAULT 0,
                    risk_low INTEGER NOT NULL DEFAULT 0,
                    file_version INTEGER NOT NULL DEFAULT 1,
                    review_round INTEGER NOT NULL DEFAULT 0,
                    skill_id TEXT NOT NULL DEFAULT '',
                    skill_version TEXT NOT NULL DEFAULT '',
                    skill_snapshot_json TEXT NOT NULL DEFAULT '{}',
                    inferred_name TEXT NOT NULL DEFAULT '',
                    time_source TEXT NOT NULL DEFAULT 'recorded',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT NOT NULL DEFAULT '',
                    FOREIGN KEY(project_id) REFERENCES projects(project_id)
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_project_runs_job_id
                ON project_runs(job_id) WHERE job_id<>'';
                CREATE UNIQUE INDEX IF NOT EXISTS idx_project_runs_source_task
                ON project_runs(source_type, source_task_id) WHERE source_task_id<>'';
                CREATE INDEX IF NOT EXISTS idx_project_runs_project_id
                ON project_runs(project_id, updated_at DESC);
                CREATE TABLE IF NOT EXISTS project_artifacts (
                    artifact_id TEXT PRIMARY KEY,
                    project_id TEXT,
                    run_id TEXT NOT NULL,
                    artifact_type TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    relative_runtime_reference TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(run_id, artifact_type, relative_runtime_reference),
                    FOREIGN KEY(project_id) REFERENCES projects(project_id),
                    FOREIGN KEY(run_id) REFERENCES project_runs(run_id)
                );
                CREATE INDEX IF NOT EXISTS idx_project_artifacts_project_id
                ON project_artifacts(project_id, updated_at DESC);
                """
            )

    def ensure_project(
        self,
        *,
        project_name: str,
        source_type: str,
        skill_id: str,
        skill_version: str,
        project_id: str | None = None,
        project_code: str = "",
        source_reference: str = "",
        created_at: str | None = None,
        create_missing_with_id: bool = False,
    ) -> tuple[str, bool]:
        source = source_type if source_type in SOURCE_TYPES else "web"
        name = _clean_text(project_name, 160)
        if not name:
            raise ProjectLedgerError("项目名称不能为空")
        timestamp = created_at or now_iso()
        with self._connect() as connection:
            if project_id:
                clean_id = validate_project_id(project_id)
                existing = connection.execute(
                    "SELECT project_id FROM projects WHERE project_id=?", (clean_id,)
                ).fetchone()
                if not existing:
                    if not create_missing_with_id:
                        raise ProjectNotFoundError("项目不存在")
                    connection.execute(
                        """
                        INSERT INTO projects(
                            project_id,project_name,project_code,source_type,source_reference,
                            skill_id,skill_version,status,created_at,updated_at
                        ) VALUES(?,?,?,?,?,?,?,?,?,?)
                        """,
                        (
                            clean_id,
                            name,
                            _clean_text(project_code, 80),
                            source,
                            _clean_text(source_reference, 240),
                            _clean_text(skill_id, 120),
                            _clean_text(skill_version, 80),
                            "processing",
                            timestamp,
                            timestamp,
                        ),
                    )
                    return clean_id, True
                connection.execute(
                    """
                    UPDATE projects
                    SET project_name=?, project_code=?, source_type=?, skill_id=?,
                        skill_version=?, updated_at=?
                    WHERE project_id=?
                    """,
                    (
                        name,
                        _clean_text(project_code, 80),
                        source,
                        _clean_text(skill_id, 120),
                        _clean_text(skill_version, 80),
                        timestamp,
                        clean_id,
                    ),
                )
                return clean_id, False
            clean_id = new_project_id()
            connection.execute(
                """
                INSERT INTO projects(
                    project_id,project_name,project_code,source_type,source_reference,
                    skill_id,skill_version,status,created_at,updated_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    clean_id,
                    name,
                    _clean_text(project_code, 80),
                    source,
                    _clean_text(source_reference, 240),
                    _clean_text(skill_id, 120),
                    _clean_text(skill_version, 80),
                    "processing",
                    timestamp,
                    timestamp,
                ),
            )
            return clean_id, True

    def ensure_external_project(
        self,
        *,
        business_key: str,
        project_name: str,
        source_type: str,
        skill_id: str,
        skill_version: str,
        project_code: str = "",
        created_at: str | None = None,
    ) -> tuple[str, bool]:
        project_id = stable_external_project_id(business_key)
        timestamp = created_at or now_iso()
        with self._connect() as connection:
            existing = connection.execute(
                "SELECT project_id FROM projects WHERE project_id=?", (project_id,)
            ).fetchone()
            if existing:
                connection.execute(
                    """
                    UPDATE projects SET project_name=?,project_code=?,source_type=?,
                    skill_id=?,skill_version=?,updated_at=? WHERE project_id=?
                    """,
                    (
                        _clean_text(project_name, 160) or "未命名项目",
                        _clean_text(project_code, 80),
                        source_type if source_type in SOURCE_TYPES else "external",
                        _clean_text(skill_id, 120),
                        _clean_text(skill_version, 80),
                        timestamp,
                        project_id,
                    ),
                )
                return project_id, False
            connection.execute(
                """
                INSERT INTO projects(
                    project_id,project_name,project_code,source_type,source_reference,
                    skill_id,skill_version,status,created_at,updated_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    project_id,
                    _clean_text(project_name, 160) or "未命名项目",
                    _clean_text(project_code, 80),
                    source_type if source_type in SOURCE_TYPES else "external",
                    hashlib.sha256(business_key.encode("utf-8")).hexdigest(),
                    _clean_text(skill_id, 120),
                    _clean_text(skill_version, 80),
                    "processing",
                    timestamp,
                    timestamp,
                ),
            )
            return project_id, True

    def record_process_state(
        self,
        *,
        job_id: str,
        state: dict[str, Any],
        project_id: str | None,
        project_name: str,
        source_type: str,
        create_project: bool,
        created_at: str | None = None,
        time_source: str = "recorded",
        create_missing_project_with_id: bool = False,
    ) -> dict[str, Any]:
        snapshot = _parse_json(state.get("skill_snapshot"))
        summary = _parse_json(state.get("summary"))
        skill_id = _clean_text(snapshot.get("id"), 120)
        skill_version = _clean_text(snapshot.get("version"), 80)
        state_created_at = _clean_text(state.get("created_at"), 80)
        clean_project_id = project_id
        created = False
        if create_project:
            clean_project_id, created = self.ensure_project(
                project_name=project_name,
                source_type=source_type,
                skill_id=skill_id,
                skill_version=skill_version,
                project_id=project_id,
                created_at=created_at or state_created_at or None,
                create_missing_with_id=create_missing_project_with_id,
            )
        elif clean_project_id:
            clean_project_id = validate_project_id(clean_project_id)

        warning_status, risk_high, risk_low = _warning_counts(summary)
        status = _run_status(summary)
        timestamp = _clean_text(state.get("updated_at"), 80) or now_iso()
        run_created_at = created_at or state_created_at or timestamp
        input_rows = _int(summary.get("total_data_rows"))
        matched_rows = _int(summary.get("filled_rows") or summary.get("matched_rows"))
        experience_rows = max(
            _int(summary.get("physical_experience_rows")),
            _int(summary.get("technical_experience_rows")),
        )
        review_rows = _int(summary.get("review_rows"))
        standard_rows = min(input_rows, max(0, matched_rows - experience_rows))
        run_id = f"run_{hashlib.sha256(job_id.encode('utf-8')).hexdigest()[:24]}"
        inferred_name = _clean_text(project_name, 160) or Path(
            _clean_text(state.get("input_filename"), 240) or "历史处理任务.xlsx"
        ).stem

        with self._connect() as connection:
            existing_run = connection.execute(
                "SELECT run_id,project_id,created_at,file_version FROM project_runs WHERE job_id=?",
                (job_id,),
            ).fetchone()
            if existing_run:
                run_id = str(existing_run["run_id"])
                if not clean_project_id and existing_run["project_id"]:
                    clean_project_id = str(existing_run["project_id"])
                run_created_at = str(existing_run["created_at"])
                file_version = int(existing_run["file_version"] or 1)
                connection.execute(
                    """
                    UPDATE project_runs SET project_id=?,source_type=?,input_filename=?,
                    status=?,stage=?,input_rows=?,matched_rows=?,standard_hit_rows=?,
                    experience_hint_rows=?,review_rows=?,warning_status=?,risk_high=?,
                    risk_low=?,skill_id=?,skill_version=?,skill_snapshot_json=?,
                    inferred_name=?,time_source=?,updated_at=?,completed_at=?
                    WHERE run_id=?
                    """,
                    (
                        clean_project_id,
                        source_type if source_type in SOURCE_TYPES else "web",
                        _clean_text(state.get("input_filename"), 240),
                        status,
                        _clean_text(summary.get("matching_status") or status, 80),
                        input_rows,
                        matched_rows,
                        standard_rows,
                        experience_rows,
                        review_rows,
                        warning_status,
                        risk_high,
                        risk_low,
                        skill_id,
                        skill_version,
                        json.dumps(snapshot, ensure_ascii=False),
                        inferred_name,
                        time_source,
                        timestamp,
                        timestamp if status == "completed" else "",
                        run_id,
                    ),
                )
            else:
                version = 1
                if clean_project_id:
                    version = int(
                        connection.execute(
                            "SELECT COALESCE(MAX(file_version),0)+1 FROM project_runs WHERE project_id=?",
                            (clean_project_id,),
                        ).fetchone()[0]
                    )
                file_version = version
                connection.execute(
                    """
                    INSERT INTO project_runs(
                        run_id,project_id,job_id,source_type,input_filename,status,stage,
                        input_rows,matched_rows,standard_hit_rows,experience_hint_rows,
                        review_rows,warning_status,risk_high,risk_low,file_version,
                        skill_id,skill_version,skill_snapshot_json,inferred_name,time_source,
                        created_at,updated_at,completed_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        run_id,
                        clean_project_id,
                        job_id,
                        source_type if source_type in SOURCE_TYPES else "web",
                        _clean_text(state.get("input_filename"), 240),
                        status,
                        _clean_text(summary.get("matching_status") or status, 80),
                        input_rows,
                        matched_rows,
                        standard_rows,
                        experience_rows,
                        review_rows,
                        warning_status,
                        risk_high,
                        risk_low,
                        version,
                        skill_id,
                        skill_version,
                        json.dumps(snapshot, ensure_ascii=False),
                        inferred_name,
                        time_source,
                        run_created_at,
                        timestamp,
                        timestamp if status == "completed" else "",
                    ),
                )
            if clean_project_id:
                connection.execute(
                    """
                    UPDATE projects SET status=?,latest_run_id=?,latest_version=?,
                    skill_id=?,skill_version=?,updated_at=? WHERE project_id=?
                    """,
                    (
                        status,
                        run_id,
                        file_version,
                        skill_id,
                        skill_version,
                        timestamp,
                        clean_project_id,
                    ),
                )

        job_dir = self.runtime_root / job_id
        for artifact_type, state_key in (("excel", "output_excel"), ("word", "output_report")):
            name = _clean_text(state.get(state_key), 240)
            if name:
                self.upsert_artifact(
                    project_id=clean_project_id,
                    run_id=run_id,
                    artifact_type=artifact_type,
                    path=job_dir / name,
                    version=file_version,
                )
        return {
            "project_id": clean_project_id,
            "run_id": run_id,
            "created_project": created,
            "status": status,
        }

    def record_external_task(
        self,
        task: dict[str, Any],
        *,
        feishu_runtime_root: Path,
    ) -> dict[str, Any]:
        business_key = _clean_text(task.get("business_key"), 600)
        if not business_key:
            business_key = "\n".join(
                [
                    _clean_text(task.get("source_system"), 120),
                    _clean_text(task.get("source_task_id"), 120),
                    _clean_text(task.get("event_type"), 120),
                ]
            )
        profile = _clean_text(task.get("platform_profile_id"), 120)
        source_type = "weact" if "weact" in profile.lower() else "feishu"
        project_id, created_project = self.ensure_external_project(
            business_key=business_key,
            project_name=_clean_text(task.get("project_name"), 160) or "未命名协同项目",
            project_code=_clean_text(task.get("source_task_id"), 80),
            source_type=source_type,
            skill_id=_clean_text(task.get("skill_id"), 120),
            skill_version=_clean_text(task.get("skill_version"), 80),
            created_at=_clean_text(task.get("created_at"), 80) or None,
        )
        public_status = _clean_text(task.get("status"), 60)
        status = {
            "completed": "completed",
            "returned": "returned",
            "failed": "failed",
            "dispatch_failed": "failed",
            "pending_review": "pending_review",
        }.get(public_status, "processing")
        task_id = _clean_text(task.get("task_id"), 180)
        run_id = f"run_{hashlib.sha256(f'external:{task_id}'.encode('utf-8')).hexdigest()[:24]}"
        created_at = _clean_text(task.get("created_at"), 80) or now_iso()
        updated_at = _clean_text(task.get("updated_at"), 80) or created_at
        with self._connect() as connection:
            existing = connection.execute(
                "SELECT run_id,file_version FROM project_runs WHERE source_type=? AND source_task_id=?",
                (source_type, task_id),
            ).fetchone()
            if existing:
                run_id = str(existing["run_id"])
                version = int(existing["file_version"] or 1)
                connection.execute(
                    """
                    UPDATE project_runs SET project_id=?,status=?,stage=?,review_round=?,
                    skill_id=?,skill_version=?,updated_at=?,completed_at=? WHERE run_id=?
                    """,
                    (
                        project_id,
                        status,
                        _clean_text(task.get("stage"), 80),
                        _int(task.get("review_round")),
                        _clean_text(task.get("skill_id"), 120),
                        _clean_text(task.get("skill_version"), 80),
                        updated_at,
                        _clean_text(task.get("completed_at"), 80),
                        run_id,
                    ),
                )
            else:
                version = int(
                    connection.execute(
                        "SELECT COALESCE(MAX(file_version),0)+1 FROM project_runs WHERE project_id=?",
                        (project_id,),
                    ).fetchone()[0]
                )
                connection.execute(
                    """
                    INSERT INTO project_runs(
                        run_id,project_id,source_type,source_task_id,input_filename,status,
                        stage,file_version,review_round,skill_id,skill_version,
                        skill_snapshot_json,inferred_name,created_at,updated_at,completed_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        run_id,
                        project_id,
                        source_type,
                        task_id,
                        _clean_text(task.get("submission_file_name") or task.get("file_name"), 240),
                        status,
                        _clean_text(task.get("stage"), 80),
                        version,
                        _int(task.get("review_round")),
                        _clean_text(task.get("skill_id"), 120),
                        _clean_text(task.get("skill_version"), 80),
                        _clean_text(task.get("skill_snapshot_json"), 20000) or "{}",
                        _clean_text(task.get("project_name"), 160),
                        created_at,
                        updated_at,
                        _clean_text(task.get("completed_at"), 80),
                    ),
                )
            connection.execute(
                """
                UPDATE projects SET status=?,latest_run_id=?,latest_version=?,
                skill_id=?,skill_version=?,updated_at=? WHERE project_id=?
                """,
                (
                    status,
                    run_id,
                    version,
                    _clean_text(task.get("skill_id"), 120),
                    _clean_text(task.get("skill_version"), 80),
                    updated_at,
                    project_id,
                ),
            )
        for artifact_type, key in (("excel", "task_excel_path"), ("excel", "submission_excel_path")):
            relative = _clean_text(task.get(key), 500)
            if relative:
                self.upsert_artifact(
                    project_id=project_id,
                    run_id=run_id,
                    artifact_type=artifact_type,
                    path=Path(feishu_runtime_root) / relative,
                    version=version,
                )
        return {
            "project_id": project_id,
            "run_id": run_id,
            "created_project": created_project,
            "status": status,
        }

    def _relative_runtime_reference(self, path: Path) -> str:
        candidate = Path(path).resolve()
        root = self.runtime_root.resolve()
        try:
            return candidate.relative_to(root).as_posix()
        except ValueError as exc:
            raise ProjectLedgerError("成果文件不在受控运行目录") from exc

    def upsert_artifact(
        self,
        *,
        project_id: str | None,
        run_id: str,
        artifact_type: str,
        path: Path,
        version: int,
    ) -> str:
        reference = self._relative_runtime_reference(path)
        display_name = Path(path).name
        timestamp = now_iso()
        artifact_id = f"art_{hashlib.sha256(f'{run_id}:{artifact_type}:{reference}'.encode('utf-8')).hexdigest()[:24]}"
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO project_artifacts(
                    artifact_id,project_id,run_id,artifact_type,display_name,
                    relative_runtime_reference,version,created_at,updated_at
                ) VALUES(?,?,?,?,?,?,?,?,?)
                ON CONFLICT(run_id,artifact_type,relative_runtime_reference)
                DO UPDATE SET project_id=excluded.project_id,display_name=excluded.display_name,
                version=excluded.version,updated_at=excluded.updated_at
                """,
                (
                    artifact_id,
                    project_id,
                    run_id,
                    artifact_type,
                    display_name,
                    reference,
                    max(1, int(version)),
                    timestamp,
                    timestamp,
                ),
            )
        return artifact_id

    def _artifact_path(self, reference: str) -> Path:
        candidate = (self.runtime_root / reference).resolve()
        root = self.runtime_root.resolve()
        try:
            candidate.relative_to(root)
        except ValueError as exc:
            raise ProjectArtifactNotFoundError("成果引用无效") from exc
        return candidate

    def get_artifact_path(self, project_id: str, artifact_id: str) -> Path:
        clean_project_id = validate_project_id(project_id)
        if not re.fullmatch(r"art_[a-f0-9]{24}", str(artifact_id or "")):
            raise ProjectArtifactNotFoundError("成果编号无效")
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT relative_runtime_reference FROM project_artifacts
                WHERE artifact_id=? AND project_id=?
                """,
                (artifact_id, clean_project_id),
            ).fetchone()
        if not row:
            raise ProjectArtifactNotFoundError("成果不存在")
        path = self._artifact_path(str(row["relative_runtime_reference"]))
        if not path.is_file():
            raise ProjectArtifactNotFoundError("成果文件已失效")
        return path

    def _public_artifact(self, row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
        reference = str(row["relative_runtime_reference"])
        exists = self._artifact_path(reference).is_file()
        project_id = str(row["project_id"] or "")
        artifact_id = str(row["artifact_id"])
        return {
            "artifact_id": artifact_id,
            "type": str(row["artifact_type"]),
            "display_name": str(row["display_name"]),
            "version": int(row["version"] or 1),
            "exists": exists,
            "created_at": str(row["created_at"]),
            "download_url": (
                f"/api/projects/{project_id}/artifacts/{artifact_id}/download"
                if exists and project_id
                else ""
            ),
        }

    def list_artifacts(self, project_id: str) -> list[dict[str, Any]]:
        clean_project_id = validate_project_id(project_id)
        self.get_project(clean_project_id)
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM project_artifacts WHERE project_id=?
                ORDER BY updated_at DESC, artifact_id DESC
                """,
                (clean_project_id,),
            ).fetchall()
        return [self._public_artifact(row) for row in rows]

    def list_runs(self, project_id: str) -> list[dict[str, Any]]:
        clean_project_id = validate_project_id(project_id)
        self.get_project(clean_project_id)
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM project_runs WHERE project_id=?
                ORDER BY updated_at DESC, run_id DESC
                """,
                (clean_project_id,),
            ).fetchall()
        return [self._public_run(row) for row in rows]

    def _public_run(self, row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
        return {
            "run_id": str(row["run_id"]),
            "job_id": str(row["job_id"] or ""),
            "source_type": str(row["source_type"]),
            "source_label": SOURCE_LABELS.get(str(row["source_type"]), "其他"),
            "input_filename": str(row["input_filename"] or ""),
            "status": str(row["status"]),
            "status_label": STATUS_LABELS.get(str(row["status"]), "处理中"),
            "stage": str(row["stage"] or ""),
            "input_rows": int(row["input_rows"] or 0),
            "matched_rows": int(row["matched_rows"] or 0),
            "standard_hit_rows": int(row["standard_hit_rows"] or 0),
            "experience_hint_rows": int(row["experience_hint_rows"] or 0),
            "review_rows": int(row["review_rows"] or 0),
            "warning_status": str(row["warning_status"]),
            "risk_high": int(row["risk_high"] or 0),
            "risk_low": int(row["risk_low"] or 0),
            "file_version": int(row["file_version"] or 1),
            "review_round": int(row["review_round"] or 0),
            "skill": {
                "id": str(row["skill_id"] or ""),
                "version": str(row["skill_version"] or ""),
            },
            "created_at": str(row["created_at"]),
            "updated_at": str(row["updated_at"]),
            "completed_at": str(row["completed_at"] or ""),
            "time_source": str(row["time_source"] or "recorded"),
        }

    def get_run(self, project_id: str, run_id: str) -> dict[str, Any]:
        clean_project_id = validate_project_id(project_id)
        if not re.fullmatch(r"run_[a-f0-9]{24}", str(run_id or "")):
            raise ProjectNotFoundError("任务编号无效")
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM project_runs WHERE run_id=? AND project_id=?",
                (run_id, clean_project_id),
            ).fetchone()
        if not row:
            raise ProjectNotFoundError("项目任务不存在")
        return dict(row)

    def get_project(self, project_id: str) -> dict[str, Any]:
        clean_project_id = validate_project_id(project_id)
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM projects WHERE project_id=? AND archived=0",
                (clean_project_id,),
            ).fetchone()
        if not row:
            raise ProjectNotFoundError("项目不存在")
        return dict(row)

    def project_detail(self, project_id: str) -> dict[str, Any]:
        project = self.get_project(project_id)
        runs = self.list_runs(project_id)
        artifacts = self.list_artifacts(project_id)
        latest = runs[0] if runs else None
        return {
            "project_id": project["project_id"],
            "project_name": project["project_name"],
            "project_code": project["project_code"],
            "source_type": project["source_type"],
            "source_label": SOURCE_LABELS.get(project["source_type"], "其他"),
            "status": project["status"],
            "status_label": STATUS_LABELS.get(project["status"], "处理中"),
            "skill": {
                "id": project["skill_id"],
                "version": project["skill_version"],
            },
            "latest_version": int(project["latest_version"] or 1),
            "created_at": project["created_at"],
            "updated_at": project["updated_at"],
            "latest_run": latest,
            "run_count": len(runs),
            "artifact_count": len(artifacts),
            "runs": runs,
            "artifacts": artifacts,
            "collaboration_summary": {
                "source": SOURCE_LABELS.get(project["source_type"], "网页上传"),
                "review_round": int(latest["review_round"] if latest else 0),
                "status": latest["status_label"] if latest else "暂无任务",
            },
        }

    def _raw_entries(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            projects = connection.execute(
                """
                SELECT p.*,r.run_id,r.job_id,r.input_filename,r.stage,
                r.input_rows,r.matched_rows,r.standard_hit_rows,r.experience_hint_rows,
                r.review_rows,r.warning_status,r.risk_high,r.risk_low,r.review_round,
                r.created_at AS run_created_at,r.updated_at AS run_updated_at
                FROM projects p
                LEFT JOIN project_runs r ON r.run_id=p.latest_run_id
                WHERE p.archived=0
                """
            ).fetchall()
            unclassified = connection.execute(
                """
                SELECT * FROM project_runs
                WHERE project_id IS NULL
                ORDER BY updated_at DESC
                """
            ).fetchall()
            artifact_rows = connection.execute(
                "SELECT * FROM project_artifacts ORDER BY updated_at DESC"
            ).fetchall()
        artifacts_by_project: dict[str, list[dict[str, Any]]] = {}
        artifacts_by_run: dict[str, list[dict[str, Any]]] = {}
        for row in artifact_rows:
            public = self._public_artifact(row)
            project_key = str(row["project_id"] or "")
            artifacts_by_project.setdefault(project_key, []).append(public)
            artifacts_by_run.setdefault(str(row["run_id"]), []).append(public)

        entries: list[dict[str, Any]] = []
        for row in projects:
            input_rows = int(row["input_rows"] or 0)
            matched_rows = int(row["matched_rows"] or 0)
            project_id = str(row["project_id"])
            entries.append(
                {
                    "record_type": "project",
                    "project_id": project_id,
                    "history_run_id": "",
                    "project_name": str(row["project_name"]),
                    "project_code": str(row["project_code"] or ""),
                    "source_type": str(row["source_type"]),
                    "source_label": SOURCE_LABELS.get(str(row["source_type"]), "其他"),
                    "status": str(row["status"]),
                    "status_label": STATUS_LABELS.get(str(row["status"]), "处理中"),
                    "skill": {
                        "id": str(row["skill_id"] or ""),
                        "version": str(row["skill_version"] or ""),
                    },
                    "input_rows": input_rows,
                    "matched_rows": matched_rows,
                    "standard_hit_rows": int(row["standard_hit_rows"] or 0),
                    "experience_hint_rows": int(row["experience_hint_rows"] or 0),
                    "review_rows": int(row["review_rows"] or 0),
                    "match_rate": round(matched_rows / input_rows * 100, 1) if input_rows else None,
                    "warning_status": str(row["warning_status"] or "not_run"),
                    "risk_high": int(row["risk_high"] or 0),
                    "risk_low": int(row["risk_low"] or 0),
                    "latest_version": int(row["latest_version"] or 1),
                    "review_round": int(row["review_round"] or 0),
                    "created_at": str(row["created_at"]),
                    "updated_at": str(row["updated_at"]),
                    "run_id": str(row["run_id"] or ""),
                    "job_id": str(row["job_id"] or ""),
                    "artifacts": artifacts_by_project.get(project_id, []),
                }
            )
        for row in unclassified:
            input_rows = int(row["input_rows"] or 0)
            matched_rows = int(row["matched_rows"] or 0)
            run_id = str(row["run_id"])
            entries.append(
                {
                    "record_type": "unclassified_task",
                    "project_id": "",
                    "history_run_id": run_id,
                    "project_name": str(row["inferred_name"] or "待归类历史任务"),
                    "project_code": "待归类历史任务",
                    "source_type": str(row["source_type"]),
                    "source_label": SOURCE_LABELS.get(str(row["source_type"]), "其他"),
                    "status": str(row["status"]),
                    "status_label": STATUS_LABELS.get(str(row["status"]), "处理中"),
                    "skill": {
                        "id": str(row["skill_id"] or ""),
                        "version": str(row["skill_version"] or ""),
                    },
                    "input_rows": input_rows,
                    "matched_rows": matched_rows,
                    "standard_hit_rows": int(row["standard_hit_rows"] or 0),
                    "experience_hint_rows": int(row["experience_hint_rows"] or 0),
                    "review_rows": int(row["review_rows"] or 0),
                    "match_rate": round(matched_rows / input_rows * 100, 1) if input_rows else None,
                    "warning_status": str(row["warning_status"]),
                    "risk_high": int(row["risk_high"] or 0),
                    "risk_low": int(row["risk_low"] or 0),
                    "latest_version": int(row["file_version"] or 1),
                    "review_round": int(row["review_round"] or 0),
                    "created_at": str(row["created_at"]),
                    "updated_at": str(row["updated_at"]),
                    "run_id": run_id,
                    "job_id": str(row["job_id"] or ""),
                    "artifacts": artifacts_by_run.get(run_id, []),
                    "time_source": str(row["time_source"] or "recorded"),
                }
            )
        return entries

    @staticmethod
    def _date_value(value: str) -> datetime | None:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None

    def filtered_entries(
        self,
        *,
        date_from: str = "",
        date_to: str = "",
        skill_id: str = "",
        status: str = "",
        source_type: str = "",
        keyword: str = "",
        risk: str = "",
        quality: str = "",
        lifecycle_stage: str = "",
    ) -> list[dict[str, Any]]:
        start = self._date_value(f"{date_from}T00:00:00") if date_from else None
        end = self._date_value(f"{date_to}T23:59:59.999999") if date_to else None
        query = keyword.strip().casefold()
        entries: list[dict[str, Any]] = []
        for item in self._raw_entries():
            created_at = self._date_value(str(item["created_at"]))
            if start and (not created_at or created_at.replace(tzinfo=None) < start):
                continue
            if end and (not created_at or created_at.replace(tzinfo=None) > end):
                continue
            if skill_id and item["skill"]["id"] != skill_id:
                continue
            if status and item["status"] != status:
                continue
            if source_type and item["source_type"] != source_type:
                continue
            if query and query not in (
                f"{item['project_name']} {item['project_code']} {item['project_id']}"
            ).casefold():
                continue
            if risk == "high" and int(item["risk_high"]) <= 0:
                continue
            if risk == "low" and int(item["risk_low"]) <= 0:
                continue
            if risk == "not_run" and item["warning_status"] != "not_run":
                continue
            if quality == "standard" and int(item["standard_hit_rows"]) <= 0:
                continue
            if quality == "experience" and int(item["experience_hint_rows"]) <= 0:
                continue
            if quality == "review" and int(item["review_rows"]) <= 0:
                continue
            if lifecycle_stage and not _lifecycle_stage_completed(item, lifecycle_stage):
                continue
            entries.append(item)
        return entries

    def list_projects(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "updated_at",
        sort_order: str = "desc",
        **filters: str,
    ) -> dict[str, Any]:
        entries = self.filtered_entries(**filters)
        allowed_sort = {
            "updated_at",
            "created_at",
            "project_name",
            "status",
            "match_rate",
            "risk_high",
            "review_rows",
        }
        sort_key = sort_by if sort_by in allowed_sort else "updated_at"
        reverse = sort_order != "asc"
        entries.sort(
            key=lambda item: (
                item.get(sort_key) is not None,
                item.get(sort_key) if item.get(sort_key) is not None else "",
            ),
            reverse=reverse,
        )
        size = max(1, min(100, int(page_size)))
        current_page = max(1, int(page))
        total = len(entries)
        start = (current_page - 1) * size
        return {
            "items": entries[start : start + size],
            "total": total,
            "page": current_page,
            "page_size": size,
            "pages": max(1, (total + size - 1) // size),
        }

    def dashboard(self, **filters: str) -> dict[str, Any]:
        entries = self.filtered_entries(**filters)
        projects = [item for item in entries if item["record_type"] == "project"]
        now = datetime.now().astimezone()
        month_key = now.strftime("%Y-%m")
        completed = [item for item in projects if item["status"] == "completed"]
        trend_granularity = "month"
        trend_start = self._date_value(
            f"{filters.get('date_from', '')}T00:00:00"
        ) if filters.get("date_from") else None
        trend_end = self._date_value(
            f"{filters.get('date_to', '')}T23:59:59"
        ) if filters.get("date_to") else None
        if trend_start and trend_end and 0 <= (trend_end - trend_start).days <= 45:
            trend_granularity = "day"
        trend: dict[str, dict[str, int]] = {}
        for item in projects:
            created = self._date_value(item["created_at"])
            if not created:
                continue
            key = created.strftime(
                "%Y-%m-%d" if trend_granularity == "day" else "%Y-%m"
            )
            bucket = trend.setdefault(key, {"new_projects": 0, "completed_projects": 0})
            bucket["new_projects"] += 1
            if item["status"] == "completed":
                bucket["completed_projects"] += 1
        trend_rows = [
            {"period": period, **values}
            for period, values in sorted(trend.items())[
                -(45 if trend_granularity == "day" else 12):
            ]
        ]
        status_rows = [
            {
                "status": status,
                "label": STATUS_LABELS[status],
                "count": sum(1 for item in projects if item["status"] == status),
            }
            for status in ("processing", "pending_review", "completed", "returned", "failed")
        ]
        source_rows = [
            {
                "source_type": source_type,
                "label": label,
                "count": sum(
                    1 for item in projects if item["source_type"] == source_type
                ),
            }
            for source_type, label in SOURCE_LABELS.items()
        ]
        risk_ranking = sorted(
            (
                {
                    "project_id": item["project_id"],
                    "project_name": item["project_name"],
                    "risk_high": item["risk_high"],
                    "risk_low": item["risk_low"],
                    "warning_status": item["warning_status"],
                }
                for item in projects
                if item["warning_status"] == "completed"
            ),
            key=lambda item: (item["risk_high"], item["risk_low"], item["project_name"]),
            reverse=True,
        )[:8]
        quality = {
            "standard_hit_rows": sum(int(item["standard_hit_rows"]) for item in projects),
            "experience_hint_rows": sum(int(item["experience_hint_rows"]) for item in projects),
            "review_rows": sum(int(item["review_rows"]) for item in projects),
        }
        quality["total_rows"] = sum(quality.values())
        lifecycle_funnel: list[dict[str, Any]] = []
        previous_count = len(projects)
        for index, (stage, label) in enumerate(LIFECYCLE_STAGES):
            count = sum(
                1 for item in projects if _lifecycle_stage_completed(item, stage)
            )
            lifecycle_funnel.append(
                {
                    "stage": stage,
                    "label": label,
                    "count": count,
                    "previous_count": previous_count if index else count,
                    "conversion_rate": (
                        100.0
                        if index == 0
                        else round(count / previous_count * 100, 1)
                        if previous_count
                        else 0.0
                    ),
                    "drop_off": 0 if index == 0 else max(0, previous_count - count),
                }
            )
            previous_count = count
        return {
            "kpis": {
                "total_projects": len(projects),
                "new_this_month": sum(
                    1 for item in projects if str(item["created_at"]).startswith(month_key)
                ),
                "completed": len(completed),
                "pending_review": sum(
                    1 for item in projects if item["status"] == "pending_review"
                ),
                "high_risk": sum(1 for item in projects if int(item["risk_high"]) > 0),
                "total_runs": len(entries),
                "unclassified_tasks": sum(
                    1 for item in entries if item["record_type"] == "unclassified_task"
                ),
                "warning_not_run": sum(
                    1 for item in projects if item["warning_status"] == "not_run"
                ),
            },
            "trend": trend_rows,
            "trend_granularity": trend_granularity,
            "status_distribution": status_rows,
            "source_distribution": source_rows,
            "lifecycle_funnel": lifecycle_funnel,
            "risk_ranking": risk_ranking,
            "matching_quality": quality,
            "filter_options": {
                "skills": sorted(
                    {
                        (item["skill"]["id"], item["skill"]["version"])
                        for item in self._raw_entries()
                        if item["skill"]["id"]
                    }
                ),
                "sources": [
                    {"value": source, "label": label}
                    for source, label in SOURCE_LABELS.items()
                ],
                "statuses": [
                    {"value": status, "label": label}
                    for status, label in STATUS_LABELS.items()
                ],
                "lifecycle_stages": [
                    {"value": stage, "label": label}
                    for stage, label in LIFECYCLE_STAGES
                ],
            },
            "generated_at": now_iso(),
        }

    def counts(self) -> dict[str, int]:
        with self._connect() as connection:
            return {
                "projects": int(connection.execute("SELECT COUNT(*) FROM projects").fetchone()[0]),
                "runs": int(connection.execute("SELECT COUNT(*) FROM project_runs").fetchone()[0]),
                "artifacts": int(
                    connection.execute("SELECT COUNT(*) FROM project_artifacts").fetchone()[0]
                ),
                "unclassified_tasks": int(
                    connection.execute(
                        "SELECT COUNT(*) FROM project_runs WHERE project_id IS NULL"
                    ).fetchone()[0]
                ),
            }

    def backfill_process_states(self, state_paths: Iterable[Path]) -> dict[str, int]:
        stats = {"scanned": 0, "recorded": 0, "failed": 0}
        for state_path in state_paths:
            stats["scanned"] += 1
            try:
                state = json.loads(state_path.read_text(encoding="utf-8"))
                if not isinstance(state, dict):
                    raise ValueError("状态文件格式无效")
                job_id = state_path.parent.name
                explicit_project_id = _clean_text(
                    state.get("project_id")
                    or _parse_json(state.get("project_relation")).get("project_id"),
                    80,
                )
                project_name = _clean_text(
                    state.get("project_name")
                    or _parse_json(state.get("project_relation")).get("project_name"),
                    160,
                )
                source_type = _clean_text(
                    state.get("source_type")
                    or _parse_json(state.get("project_relation")).get("source_type")
                    or "web",
                    40,
                )
                file_time = datetime.fromtimestamp(state_path.stat().st_mtime).astimezone().isoformat(
                    timespec="seconds"
                )
                self.record_process_state(
                    job_id=job_id,
                    state=state,
                    project_id=explicit_project_id or None,
                    project_name=project_name,
                    source_type=source_type,
                    create_project=bool(explicit_project_id and project_name),
                    created_at=_clean_text(state.get("created_at"), 80) or file_time,
                    time_source="recorded" if state.get("created_at") else "file_mtime_inferred",
                    create_missing_project_with_id=True,
                )
                stats["recorded"] += 1
            except (OSError, ValueError, json.JSONDecodeError, ProjectLedgerError):
                stats["failed"] += 1
        return stats
