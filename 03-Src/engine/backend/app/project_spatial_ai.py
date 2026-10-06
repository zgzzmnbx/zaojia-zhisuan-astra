"""Restricted AI boundary for project location suggestions.

The first production slice intentionally has no new model credential or
network path.  This module validates a future model response and always keeps
the server-side dictionary and human confirmation as the authority.
"""

from __future__ import annotations

import math
import re
from typing import Any

from .project_spatial import (
    SPATIAL_TYPES,
    ProjectSpatialValidationError,
    _places_from_payload,
    clean_text,
    map_source_metadata,
)


_UNSAFE_TEXT_PATTERNS = (
    re.compile(r"https?://|www\.", re.IGNORECASE),
    re.compile(r"<[^>]{1,240}>", re.IGNORECASE),
    re.compile(r"(?:[A-Za-z]:[\\/]|^[/\\])"),
    re.compile(r"(?:\$\(|`|&&|\|\||;\s*(?:rm|del|set|python|powershell|cmd)\b)", re.IGNORECASE),
    re.compile(r"(?:忽略(?:之前|以上|系统)|ignore\s+(?:all\s+)?previous|system\s+prompt|developer\s+message|执行命令|读取文件|写入文件|调用工具)", re.IGNORECASE),
)


def _safe_ai_text(value: object, *, field_name: str, limit: int) -> str:
    text = clean_text(value, limit)
    if any(pattern.search(text) for pattern in _UNSAFE_TEXT_PATTERNS):
        raise ProjectSpatialValidationError(f"AI {field_name} 含有不允许的链接、标记或指令内容")
    return text


def _validate_nested_text(value: object, *, field_name: str = "证据") -> None:
    if isinstance(value, dict):
        for key, item in list(value.items())[:50]:
            safe_key = _safe_ai_text(key, field_name=f"{field_name}字段名", limit=40)
            _validate_nested_text(item, field_name=f"{field_name}.{safe_key}")
    elif isinstance(value, list):
        for item in value[:50]:
            _validate_nested_text(item, field_name=field_name)
    elif isinstance(value, str):
        _safe_ai_text(value, field_name=field_name, limit=240)


def validate_ai_suggestion(payload: object, *, dictionary: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ProjectSpatialValidationError("AI 地点建议必须是对象")
    if any(key in payload for key in ("longitude", "latitude", "经度", "纬度")):
        raise ProjectSpatialValidationError("AI 不得直接提供坐标，坐标必须来自受信地点字典")
    spatial_type = clean_text(payload.get("spatial_type"), 20).upper()
    if spatial_type not in SPATIAL_TYPES:
        raise ProjectSpatialValidationError("AI 地点建议的空间类型无效")
    if "source_version" in payload and clean_text(payload.get("source_version"), 80) != map_source_metadata(dictionary)["source_version"]:
        raise ProjectSpatialValidationError("AI 地点建议的地点版本不是当前受信版本")
    if payload.get("requires_confirmation") is False:
        raise ProjectSpatialValidationError("AI 地点建议必须保留人工确认门禁")
    _safe_ai_text(payload.get("display_location"), field_name="展示位置", limit=160)
    _safe_ai_text(payload.get("reason"), field_name="建议理由", limit=240)
    _validate_nested_text(payload.get("evidence"), field_name="证据")
    raw_places = payload.get("places")
    if raw_places is None and isinstance(payload.get("candidate_ids"), list):
        raw_places = [{"candidate_id": item} for item in payload["candidate_ids"]]
    if not isinstance(raw_places, list):
        raise ProjectSpatialValidationError("AI 地点建议必须提供 candidate_id 列表")
    strict_places: list[dict[str, Any]] = []
    for raw_place in raw_places:
        if not isinstance(raw_place, dict):
            raise ProjectSpatialValidationError("AI 地点候选必须是对象")
        if "candidate_id" not in raw_place or any(key in raw_place for key in ("record_id", "admin_code")):
            raise ProjectSpatialValidationError("AI 只能提交受信地点 candidate_id")
        _safe_ai_text(raw_place.get("candidate_id"), field_name="候选编号", limit=80)
        for key, limit in (("source_text", 240), ("source_sheet", 120), ("source_cell", 30)):
            _safe_ai_text(raw_place.get(key), field_name=key, limit=limit)
        strict_places.append(raw_place)
    places = _places_from_payload(strict_places, dictionary=dictionary, spatial_type=spatial_type)
    raw_confidence = payload.get("confidence", 0.0)
    if raw_confidence is None:
        raw_confidence = 0.0
    if isinstance(raw_confidence, bool) or not isinstance(raw_confidence, (int, float)):
        raise ProjectSpatialValidationError("AI 地点建议 confidence 必须是 0 到 1 的数字")
    confidence = float(raw_confidence)
    if not math.isfinite(confidence) or not 0.0 <= confidence <= 1.0:
        raise ProjectSpatialValidationError("AI 地点建议 confidence 必须是 0 到 1 的数字")
    return {
        "spatial_type": spatial_type,
        "display_location": _safe_ai_text(payload.get("display_location"), field_name="展示位置", limit=160),
        "reason": _safe_ai_text(payload.get("reason"), field_name="建议理由", limit=240),
        "confidence": confidence,
        "places": [
            {
                "candidate_id": clean_text(item["record"].get("record_id"), 80),
                "source_text": item["source_text"],
                "source_sheet": item["source_sheet"],
                "source_cell": item["source_cell"],
            }
            for item in places
        ],
        "source_version": map_source_metadata(dictionary)["source_version"],
        "requires_confirmation": True,
    }


def analyze_project_spatial(
    payload: object,
    *,
    dictionary: dict[str, Any],
    ai_enabled: bool = True,
) -> dict[str, Any]:
    """Return a safe proposal envelope without silently invoking a model.

    A model adapter can be added later behind this function.  Until a model,
    credential, latency budget, and recorded sample set are configured, the
    mechanical suggestion is the only usable result and is explicitly marked
    as degraded.
    """

    candidate = payload.get("project_identity_suggestion") if isinstance(payload, dict) else None
    if candidate is None and isinstance(payload, dict):
        candidate = payload.get("suggestion")
    if isinstance(payload, dict):
        for field_name in ("user_context", "instructions", "prompt"):
            if payload.get(field_name) is not None:
                _safe_ai_text(payload.get(field_name), field_name=field_name, limit=600)
    if candidate is None:
        return {
            "status": "needs_review",
            "requested_mode": "ai_enhanced",
            "actual_mode": "mechanical",
            "mode_reason": "未提交可验证的地点候选，已保持人工复核边界。",
            "suggestion": None,
            "requires_confirmation": True,
            "map_source": map_source_metadata(dictionary),
        }
    suggestion = validate_ai_suggestion(candidate, dictionary=dictionary)
    return {
        "status": "degraded" if ai_enabled else "disabled",
        "requested_mode": "ai_enhanced",
        "actual_mode": "mechanical",
        "mode_reason": "当前未配置项目地点模型适配器；已验证候选仅作为机械建议，确认前不进入真实地图。",
        "suggestion": suggestion,
        "requires_confirmation": True,
        "map_source": map_source_metadata(dictionary),
    }
