from __future__ import annotations

import json

from backend.app import feishu_robot_settings


def test_shared_robot_settings_preserve_both_sections(tmp_path, monkeypatch):
    shared = tmp_path / "feishu-robot-settings.json"
    monkeypatch.setattr(feishu_robot_settings, "SETTINGS_PATH", shared)
    monkeypatch.setattr(feishu_robot_settings, "LEGACY_APP_SETTINGS_PATH", tmp_path / "legacy-app.json")
    monkeypatch.setattr(feishu_robot_settings, "LEGACY_WEBHOOK_SETTINGS_PATH", tmp_path / "legacy-webhook.json")

    feishu_robot_settings.save_section("app_bot", {"active_profile": "default", "profiles": {"default": {"app_id": "id", "app_secret": "secret"}}})
    feishu_robot_settings.save_section("webhook", {"active_profile": "weact", "profiles": {"weact": {"webhook_url": "https://example.invalid"}}})

    raw = json.loads(shared.read_text(encoding="utf-8"))
    assert raw["version"] == 1
    assert raw["app_bot"]["active_profile"] == "default"
    assert raw["webhook"]["active_profile"] == "weact"


def test_shared_robot_settings_import_legacy_sections(tmp_path, monkeypatch):
    shared = tmp_path / "feishu-robot-settings.json"
    legacy_app = tmp_path / "feishu-app-settings.json"
    legacy_webhook = tmp_path / "feishu-webhook-settings.json"
    legacy_app.write_text(json.dumps({"active_profile": "app"}), encoding="utf-8")
    legacy_webhook.write_text(json.dumps({"enabled": True}), encoding="utf-8")
    monkeypatch.setattr(feishu_robot_settings, "SETTINGS_PATH", shared)
    monkeypatch.setattr(feishu_robot_settings, "LEGACY_APP_SETTINGS_PATH", legacy_app)
    monkeypatch.setattr(feishu_robot_settings, "LEGACY_WEBHOOK_SETTINGS_PATH", legacy_webhook)

    store = feishu_robot_settings.load_store()

    assert store["app_bot"]["active_profile"] == "app"
    assert store["webhook"]["enabled"] is True
