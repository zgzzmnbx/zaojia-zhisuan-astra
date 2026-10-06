from __future__ import annotations

import json

import httpx
import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from backend.app import feishu_webhook
from backend.app import main as main_module
from backend.app.main import app


TEST_WEBHOOK = "https://open.feishu.cn/open-apis/bot/v2/hook/test-token-1234"
INTERNAL_WEBHOOK = "https://open.weact.pipechina.com.cn/open-apis/bot/v2/hook/internal-token-1234"
TEST_SECRET = "unit-test-signing-secret"


@pytest.fixture(autouse=True)
def isolated_webhook_files(tmp_path, monkeypatch):
    monkeypatch.setattr(feishu_webhook, "DEFAULT_SETTINGS_PATH", tmp_path / "runtime" / "settings.json")
    monkeypatch.setattr(feishu_webhook, "DEFAULT_HISTORY_PATH", tmp_path / "runtime" / "history.jsonl")


def enable_webhook(*, secret: str = TEST_SECRET, notifications: dict[str, bool] | None = None) -> None:
    feishu_webhook.save_settings(
        {
            "webhook_url": TEST_WEBHOOK,
            "secret": secret,
            "enabled": True,
            "notifications": notifications or feishu_webhook.DEFAULT_NOTIFICATION_SWITCHES,
            "app_url": "http://127.0.0.1:5174/",
        }
    )


def test_missing_and_corrupted_settings_are_safe_and_unconfigured():
    assert feishu_webhook.get_status()["configured"] is False
    feishu_webhook.DEFAULT_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    feishu_webhook.DEFAULT_SETTINGS_PATH.write_text("{broken", encoding="utf-8")

    status = feishu_webhook.get_status()

    assert status["configured"] is False
    assert status["enabled"] is False
    assert status["security_enabled"] is False


@pytest.mark.parametrize(
    "webhook_url",
    [
        "http://open.feishu.cn/open-apis/bot/v2/hook/test-token-1234",
        "https://example.com/open-apis/bot/v2/hook/test-token-1234",
        "https://open.feishu.cn/open-apis/bot/v2/hook/short",
        "https://open.feishu.cn/open-apis/bot/v2/hook/test-token-1234?leak=1",
    ],
)
def test_non_official_webhook_url_is_rejected(webhook_url):
    response = TestClient(app).post(
        "/api/collaboration/feishu-webhook/settings",
        json={"webhook_url": webhook_url, "enabled": True},
    )

    assert response.status_code == 400
    assert "官方群自定义机器人地址" in response.json()["detail"]


def test_internal_feishu_webhook_url_is_accepted():
    response = TestClient(app).post(
        "/api/collaboration/feishu-webhook/settings",
        json={"webhook_url": INTERNAL_WEBHOOK, "enabled": True},
    )

    assert response.status_code == 200
    assert response.json()["configured"] is True
    assert response.json()["enabled"] is True


def test_multiple_webhook_profiles_can_switch_without_exposing_urls():
    feishu_webhook.DEFAULT_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    feishu_webhook.DEFAULT_SETTINGS_PATH.write_text(
        json.dumps(
            {
                "enabled": True,
                "active_profile": "default",
                "profiles": {
                    "default": {"label": "默认 Webhook", "webhook_url": TEST_WEBHOOK, "secret": ""},
                    "weact": {"label": "weact机器人（webhook）", "webhook_url": INTERNAL_WEBHOOK, "secret": TEST_SECRET},
                },
                "app_url": "",
                "notifications": feishu_webhook.DEFAULT_NOTIFICATION_SWITCHES,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    response = TestClient(app).post(
        "/api/collaboration/feishu-webhook/settings",
        json={"profile_id": "weact", "enabled": True},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["active_profile"] == "weact"
    assert [profile["label"] for profile in payload["profiles"]] == ["默认 Webhook", "weact机器人（webhook）"]
    assert payload["security_enabled"] is True
    serialized = json.dumps(payload, ensure_ascii=False)
    assert "internal-token-1234" not in serialized
    assert TEST_SECRET not in serialized
    assert feishu_webhook.load_settings()["webhook_url"] == INTERNAL_WEBHOOK


def test_unknown_webhook_profile_is_rejected_without_changing_active_profile():
    enable_webhook()

    response = TestClient(app).post(
        "/api/collaboration/feishu-webhook/settings",
        json={"profile_id": "missing", "enabled": True},
    )

    assert response.status_code == 400
    assert feishu_webhook.get_status()["active_profile"] == "default"


def test_saved_status_never_returns_webhook_or_secret():
    response = TestClient(app).post(
        "/api/collaboration/feishu-webhook/settings",
        json={"webhook_url": TEST_WEBHOOK, "secret": TEST_SECRET, "enabled": True},
    )

    assert response.status_code == 200
    serialized = json.dumps(response.json(), ensure_ascii=False)
    assert response.json()["configured"] is True
    assert response.json()["security_enabled"] is True
    assert "test-token-1234" not in serialized
    assert TEST_SECRET not in serialized
    assert "webhook_url" not in response.json()
    assert "secret" not in response.json()


def test_signature_matches_feishu_official_algorithm():
    assert feishu_webhook.generate_signature(1599360473, "demo") == "l1N0gAcBjdwBvGm1xMjOF0XSyaLRpR7tuO5dHfhAYc8="


def test_unsigned_request_does_not_forge_signature_fields():
    enable_webhook(secret="")
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content.decode("utf-8")))
        return httpx.Response(200, json={"code": 0, "msg": "success"})

    outcome = feishu_webhook.send_notification(
        "test",
        transport=httpx.MockTransport(handler),
        now=lambda: 1599360473,
    )

    assert outcome.success is True
    assert "timestamp" not in captured
    assert "sign" not in captured


def test_test_message_is_safe_and_success_is_recorded():
    enable_webhook()
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content.decode("utf-8")))
        return httpx.Response(200, json={"code": 0, "msg": "success"})

    outcome = feishu_webhook.send_notification(
        "test",
        transport=httpx.MockTransport(handler),
        now=lambda: 1599360473,
    )
    history = feishu_webhook.read_history()
    serialized = json.dumps({"message": captured, "history": history}, ensure_ascii=False)

    assert outcome.success is True
    assert captured["msg_type"] == "text"
    assert "Webhook 连接测试" in captured["content"]["text"]
    assert captured["timestamp"] == "1599360473"
    assert history[0]["success"] is True
    assert "test-token-1234" not in serialized
    assert TEST_SECRET not in serialized


@pytest.mark.parametrize("failure_kind", ["business", "http", "timeout", "network"])
def test_delivery_failures_are_recorded_without_secret_leak(failure_kind):
    enable_webhook()

    def handler(request: httpx.Request) -> httpx.Response:
        if failure_kind == "business":
            return httpx.Response(200, json={"code": 19021, "msg": f"sign fail {TEST_WEBHOOK} {TEST_SECRET}"})
        if failure_kind == "http":
            return httpx.Response(429, json={"code": 11232, "msg": "rate limited"})
        if failure_kind == "timeout":
            raise httpx.ReadTimeout("timed out", request=request)
        raise httpx.ConnectError(f"cannot connect {TEST_WEBHOOK}", request=request)

    outcome = feishu_webhook.send_notification(
        "task_failed",
        {"job_id": "job-safe", "error": "输入检查失败"},
        transport=httpx.MockTransport(handler),
    )
    history = feishu_webhook.read_history()
    serialized = json.dumps({"outcome": outcome.to_dict(), "history": history}, ensure_ascii=False)

    assert outcome.success is False
    assert outcome.skipped is False
    assert history[0]["success"] is False
    assert history[0]["job_id"] == "job-safe"
    assert "test-token-1234" not in serialized
    assert TEST_SECRET not in serialized


def test_disabled_notification_never_opens_network_request():
    enable_webhook(notifications={"task_started": False, "progress": True, "task_completed": True, "task_failed": True})
    request_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(200, json={"code": 0})

    outcome = feishu_webhook.send_notification(
        "task_started",
        transport=httpx.MockTransport(handler),
    )

    assert outcome.skipped is True
    assert request_count == 0
    assert feishu_webhook.read_history() == []


def test_completion_card_only_contains_open_url_behavior():
    settings = feishu_webhook.default_settings()
    settings["app_url"] = "http://127.0.0.1:5174/"

    message = feishu_webhook.build_message(
        "task_completed",
        {"task_name": "投标限价", "job_id": "job-1", "summary": {"total_data_rows": 100, "matched_rows": 86, "review_rows": 14}},
        settings,
        1599360473,
    )
    serialized = json.dumps(message, ensure_ascii=False)

    assert message["msg_type"] == "interactive"
    assert '"type": "open_url"' in serialized
    assert "callback" not in serialized
    assert "进入造价智算" in serialized


def test_clear_credentials_disables_connection_and_removes_secrets():
    enable_webhook()

    status = feishu_webhook.save_settings({"clear_credentials": True})
    raw = feishu_webhook.DEFAULT_SETTINGS_PATH.read_text(encoding="utf-8")

    assert status["configured"] is False
    assert status["enabled"] is False
    assert "test-token-1234" not in raw
    assert TEST_SECRET not in raw


def test_webhook_failure_is_isolated_from_existing_process_endpoint(tmp_path, monkeypatch):
    kb_path = tmp_path / "kb.xlsx"
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["要素1", "要素2", "要素3", "要素4", "要素5", "单位", "基价"])
    sheet.append(["控制测量", "GPS测量E级", "", "中等", "", "点", 3203])
    workbook.save(kb_path)
    workbook.close()

    input_path = tmp_path / "input.xlsx"
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "表2"
    sheet.append(["要素1", "要素2", "要素3", "要素4", "要素5", "单位", "基价"])
    sheet.append(["控制测量", "GPS测量E级", "", "中等", "", "点", ""])
    workbook.save(input_path)
    workbook.close()

    monkeypatch.setattr(main_module, "RUNTIME_DIR", tmp_path / "process-runtime")
    monkeypatch.setattr(main_module, "DEFAULT_KB_PATH", kb_path)
    monkeypatch.setattr(
        feishu_webhook,
        "send_notification",
        lambda *args, **kwargs: feishu_webhook.SendOutcome("task_started", False, error="飞书不可用"),
    )
    client = TestClient(app)
    notify_response = client.post(
        "/api/collaboration/feishu-webhook/notify",
        json={"notification_type": "task_started", "context": {"task_name": "测试任务"}},
    )
    with input_path.open("rb") as handle:
        process_response = client.post(
            "/api/process",
            files={"file": ("input.xlsx", handle, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={
                "column_mapping": json.dumps(
                    {"要素1": "A", "要素2": "B", "要素3": "C", "要素4": "D", "要素5": "E", "单位": "F", "输出-价格列": "G"},
                    ensure_ascii=False,
                ),
                "only_match_rows_with_value": "false",
                "defer_matching": "true",
            },
        )

    assert notify_response.status_code == 200
    assert notify_response.json()["success"] is False
    assert process_response.status_code == 200
    assert process_response.json()["summary"]["matching_status"] == "pending"
