from __future__ import annotations

import json
import sqlite3

import pytest

from app.business_tasks import (
    BusinessTaskConflict,
    BusinessTaskError,
    BusinessTaskStore,
)
from app import main as main_module
from fastapi.testclient import TestClient


def _task(store: BusinessTaskStore, **overrides):
    values = {
        "identity_key": "web:objective-a:survey:1.0",
        "project_id": "prj_aaaaaaaaaaaaaaaaaaaaaaaa",
        "source_type": "web",
        "source_reference": "SRC-001",
        "task_name": "控制价辅助填价",
        "objective": "形成可复核的 Excel 与 Word 成果",
        "definition": {
            "expected_artifacts": ["excel", "word"],
            "success_criteria": ["规则处理完成"],
            "human_gates": ["冲突项人工复核"],
            "collaboration_required": False,
        },
        "skill_snapshot": {
            "id": "survey-measurement-v1",
            "display_name": "长输管道勘察测量控制价编制",
            "version": "1.0.0",
            "manifest_hash": "a" * 64,
        },
        "input_snapshot": {
            "reference": "输入.xlsx",
            "type": "xlsx",
            "version": 1,
            "sha256": "b" * 64,
        },
        "responsibility": {},
    }
    values.update(overrides)
    return store.ensure_task(**values)


def test_stable_identity_links_and_replay_are_idempotent(tmp_path):
    store = BusinessTaskStore(tmp_path / "tasks.sqlite3")
    first, created = _task(store)
    repeated, repeated_created = _task(store)

    assert created is True
    assert repeated_created is False
    assert first["task_id"] == repeated["task_id"]

    store.link(first["task_id"], "job_id", "a" * 32, source_system="professional")
    store.link(first["task_id"], "job_id", "a" * 32, source_system="professional")
    store.link(first["task_id"], "run_id", "run_" + "b" * 24, source_system="project_ledger")
    store.link(first["task_id"], "collaboration_task_id", "FS-20260812-0001", source_system="external_dispatch")
    store.link(first["task_id"], "source_task_id", "SRC-001", source_system="web:survey:1.0")

    current = store.get_task(first["task_id"])
    assert {link["link_type"] for link in current["links"]} == {
        "job_id", "run_id", "collaboration_task_id", "source_task_id",
    }
    assert store.find_by_link("job_id", "a" * 32, source_system="professional")["task_id"] == first["task_id"]


def test_definition_skill_and_input_snapshot_cannot_drift(tmp_path):
    store = BusinessTaskStore(tmp_path / "tasks.sqlite3")
    _task(store)

    with pytest.raises(BusinessTaskConflict, match="不可漂移"):
        _task(store, objective="偷偷改变目标", definition={"expected_artifacts": ["excel"]})
    with pytest.raises(BusinessTaskConflict, match="不可漂移"):
        _task(store, skill_snapshot={"id": "other", "version": "2.0.0"})
    with pytest.raises(BusinessTaskConflict, match="不可漂移"):
        _task(store, input_snapshot={"reference": "另一个.xlsx", "type": "xlsx", "version": 2, "sha256": "c" * 64})


def test_skill_or_reliable_source_change_creates_new_task(tmp_path):
    store = BusinessTaskStore(tmp_path / "tasks.sqlite3")
    original, _ = _task(store)
    changed_source, _ = _task(store, identity_key="web:objective-b:survey:1.0", source_reference="SRC-002")
    changed_skill, _ = _task(
        store,
        identity_key="web:objective-a:survey:2.0",
        skill_snapshot={
            "id": "survey-measurement-v1", "display_name": "专业 Skill",
            "version": "2.0.0", "manifest_hash": "d" * 64,
        },
    )
    assert len({original["task_id"], changed_source["task_id"], changed_skill["task_id"]}) == 3
    assert store.get_task(original["task_id"])["skill_snapshot"]["version"] == "1.0.0"


def test_timeline_preserves_real_status_and_truthful_placeholders(tmp_path):
    store = BusinessTaskStore(tmp_path / "tasks.sqlite3")
    task, _ = _task(store)
    store.record_event(
        task["task_id"], event_key="defined", event_type="task_defined", status="completed",
        source_module="business_tasks", occurred_at="2026-08-12T10:00:00+08:00",
    )
    store.record_event(
        task["task_id"], event_key="risk-failed", event_type="risk_checked", status="failed",
        source_module="experience_warning", detail="规则文件不可用，可重试。",
        occurred_at="2026-08-12T10:01:00+08:00",
    )
    timeline = store.timeline(task["task_id"])
    by_type = {item["event_type"]: item for item in timeline["items"]}

    assert by_type["task_defined"]["status"] == "completed"
    assert by_type["risk_checked"]["status"] == "failed"
    assert by_type["rules_executed"]["status"] == "not_run"
    assert by_type["collaboration_completed"]["status"] == "not_applicable"
    assert by_type["experience_governed"]["status"] == "no_candidate"
    assert timeline["actual_event_count"] == 2


def test_round_version_project_listing_and_old_unclassified_task(tmp_path):
    store = BusinessTaskStore(tmp_path / "tasks.sqlite3")
    task, _ = _task(store)
    store.update_progress(
        task["task_id"], status="returned", stage="human_reviewed",
        current_run_id="run_" + "a" * 24, artifact_version=2, review_round=1,
    )
    resubmitted = store.update_progress(
        task["task_id"], status="pending_review", stage="human_reviewed",
        current_run_id="run_" + "b" * 24, artifact_version=3, review_round=2,
    )
    unclassified, _ = _task(
        store,
        identity_key="legacy:without-reliable-project",
        project_id="",
        source_reference="",
        classification_status="pending_classification",
    )

    assert resubmitted["task_id"] == task["task_id"]
    assert (resubmitted["review_round"], resubmitted["artifact_version"]) == (2, 3)
    assert store.list_project_tasks("prj_aaaaaaaaaaaaaaaaaaaaaaaa")[0]["task_id"] == task["task_id"]
    assert unclassified["classification_status"] == "pending_classification"
    assert unclassified["project_id"] == ""


def test_security_rejects_malicious_references_and_sanitizes_payload(tmp_path):
    store = BusinessTaskStore(tmp_path / "tasks.sqlite3")
    task, _ = _task(store)
    with pytest.raises(BusinessTaskError):
        store.link(task["task_id"], "job_id", "../../secret", source_system="professional")
    with pytest.raises(BusinessTaskError):
        store.record_event(
            task["task_id"], event_key="bad", event_type="artifact_generated", status="completed",
            source_module="report", reference_id="C:\\secret\\result.docx",
        )

    event = store.record_event(
        task["task_id"], event_key="safe", event_type="artifact_generated", status="completed",
        source_module="report", payload={
            "app_secret": "must-not-leak", "token": "must-not-leak",
            "path": "C:\\private\\result.docx", "tool": "write_report",
        },
    )
    encoded = json.dumps(event, ensure_ascii=False)
    assert "must-not-leak" not in encoded
    assert "C:\\private" not in encoded
    assert "result.docx" in encoded


def _write_process_state(runtime_dir, *, job_id="f" * 32, skill_version="1.0.0", manifest_hash="a" * 64):
    job_dir = runtime_dir / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    (job_dir / "输入.xlsx").write_bytes(b"input-v1")
    (job_dir / "输出.xlsx").write_bytes(b"excel-v1")
    (job_dir / "输出.docx").write_bytes(b"word-v1")
    state = {
        "input_filename": "输入.xlsx",
        "input_excel": "输入.xlsx",
        "output_excel": "输出.xlsx",
        "output_report": "输出.docx",
        "summary": {"total_data_rows": 12, "filled_rows": 10, "review_rows": 2, "matching_status": "completed"},
        "skill_snapshot": {
            "id": "survey-measurement-v1",
            "display_name": "长输管道勘察测量控制价编制",
            "version": skill_version,
            "manifest_hash": manifest_hash,
            "created_at": "2026-08-12T10:00:00+08:00",
            "runtime_context": {
                "processor_id": "survey-measurement-v1",
                "capabilities": {"pricing": True, "wordReport": True},
                "rule_assets": {"technicalRules": ["rules.xlsx"]},
                "knowledge_sources": ["rules.md"],
            },
        },
        "project_relation": {
            "project_id": "prj_aaaaaaaaaaaaaaaaaaaaaaaa",
            "project_name": "集成测试项目",
            "source_type": "web",
            "run_id": "run_" + job_id[:24],
        },
        "project_id": "prj_aaaaaaaaaaaaaaaaaaaaaaaa",
        "project_name": "集成测试项目",
        "source_type": "web",
        "created_at": "2026-08-12T10:00:00+08:00",
        "updated_at": "2026-08-12T10:01:00+08:00",
    }
    (job_dir / main_module.PROCESS_STATE_FILENAME).write_text(
        json.dumps(state, ensure_ascii=False), encoding="utf-8"
    )
    return job_dir


def test_job_sync_api_and_artifact_refresh_keep_one_task(tmp_path, monkeypatch):
    runtime_dir = tmp_path / "runtime"
    monkeypatch.setattr(main_module, "RUNTIME_DIR", runtime_dir)
    job_dir = _write_process_state(runtime_dir)

    first = main_module._sync_business_task_from_job(job_dir, activity="process_completed")
    repeated = main_module._sync_business_task_from_job(job_dir, activity="process_completed")
    task_id = first["task"]["task_id"]
    assert first["created"] is True
    assert repeated["created"] is False
    assert repeated["task"]["task_id"] == task_id
    assert repeated["task"]["artifact_version"] == 1

    (job_dir / "输出.docx").write_bytes(b"word-v2")
    refreshed = main_module._sync_business_task_from_job(job_dir, activity="recalculate")
    assert refreshed["task"]["task_id"] == task_id
    assert refreshed["task"]["artifact_version"] == 2

    client = TestClient(main_module.app)
    detail = client.get(f"/api/tasks/{task_id}")
    timeline = client.get(f"/api/tasks/{task_id}/timeline")
    project_tasks = client.get("/api/projects/prj_aaaaaaaaaaaaaaaaaaaaaaaa/tasks")
    assert detail.status_code == timeline.status_code == project_tasks.status_code == 200
    assert detail.json()["task_id"] == task_id
    assert detail.json()["lineage"]["tools"] == [
        "FillEngine.fill_workbook", "FillEngine.inspect_workbook",
        "ProfessionalSkillRegistry.create_snapshot", "UploadFile", "report.write_report",
    ]
    assert project_tasks.json()["count"] == 1
    assert client.get("/api/tasks/../../secret").status_code in {404, 422}

    with sqlite3.connect(runtime_dir / "business-tasks.sqlite3") as connection:
        assert connection.execute("SELECT COUNT(*) FROM business_tasks").fetchone()[0] == 1


def test_skill_change_starts_new_business_task_and_aggregator_failure_degrades(tmp_path, monkeypatch):
    runtime_dir = tmp_path / "runtime"
    monkeypatch.setattr(main_module, "RUNTIME_DIR", runtime_dir)
    job_dir = _write_process_state(runtime_dir)
    first = main_module._sync_business_task_from_job(job_dir, activity="process_completed")

    changed_job_dir = _write_process_state(
        runtime_dir, job_id="d" * 32, skill_version="2.0.0", manifest_hash="c" * 64,
    )
    changed = main_module._sync_business_task_from_job(changed_job_dir, activity="process_completed")
    assert changed["task"]["task_id"] != first["task"]["task_id"]
    assert main_module._business_task_store().get_task(first["task"]["task_id"])["skill_snapshot"]["version"] == "1.0.0"

    def fail_store():
        raise sqlite3.OperationalError("database unavailable")

    monkeypatch.setattr(main_module, "_business_task_store", fail_store)
    degraded = main_module._sync_business_task_from_job(job_dir, activity="recalculate")
    assert degraded["status"] == "unavailable"
    assert degraded["message"] == "专业处理已继续，但任务轨迹暂不可用。"


def test_risk_report_closes_business_task_as_completed():
    status, stage = main_module._task_status_from_state({}, "risk_report")

    assert status == "completed"
    assert stage == "artifact_generated"


def test_restoring_project_run_does_not_regress_completed_task(tmp_path, monkeypatch):
    runtime_dir = tmp_path / "runtime"
    monkeypatch.setattr(main_module, "RUNTIME_DIR", runtime_dir)
    job_dir = _write_process_state(runtime_dir)

    completed = main_module._sync_business_task_from_job(job_dir, activity="risk_report")
    restored = main_module._sync_business_task_from_job(job_dir, activity="restore")

    assert completed["task"]["status"] == "completed"
    assert completed["task"]["stage"] == "artifact_generated"
    assert restored["task"]["status"] == "completed"
    assert restored["task"]["stage"] == "artifact_generated"
