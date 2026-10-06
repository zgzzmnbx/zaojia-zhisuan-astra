import sqlite3

from backend import feishu_bot_runner


class FakeWsClient:
    _reconnect_nonce = 30
    _reconnect_interval = 120


def test_long_connection_reconnect_delays_are_shortened():
    client = FakeWsClient()

    feishu_bot_runner.configure_long_connection_reconnect(client)

    assert client._reconnect_nonce == 1
    assert client._reconnect_interval == 5


def test_task_worker_cycle_retries_after_database_lock(monkeypatch):
    events: list[tuple] = []

    class LockedWorker:
        def run_once(self):
            raise sqlite3.OperationalError("database is locked")

    monkeypatch.setattr(
        feishu_bot_runner,
        "append_runtime_event",
        lambda *args, **kwargs: events.append((args, kwargs)),
    )

    delay = feishu_bot_runner.run_task_worker_cycle(LockedWorker(), "default")

    assert delay == feishu_bot_runner.TASK_WORKER_ERROR_RETRY_SECONDS
    assert events[-1][1]["level"] == "warning"
    assert "数据库繁忙" in events[-1][0][1]


def test_weact_card_action_response_returns_toast_without_inline_card():
    card = {"header": {"title": {"content": "已完成"}}}

    payload = feishu_bot_runner.build_card_action_response_payload(
        "weact_cost",
        toast={"type": "success", "content": "复核通过"},
        card=card,
    )

    assert payload == {"toast": {"type": "success", "content": "复核通过"}}


def test_public_feishu_card_action_response_keeps_inline_card_update():
    card = {"header": {"title": {"content": "已完成"}}}

    payload = feishu_bot_runner.build_card_action_response_payload(
        "default",
        toast={"type": "success", "content": "复核通过"},
        card=card,
    )

    assert payload["card"] == {"type": "raw", "data": card}


def test_weact_card_follow_up_waits_then_updates_before_completion(monkeypatch):
    calls: list[tuple] = []

    class FakeFeishu:
        def update_card_after_callback(self, token, card, *, open_ids):
            calls.append(("update", token, card, open_ids))

    monkeypatch.setattr(
        feishu_bot_runner.time,
        "sleep",
        lambda seconds: calls.append(("sleep", seconds)),
    )
    monkeypatch.setattr(
        feishu_bot_runner,
        "append_runtime_event",
        lambda *args, **kwargs: calls.append(("log", kwargs.get("level"))),
    )
    monkeypatch.setattr(
        feishu_bot_runner,
        "deliver_external_completion_notification",
        lambda task_id, *, profile_id, feishu: calls.append(("completion", task_id, profile_id)),
    )

    feishu_bot_runner.deliver_card_action_follow_up(
        "FS-TEST",
        profile_id="weact_cost",
        feishu=FakeFeishu(),
        callback_token="callback-token",
        operator_open_id="ou_reviewer",
        card={"header": {}},
        notify_completion=True,
    )

    assert calls[0] == ("sleep", feishu_bot_runner.CARD_ACTION_FOLLOW_UP_DELAY_SECONDS)
    assert calls[1] == ("update", "callback-token", {"header": {}}, ["ou_reviewer"])
    assert calls[-1] == ("completion", "FS-TEST", "weact_cost")
