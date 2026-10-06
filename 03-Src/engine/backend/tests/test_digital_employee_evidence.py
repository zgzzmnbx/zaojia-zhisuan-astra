from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.digital_employee_evidence import build_onboarding_evidence
from backend.app import main as main_module
from backend.app.main import app


ACTIVE_SKILL = {
    "id": "survey-measurement-limit-price",
    "display_name": "勘察测量最高投标限价编制",
    "version": "1.0.0",
    "status": "active",
    "status_label": "已上线",
    "domain": "工程造价/勘察测量",
    "description": "确定性专业能力",
    "can_create_task": True,
    "capabilities": ["三数字匹配", "经验池预警", "知识库问答", "Word 报告", "智能协同"],
    "input_profile": {"extensions": [".xlsx"], "templateHints": ["要素1-5、单位和三个数字"]},
    "applicability": {
        "includes": ["长输管道勘察测量最高投标限价编制"],
        "excludes": ["由大模型直接生成最终价格或调整系数"],
    },
    "sub_skills": [
        {"name": "造价规则匹配 Skill", "description": "确定性规则", "type": "shared", "status": "available"}
    ],
    "asset_summary": [{"id": "knowledgeBase", "name": "结构化计价库", "count": 1}],
    "validation": {"status": "verified", "sample": "V3.1", "updatedAt": "2026-08-13", "limitations": []},
    "boundary": "规则裁决、模型解释、人工兜底。",
}


def test_active_skill_evidence_keeps_real_lineage_and_redacts_sensitive_fields() -> None:
    tasks = [
        {
            "task_id": "tsk_1234567890abcdef12345678",
            "task_name": "V3.1 正式回归",
            "objective": "完成控制价编制并输出正式成果",
            "source": {"type": "web", "reference": "platform-user-7788"},
            "status": "completed",
            "status_label": "已完成",
            "stage": "artifact_generated",
            "stage_label": "成果已生成",
            "updated_at": "2026-08-13T09:44:37+08:00",
            "skill_snapshot": {
                "id": "survey-measurement-limit-price",
                "display_name": "勘察测量最高投标限价编制",
                "version": "1.0.0",
                "manifest_hash": "a" * 64,
            },
            "input_snapshot": {"reference": "C:/secret/input.xlsx", "sha256": "b" * 64},
            "definition": {"success_criteria": ["输出 Excel 和 Word"], "human_gates": ["异常人工复核"]},
            "responsibility": {
                "participants": [{"role": "复核人", "name": "个人姓名", "status": "completed"}]
            },
            "lineage": {
                "tools": ["FillEngine.match_workbook", "ReportWriter.write"],
                "artifacts": [
                    {
                        "artifact_id": "art_1",
                        "type": "excel",
                        "display_name": "控制价计算表.xlsx",
                        "version": 3,
                        "exists": True,
                        "download_url": "/api/projects/artifacts/art_1/download",
                        "absolute_path": "D:/secret/output.xlsx",
                    }
                ],
                "collaboration": [
                    {
                        "task_id": "external-platform-id",
                        "status": "completed",
                        "status_label": "已完成",
                        "review_round": 2,
                        "participants": [{"name": "个人姓名", "role": "审核人", "status": "approved"}],
                    }
                ],
                "experience_events": [
                    {
                        "id": "texp_1",
                        "event_type": "cell_edit",
                        "capture_status": "captured",
                        "candidate_id": "km_1",
                        "governance_status": "candidate",
                        "created_at": "2026-08-13T09:45:00+08:00",
                    },
                    {
                        "id": "texp_2",
                        "event_type": "review_opinion",
                        "capture_status": "captured",
                        "candidate_id": "km_2",
                        "governance_status": "revoked",
                        "created_at": "2026-08-13T09:46:00+08:00",
                    },
                ],
            },
        }
    ]
    validation = {
        "status": "passed",
        "verified_at": "2026-08-13T09:44:37+08:00",
        "baseline": "V3.1 正式成对验收",
        "sample": "V3.1 输入样例",
        "facts": {
            "compared_target_cells": 1254,
            "three_number_difference_count": 0,
            "word_business_core_difference_count": 0,
        },
        "limitations": ["不代表全场景准确率承诺"],
    }

    payload = build_onboarding_evidence(
        skill=ACTIVE_SKILL,
        tasks=tasks,
        validation_evidence=validation,
        experience_metrics={
            "candidate_sources": 2,
            "events": {"cell_edit": 1, "review_opinion": 1},
            "governance": {"confirmed": 0, "rejected": 0, "revoked": 1},
            "retrieval_hits": 0,
            "version_corrections": 0,
            "suspected_stale": 0,
        },
        generated_at="2026-08-13T10:00:00+08:00",
    )

    assert payload["readiness"]["status"] == "on_duty"
    assert payload["task_evidence"]["state"] == "available"
    assert payload["task_evidence"]["items"][0]["skill_snapshot"]["frozen"] is True
    assert payload["task_evidence"]["items"][0]["experience"][0]["governance_status"] == "candidate"
    assert payload["task_evidence"]["items"][0]["experience"][1]["governance_status"] == "revoked"
    assert payload["formal_validation"]["facts"]["compared_target_cells"] == 1254
    rendered = json.dumps(payload, ensure_ascii=False)
    assert "C:/secret" not in rendered
    assert "D:/secret" not in rendered
    assert "platform-user-7788" not in rendered
    assert "external-platform-id" not in rendered
    assert "个人姓名" not in rendered
    assert "a" * 64 not in rendered
    assert "b" * 64 not in rendered


def test_planned_skill_is_honest_and_cannot_create_task() -> None:
    planned = {
        **ACTIVE_SKILL,
        "id": "general-service-cost-estimation",
        "display_name": "通用服务类造价测算",
        "version": "0.1.0",
        "status": "planned",
        "status_label": "规划中",
        "can_create_task": False,
        "capabilities": [],
        "asset_summary": [],
        "validation": {
            "status": "not_started",
            "sample": "尚未提供",
            "limitations": ["缺少独立业务资料、确定性规则、成果模板和验证样例"],
        },
    }

    payload = build_onboarding_evidence(
        skill=planned,
        tasks=[],
        validation_evidence={},
        experience_metrics={},
        generated_at="2026-08-13T10:00:00+08:00",
    )

    assert payload["readiness"]["status"] == "insufficient"
    assert payload["actions"]["can_create_task"] is False
    assert payload["task_evidence"]["state"] == "not_applicable"
    assert payload["incomplete_items"]
    assert payload["formal_validation"]["status"] == "not_started"


def test_active_skill_without_task_uses_empty_state_instead_of_fake_counts() -> None:
    payload = build_onboarding_evidence(
        skill=ACTIVE_SKILL,
        tasks=[],
        validation_evidence={"status": "passed", "facts": {}},
        experience_metrics={},
        generated_at="2026-08-13T10:00:00+08:00",
    )

    assert payload["readiness"]["status"] == "on_duty"
    assert payload["task_evidence"] == {
        "state": "empty",
        "count": 0,
        "message": "当前运行库尚无该 Skill 的真实 Task；不会用演示任务补位。",
        "items": [],
    }
    assert payload["relationship"][0]["evidence_count"] == 0


def test_onboarding_evidence_api_degrades_to_honest_empty_state_and_never_leaks_paths(tmp_path, monkeypatch) -> None:
    runtime_dir = tmp_path / "runtime"
    monkeypatch.setattr(main_module, "RUNTIME_DIR", runtime_dir)
    monkeypatch.setattr(main_module, "DEFAULT_KNOWLEDGE_MEMORY_DB_PATH", runtime_dir / "knowledge-memory.sqlite3")

    with TestClient(app) as client:
        active = client.get("/api/professional-skills/survey-measurement-limit-price/onboarding-evidence")
        planned = client.get("/api/professional-skills/general-service-cost-estimation/onboarding-evidence")

    assert active.status_code == planned.status_code == 200
    assert active.json()["task_evidence"]["state"] == "empty"
    assert active.json()["formal_validation"]["facts"]["compared_target_cells"] == 1254
    assert planned.json()["readiness"]["status"] == "insufficient"
    assert planned.json()["actions"]["can_create_task"] is False
    combined = active.text + planned.text
    assert str(Path.cwd()) not in combined
    assert "manifest_hash" not in combined
    assert "platform_profile_id" not in combined
