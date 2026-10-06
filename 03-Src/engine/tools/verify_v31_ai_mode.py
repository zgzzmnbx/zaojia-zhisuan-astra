from __future__ import annotations

"""Verify the V3.1 formal workbook through the explicit AI-enhanced entry point."""

import json
import sys
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app import main as main_module  # noqa: E402
from verify_v31_task_acceptance import (  # noqa: E402
    ANSWER_EXCEL,
    ANSWER_WORD,
    INPUT_PATH,
    compare_excel,
    compare_word,
)


EVIDENCE_DIR = PROJECT_ROOT / "Codex-Temp" / "acceptance" / "ai-repair-20260909" / "v31-ai-formal"
RUNTIME_DIR = EVIDENCE_DIR / "runtime"


def _json(response: Any, label: str) -> dict[str, Any]:
    if response.status_code >= 400:
        raise RuntimeError(f"{label} failed: HTTP {response.status_code}: {response.text[:1000]}")
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError(f"{label} returned a non-object response")
    return payload


def run() -> dict[str, Any]:
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    main_module.RUNTIME_DIR = RUNTIME_DIR
    client = TestClient(main_module.app)

    with INPUT_PATH.open("rb") as handle:
        inspected = _json(
            client.post(
                "/api/inspect",
                files={
                    "file": (
                        INPUT_PATH.name,
                        handle,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            ),
            "结构识别",
        )
    sheet_configs = [
        {
            "sheet_name": sheet["sheet_name"],
            "enabled": bool(sheet.get("enabled", True)),
            "header_row": int(sheet["header_row"]),
            "column_mapping": sheet["suggested_mapping"],
            "output_match_report": True,
            "merge_vertical_cells": True,
            "merge_horizontal_cells": True,
            "only_match_rows_with_value": True,
            "match_value_filter_field": "数量",
        }
        for sheet in inspected.get("sheets", [])
    ]
    with INPUT_PATH.open("rb") as handle:
        processed = _json(
            client.post(
                "/api/process",
                data={
                    "project_name": "V3.1 AI 增强入口正式回归",
                    "source_type": "web",
                    "sheet_configs": json.dumps(sheet_configs, ensure_ascii=False),
                    "defer_matching": "true",
                    "matching_mode": "ai_enhanced",
                    "only_match_rows_with_value": "true",
                    "match_value_filter_field": "数量",
                },
                files={
                    "file": (
                        INPUT_PATH.name,
                        handle,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            ),
            "AI 增强入口处理",
        )
    job_id = str(processed.get("job_id") or "")
    if not job_id:
        raise RuntimeError("AI 增强入口未返回 job_id")

    analyzed = _json(client.post(f"/api/process/{job_id}/ai-matching/analyze", json={}), "AI 结构分析")
    analyzed_state = analyzed.get("ai_matching") if isinstance(analyzed.get("ai_matching"), dict) else {}
    batched = _json(client.post("/api/process/batch-match", json={"job_id": job_id}), "AI 增强批量匹配")
    ai_state = batched.get("ai_matching") if isinstance(batched.get("ai_matching"), dict) else analyzed_state
    metrics = ai_state.get("metrics") if isinstance(ai_state.get("metrics"), dict) else {}
    if metrics.get("model_calls", 0) != 0:
        raise RuntimeError(f"V3.1 标准结构应零模型调用，实际为 {metrics.get('model_calls')}")

    warning_result = _json(
        client.post("/api/experience-warnings/run", data={"job_id": job_id}),
        "经验池预警",
    )
    risk_report = client.post("/api/risk-report", data={"job_id": job_id})
    if risk_report.status_code != 200:
        raise RuntimeError(f"风险报告生成失败: HTTP {risk_report.status_code}: {risk_report.text[:500]}")

    excel_response = client.get(
        f"/api/download/{job_id}/excel",
        params={"hide_empty_rows": "true", "value_filter_field": "数量"},
    )
    word_response = client.get(f"/api/download/{job_id}/report")
    if excel_response.status_code != 200 or word_response.status_code != 200:
        raise RuntimeError("AI 增强入口正式成果下载失败")
    actual_excel = EVIDENCE_DIR / "V3.1-AI增强入口-实际输出.xlsx"
    actual_word = EVIDENCE_DIR / "V3.1-AI增强入口-实际输出.docx"
    actual_excel.write_bytes(excel_response.content)
    actual_word.write_bytes(word_response.content)

    excel_comparison = compare_excel(actual_excel, ANSWER_EXCEL)
    word_comparison = compare_word(actual_word, ANSWER_WORD)
    result = {
        "status": "passed" if (
            excel_comparison["three_number_difference_count"] == 0
            and excel_comparison["formula_difference_count"] == 0
            and excel_comparison["target_fill_difference_count"] == 0
            and excel_comparison["review_status_difference_count"] == 0
            and word_comparison["business_content_passed"] is True
        ) else "differences_found",
        "requested_mode": processed.get("matching_mode")
        or ai_state.get("requested_mode")
        or ai_state.get("matching_mode"),
        "effective_mode": ai_state.get("effective_mode"),
        "ai_stage": ai_state.get("ai_stage"),
        "structure_kind": ai_state.get("structure_kind"),
        "metrics": metrics,
        "warning_summary": warning_result.get("summary", {}).get("warning_summary"),
        "outputs": [str(actual_excel.relative_to(PROJECT_ROOT)), str(actual_word.relative_to(PROJECT_ROOT))],
        "excel_comparison": excel_comparison,
        "word_comparison": word_comparison,
    }
    (EVIDENCE_DIR / "summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["status"] == "passed" else 1)
