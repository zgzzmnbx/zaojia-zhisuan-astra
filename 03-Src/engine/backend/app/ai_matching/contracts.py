from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4


AI_MATCHING_SCHEMA_VERSION = "2.0"
MATCHING_MODES = {"ai_enhanced", "mechanical"}
AI_MATCHING_STAGES = {
    "not_requested",
    "awaiting_analysis",
    "analyzing",
    "mechanical_clear",
    "awaiting_confirmation",
    "confirmed",
    "degraded_needs_review",
    "cancelled",
}
AI_NUMERIC_FIELDS = (
    "price",
    "physical_adjustment",
    "technical_adjustment",
)
AI_SEMANTIC_FIELD = "semantic"
AI_MAPPING_FIELDS = (
    "要素1",
    "要素2",
    "要素3",
    "要素4",
    "要素5",
    "单位",
    "输出-价格列",
    "输出-实物工作费调整系数",
    "输出-技术工作费调整系数",
)


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def normalize_matching_mode(value: object, *, default: str = "mechanical") -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in MATCHING_MODES else default


def new_run_id() -> str:
    return f"aimrun_{uuid4().hex[:24]}"


def empty_ai_state(
    *,
    requested_mode: str = "mechanical",
    effective_mode: str = "mechanical",
    mode_reason: str = "未启用 AI 增强匹配。",
) -> dict[str, Any]:
    timestamp = now_iso()
    return {
        "schema_version": AI_MATCHING_SCHEMA_VERSION,
        "run_id": new_run_id(),
        "requested_mode": normalize_matching_mode(requested_mode),
        "effective_mode": normalize_matching_mode(effective_mode),
        "mode_reason": mode_reason,
        "ai_stage": "not_requested",
        "input_sha256": "",
        "skill_snapshot_id": "",
        "asset_hashes": {},
        "model_config_snapshot": {},
        "artifact_sha256": "",
        "artifact_version": 0,
        "artifact_invalidated": False,
        "manual_edit_revision": 0,
        "prompt_version": "ai-matching-semantic-v2",
        "parser_version": "workbook-reader-v1",
        "operation_revision": 0,
        "coverage": {},
        "record_analysis": [],
        "semantic_records": {},
        "pending_ai_review_count": 0,
        "unresolved_review_count": 0,
        "proposals": [],
        "confirmed_proposal_ids": [],
        "confirmed_mapping": {},
        "confirmed_mapping_by_sheet": {},
        "deterministic_mapping": {},
        "confirmed_candidates": [],
        "metrics": {
            "model_calls": 0,
            "cache_hits": 0,
            "model_elapsed_ms": 0,
            "model_wall_elapsed_ms": 0,
            "structure_rows_analyzed": 0,
            "semantic_rows_analyzed": 0,
            "candidate_rows_analyzed": 0,
            "mechanical_clear_rows": 0,
            "needs_ai_rows": 0,
            "rejected_proposals": 0,
            "last_error": "",
        },
        "created_at": timestamp,
        "updated_at": timestamp,
    }
