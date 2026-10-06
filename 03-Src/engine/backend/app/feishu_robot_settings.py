from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

from .paths import RUNTIME_DIR


SETTINGS_PATH = RUNTIME_DIR / "feishu-robot-settings.json"
LEGACY_APP_SETTINGS_PATH = RUNTIME_DIR / "feishu-app-settings.json"
LEGACY_WEBHOOK_SETTINGS_PATH = RUNTIME_DIR / "feishu-webhook-settings.json"
_WRITE_LOCK = threading.RLock()


def _read_json(path: Path) -> dict[str, Any]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return {}
    return raw if isinstance(raw, dict) else {}


def load_store() -> dict[str, Any]:
    raw = _read_json(SETTINGS_PATH)
    if "app_bot" in raw or "webhook" in raw:
        return {
            "version": 1,
            "app_bot": raw.get("app_bot") if isinstance(raw.get("app_bot"), dict) else {},
            "webhook": raw.get("webhook") if isinstance(raw.get("webhook"), dict) else {},
        }
    migrated = {
        "version": 1,
        "app_bot": _read_json(LEGACY_APP_SETTINGS_PATH),
        "webhook": _read_json(LEGACY_WEBHOOK_SETTINGS_PATH),
    }
    if migrated["app_bot"] or migrated["webhook"]:
        with _WRITE_LOCK:
            if not SETTINGS_PATH.exists():
                _save_store(migrated)
    return migrated


def load_section(section: str) -> dict[str, Any]:
    value = load_store().get(section)
    return value if isinstance(value, dict) else {}


def _save_store(store: dict[str, Any]) -> None:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = SETTINGS_PATH.with_suffix(f"{SETTINGS_PATH.suffix}.tmp")
    temporary.write_text(json.dumps(store, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(SETTINGS_PATH)
    try:
        os.chmod(SETTINGS_PATH, 0o600)
    except OSError:
        pass


def save_section(section: str, payload: dict[str, Any]) -> None:
    if section not in {"app_bot", "webhook"}:
        raise ValueError("不支持的飞书机器人配置分区")
    with _WRITE_LOCK:
        store = load_store()
        store[section] = payload
        _save_store(store)


def migrate_legacy_settings() -> Path:
    with _WRITE_LOCK:
        _save_store(load_store())
    return SETTINGS_PATH
