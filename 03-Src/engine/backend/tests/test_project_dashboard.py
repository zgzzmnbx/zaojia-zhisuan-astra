from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main as main_module
from app.main import app
from app.project_dashboard import backfill_project_ledger
from app.project_ledger import (
    ProjectArtifactNotFoundError,
    ProjectLedger,
    ProjectLedgerError,
    ProjectNotFoundError,
)


def make_state(
    *,
    name: str = "测试项目.xlsx",
    matching_status: str = "completed",
    review_rows: int = 0,
    warning_executed: bool = False,
    high_rows: int = 0,
    low_rows: int = 0,
) -> dict[str, object]:
    return {
        "input_filename": name,
        "output_excel": "result.xlsx",
        "output_report": "report.docx",
        "skill_snapshot": {
            "id": "survey-measurement-limit-price",
            "version": "1.0.0",
        },
        "summary": {
            "total_data_rows": 10,
            "filled_rows": 10 - review_rows,
            "matched_rows": 10 - review_rows,
            "review_rows": review_rows,
            "physical_experience_rows": 2,
            "technical_experience_rows": 1,
            "matching_status": matching_status,
            "warning_summary": {
                "executed": warning_executed,
                "high_rows": high_rows,
                "low_rows": low_rows,
            },
        },
        "created_at": "2026-07-01T08:00:00+08:00",
        "updated_at": "2026-07-02T08:00:00+08:00",
    }


def make_ledger(tmp_path: Path) -> ProjectLedger:
    return ProjectLedger(tmp_path / "project-ledger.sqlite3", tmp_path / "runtime")


def record_project(
    ledger: ProjectLedger,
    *,
    job_id: str,
    project_id: str | None = None,
    project_name: str = "西气东输勘测项目",
    source_type: str = "web",
    state: dict[str, object] | None = None,
) -> dict[str, object]:
    runtime = ledger.runtime_root / job_id
    runtime.mkdir(parents=True, exist_ok=True)
    payload = state or make_state()
    (runtime / "result.xlsx").write_bytes(b"xlsx")
    (runtime / "report.docx").write_bytes(b"docx")
    return ledger.record_process_state(
        job_id=job_id,
        state=payload,
        project_id=project_id,
        project_name=project_name,
        source_type=source_type,
        create_project=True,
    )


def test_new_project_is_stable_and_same_job_updates_without_duplicate(tmp_path):
    ledger = make_ledger(tmp_path)
    first = record_project(ledger, job_id="job-1")
    second = record_project(
        ledger,
        job_id="job-1",
        project_id=str(first["project_id"]),
    )

    assert first["project_id"] == second["project_id"]
    assert first["run_id"] == second["run_id"]
    assert ledger.counts() == {
        "projects": 1,
        "runs": 1,
        "artifacts": 2,
        "unclassified_tasks": 0,
    }


def test_same_project_runs_versions_and_review_rounds_are_separate(tmp_path):
    ledger = make_ledger(tmp_path)
    first = record_project(ledger, job_id="job-1")
    record_project(
        ledger,
        job_id="job-2",
        project_id=str(first["project_id"]),
        state=make_state(review_rows=3),
    )

    detail = ledger.project_detail(str(first["project_id"]))
    assert detail["run_count"] == 2
    assert detail["latest_version"] == 2
    assert detail["latest_run"]["review_rows"] == 3
    assert detail["collaboration_summary"]["review_round"] == 0


def test_web_and_agent_sources_share_filtered_list_and_dashboard(tmp_path):
    ledger = make_ledger(tmp_path)
    record_project(ledger, job_id="web-job", project_name="网页项目", source_type="web")
    record_project(ledger, job_id="agent-job", project_name="会话项目", source_type="agent")

    agent_list = ledger.list_projects(source_type="agent")
    agent_dashboard = ledger.dashboard(source_type="agent")
    assert agent_list["total"] == 1
    assert agent_list["items"][0]["source_label"] == "智算助手"
    assert agent_dashboard["kpis"]["total_projects"] == 1
    all_dashboard = ledger.dashboard()
    assert next(
        item
        for item in all_dashboard["source_distribution"]
        if item["source_type"] == "web"
    )["count"] == 1
    assert next(
        item
        for item in all_dashboard["source_distribution"]
        if item["source_type"] == "agent"
    )["count"] == 1


def test_filters_are_shared_by_dashboard_and_history(tmp_path):
    ledger = make_ledger(tmp_path)
    record_project(
        ledger,
        job_id="review-job",
        project_name="待复核项目",
        state=make_state(review_rows=2),
    )
    record_project(ledger, job_id="done-job", project_name="已完成项目")

    history = ledger.list_projects(status="pending_review", keyword="待复核")
    dashboard = ledger.dashboard(status="pending_review", keyword="待复核")
    assert history["total"] == 1
    assert dashboard["kpis"]["total_projects"] == 1
    assert dashboard["kpis"]["pending_review"] == 1


def test_short_date_range_uses_real_daily_trend_buckets(tmp_path):
    ledger = make_ledger(tmp_path)
    first_state = make_state()
    first_state["created_at"] = "2026-07-01T08:00:00+08:00"
    second_state = make_state()
    second_state["created_at"] = "2026-07-02T08:00:00+08:00"
    record_project(ledger, job_id="day-1", project_name="第一日项目", state=first_state)
    record_project(ledger, job_id="day-2", project_name="第二日项目", state=second_state)

    daily = ledger.dashboard(date_from="2026-07-01", date_to="2026-07-31")
    monthly = ledger.dashboard()

    assert daily["trend_granularity"] == "day"
    assert [item["period"] for item in daily["trend"]] == [
        "2026-07-01",
        "2026-07-02",
    ]
    assert monthly["trend_granularity"] == "month"
    assert [item["period"] for item in monthly["trend"]] == ["2026-07"]


def test_quality_filter_is_shared_by_dashboard_and_history(tmp_path):
    ledger = make_ledger(tmp_path)
    record_project(
        ledger,
        job_id="experience-job",
        project_name="含经验提示项目",
        state=make_state(),
    )
    record_project(
        ledger,
        job_id="review-job",
        project_name="待复核项目",
        state=make_state(review_rows=2),
    )

    history = ledger.list_projects(quality="review")
    dashboard = ledger.dashboard(quality="review")
    assert history["total"] == 1
    assert history["items"][0]["project_name"] == "待复核项目"
    assert dashboard["kpis"]["total_projects"] == 1


def test_warning_not_run_is_not_counted_as_zero_risk(tmp_path):
    ledger = make_ledger(tmp_path)
    record_project(ledger, job_id="not-run")
    record_project(
        ledger,
        job_id="risk",
        project_name="高风险项目",
        state=make_state(warning_executed=True, high_rows=2, low_rows=1),
    )

    dashboard = ledger.dashboard()
    assert dashboard["kpis"]["warning_not_run"] == 1
    assert dashboard["kpis"]["high_risk"] == 1
    assert len(dashboard["risk_ranking"]) == 1


def test_lifecycle_funnel_is_cumulative_and_filters_history_with_same_contract(tmp_path):
    ledger = make_ledger(tmp_path)
    ledger.ensure_project(
        project_name="仅进入项目",
        source_type="web",
        skill_id="survey-measurement-limit-price",
        skill_version="1.0.0",
    )
    record_project(ledger, job_id="matched", project_name="完成匹配项目")
    record_project(
        ledger,
        job_id="warned",
        project_name="完成预警项目",
        state=make_state(warning_executed=True),
    )
    (ledger.runtime_root / "warned" / "report.docx").unlink()
    record_project(
        ledger,
        job_id="reported",
        project_name="生成报告项目",
        state=make_state(review_rows=2, warning_executed=True),
    )
    record_project(
        ledger,
        job_id="reviewed",
        project_name="完成复核项目",
        state=make_state(warning_executed=True),
    )

    dashboard = ledger.dashboard()
    funnel = dashboard["lifecycle_funnel"]
    assert [item["stage"] for item in funnel] == [
        "entered",
        "matched",
        "warned",
        "reported",
        "reviewed",
    ]
    assert [item["count"] for item in funnel] == [5, 4, 3, 2, 1]
    assert [item["conversion_rate"] for item in funnel] == [
        100.0,
        80.0,
        75.0,
        66.7,
        50.0,
    ]
    assert [item["drop_off"] for item in funnel] == [0, 1, 1, 1, 1]

    history = ledger.list_projects(lifecycle_stage="reported")
    filtered_dashboard = ledger.dashboard(lifecycle_stage="reported")
    assert history["total"] == 2
    assert {item["project_name"] for item in history["items"]} == {
        "生成报告项目",
        "完成复核项目",
    }
    assert filtered_dashboard["kpis"]["total_projects"] == 2


def test_dashboard_list_detail_and_run_result_api_contract(tmp_path, monkeypatch):
    ledger = make_ledger(tmp_path)
    relation = record_project(ledger, job_id="api-job")
    job_dir = ledger.runtime_root / "api-job"
    (job_dir / "process-state.json").write_text(
        json.dumps(make_state(), ensure_ascii=False),
        encoding="utf-8",
    )
    monkeypatch.setattr(main_module, "RUNTIME_DIR", ledger.runtime_root)
    monkeypatch.setattr(main_module, "_project_ledger", lambda: ledger)
    client = TestClient(app)

    dashboard_response = client.get("/api/projects/dashboard?source_type=web")
    list_response = client.get("/api/projects?source_type=web&page=1&page_size=20")
    assert dashboard_response.status_code == 200
    assert dashboard_response.json()["kpis"]["total_projects"] == 1
    assert [item["label"] for item in dashboard_response.json()["lifecycle_funnel"]] == [
        "项目进入",
        "完成匹配",
        "完成预警",
        "生成报告",
        "完成复核",
    ]
    assert dashboard_response.json()["llm_usage"] == {
        "available": True,
        "scope": "local_instance",
        "total_requests": 0,
        "successful_requests": 0,
        "failed_requests": 0,
        "historical_requests": 0,
        "model_count": 0,
        "trend_granularity": "month",
        "trend": [],
        "models": [],
        "tracked_from": "",
    }
    assert list_response.status_code == 200
    item = list_response.json()["items"][0]
    assert item["project_id"] == relation["project_id"]
    assert "absolute_path" not in json.dumps(item)

    detail_response = client.get(f"/api/projects/{relation['project_id']}")
    assert detail_response.status_code == 200
    assert detail_response.json()["run_count"] == 1

    result_response = client.get(
        f"/api/projects/{relation['project_id']}/runs/{relation['run_id']}/result"
    )
    assert result_response.status_code == 200
    result = result_response.json()
    assert result["job_id"] == "api-job"
    assert result["project_tracking"]["project_id"] == relation["project_id"]
    assert result["downloads"]["excel"].endswith("/excel")


def test_backfill_is_idempotent_and_keeps_unknown_tasks_unclassified(tmp_path):
    ledger = make_ledger(tmp_path)
    job_dir = ledger.runtime_root / "0123456789abcdef0123456789abcdef"
    job_dir.mkdir(parents=True)
    state = make_state(name="旧项目.xlsx")
    (job_dir / "process-state.json").write_text(
        json.dumps(state, ensure_ascii=False),
        encoding="utf-8",
    )
    (job_dir / "result.xlsx").write_bytes(b"xlsx")
    (job_dir / "report.docx").write_bytes(b"docx")

    first = backfill_project_ledger(
        ledger,
        runtime_root=ledger.runtime_root,
        include_unclassified_legacy=True,
    )
    second = backfill_project_ledger(
        ledger,
        runtime_root=ledger.runtime_root,
        include_unclassified_legacy=True,
    )
    assert first["totals"] == second["totals"]
    assert second["totals"]["projects"] == 0
    assert second["totals"]["runs"] == 1
    assert second["totals"]["unclassified_tasks"] == 1
    assert ledger.list_projects()["items"][0]["record_type"] == "unclassified_task"


def test_default_backfill_skips_legacy_state_without_project_identity(tmp_path):
    ledger = make_ledger(tmp_path)
    job_dir = ledger.runtime_root / "fedcba9876543210fedcba9876543210"
    job_dir.mkdir(parents=True)
    (job_dir / "process-state.json").write_text(
        json.dumps(make_state(name="待人工确认来源.xlsx"), ensure_ascii=False),
        encoding="utf-8",
    )

    result = backfill_project_ledger(ledger, runtime_root=ledger.runtime_root)

    assert result["process_states"]["scanned"] == 0
    assert result["process_states"]["skipped_without_project_identity"] == 1
    assert result["totals"]["runs"] == 0


def test_backfill_ignores_non_production_fixture_directories(tmp_path):
    ledger = make_ledger(tmp_path)
    fixture_dir = ledger.runtime_root / "api-test-fixture"
    fixture_dir.mkdir(parents=True)
    (fixture_dir / "process-state.json").write_text(
        json.dumps(make_state(name="测试夹具.xlsx"), ensure_ascii=False),
        encoding="utf-8",
    )

    result = backfill_project_ledger(ledger, runtime_root=ledger.runtime_root)

    assert result["process_states"]["scanned"] == 0
    assert result["totals"]["runs"] == 0
    assert result["totals"]["unclassified_tasks"] == 0


def test_artifact_existence_is_refreshed_and_missing_download_fails_closed(tmp_path):
    ledger = make_ledger(tmp_path)
    relation = record_project(ledger, job_id="job-1")
    project_id = str(relation["project_id"])
    artifacts = ledger.list_artifacts(project_id)
    assert all(item["exists"] for item in artifacts)

    (ledger.runtime_root / "job-1" / "report.docx").unlink()
    refreshed = ledger.list_artifacts(project_id)
    word = next(item for item in refreshed if item["type"] == "word")
    assert word["exists"] is False
    assert word["download_url"] == ""
    with pytest.raises(ProjectArtifactNotFoundError):
        ledger.get_artifact_path(project_id, word["artifact_id"])


def test_malicious_project_and_artifact_identifiers_fail_closed(tmp_path, monkeypatch):
    runtime = tmp_path / "runtime"
    monkeypatch.setattr(main_module, "RUNTIME_DIR", runtime)
    client = TestClient(app)

    assert client.get("/api/projects/..%2F..%2Fsecret").status_code == 404
    assert (
        client.get(
            "/api/projects/prj_000000000000000000000000/artifacts/..%2Fsecret/download"
        ).status_code
        == 404
    )


def test_project_ledger_failure_does_not_corrupt_process_state(tmp_path, monkeypatch):
    job_dir = tmp_path / "runtime" / "job-1"
    job_dir.mkdir(parents=True)
    state = make_state()
    (job_dir / "process-state.json").write_text(
        json.dumps(state, ensure_ascii=False),
        encoding="utf-8",
    )

    def fail_ledger():
        raise ProjectLedgerError("database unavailable")

    monkeypatch.setattr(main_module, "_project_ledger", fail_ledger)
    result = main_module._sync_project_ledger(
        job_dir,
        project_id=None,
        project_name="测试项目",
        source_type="web",
        create_project=True,
    )
    assert result["status"] == "unavailable"
    persisted = json.loads((job_dir / "process-state.json").read_text(encoding="utf-8"))
    assert persisted["summary"] == state["summary"]


def test_unknown_project_id_cannot_be_bound_to_new_run(tmp_path):
    ledger = make_ledger(tmp_path)
    with pytest.raises(ProjectNotFoundError):
        record_project(
            ledger,
            job_id="job-1",
            project_id="prj_000000000000000000000000",
        )
