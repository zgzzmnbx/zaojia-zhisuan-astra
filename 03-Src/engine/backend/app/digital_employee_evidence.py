from __future__ import annotations

from collections import Counter
from datetime import datetime
from pathlib import PurePath
from typing import Any


DISCLAIMER = "本证据包不代表生产级统一身份、组织授权或全场景准确率承诺。"
POSITION_NAME = "长输管道勘察测量最高投标限价编制数智员工"


def _text(value: object, limit: int = 500) -> str:
    return str(value or "").strip()[:limit]


def _safe_name(value: object) -> str:
    text = _text(value, 240).replace("\\", "/")
    return PurePath(text).name if text else ""


def _string_list(value: object, *, limit: int = 30) -> list[str]:
    if not isinstance(value, list):
        return []
    return [_text(item, 300) for item in value[:limit] if _text(item, 300)]


def _safe_download_url(value: object) -> str:
    text = _text(value, 500)
    if not text.startswith("/api/") or ".." in text or "://" in text:
        return ""
    return text


def _safe_artifact(item: object) -> dict[str, object] | None:
    if not isinstance(item, dict):
        return None
    display_name = _safe_name(item.get("display_name"))
    if not display_name:
        return None
    return {
        "type": _text(item.get("type"), 40) or "file",
        "display_name": display_name,
        "version": max(0, int(item.get("version") or 0)),
        "exists": bool(item.get("exists")),
        "download_url": _safe_download_url(item.get("download_url")),
    }


def _status_counts(items: object) -> dict[str, int]:
    if not isinstance(items, list):
        return {}
    counter = Counter(
        _text(item.get("status"), 60) or "unknown"
        for item in items
        if isinstance(item, dict)
    )
    return dict(sorted(counter.items()))


def _safe_task(task: object) -> dict[str, object] | None:
    if not isinstance(task, dict):
        return None
    task_id = _text(task.get("task_id"), 80)
    if not task_id.startswith("tsk_"):
        return None
    snapshot = task.get("skill_snapshot") if isinstance(task.get("skill_snapshot"), dict) else {}
    definition = task.get("definition") if isinstance(task.get("definition"), dict) else {}
    responsibility = task.get("responsibility") if isinstance(task.get("responsibility"), dict) else {}
    participants = responsibility.get("participants") if isinstance(responsibility.get("participants"), list) else []
    lineage = task.get("lineage") if isinstance(task.get("lineage"), dict) else {}
    artifacts = [artifact for item in lineage.get("artifacts", []) if (artifact := _safe_artifact(item))]
    reviews: list[dict[str, object]] = []
    for item in lineage.get("collaboration", []) if isinstance(lineage.get("collaboration"), list) else []:
        if not isinstance(item, dict):
            continue
        reviews.append(
            {
                "status_label": _text(item.get("status_label"), 80) or "状态未登记",
                "review_round": max(0, int(item.get("review_round") or 0)),
                "participant_statuses": _status_counts(item.get("participants")),
            }
        )
    experience: list[dict[str, object]] = []
    for item in lineage.get("experience_events", []) if isinstance(lineage.get("experience_events"), list) else []:
        if not isinstance(item, dict):
            continue
        experience.append(
            {
                "event_type": _text(item.get("event_type"), 60),
                "capture_status": _text(item.get("capture_status"), 60) or "unknown",
                "governance_status": _text(item.get("governance_status"), 60) or "candidate",
                "created_at": _text(item.get("created_at"), 80),
            }
        )
    roles = sorted(
        {
            _text(item.get("role"), 80)
            for item in participants
            if isinstance(item, dict) and _text(item.get("role"), 80)
        }
    )
    return {
        "task_id": task_id,
        "task_name": _text(task.get("task_name"), 180) or "未命名 Task",
        "objective": _text(task.get("objective"), 500),
        "source_type": _text((task.get("source") or {}).get("type"), 60)
        if isinstance(task.get("source"), dict)
        else "",
        "status": _text(task.get("status"), 60),
        "status_label": _text(task.get("status_label"), 80) or "状态未登记",
        "stage": _text(task.get("stage"), 80),
        "stage_label": _text(task.get("stage_label"), 100) or "阶段未登记",
        "updated_at": _text(task.get("updated_at"), 80),
        "skill_snapshot": {
            "id": _text(snapshot.get("id"), 100),
            "version": _text(snapshot.get("version"), 40),
            "frozen": bool(snapshot.get("id") and snapshot.get("version")),
        },
        "success_criteria": _string_list(definition.get("success_criteria"), limit=20),
        "human_gates": _string_list(definition.get("human_gates"), limit=20),
        "tools": _string_list(lineage.get("tools"), limit=30),
        "artifacts": artifacts,
        "reviews": reviews,
        "experience": experience,
        "responsibility": {
            "registered_count": len(participants),
            "roles": roles,
            "status_counts": _status_counts(participants),
        },
    }


def _validation_payload(skill: dict[str, Any], evidence: dict[str, Any]) -> dict[str, object]:
    manifest_validation = skill.get("validation") if isinstance(skill.get("validation"), dict) else {}
    raw_facts = evidence.get("facts") if isinstance(evidence.get("facts"), dict) else {}
    facts: dict[str, object] = {}
    for key, value in raw_facts.items():
        if isinstance(value, (bool, int, float)) or value is None:
            facts[_text(key, 100)] = value
        elif isinstance(value, str) and len(value) <= 300 and not any(token in value for token in ("\\", "/", "://")):
            facts[_text(key, 100)] = value
    return {
        "status": _text(evidence.get("status"), 40)
        or _text(manifest_validation.get("status"), 40)
        or "not_started",
        "baseline": _text(evidence.get("baseline"), 160) or "尚未形成正式成对验收事实",
        "verified_at": _text(evidence.get("verified_at"), 80)
        or _text(manifest_validation.get("updatedAt"), 80),
        "sample": _safe_name(evidence.get("sample"))
        or _safe_name(manifest_validation.get("sample"))
        or "尚未提供",
        "facts": facts,
        "limitations": _string_list(evidence.get("limitations"), limit=20)
        or _string_list(manifest_validation.get("limitations"), limit=20),
    }


def _deduplicate(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def build_onboarding_evidence(
    *,
    skill: dict[str, Any],
    tasks: list[dict[str, Any]],
    validation_evidence: dict[str, Any],
    experience_metrics: dict[str, Any],
    generated_at: str | None = None,
    aggregation_warnings: list[str] | None = None,
) -> dict[str, object]:
    safe_tasks = [item for task in tasks if (item := _safe_task(task))]
    formal_validation = _validation_payload(skill, validation_evidence)
    can_create_task = bool(skill.get("can_create_task"))
    validation_passed = formal_validation["status"] in {"passed", "verified"}
    readiness_status = "on_duty" if can_create_task and validation_passed else "limited" if can_create_task else "insufficient"
    readiness_label = {
        "on_duty": "具备上岗证据",
        "limited": "有限上岗证据",
        "insufficient": "尚不具备上岗条件",
    }[readiness_status]
    task_count = len(safe_tasks)
    tool_count = len({tool for task in safe_tasks for tool in task["tools"]})
    artifact_count = sum(len(task["artifacts"]) for task in safe_tasks)
    experience_count = sum(len(task["experience"]) for task in safe_tasks)
    enabled_sub_skills = [
        item
        for item in skill.get("sub_skills", [])
        if isinstance(item, dict) and item.get("status") in {"available", "planned"}
    ]
    scope = skill.get("applicability") if isinstance(skill.get("applicability"), dict) else {}
    input_profile = skill.get("input_profile") if isinstance(skill.get("input_profile"), dict) else {}
    capability_names = _string_list(skill.get("capabilities"), limit=30)
    metrics = experience_metrics if isinstance(experience_metrics, dict) else {}
    metrics_events = metrics.get("events") if isinstance(metrics.get("events"), dict) else {}
    metrics_governance = metrics.get("governance") if isinstance(metrics.get("governance"), dict) else {}
    warnings = _deduplicate([_text(item, 300) for item in (aggregation_warnings or [])])
    limitations = _string_list(formal_validation.get("limitations"), limit=20)
    if not can_create_task:
        limitations.append("当前 Registry 状态不允许创建真实 Task。")
    if not safe_tasks and can_create_task:
        limitations.append("当前运行库尚无该 Skill 的真实 Task，Task 级证据为空。")
    limitations.append("生产级统一身份、组织授权与全场景准确率承诺尚未建立。")
    incomplete_items = _deduplicate(limitations)
    task_state = "available" if safe_tasks else "empty" if can_create_task else "not_applicable"
    task_message = (
        f"已聚合最近 {task_count} 个真实 Task。"
        if safe_tasks
        else "当前运行库尚无该 Skill 的真实 Task；不会用演示任务补位。"
        if can_create_task
        else "规划中 Skill 不创建真实 Task；仅显示缺口和不足项。"
    )
    position_name = POSITION_NAME if skill.get("id") == "survey-measurement-limit-price" else f"{_text(skill.get('display_name'), 120)}数智员工（规划）"
    generated = generated_at or datetime.now().astimezone().isoformat(timespec="seconds")
    return {
        "schema_version": 1,
        "generated_at": generated,
        "disclaimer": DISCLAIMER,
        "skill": {
            "id": _text(skill.get("id"), 100),
            "display_name": _text(skill.get("display_name"), 160),
            "version": _text(skill.get("version"), 40),
            "status": _text(skill.get("status"), 40),
            "status_label": _text(skill.get("status_label"), 80),
            "domain": _text(skill.get("domain"), 120),
        },
        "readiness": {
            "status": readiness_status,
            "label": readiness_label,
            "reason": "已上线、运行能力就绪且有正式验证事实。"
            if readiness_status == "on_duty"
            else "Registry 已上线，但正式验证事实不足。"
            if readiness_status == "limited"
            else "专业资产、验证或 Registry 状态尚不满足真实任务要求。",
        },
        "actions": {"can_create_task": can_create_task},
        "position": {
            "name": position_name,
            "objective": "接住真实造价 Task，调用专业 Skill 和可信 Tool，按结构化规则完成工作，把异常交给人复核，并把确认后的经验带到后续任务。",
            "scope": _string_list(scope.get("includes"), limit=20),
            "inputs": _deduplicate(
                _string_list(input_profile.get("extensions"), limit=10)
                + _string_list(input_profile.get("templateHints"), limit=10)
            ),
            "artifacts": ["回填后的 Excel 成果副本", "Word 控制价报告", "结构化风险与人工复核线索"],
            "responsibilities": [
                "读取 Task 的目标、输入范围、成功标准和冻结 Skill。",
                "调用白名单处理器、结构化计价库、规则、风险检查、知识解释和成果生成能力。",
                "记录真实执行事件、成果版本与 Experience 血缘。",
            ],
            "human_responsibilities": [
                "确认多候选、无候选、字段冲突和异常风险。",
                "对人工改单、AI填价建议、复核意见和 Experience 候选作最终确认。",
                "对正式成果、生产身份、组织授权和发布承担责任。",
            ],
        },
        "principles": [
            {"id": "onboard", "title": "能上岗", "conclusion": readiness_label, "evidence": f"Registry 状态：{_text(skill.get('status_label'), 80)}；真实 Task：{task_count} 个。"},
            {"id": "work", "title": "能干活", "conclusion": "能力已登记" if capability_names else "能力尚未开放", "evidence": f"可信能力 {len(capability_names)} 项；实际 Tool {tool_count} 项；成果 {artifact_count} 个。"},
            {"id": "grow", "title": "能成长", "conclusion": "受治理的 Experience" if "知识记忆" in capability_names else "尚未开放", "evidence": f"真实 Experience 事件 {experience_count} 条；候选、确认、撤销和失效状态分别呈现。"},
            {"id": "boundary", "title": "不越权", "conclusion": "规则裁决、模型解释、人工负责", "evidence": "不猜价格、不自动改规则、不绕过人工确认，异常进入人工复核。"},
        ],
        "relationship": [
            {"id": "task", "label": "Task", "description": "冻结业务目标、输入、责任和成功标准", "evidence_count": task_count},
            {"id": "skill", "label": "Skill", "description": "冻结专业能力版本和运行上下文", "evidence_count": 1 if can_create_task else 0},
            {"id": "tool", "label": "Tool", "description": "记录本次任务实际调用的可信能力", "evidence_count": tool_count},
            {"id": "artifact", "label": "Artifact", "description": "登记可追溯的 Excel、Word 等正式成果", "evidence_count": artifact_count},
            {"id": "experience", "label": "Experience", "description": "把确认后的业务经验纳入治理与复用", "evidence_count": experience_count},
        ],
        "capability_package": [
            {
                "name": _text(item.get("name"), 160),
                "type": _text(item.get("type"), 40),
                "status": _text(item.get("status"), 40),
                "description": _text(item.get("description"), 300),
            }
            for item in enabled_sub_skills
        ],
        "allowed_capabilities": capability_names,
        "restricted_actions": _deduplicate(
            _string_list(scope.get("excludes"), limit=20)
            + [
                "不得由大模型直接生成或裁决最终价格、调整系数和正式规则。",
                "不得自动确认、提升、撤销或失效 Experience，也不得绕过人工复核。",
                "不得把测试 Skill、结算审核 MVP 或规划能力包装成已上线 Registry Skill。",
            ]
        ),
        "formal_validation": formal_validation,
        "task_evidence": {
            "state": task_state,
            "count": task_count,
            "message": task_message,
            "items": safe_tasks,
        },
        "experience_metrics": {
            "scope_label": "当前本机可信经验运行库（非准确率或 ROI 指标）",
            "candidate_sources": int(metrics.get("candidate_sources") or 0),
            "events": {
                "cell_edit": int(metrics_events.get("cell_edit") or 0),
                "review_opinion": int(metrics_events.get("review_opinion") or 0),
            },
            "governance": {
                "confirmed": int(metrics_governance.get("confirmed") or 0),
                "rejected": int(metrics_governance.get("rejected") or 0),
                "revoked": int(metrics_governance.get("revoked") or 0),
            },
            "retrieval_hits": int(metrics.get("retrieval_hits") or 0),
            "version_corrections": int(metrics.get("version_corrections") or 0),
            "suspected_stale": int(metrics.get("suspected_stale") or 0),
        },
        "data_sources": [
            "Skill Registry 与 Manifest",
            "SkillRuntimeContext 冻结摘要",
            "Task 聚合与 TaskEvent",
            "项目台账与成果版本",
            "可信经验事件、治理状态与 Experience 血缘",
            "V3.1 正式成对验收事实",
        ],
        "incomplete_items": incomplete_items,
        "aggregation": {"status": "partial" if warnings else "complete", "warnings": warnings},
    }
