from __future__ import annotations

from typing import Any

from .schemas import FillSummary


def build_structured_risk_items(summary: FillSummary) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for row in summary.review_details:
        severity = "high" if row.status == "unmatched" else "low"
        sheet_name = _sheet_from_values(row.values)
        items.append(
            {
                "id": f"review-{sheet_name}-{row.excel_row}-{len(items)}",
                "source": "matching",
                "severity": severity,
                "severity_label": "高风险" if severity == "high" else "低风险",
                "risk_type": "待复核",
                "title": f"{sheet_name or '输出表'} 第 {row.excel_row} 行待复核",
                "sheet_name": sheet_name,
                "excel_row": row.excel_row,
                "metric": "基价 / 单价",
                "message": row.message,
                "suggested_action": "核对要素1-5、单位和知识库候选；必要时使用辅助填价人工确认。",
                "key_text": _key_text(row.values),
                "evidence": [
                    {
                        "label": "匹配说明",
                        "text": row.message,
                    }
                ],
            }
        )
    for warning in summary.warning_details:
        severity = str(warning.get("severity") or "low")
        items.append(
            {
                "id": f"warning-{warning.get('sheet_name', '')}-{warning.get('excel_row', '')}-{warning.get('metric', '')}-{len(items)}",
                "source": "experience_warning",
                "severity": severity,
                "severity_label": warning.get("severity_label") or ("高风险" if severity == "high" else "低风险"),
                "risk_type": "经验池偏离",
                "title": f"{warning.get('sheet_name', '')} 第 {warning.get('excel_row', '')} 行 {warning.get('metric', '')} 经验偏离",
                "sheet_name": warning.get("sheet_name", ""),
                "excel_row": warning.get("excel_row", ""),
                "metric": warning.get("metric", ""),
                "message": warning.get("message", ""),
                "suggested_action": warning.get("suggested_action", ""),
                "key_text": warning.get("row_key", ""),
                "current_value": warning.get("current_value", ""),
                "reference_value": warning.get("experience_average", ""),
                "deviation_percent": warning.get("deviation_percent", ""),
                "sample_count": warning.get("sample_count", 0),
                "evidence": _warning_evidence(warning),
            }
        )
    return items


def summarize_risk_items(items: list[dict[str, Any]]) -> dict[str, Any]:
    severity_counts: dict[str, int] = {}
    type_counts: dict[str, int] = {}
    for item in items:
        severity = str(item.get("severity") or "unknown")
        risk_type = str(item.get("risk_type") or "unknown")
        severity_counts[severity] = severity_counts.get(severity, 0) + 1
        type_counts[risk_type] = type_counts.get(risk_type, 0) + 1
    return {
        "total": len(items),
        "severity_counts": severity_counts,
        "type_counts": type_counts,
    }


def build_standard_trace(summary: FillSummary, sheet_name: str, excel_row: int) -> list[dict[str, Any]]:
    traces: list[dict[str, Any]] = []
    for row in summary.review_details:
        if row.excel_row != excel_row:
            continue
        if sheet_name and _sheet_from_values(row.values) not in {"", sheet_name}:
            continue
        traces.append(
            {
                "kind": "匹配过程",
                "title": "主价格匹配说明",
                "text": row.message,
                "source": "输出 Excel 匹配说明列",
            }
        )
    for warning in summary.warning_details:
        if int(warning.get("excel_row") or 0) != excel_row:
            continue
        if sheet_name and str(warning.get("sheet_name") or "") != sheet_name:
            continue
        traces.append(
            {
                "kind": "经验池依据",
                "title": f"{warning.get('metric', '')} 经验偏离",
                "text": warning.get("warning_detail") or warning.get("message") or "",
                "source": "经验池预警分析",
                "source_rows": warning.get("source_rows") or [],
            }
        )
    if not traces:
        traces.append(
            {
                "kind": "项目规则",
                "title": "标准依据追溯",
                "text": "当前行未生成专属风险或待复核记录，可查看知识库行号、匹配说明列和项目总体匹配规则说明。",
                "source": "03-【匹配规则】-勘察测绘知识库-匹配规则提炼/【重要匹配规则】项目以及总体匹配规则介绍.md",
            }
        )
    return traces


def _warning_evidence(warning: dict[str, Any]) -> list[dict[str, Any]]:
    evidence = [
        {
            "label": "匹配模式",
            "text": warning.get("match_mode_detail") or warning.get("match_mode") or "",
        },
        {
            "label": "经验范围",
            "text": warning.get("experience_range_text") or "",
        },
    ]
    for source in list(warning.get("source_rows") or [])[:3]:
        if not isinstance(source, dict):
            continue
        evidence.append(
            {
                "label": "经验来源",
                "text": f"{source.get('source_file', '')} / {source.get('source_sheet', '')} 第 {source.get('source_row', '')} 行",
            }
        )
    return [item for item in evidence if str(item.get("text") or "").strip()]


def _sheet_from_values(values: dict[str, Any]) -> str:
    for key in ("sheet_name", "sheet", "表名"):
        value = str(values.get(key) or "").strip()
        if value:
            return value
    return ""


def _key_text(values: dict[str, Any]) -> str:
    parts = [str(values.get(field) or "").strip() for field in ("要素1", "要素2", "要素3", "要素4", "要素5", "单位")]
    return " / ".join(part for part in parts if part)
