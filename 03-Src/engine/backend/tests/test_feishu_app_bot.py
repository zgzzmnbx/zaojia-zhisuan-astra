from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app import feishu_app_bot
from backend.app.main import app


@pytest.fixture(autouse=True)
def isolate_runtime_console_log(tmp_path, monkeypatch):
    monkeypatch.setattr(feishu_app_bot, "CONSOLE_EVENTS_PATH", tmp_path / "console-events.jsonl")
    monkeypatch.setattr(feishu_app_bot, "start_local_bot_supervisor", lambda: True)


class FakeFeishu:
    def __init__(self):
        self.texts: list[tuple[str, str]] = []
        self.files: list[tuple[str, Path]] = []
        self.cards: list[tuple[str, dict]] = []
        self.reactions: list[tuple[str, str]] = []

    def send_text(self, chat_id: str, text: str) -> None:
        self.texts.append((chat_id, text))

    def send_file(self, chat_id: str, path: Path) -> None:
        self.files.append((chat_id, path))

    def send_card(self, chat_id: str, card: dict) -> None:
        self.cards.append((chat_id, card))

    def add_reaction(self, message_id: str, emoji_type: str) -> None:
        self.reactions.append((message_id, emoji_type))

    def download_file(self, message_id: str, file_key: str, target: Path) -> Path:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"xlsx")
        return target

    def resolve_user_name(self, user_id: str) -> str:
        return {"user-1": "石萌"}.get(user_id, user_id)

    def resolve_chat_name(self, chat_id: str) -> str:
        return {"chat-1": "造价智算小组"}.get(chat_id, chat_id)


def event_payload(*, event_id: str = "evt-1", message_id: str = "msg-1", files=None, mentions=None, text: str = "", sender_id: str = "user-1", chat_type: str = "group", chat_id: str = "chat-1", create_time: str | None = None):
    message = {
        "message_id": message_id,
        "chat_id": chat_id,
        "chat_type": chat_type,
        "mentions": [{"name": "机器人"}] if mentions is None else mentions,
        "content": json.dumps({"text": text, "files": files if files is not None else [{"file_key": "file-1", "file_name": "控制价.xlsx"}]}, ensure_ascii=False),
    }
    if create_time is not None:
        message["create_time"] = create_time
    return {
        "header": {"event_id": event_id},
        "event": {
            "sender": {"sender_id": {"open_id": sender_id}},
            "message": message,
        },
    }


def test_parse_valid_group_message():
    task = feishu_app_bot.parse_message_event(event_payload())
    assert task.file_name == "控制价.xlsx"
    assert task.chat_id == "chat-1"


def test_acknowledge_message_event_uses_get_reaction():
    feishu = FakeFeishu()

    message_id = feishu_app_bot.acknowledge_message_event(event_payload(), feishu)

    assert message_id == "msg-1"
    assert feishu.reactions == [("msg-1", "Get")]


def test_acknowledge_message_event_supports_sdk_event_body_shape():
    feishu = FakeFeishu()
    payload = event_payload()
    sdk_event_body = {
        "event_id": payload["header"]["event_id"],
        **payload["event"],
    }

    message_id = feishu_app_bot.acknowledge_message_event(sdk_event_body, feishu)

    assert message_id == "msg-1"
    assert feishu.reactions == [("msg-1", "Get")]


def test_acknowledgement_is_limited_to_mentioned_group_messages_and_private_chat():
    assert feishu_app_bot.should_acknowledge_message(event_payload()) is True
    assert feishu_app_bot.should_acknowledge_message(event_payload(mentions=[])) is False
    assert feishu_app_bot.should_acknowledge_message(
        event_payload(chat_type="p2p", mentions=[]),
    ) is True


def test_group_file_acknowledgement_requires_validated_pending_window():
    file_message = event_payload(mentions=[])

    assert feishu_app_bot.should_acknowledge_message(file_message) is False
    assert feishu_app_bot.should_acknowledge_message(
        file_message,
        validated_pending_file=True,
    ) is True


def test_validated_delayed_group_file_can_be_acknowledged():
    delayed_file = event_payload(
        mentions=[],
        create_time="2026-07-15T04:30:38.530Z",
    )

    assert feishu_app_bot.should_acknowledge_message(
        delayed_file,
        received_at="2026-07-15T04:35:55+00:00",
        validated_pending_file=True,
    ) is True


def test_pending_flag_does_not_acknowledge_non_xlsx_group_file():
    xls_file = event_payload(
        mentions=[],
        files=[{"file_key": "file-1", "file_name": "控制价.xls"}],
    )

    assert feishu_app_bot.should_acknowledge_message(
        xls_file,
        validated_pending_file=True,
    ) is False


def test_group_message_only_acknowledges_current_bot_mention():
    current_bot = [{"key": "@_user_1", "id": {"open_id": "ou_current_bot"}, "name": "当前机器人"}]
    other_user = [{"key": "@_user_1", "id": {"open_id": "ou_other"}, "name": "其他人"}]

    assert feishu_app_bot.should_acknowledge_message(
        event_payload(mentions=current_bot, text="@_user_1 你好"),
        bot_open_id="ou_current_bot",
        bot_name="当前机器人",
    ) is True
    assert feishu_app_bot.should_acknowledge_message(
        event_payload(mentions=other_user, text="@_user_1 你好"),
        bot_open_id="ou_current_bot",
        bot_name="当前机器人",
    ) is False
    assert feishu_app_bot.should_acknowledge_message(
        event_payload(mentions=other_user, text="@_user_1 你好"),
        bot_open_id="",
        bot_name="",
    ) is False


def test_group_mentions_of_other_people_are_ignored_by_all_message_routes(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    mentions = [{"key": "@_user_1", "id": {"open_id": "ou_other"}, "name": "其他人"}]
    identity = {"bot_open_id": "ou_current_bot", "bot_name": "当前机器人"}

    with pytest.raises(feishu_app_bot.IgnoreEvent):
        feishu_app_bot.accept_event(
            event_payload(files=[], mentions=mentions, text="@_user_1 @上传"),
            store,
            FakeFeishu(),
            **identity,
        )
    with pytest.raises(feishu_app_bot.IgnoreEvent):
        feishu_app_bot.accept_knowledge_event(
            event_payload(files=[], mentions=mentions, text="@_user_1 #知识库：系数如何确定"),
            store,
            FakeFeishu(),
            **identity,
        )
    with pytest.raises(feishu_app_bot.IgnoreEvent):
        feishu_app_bot.accept_conversation_event(
            event_payload(files=[], mentions=mentions, text="@_user_1 你好"),
            store,
            FakeFeishu(),
            **identity,
        )


def test_describe_message_event_contains_business_context_and_marks_missing_ip():
    detail = feishu_app_bot.describe_message_event(
        event_payload(text="#知识库：系数如何确定？"),
        FakeFeishu(),
    )

    assert "发送人：石萌（user-1）" in detail
    assert "会话：造价智算小组（群聊；chat-1）" in detail
    assert "消息 ID：msg-1" in detail
    assert "平台创建时间：未提供" in detail
    assert "本机接收时间：" in detail
    assert "消息：#知识库：系数如何确定？；附件：控制价.xlsx" in detail
    assert "来源 IP：飞书长连接事件未提供" in detail


def test_platform_message_time_and_stale_guard_are_backward_compatible():
    received_at = "2026-07-15T03:30:00+00:00"
    fresh = feishu_app_bot.parse_message_envelope(
        event_payload(create_time="1784086170000"),
    )
    stale = feishu_app_bot.parse_message_envelope(
        event_payload(create_time="2026-07-15T03:20:00Z"),
    )
    legacy = feishu_app_bot.parse_message_envelope(event_payload())

    assert fresh.message_created_at == "2026-07-15T03:29:30.000+00:00"
    assert feishu_app_bot.message_is_stale(fresh, received_at=received_at) is False
    assert feishu_app_bot.message_is_stale(stale, received_at=received_at) is True
    assert feishu_app_bot.message_is_stale(legacy, received_at=received_at) is False
    assert feishu_app_bot.should_acknowledge_message(
        event_payload(create_time="2026-07-15T03:20:00Z"),
        received_at=received_at,
    ) is False


def test_delayed_xlsx_sent_inside_pending_window_is_allowed(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()
    with store._connect() as connection:
        connection.execute(
            """INSERT INTO pending_uploads
            (platform_profile_id,chat_id,sender_id,created_at,expires_at) VALUES (?,?,?,?,?)""",
            (
                "default",
                "chat-1",
                "user-1",
                "2026-07-15T04:30:30+00:00",
                "2026-07-15T04:31:30+00:00",
            ),
        )
    payload = event_payload(
        event_id="delayed-file",
        message_id="delayed-file-message",
        mentions=[],
        create_time="2026-07-15T04:30:38.530Z",
    )
    envelope = feishu_app_bot.parse_message_envelope(payload)

    assert feishu_app_bot.delayed_file_matches_pending_window(
        envelope,
        store,
        received_at="2026-07-15T04:35:55+00:00",
    ) is True
    result = feishu_app_bot.accept_event(payload, store, feishu, platform_profile_id="default")
    assert result["created"] is True


def test_delayed_file_outside_original_window_remains_blocked(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    with store._connect() as connection:
        connection.execute(
            """INSERT INTO pending_uploads
            (platform_profile_id,chat_id,sender_id,created_at,expires_at) VALUES (?,?,?,?,?)""",
            (
                "default",
                "chat-1",
                "user-1",
                "2026-07-15T04:30:30+00:00",
                "2026-07-15T04:31:30+00:00",
            ),
        )
    envelope = feishu_app_bot.parse_message_envelope(event_payload(
        mentions=[],
        create_time="2026-07-15T04:31:31Z",
    ))

    assert feishu_app_bot.delayed_file_matches_pending_window(
        envelope,
        store,
        received_at="2026-07-15T04:36:48+00:00",
    ) is False


def test_delayed_file_over_fifteen_minutes_remains_blocked(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    with store._connect() as connection:
        connection.execute(
            "INSERT INTO pending_uploads(chat_id,sender_id,created_at,expires_at) VALUES (?,?,?,?)",
            (
                "chat-1",
                "user-1",
                "2026-07-15T04:30:30+00:00",
                "2026-07-15T04:31:30+00:00",
            ),
        )
    envelope = feishu_app_bot.parse_message_envelope(event_payload(
        mentions=[],
        create_time="2026-07-15T04:30:38.530Z",
    ))

    assert feishu_app_bot.delayed_file_matches_pending_window(
        envelope,
        store,
        received_at="2026-07-15T04:45:39+00:00",
    ) is False


def test_persistent_inbound_dedup_blocks_event_and_message_replays(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    first = store.record_inbound_message(
        event_id="evt-1", message_id="msg-1",
        message_created_at="2026-07-15T03:29:30.000+00:00", received_at="2026-07-15T03:30:00+00:00",
    )
    same_event = store.record_inbound_message(
        event_id="evt-1", message_id="msg-2",
        message_created_at="", received_at="2026-07-15T03:30:01+00:00",
    )
    same_message = store.record_inbound_message(
        event_id="evt-2", message_id="msg-1",
        message_created_at="", received_at="2026-07-15T03:30:02+00:00",
    )

    assert first == (True, "")
    assert same_event == (False, "event_id")
    assert same_message == (False, "message_id")


def test_task_store_additively_migrates_legacy_event_tables(tmp_path):
    import sqlite3

    db_path = tmp_path / "legacy.sqlite3"
    with sqlite3.connect(db_path) as connection:
        connection.executescript(
            """
            CREATE TABLE knowledge_events (event_id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
            CREATE TABLE conversation_events (event_id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
            INSERT INTO knowledge_events(event_id, created_at) VALUES ('legacy-k', '2026-07-14T00:00:00+00:00');
            INSERT INTO conversation_events(event_id, created_at) VALUES ('legacy-c', '2026-07-14T00:00:00+00:00');
            """
        )

    store = feishu_app_bot.TaskStore(db_path)

    assert store.record_knowledge_event("new-k", "msg-k") is True
    assert store.record_conversation_event("new-c", "msg-c") is True
    with store._connect() as connection:
        knowledge_columns = {row["name"] for row in connection.execute("PRAGMA table_info(knowledge_events)")}
        conversation_columns = {row["name"] for row in connection.execute("PRAGMA table_info(conversation_events)")}
        inbound_table = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='inbound_message_events'"
        ).fetchone()
    assert "message_id" in knowledge_columns
    assert "message_id" in conversation_columns
    assert inbound_table is not None


@pytest.mark.parametrize(
    ("payload", "message"),
    [
        (event_payload(mentions=[]), "@机器人"),
        (event_payload(files=[]), "只发送一个"),
        (event_payload(files=[{"file_key": "f", "file_name": "a.xls"}]), ".xlsx"),
        (event_payload(files=[{"file_key": "a", "file_name": "a.xlsx"}, {"file_key": "b", "file_name": "b.xlsx"}]), "只发送一个"),
    ],
)
def test_parse_rejects_invalid_messages(payload, message):
    with pytest.raises(ValueError, match=message):
        feishu_app_bot.parse_message_event(payload)


def test_enqueue_is_idempotent_and_fifo(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    first, created = store.enqueue(event_id="e1", message_id="m1", chat_id="c", file_key="f1", file_name="a.xlsx")
    duplicate, created_again = store.enqueue(event_id="e1", message_id="m1", chat_id="c", file_key="f1", file_name="a.xlsx")
    second, _ = store.enqueue(event_id="e2", message_id="m2", chat_id="c", file_key="f2", file_name="b.xlsx")
    assert created is True
    assert created_again is False
    assert duplicate["task_id"] == first["task_id"]
    assert store.claim_next()["task_id"] == first["task_id"]
    store.update(first["task_id"], "completed", stage="completed")
    assert store.claim_next()["task_id"] == second["task_id"]


def test_claim_next_does_not_request_write_lock_when_queue_is_empty(tmp_path, monkeypatch):
    import sqlite3

    monkeypatch.setattr(
        feishu_app_bot,
        "credential_profiles",
        lambda: [{"profile_id": "default", "label": "普通飞书"}],
    )
    monkeypatch.setattr(feishu_app_bot, "is_bot_enabled", lambda profile_id=None: True)
    db_path = tmp_path / "tasks.sqlite3"
    store = feishu_app_bot.TaskStore(db_path)

    with sqlite3.connect(db_path, timeout=0) as blocker:
        blocker.execute("BEGIN IMMEDIATE")

        assert store.claim_next("default") is None


def test_parallel_profiles_share_one_global_fifo_worker_slot(tmp_path, monkeypatch):
    monkeypatch.setattr(
        feishu_app_bot,
        "credential_profiles",
        lambda: [
            {"profile_id": "default", "label": "普通飞书"},
            {"profile_id": "weact_cost", "label": "WeAct"},
        ],
    )
    monkeypatch.setattr(feishu_app_bot, "is_bot_enabled", lambda profile_id=None: True)
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu_task, _ = store.enqueue(
        event_id="feishu-event",
        message_id="feishu-message",
        chat_id="feishu-chat",
        file_key="feishu-file",
        file_name="feishu.xlsx",
        platform_profile_id="default",
    )
    weact_task, _ = store.enqueue(
        event_id="weact-event",
        message_id="weact-message",
        chat_id="weact-chat",
        file_key="weact-file",
        file_name="weact.xlsx",
        platform_profile_id="weact_cost",
    )

    assert store.claim_next("weact_cost") is None
    claimed_feishu = store.claim_next("default")
    assert claimed_feishu["task_id"] == feishu_task["task_id"]
    assert claimed_feishu["platform_profile_id"] == "default"
    assert store.claim_next("weact_cost") is None
    store.update(feishu_task["task_id"], "completed", stage="completed")
    claimed_weact = store.claim_next("weact_cost")
    assert claimed_weact["task_id"] == weact_task["task_id"]
    assert claimed_weact["platform_profile_id"] == "weact_cost"


def test_upload_windows_and_tasks_are_isolated_by_platform(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    store.open_upload_window("shared-chat", "shared-user", platform_profile_id="default")
    reference = feishu_app_bot.utc_now()

    assert store.matches_upload_window(
        "shared-chat",
        "shared-user",
        reference,
        platform_profile_id="default",
    )
    assert not store.matches_upload_window(
        "shared-chat",
        "shared-user",
        reference,
        platform_profile_id="weact_cost",
    )


def test_task_query_cannot_cross_platform_even_with_same_chat_id(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(
        event_id="feishu-event",
        message_id="feishu-message",
        chat_id="shared-chat",
        file_key="feishu-file",
        file_name="feishu.xlsx",
        platform_profile_id="default",
    )
    feishu = FakeFeishu()
    result = feishu_app_bot.accept_conversation_event(
        event_payload(
            event_id="weact-query-event",
            message_id="weact-query-message",
            files=[],
            text=f"进度 {task['task_id']}",
            chat_type="p2p",
            chat_id="shared-chat",
            mentions=[],
        ),
        store,
        feishu,
        platform_profile_id="weact_cost",
    )

    assert result["kind"] == "task_missing"
    assert "未找到" in feishu.texts[-1][1]


def test_accept_event_replies_once_for_duplicate(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()
    feishu_app_bot.accept_event(event_payload(files=[], text="@上传", message_id="upload-command"), store, feishu)
    file_payload = event_payload(mentions=[])
    first = feishu_app_bot.accept_event(file_payload, store, feishu)
    second = feishu_app_bot.accept_event(file_payload, store, feishu)
    assert first["created"] is True
    assert second["created"] is False
    assert len(feishu.texts) == 2
    assert first["task_id"] in feishu.texts[1][1]


def test_at_then_separate_file_message_creates_task(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()
    pending = feishu_app_bot.accept_event(event_payload(files=[], text="@上传", message_id="mention"), store, feishu)
    file_message = event_payload(event_id="evt-file", message_id="file-message", mentions=[])
    created = feishu_app_bot.accept_event(file_message, store, feishu)
    assert pending["pending"] is True
    assert created["created"] is True
    assert "1 分钟" in feishu.texts[0][1]


def test_unrelated_file_message_is_ignored(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    with pytest.raises(feishu_app_bot.IgnoreEvent):
        feishu_app_bot.accept_event(event_payload(mentions=[]), store, FakeFeishu())


def test_pending_upload_is_bound_to_sender(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu_app_bot.accept_event(event_payload(files=[], text="@上传", sender_id="user-a"), store, FakeFeishu())
    with pytest.raises(feishu_app_bot.IgnoreEvent):
        feishu_app_bot.accept_event(event_payload(mentions=[], sender_id="user-b"), store, FakeFeishu())


def test_group_file_uses_only_pending_window_when_sender_id_is_missing(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()
    feishu_app_bot.accept_event(event_payload(files=[], text="@上传文件", sender_id="user-a"), store, feishu)
    result = feishu_app_bot.accept_event(
        event_payload(event_id="file-event", message_id="file-message", mentions=[], sender_id=""),
        store,
        feishu,
    )
    assert result["created"] is True


def test_private_chat_requires_upload_command_before_file(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()
    with pytest.raises(ValueError, match="@上传"):
        feishu_app_bot.accept_event(event_payload(chat_type="p2p", mentions=[]), store, feishu)
    pending = feishu_app_bot.accept_event(
        event_payload(chat_type="p2p", files=[], mentions=[], text="@上传"), store, feishu,
    )
    result = feishu_app_bot.accept_event(
        event_payload(event_id="evt-file", message_id="msg-file", chat_type="p2p", mentions=[]), store, feishu,
    )
    assert pending["pending"] is True
    assert result["created"] is True


def test_non_upload_text_is_not_treated_as_upload_command(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()
    result = feishu_app_bot.accept_event(
        event_payload(chat_type="p2p", files=[], mentions=[], text="帮我分析一下"), store, feishu,
    )
    assert result is None
    assert feishu.texts == []


@pytest.mark.parametrize(
    "command",
    ["@上传", "@上传文件", "#辅助审核", "@_user_ @上传！", "@_user_1  @上传", "@_user_1 #辅助审核！"],
)
def test_only_explicit_upload_commands_open_one_minute_window(tmp_path, command):
    store = feishu_app_bot.TaskStore(tmp_path / f"{len(command)}-tasks.sqlite3")
    feishu = FakeFeishu()
    result = feishu_app_bot.accept_event(event_payload(files=[], text=command), store, feishu)
    assert result["pending"] is True
    assert "1 分钟" in feishu.texts[0][1]


def test_assisted_review_command_has_clear_receipt_prompt(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()

    result = feishu_app_bot.accept_event(
        event_payload(files=[], text="#辅助审核"),
        store,
        feishu,
    )

    assert result["pending"] is True
    assert "辅助审核收件状态" in feishu.texts[0][1]


@pytest.mark.parametrize(
    "text",
    ["上传", "请上传", "@上传一下", "我要@上传文件了", "辅助审核", "@辅助审核", "#辅助审核一下"],
)
def test_similar_phrases_do_not_open_upload_window(tmp_path, text):
    store = feishu_app_bot.TaskStore(tmp_path / f"{len(text)}-tasks.sqlite3")
    assert feishu_app_bot.accept_event(event_payload(files=[], text=text), store, FakeFeishu()) is None


def test_legacy_at_knowledge_command_no_longer_enters_knowledge_route(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")

    assert feishu_app_bot.accept_knowledge_event(
        event_payload(chat_type="p2p", files=[], mentions=[], text="@知识库：系数如何确定？"),
        store,
        FakeFeishu(),
    ) is None


def test_greeting_returns_introduction_and_usage(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()
    result = feishu_app_bot.accept_conversation_event(
        event_payload(files=[], text="你好！"), store, feishu,
    )
    assert result["kind"] == "greeting"
    assert "我是造价智算机器人" in feishu.texts[0][1]
    assert "@上传" in feishu.texts[0][1]
    assert "#辅助审核" in feishu.texts[0][1]
    assert "#知识库" in feishu.texts[0][1]
    assert "Excel 自动处理" in feishu.texts[0][1]
    assert "普通智能问答" in feishu.texts[0][1]


def test_weact_numbered_mention_still_triggers_greeting(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()
    result = feishu_app_bot.accept_conversation_event(
        event_payload(
            files=[],
            mentions=[{"key": "@_user_1", "id": {"open_id": "ou_current_bot"}, "name": "当前机器人"}],
            text="@_user_1  你好",
        ),
        store,
        feishu,
        bot_open_id="ou_current_bot",
        bot_name="当前机器人",
    )
    assert result["kind"] == "greeting"
    assert "我是造价智算机器人" in feishu.texts[0][1]


@pytest.mark.parametrize("command", ["群里有几个人", "群成员", "都有谁？"])
def test_exact_group_member_commands_use_deterministic_route(tmp_path, command):
    store = feishu_app_bot.TaskStore(tmp_path / f"{command}-tasks.sqlite3")
    feishu = FakeFeishu()
    result = feishu_app_bot.accept_conversation_event(
        event_payload(
            files=[],
            mentions=[{"key": "@_user_1", "id": {"open_id": "ou_current_bot"}, "name": "当前机器人"}],
            text=f"@_user_1 {command}",
        ),
        store,
        feishu,
        bot_open_id="ou_current_bot",
        bot_name="当前机器人",
    )

    assert result == {
        "handled": True,
        "duplicate": False,
        "kind": "members",
        "chat_id": "chat-1",
    }
    assert "真实成员信息" in feishu.texts[0][1]


@pytest.mark.parametrize("text", ["这个群成员挺多", "都有谁会参加项目", "群里大概有几个人吧"])
def test_similar_group_member_phrases_fall_back_to_llm(tmp_path, text):
    store = feishu_app_bot.TaskStore(tmp_path / f"{len(text)}-tasks.sqlite3")
    feishu = FakeFeishu()

    result = feishu_app_bot.accept_conversation_event(
        event_payload(files=[], text=text), store, feishu,
    )

    assert result["kind"] == "chat"
    assert result["question"] == text
    assert "大模型" in feishu.texts[0][1]


def test_group_member_command_in_private_chat_explains_group_only(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()

    result = feishu_app_bot.accept_conversation_event(
        event_payload(chat_type="p2p", files=[], mentions=[], text="群成员"), store, feishu,
    )

    assert result["kind"] == "members_private"
    assert "仅适用于群聊" in feishu.texts[0][1]


@pytest.mark.parametrize(("command", "kind"), [("帮助", "help"), ("指令！", "help")])
def test_help_commands_return_deterministic_instruction_list(tmp_path, command, kind):
    store = feishu_app_bot.TaskStore(tmp_path / f"{len(command)}-tasks.sqlite3")
    feishu = FakeFeishu()

    result = feishu_app_bot.accept_conversation_event(
        event_payload(files=[], text=command), store, feishu,
    )

    assert result["kind"] == kind
    assert "进度 FS-任务编号" in feishu.texts[0][1]
    assert "结果 FS-任务编号" in feishu.texts[0][1]
    assert "只在原任务所在会话内" in feishu.texts[0][1]


def test_task_list_only_returns_tasks_from_current_chat(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    current, _ = store.enqueue(
        event_id="e-current", message_id="m-current", chat_id="chat-1",
        file_key="f-current", file_name="当前群.xlsx",
    )
    other, _ = store.enqueue(
        event_id="e-other", message_id="m-other", chat_id="chat-2",
        file_key="f-other", file_name="其他群.xlsx",
    )
    feishu = FakeFeishu()

    result = feishu_app_bot.accept_conversation_event(
        event_payload(event_id="evt-list", files=[], text="最近任务"), store, feishu,
    )

    assert result["kind"] == "task_list"
    assert current["task_id"] in feishu.texts[0][1]
    assert other["task_id"] not in feishu.texts[0][1]
    assert "其他群.xlsx" not in feishu.texts[0][1]


def test_progress_and_risk_commands_are_deterministic(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(
        event_id="e1", message_id="m1", chat_id="chat-1",
        file_key="f1", file_name="控制价.xlsx",
    )
    store.update(task["task_id"], "completed", "成果已回传", stage="completed", risk_total=4, risk_high=2)

    progress_feishu = FakeFeishu()
    progress = feishu_app_bot.accept_conversation_event(
        event_payload(event_id="evt-progress", files=[], text=f"进度 {task['task_id'].lower()}"),
        store,
        progress_feishu,
    )
    risk_feishu = FakeFeishu()
    risk = feishu_app_bot.accept_conversation_event(
        event_payload(event_id="evt-risk", message_id="msg-risk", files=[], text=f"风险 {task['task_id']}"),
        store,
        risk_feishu,
    )

    assert progress["kind"] == "progress"
    assert "当前状态：已完成" in progress_feishu.texts[0][1]
    assert risk["kind"] == "risk"
    assert "结构化风险：4 项" in risk_feishu.texts[0][1]
    assert "高风险：2 项" in risk_feishu.texts[0][1]


def test_high_risk_command_only_lists_current_chat(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    current, _ = store.enqueue(
        event_id="e-current", message_id="m-current", chat_id="chat-1",
        file_key="f-current", file_name="当前群.xlsx",
    )
    store.update(current["task_id"], "completed", stage="completed", risk_total=3, risk_high=1)
    other, _ = store.enqueue(
        event_id="e-other", message_id="m-other", chat_id="chat-2",
        file_key="f-other", file_name="其他群.xlsx",
    )
    store.update(other["task_id"], "completed", stage="completed", risk_total=9, risk_high=8)
    feishu = FakeFeishu()

    result = feishu_app_bot.accept_conversation_event(
        event_payload(event_id="evt-high", files=[], text="高风险"), store, feishu,
    )

    assert result["kind"] == "high_risk"
    assert current["task_id"] in feishu.texts[0][1]
    assert other["task_id"] not in feishu.texts[0][1]


def test_result_command_prepares_background_resend_for_same_chat(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(
        event_id="e1", message_id="m1", chat_id="chat-1",
        file_key="f1", file_name="控制价.xlsx",
    )
    store.update(task["task_id"], "completed", stage="completed")
    feishu = FakeFeishu()

    result = feishu_app_bot.accept_conversation_event(
        event_payload(event_id="evt-result", files=[], text=f"结果 {task['task_id']}"),
        store,
        feishu,
    )

    assert result["kind"] == "result"
    assert result["task_id"] == task["task_id"]
    assert "正在重新发送历史成果" in feishu.texts[0][1]


def test_result_command_does_not_start_resend_before_completion(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(
        event_id="e1", message_id="m1", chat_id="chat-1",
        file_key="f1", file_name="控制价.xlsx",
    )
    feishu = FakeFeishu()

    result = feishu_app_bot.accept_conversation_event(
        event_payload(event_id="evt-result-pending", files=[], text=f"结果 {task['task_id']}"),
        store,
        feishu,
    )

    assert result["kind"] == "result_unavailable"
    assert "尚无可重新发送的完整成果" in feishu.texts[0][1]


def test_task_detail_command_cannot_read_another_chat(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(
        event_id="e-other", message_id="m-other", chat_id="chat-2",
        file_key="f-other", file_name="其他群.xlsx",
    )
    feishu = FakeFeishu()

    result = feishu_app_bot.accept_conversation_event(
        event_payload(event_id="evt-cross-chat", files=[], text=f"进度 {task['task_id']}"),
        store,
        feishu,
    )

    assert result["kind"] == "task_missing"
    assert "当前会话未找到" in feishu.texts[0][1]
    assert "其他群.xlsx" not in feishu.texts[0][1]


@pytest.mark.parametrize("text", ["最近有什么任务", "帮我看一下进度", "这个结果怎么样"])
def test_similar_task_phrases_fall_back_to_llm(tmp_path, text):
    store = feishu_app_bot.TaskStore(tmp_path / f"{len(text)}-tasks.sqlite3")
    feishu = FakeFeishu()

    result = feishu_app_bot.accept_conversation_event(
        event_payload(files=[], text=text), store, feishu,
    )

    assert result["kind"] == "chat"
    assert "大模型" in feishu.texts[0][1]


def test_list_chat_members_paginates_and_deduplicates():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/auth/v3/tenant_access_token/internal"):
            return httpx.Response(200, json={"code": 0, "tenant_access_token": "token", "expire": 7200})
        assert request.url.path == "/open-apis/im/v1/chats/chat-1/members"
        assert request.url.params["member_id_type"] == "open_id"
        assert request.url.params["page_size"] == "100"
        if request.url.params.get("page_token") == "next-page":
            return httpx.Response(200, json={
                "code": 0,
                "data": {
                    "member_total": 3,
                    "has_more": False,
                    "items": [
                        {"member_id": "ou-2", "name": "李四"},
                        {"member_id": "ou-3", "name": "王五"},
                    ],
                },
            })
        return httpx.Response(200, json={
            "code": 0,
            "data": {
                "member_total": 3,
                "has_more": True,
                "page_token": "next-page",
                "items": [
                    {"member_id": "ou-1", "name": "张三"},
                    {"member_id": "ou-2", "name": "李四"},
                ],
            },
        })

    api = feishu_app_bot.FeishuApi(
        "app-id",
        "app-secret",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    result = api.list_chat_members("chat-1")

    assert result == {
        "member_total": 3,
        "members": [
            {"member_id": "ou-1", "name": "张三"},
            {"member_id": "ou-2", "name": "李四"},
            {"member_id": "ou-3", "name": "王五"},
        ],
    }
    assert sum(request.url.path.endswith("/members") for request in requests) == 2


def test_format_chat_members_contains_total_and_numbered_names():
    message = feishu_app_bot.format_chat_members({
        "member_total": 2,
        "members": [
            {"member_id": "ou-1", "name": "张三"},
            {"member_id": "ou-2", "name": "李四"},
        ],
    })

    assert "当前群共有 2 人" in message
    assert "1. 张三" in message
    assert "2. 李四" in message


def test_other_text_uses_llm_fallback_and_is_idempotent(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()
    payload = event_payload(files=[], text="请介绍一下工程造价")
    first = feishu_app_bot.accept_conversation_event(payload, store, feishu)
    second = feishu_app_bot.accept_conversation_event(payload, store, feishu)
    assert first["kind"] == "chat"
    assert first["question"] == "请介绍一下工程造价"
    assert second["duplicate"] is True
    assert len(feishu.texts) == 1
    assert "大模型" in feishu.texts[0][1]


def test_conversation_reissued_with_new_event_id_same_message_id_is_idempotent(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()

    first = feishu_app_bot.accept_conversation_event(
        event_payload(event_id="evt-old", message_id="msg-same", files=[], text="你好"),
        store,
        feishu,
    )
    replay = feishu_app_bot.accept_conversation_event(
        event_payload(event_id="evt-reissued", message_id="msg-same", files=[], text="你好"),
        store,
        feishu,
    )

    assert first["duplicate"] is False
    assert replay == {"handled": True, "duplicate": True, "kind": "greeting"}
    assert len(feishu.texts) == 1
    assert "我是造价智算机器人" in feishu.texts[0][1]


def test_group_conversation_without_bot_mention_is_ignored(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    with pytest.raises(feishu_app_bot.IgnoreEvent):
        feishu_app_bot.accept_conversation_event(
            event_payload(files=[], mentions=[], text="大家好"), store, FakeFeishu(),
        )


def test_group_knowledge_question_requires_bot_mention(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()
    result = feishu_app_bot.accept_knowledge_event(
        event_payload(files=[], text="#知识库：第二层经验提示是什么意思？"), store, feishu,
    )
    assert result["handled"] is True
    assert result["question"] == "第二层经验提示是什么意思？"
    assert "正在检索" in feishu.texts[0][1]


def test_group_knowledge_question_without_bot_mention_is_ignored(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    with pytest.raises(feishu_app_bot.IgnoreEvent):
        feishu_app_bot.accept_knowledge_event(
            event_payload(files=[], mentions=[], text="#知识库：第二层经验提示是什么意思？"), store, FakeFeishu(),
        )


def test_private_knowledge_question_does_not_require_bot_mention(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    result = feishu_app_bot.accept_knowledge_event(
        event_payload(chat_type="p2p", files=[], mentions=[], text="#知识库：技术工作费依据是什么？"), store, FakeFeishu(),
    )
    assert result["question"] == "技术工作费依据是什么？"


def test_knowledge_question_is_idempotent(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()
    first = feishu_app_bot.accept_knowledge_event(
        event_payload(files=[], text="#知识库：预警阈值怎么来的？"), store, feishu,
    )
    second = feishu_app_bot.accept_knowledge_event(
        event_payload(files=[], text="#知识库：预警阈值怎么来的？"), store, feishu,
    )
    assert first["duplicate"] is False
    assert second["duplicate"] is True
    assert len(feishu.texts) == 1


def test_knowledge_reissued_with_new_event_id_same_message_id_is_idempotent(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    feishu = FakeFeishu()

    first = feishu_app_bot.accept_knowledge_event(
        event_payload(event_id="evt-old", message_id="msg-same", files=[], text="#知识库：系数如何确定？"),
        store,
        feishu,
    )
    replay = feishu_app_bot.accept_knowledge_event(
        event_payload(event_id="evt-reissued", message_id="msg-same", files=[], text="#知识库：系数如何确定？"),
        store,
        feishu,
    )

    assert first["duplicate"] is False
    assert replay == {"handled": True, "duplicate": True}
    assert len(feishu.texts) == 1


def test_format_markdown_tables_for_plain_chat_uses_mobile_friendly_list():
    answer = """查询结果：

| 复杂程度 | 技术工作费调整系数 | 来源定位 |
| --- | :---: | --- |
| **简单** | 0.27 | [母表第427行](https://example.test/rule) |
| 中等 | 0.30 | 同上 |
| 复杂 | 0.33 | 同上 |

依据来源：
1. 规则说明"""

    formatted = feishu_app_bot.format_markdown_tables_for_plain_chat(answer)

    assert "| --- |" not in formatted
    assert "【1】复杂程度：简单" in formatted
    assert "• 技术工作费调整系数：0.27" in formatted
    assert "• 来源定位：母表第427行（https://example.test/rule）" in formatted
    assert "【3】复杂程度：复杂" in formatted
    assert "依据来源：\n1. 规则说明" in formatted


def test_format_markdown_tables_for_plain_chat_preserves_non_table_pipes():
    answer = "公式说明：A | B 只是分隔写法，不是表格。"

    assert feishu_app_bot.format_markdown_tables_for_plain_chat(answer) == answer


def test_answer_knowledge_event_uses_native_table_card_for_feishu():
    feishu = FakeFeishu()
    feishu.domain = feishu_app_bot.DEFAULT_FEISHU_DOMAIN

    class Professional:
        def ask_knowledge(self, question):
            assert question == "技术工作费依据是什么？"
            return (
                "| 复杂程度 | 技术工作费调整系数 |\n"
                "| --- | --- |\n"
                "| 简单 | 0.27 |\n\n"
                "依据来源：规则说明"
            )

    feishu_app_bot.answer_knowledge_event("chat-1", "技术工作费依据是什么？", feishu, Professional())
    assert feishu.texts == []
    card = feishu.cards[-1][1]
    assert card["header"]["title"]["content"] == "造价智算 · 知识库答复"
    table = next(element for element in card["elements"] if element["tag"] == "table")
    assert [column["display_name"] for column in table["columns"]] == ["复杂程度", "技术工作费调整系数"]
    assert table["rows"] == [{"column_1": "简单", "column_2": "0.27"}]
    assert "依据来源：规则说明" in json.dumps(card, ensure_ascii=False)
    assert card["elements"][-1] == {
        "tag": "note",
        "elements": [{
            "tag": "plain_text",
            "content": "由造价智算知识库检索生成；价格与系数仍以项目规则及人工复核为准。",
        }],
    }


def test_answer_chat_event_uses_classic_compatible_fields_for_weact():
    feishu = FakeFeishu()
    feishu.domain = "https://open.weact.pipechina.com.cn"

    class Professional:
        def ask_chat(self, question):
            assert question == "请用表格比较"
            return "| 项目 | 结论 |\n| --- | --- |\n| A | 可用 |"

    feishu_app_bot.answer_chat_event("chat-1", "请用表格比较", feishu, Professional())

    assert feishu.texts == []
    card = feishu.cards[-1][1]
    assert card["header"]["title"]["content"] == "造价智算 · 智能回答"
    assert not any(element["tag"] == "table" for element in card["elements"])
    fields = next(element["fields"] for element in card["elements"] if element["tag"] == "div")
    assert fields[0]["text"]["content"] == "**项目**\nA"
    assert fields[1]["text"]["content"] == "**结论**\n可用"


def test_table_answer_card_failure_falls_back_to_plain_list():
    class CardFailureFeishu(FakeFeishu):
        domain = "https://open.weact.pipechina.com.cn"

        def send_card(self, chat_id: str, card: dict) -> None:
            raise RuntimeError("card unavailable")

    feishu = CardFailureFeishu()

    class Professional:
        def ask_knowledge(self, question):
            return "| 项目 | 结论 |\n| --- | --- |\n| A | 可用 |"

    feishu_app_bot.answer_knowledge_event("chat-1", "请用表格比较", feishu, Professional())

    assert feishu.texts == [("chat-1", "知识库查询完成：\n\n【1】项目：A\n• 结论：可用")]


def test_answer_knowledge_without_table_uses_readable_card_for_feishu():
    feishu = FakeFeishu()

    class Professional:
        def ask_knowledge(self, question):
            return "## 核心结论\n系数按项目复杂程度确定。\n\n依据来源：\n- 规则说明"

    feishu_app_bot.answer_knowledge_event("chat-1", "依据是什么？", feishu, Professional())

    assert feishu.texts == []
    card = feishu.cards[-1][1]
    assert card["header"]["title"]["content"] == "造价智算 · 知识库答复"
    assert not any(element["tag"] == "table" for element in card["elements"])
    body = next(element["text"] for element in card["elements"] if element["tag"] == "div")
    assert body["tag"] == "lark_md"
    assert "**核心结论**" in body["content"]
    assert "**依据来源：**" in body["content"]
    assert "• 规则说明" in body["content"]


def test_answer_knowledge_without_table_uses_classic_card_for_weact():
    feishu = FakeFeishu()
    feishu.domain = "https://open.weact.pipechina.com.cn"

    class Professional:
        def ask_knowledge(self, question):
            return "结论：\n- 使用项目规则核对\n- 保留人工复核"

    feishu_app_bot.answer_knowledge_event("chat-1", "怎么核对？", feishu, Professional())

    assert feishu.texts == []
    card = feishu.cards[-1][1]
    assert card["header"]["title"]["content"] == "造价智算 · 知识库答复"
    assert not any(element["tag"] == "table" for element in card["elements"])
    assert not any("schema" in element for element in card["elements"])
    body = next(element["text"] for element in card["elements"] if element["tag"] == "div")
    assert body["tag"] == "lark_md"
    assert "**结论：**" in body["content"]


def test_answer_knowledge_general_model_fallback_uses_explicit_card_boundary():
    feishu = FakeFeishu()

    class Professional:
        def ask_knowledge(self, question):
            return (
                "已自动转为大模型回答\n\n"
                "这是普通大模型兜底答案。\n\n"
                "提示：本回答未检索到本地知识库明确依据。"
            )

    feishu_app_bot.answer_knowledge_event("chat-1", "火星土豆怎么收费？", feishu, Professional())

    card = feishu.cards[-1][1]
    assert "已自动转为大模型回答" in json.dumps(card, ensure_ascii=False)
    assert card["elements"][-1] == {
        "tag": "note",
        "elements": [{
            "tag": "plain_text",
            "content": "本回答由大模型兜底生成，未检索到知识库明确依据；价格与系数仍以项目规则及人工复核为准。",
        }],
    }


def test_answer_chat_without_table_keeps_plain_text_message():
    feishu = FakeFeishu()

    class Professional:
        def ask_chat(self, question):
            return "这是普通智能问答。"

    feishu_app_bot.answer_chat_event("chat-1", "普通问题", feishu, Professional())

    assert feishu.cards == []
    assert feishu.texts == [("chat-1", "这是普通智能问答。")]


def test_knowledge_card_failure_without_table_falls_back_to_plain_text():
    class CardFailureFeishu(FakeFeishu):
        def send_card(self, chat_id: str, card: dict) -> None:
            raise RuntimeError("card unavailable")

    feishu = CardFailureFeishu()

    class Professional:
        def ask_knowledge(self, question):
            return "依据来源：规则说明"

    feishu_app_bot.answer_knowledge_event("chat-1", "依据是什么？", feishu, Professional())

    assert feishu.texts == [("chat-1", "知识库查询完成：\n\n依据来源：规则说明")]


def test_professional_api_knowledge_query_uses_existing_endpoint():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/knowledge/ask"
        body = json.loads(request.content.decode("utf-8"))
        assert body == {"question": "技术工作费依据是什么？", "force_knowledge": True}
        return httpx.Response(
            200,
            json={
                "answer": "技术工作费按规则表解释。",
                "sources": [{"source_file": "规则说明.md", "title_path": "第一层规则"}],
            },
            request=request,
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    professional = feishu_app_bot.ProfessionalApi("http://127.0.0.1:8000", client=client)
    answer = professional.ask_knowledge("技术工作费依据是什么？")
    assert "技术工作费按规则表解释" in answer
    assert "规则说明.md / 第一层规则" in answer
    assert "不改变程序填价结果" in answer


def test_professional_api_chat_fallback_uses_existing_llm_endpoint():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/llm-chat"
        assert "message=%E8%AF%B7%E4%BB%8B%E7%BB%8D" in request.content.decode("utf-8")
        return httpx.Response(200, json={"answer": "我是大模型托底回答。"}, request=request)

    professional = feishu_app_bot.ProfessionalApi(
        "http://professional.local",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    assert professional.ask_chat("请介绍") == "我是大模型托底回答。"


def test_professional_api_health_check_requires_ok_status():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/health"
        return httpx.Response(200, json={"status": "ok"}, request=request)

    professional = feishu_app_bot.ProfessionalApi(
        "http://professional.local",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    professional.health_check()


def test_professional_api_health_check_rejects_non_ok_status():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "starting"}, request=request)

    professional = feishu_app_bot.ProfessionalApi(
        "http://professional.local",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(RuntimeError, match="未返回 ok"):
        professional.health_check()


def test_worker_completes_and_returns_two_files(tmp_path, monkeypatch):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(event_id="e1", message_id="m1", chat_id="c", file_key="f", file_name="a.xlsx")
    feishu = FakeFeishu()

    class Professional:
        def run(self, input_path, task_dir, *, progress=None):
            progress("matching")
            progress("risk")
            progress("report")
            output = task_dir / "output"
            output.mkdir(parents=True, exist_ok=True)
            excel = output / "result.xlsx"
            report = output / "report.docx"
            excel.write_bytes(b"excel")
            report.write_bytes(b"word")
            return {
                "job_id": "job-1", "excel": excel, "report": report, "llm_error": "",
                "risks": {"summary": {"total": 3, "severity_counts": {"high": 1}}},
            }

    monkeypatch.setattr(feishu_app_bot, "TASKS_ROOT", tmp_path / "task-files")
    worker = feishu_app_bot.TaskWorker(store, feishu, Professional())
    assert worker.run_once() is True
    saved = store.get(task["task_id"])
    assert saved["status"] == "completed"
    assert saved["risk_total"] == 3
    assert len(feishu.files) == 2
    assert len(feishu.cards) == 1
    assert feishu.cards[0][1]["header"]["template"] == "green"
    assert "高风险 **1 项**" in feishu.cards[0][1]["elements"][0]["text"]["content"]
    assert any("批量匹配完成" in text for _, text in feishu.texts)
    assert any("正在生成 Excel 和 Word" in text for _, text in feishu.texts)


def test_completion_card_has_optional_safe_open_url_button():
    card = feishu_app_bot.build_task_completion_card(
        task_id="FS-TEST-001",
        file_name="控制价.xlsx",
        risk_total=2,
        risk_high=1,
        app_url="http://127.0.0.1:5174/",
    )

    assert card["config"] == {"wide_screen_mode": True}
    assert card["header"]["title"]["content"] == "造价智算 · 任务处理完成"
    assert "FS-TEST-001" in card["elements"][0]["text"]["content"]
    assert card["elements"][1]["actions"][0]["url"] == "http://127.0.0.1:5174/"


def test_answer_task_result_resends_files_and_card_without_mutating_task(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(
        event_id="e1", message_id="m1", chat_id="chat-1",
        file_key="f1", file_name="控制价.xlsx",
    )
    excel = tmp_path / "result.xlsx"
    report = tmp_path / "report.docx"
    excel.write_bytes(b"excel")
    report.write_bytes(b"word")
    store.update(
        task["task_id"], "completed", "成果已回传", stage="completed",
        output_excel=str(excel), output_report=str(report), risk_total=2, risk_high=1,
    )
    before = store.get(task["task_id"])
    feishu = FakeFeishu()

    feishu_app_bot.answer_task_result_event("chat-1", task["task_id"], store, feishu)

    after = store.get(task["task_id"])
    assert feishu.files == [("chat-1", excel), ("chat-1", report)]
    assert len(feishu.cards) == 1
    assert feishu.cards[0][1]["header"]["template"] == "green"
    assert after == before


def test_answer_task_result_refuses_cross_chat_and_missing_outputs(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(
        event_id="e1", message_id="m1", chat_id="chat-1",
        file_key="f1", file_name="控制价.xlsx",
    )
    store.update(task["task_id"], "completed", stage="completed", output_excel="missing.xlsx", output_report="missing.docx")

    cross_chat_feishu = FakeFeishu()
    feishu_app_bot.answer_task_result_event("chat-2", task["task_id"], store, cross_chat_feishu)
    assert "当前会话未找到" in cross_chat_feishu.texts[0][1]
    assert cross_chat_feishu.files == []

    missing_feishu = FakeFeishu()
    feishu_app_bot.answer_task_result_event("chat-1", task["task_id"], store, missing_feishu)
    assert "历史成果文件已不存在" in missing_feishu.texts[0][1]
    assert missing_feishu.files == []


def test_worker_falls_back_to_text_when_completion_card_fails(tmp_path, monkeypatch):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(event_id="e1", message_id="m1", chat_id="c", file_key="f", file_name="a.xlsx")

    class CardFailureFeishu(FakeFeishu):
        def send_card(self, chat_id: str, card: dict) -> None:
            raise RuntimeError("card unavailable")

    class Professional:
        def run(self, input_path, task_dir, *, progress=None):
            output = task_dir / "output"
            output.mkdir(parents=True, exist_ok=True)
            excel = output / "result.xlsx"
            report = output / "report.docx"
            excel.write_bytes(b"excel")
            report.write_bytes(b"word")
            return {
                "job_id": "job-1", "excel": excel, "report": report, "llm_error": "",
                "risks": {"summary": {"total": 0, "severity_counts": {"high": 0}}},
            }

    feishu = CardFailureFeishu()
    monkeypatch.setattr(feishu_app_bot, "TASKS_ROOT", tmp_path / "task-files")
    feishu_app_bot.TaskWorker(store, feishu, Professional()).run_once()

    assert store.get(task["task_id"])["status"] == "completed"
    assert len(feishu.files) == 2
    assert "已完成" in feishu.texts[-1][1]


def test_worker_stays_completed_when_card_and_fallback_text_both_fail(tmp_path, monkeypatch):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(event_id="e1", message_id="m1", chat_id="c", file_key="f", file_name="a.xlsx")

    class NotificationFailureFeishu(FakeFeishu):
        def send_card(self, chat_id: str, card: dict) -> None:
            raise RuntimeError("card unavailable")

        def send_text(self, chat_id: str, text: str) -> None:
            raise RuntimeError("text unavailable")

    class Professional:
        def run(self, input_path, task_dir, *, progress=None):
            output = task_dir / "output"
            output.mkdir(parents=True, exist_ok=True)
            excel = output / "result.xlsx"
            report = output / "report.docx"
            excel.write_bytes(b"excel")
            report.write_bytes(b"word")
            return {
                "job_id": "job-1", "excel": excel, "report": report, "llm_error": "",
                "risks": {"summary": {"total": 0, "severity_counts": {"high": 0}}},
            }

    feishu = NotificationFailureFeishu()
    monkeypatch.setattr(feishu_app_bot, "TASKS_ROOT", tmp_path / "task-files")
    feishu_app_bot.TaskWorker(store, feishu, Professional()).run_once()

    assert store.get(task["task_id"])["status"] == "completed"
    assert len(feishu.files) == 2


def test_worker_marks_mapping_problem_needs_manual(tmp_path, monkeypatch):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(event_id="e1", message_id="m1", chat_id="c", file_key="f", file_name="a.xlsx")
    feishu = FakeFeishu()

    class Professional:
        def run(self, input_path, task_dir, *, progress=None):
            raise feishu_app_bot.NeedsManual("缺少单位")

    monkeypatch.setattr(feishu_app_bot, "TASKS_ROOT", tmp_path / "task-files")
    feishu_app_bot.TaskWorker(store, feishu, Professional()).run_once()
    assert store.get(task["task_id"])["status"] == "needs_manual"
    assert "未猜测字段" in feishu.texts[-1][1]


def test_worker_retries_then_fails(tmp_path, monkeypatch):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(event_id="e1", message_id="m1", chat_id="c", file_key="f", file_name="a.xlsx")
    feishu = FakeFeishu()

    class Professional:
        def run(self, input_path, task_dir, *, progress=None):
            raise RuntimeError("network down")

    monkeypatch.setattr(feishu_app_bot, "TASKS_ROOT", tmp_path / "task-files")
    monkeypatch.setattr(feishu_app_bot, "load_bot_defaults", lambda: {"retryCount": 1})
    worker = feishu_app_bot.TaskWorker(store, feishu, Professional())
    worker.run_once()
    assert store.get(task["task_id"])["status"] == "retryable_failed"
    worker.run_once()
    assert store.get(task["task_id"])["status"] == "failed"


def test_recover_interrupted_tasks(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(event_id="e1", message_id="m1", chat_id="c", file_key="f", file_name="a.xlsx")
    store.claim_next()
    assert store.recover_interrupted() == 1
    assert store.get(task["task_id"])["status"] == "retryable_failed"


def test_cleanup_only_removes_expired_terminal_task_files(tmp_path):
    store = feishu_app_bot.TaskStore(tmp_path / "tasks.sqlite3")
    task, _ = store.enqueue(event_id="e1", message_id="m1", chat_id="c", file_key="f", file_name="a.xlsx")
    store.update(task["task_id"], "completed", stage="completed")
    old = (datetime.now(timezone.utc) - timedelta(days=31)).isoformat(timespec="seconds")
    with store._connect() as connection:
        connection.execute("UPDATE tasks SET completed_at=? WHERE task_id=?", (old, task["task_id"]))
    task_dir = tmp_path / "tasks" / task["task_id"]
    task_dir.mkdir(parents=True)
    assert feishu_app_bot.cleanup_expired(store, tmp_path / "tasks", retention_days=30) == 1
    assert not task_dir.exists()


def test_status_api_does_not_expose_credentials(tmp_path, monkeypatch):
    monkeypatch.setattr(feishu_app_bot, "DB_PATH", tmp_path / "tasks.sqlite3")
    monkeypatch.setattr(
        feishu_app_bot,
        "credential_profiles",
        lambda: [{"profile_id": "default", "label": "普通飞书", "app_id_suffix": "test"}],
    )
    monkeypatch.setattr(
        feishu_app_bot,
        "load_credentials",
        lambda profile_id=None: {"profile_id": profile_id or "default", "app_id": "app", "app_secret": "secret"},
    )
    monkeypatch.setattr(feishu_app_bot, "is_bot_enabled", lambda profile_id=None: False)
    monkeypatch.setattr(feishu_app_bot, "bot_process_running", lambda profile_id=None: False)
    monkeypatch.setattr(feishu_app_bot, "credential_configuration_issue", lambda *args, **kwargs: "")
    response = TestClient(app).get("/api/collaboration/feishu-app-bot/status")
    assert response.status_code == 200
    text = response.text
    assert "secret" not in text
    assert response.json()["configured"] is True


def test_load_bot_defaults_allows_cloud_api_base_url_environment_override(tmp_path, monkeypatch):
    defaults_path = tmp_path / "project-default-settings.json"
    defaults_path.write_text(json.dumps({
        "feishuAppBot": {"apiBaseUrl": "http://127.0.0.1:8000"},
    }), encoding="utf-8")
    monkeypatch.setattr(feishu_app_bot, "PROJECT_DEFAULT_SETTINGS_PATH", defaults_path)
    monkeypatch.setenv("FEISHU_APP_BOT_API_BASE_URL", "http://127.0.0.1:1285")

    assert feishu_app_bot.load_bot_defaults()["apiBaseUrl"] == "http://127.0.0.1:1285"


def test_console_events_keep_business_context_but_hide_runtime_secrets(tmp_path):
    console_path = tmp_path / "console-events.jsonl"
    runner_out = tmp_path / "runner.out.log"
    runner_err = tmp_path / "runner.err.log"
    db_path = tmp_path / "tasks.sqlite3"
    feishu_app_bot.append_runtime_event(
        "message",
        "收到消息 ticket=private-ticket chat_id=private-chat user_id=private-user 消息=系数如何确定 https://open.feishu.cn/open-apis/private/path",
        path=console_path,
    )
    runner_out.write_text(
        "[Lark] [2026-07-13 19:31:38,123] [INFO] connected to "
        "wss://lark-frontier.weact.pipechina.com.cn/ws/v2?ticket=private-ticket&access_key=private-key\n",
        encoding="utf-8",
    )
    store = feishu_app_bot.TaskStore(db_path)
    task, _ = store.enqueue(event_id="e-console", message_id="m-console", chat_id="c", file_key="f", file_name="a.xlsx")
    store.update(task["task_id"], "completed", "成果已回传", stage="completed")

    items = feishu_app_bot.read_console_events(
        limit=50,
        db_path=db_path,
        console_path=console_path,
        runner_out_path=runner_out,
        runner_err_path=runner_err,
    )

    serialized = json.dumps(items, ensure_ascii=False)
    assert "private-ticket" not in serialized
    assert "private-key" not in serialized
    assert "private-chat" in serialized
    assert "private-user" in serialized
    assert "系数如何确定" in serialized
    assert "/ws/v2" not in serialized
    assert any(item["category"] == "connection" and "lark-frontier.weact.pipechina.com.cn" in item["message"] for item in items)
    assert any(item["category"] == "message" for item in items)
    assert any(item["category"] == "task" and item["task_id"] == task["task_id"] for item in items)


def test_console_log_api_is_bounded_and_does_not_expose_raw_runner_url(tmp_path, monkeypatch):
    console_path = tmp_path / "console-events.jsonl"
    runner_out = tmp_path / "runner.out.log"
    runner_out.write_text(
        "[Lark] [2026-07-13 19:31:38,123] [INFO] connected to "
        "wss://msg-frontier.feishu.cn/ws/v2?ticket=secret-ticket\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(feishu_app_bot, "DB_PATH", tmp_path / "tasks.sqlite3")
    monkeypatch.setattr(feishu_app_bot, "CONSOLE_EVENTS_PATH", console_path)
    monkeypatch.setattr(feishu_app_bot, "RUNNER_OUT_LOG_PATH", runner_out)
    monkeypatch.setattr(feishu_app_bot, "RUNNER_ERR_LOG_PATH", tmp_path / "runner.err.log")

    response = TestClient(app).get("/api/collaboration/feishu-app-bot/logs?limit=1")

    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert "secret-ticket" not in response.text
    assert "/ws/v2" not in response.text


def test_start_bot_process_records_child_pid_immediately(tmp_path, monkeypatch):
    profile_root = tmp_path / "profiles"
    monkeypatch.setattr(feishu_app_bot, "PROFILE_RUNTIME_ROOT", profile_root)
    monkeypatch.setattr(feishu_app_bot, "is_bot_enabled", lambda profile_id=None: True)
    monkeypatch.setattr(feishu_app_bot, "bot_process_running", lambda profile_id=None: False)
    monkeypatch.setattr(
        feishu_app_bot,
        "load_credentials",
        lambda profile_id=None: {
            "profile_id": profile_id or "default",
            "app_id": "app",
            "app_secret": "secret",
            "domain": "https://open.feishu.cn",
        },
    )
    monkeypatch.setattr(feishu_app_bot, "credential_profiles", lambda: [{"profile_id": "default", "label": "普通飞书"}])
    monkeypatch.setattr(feishu_app_bot, "credential_configuration_issue", lambda *args, **kwargs: "")
    monkeypatch.setattr(feishu_app_bot.subprocess, "Popen", lambda *args, **kwargs: SimpleNamespace(pid=4321))

    assert feishu_app_bot.start_bot_process("default") is True
    assert feishu_app_bot.bot_pid_path("default").read_text(encoding="utf-8") == "4321"


def test_credential_profiles_support_multiple_bots_without_exposing_secrets(tmp_path, monkeypatch):
    settings_path = tmp_path / "feishu-app-settings.json"
    settings_path.write_text(json.dumps({
        "active_profile": "default",
        "profiles": {
            "default": {"label": "默认机器人（普通飞书）", "app_id": "cli_default", "app_secret": "secret-default"},
            "weact_cost": {"label": "Weact机器人（管网内网）", "app_id": "cli_weact", "app_secret": "secret-weact", "domain": "https://open.weact.pipechina.com.cn"},
        },
    }), encoding="utf-8")
    monkeypatch.setattr(feishu_app_bot, "SETTINGS_PATH", settings_path)

    assert feishu_app_bot.active_profile_id() == "default"
    assert [item["profile_id"] for item in feishu_app_bot.credential_profiles()] == ["default", "weact_cost"]
    assert feishu_app_bot.load_credentials()["app_id"] == "cli_default"
    feishu_app_bot.save_active_profile("weact_cost")
    assert feishu_app_bot.active_profile_id() == "weact_cost"
    assert feishu_app_bot.load_credentials()["app_secret"] == "secret-weact"
    assert feishu_app_bot.load_credentials()["domain"] == "https://open.weact.pipechina.com.cn"
    assert feishu_app_bot.credential_profiles()[1]["domain_host"] == "open.weact.pipechina.com.cn"
    assert "secret-weact" not in json.dumps(feishu_app_bot.credential_profiles(), ensure_ascii=False)


def test_feishu_api_uses_selected_enterprise_domain():
    api = feishu_app_bot.FeishuApi(
        "cli_weact",
        "secret-weact",
        domain="https://open.weact.pipechina.com.cn",
        client=httpx.Client(transport=httpx.MockTransport(lambda _request: httpx.Response(500))),
    )

    assert api.domain == "https://open.weact.pipechina.com.cn"
    assert api.base_url == "https://open.weact.pipechina.com.cn/open-apis"


def test_feishu_api_adds_get_reaction_to_received_message():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/auth/v3/tenant_access_token/internal"):
            return httpx.Response(200, json={"code": 0, "tenant_access_token": "token", "expire": 7200}, request=request)
        if request.url.path.endswith("/im/v1/messages/msg-1/reactions"):
            assert request.headers["Authorization"] == "Bearer token"
            assert json.loads(request.content.decode("utf-8")) == {
                "reaction_type": {"emoji_type": "Get"},
            }
            return httpx.Response(200, json={"code": 0, "msg": "success", "data": {}}, request=request)
        return httpx.Response(404, request=request)

    api = feishu_app_bot.FeishuApi(
        "cli_test",
        "secret-test",
        domain="https://open.weact.pipechina.com.cn",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    api.add_reaction("msg-1")

    assert requests[-1].url.host == "open.weact.pipechina.com.cn"


def test_feishu_api_sends_interactive_card_as_message_content():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/auth/v3/tenant_access_token/internal"):
            return httpx.Response(200, json={"code": 0, "tenant_access_token": "token", "expire": 7200}, request=request)
        body = json.loads(request.content.decode("utf-8"))
        assert body["receive_id"] == "oc_chat"
        assert body["msg_type"] == "interactive"
        assert json.loads(body["content"])["header"]["title"]["content"] == "造价智算 · 任务处理完成"
        return httpx.Response(200, json={"code": 0, "msg": "success", "data": {}}, request=request)

    api = feishu_app_bot.FeishuApi(
        "cli_test",
        "secret-test",
        domain="https://open.weact.pipechina.com.cn",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    api.send_card("oc_chat", feishu_app_bot.build_task_completion_card(
        task_id="FS-TEST-001",
        file_name="控制价.xlsx",
        risk_total=2,
        risk_high=1,
    ))

    assert requests[-1].url.path == "/open-apis/im/v1/messages"
    assert requests[-1].url.params["receive_id_type"] == "chat_id"


def test_feishu_api_updates_exclusive_card_after_callback_for_current_operator():
    requests: list[httpx.Request] = []
    original_card = {
        "config": {"wide_screen_mode": True},
        "header": {"title": {"tag": "plain_text", "content": "造价智算 · 多人复核"}},
        "elements": [],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/auth/v3/tenant_access_token/internal"):
            return httpx.Response(
                200,
                json={"code": 0, "tenant_access_token": "token", "expire": 7200},
                request=request,
            )
        assert request.url.path == "/open-apis/interactive/v1/card/update"
        assert request.headers["Authorization"] == "Bearer token"
        body = json.loads(request.content.decode("utf-8"))
        assert body["token"] == "callback-token"
        assert body["card"]["open_ids"] == ["ou_reviewer"]
        assert body["card"]["header"] == original_card["header"]
        return httpx.Response(200, json={"code": 0, "msg": "success", "data": {}}, request=request)

    api = feishu_app_bot.FeishuApi(
        "cli_test",
        "secret-test",
        domain="https://open.weact.pipechina.com.cn",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    api.update_card_after_callback(
        "callback-token",
        original_card,
        open_ids=["ou_reviewer", "ou_reviewer"],
    )

    assert requests[-1].url.host == "open.weact.pipechina.com.cn"
    assert "open_ids" not in original_card


def test_feishu_api_reaction_error_keeps_platform_reason():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/auth/v3/tenant_access_token/internal"):
            return httpx.Response(200, json={"code": 0, "tenant_access_token": "token", "expire": 7200}, request=request)
        return httpx.Response(
            400,
            json={"code": 99991672, "msg": "Access denied: im:message.reactions:write_only"},
            request=request,
        )

    api = feishu_app_bot.FeishuApi(
        "cli_test",
        "secret-test",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(RuntimeError, match="im:message.reactions:write_only.*99991672"):
        api.add_reaction("msg-1")


def test_feishu_api_resolves_and_caches_user_and_chat_names():
    request_paths: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        request_paths.append(request.url.path)
        if request.url.path.endswith("/auth/v3/tenant_access_token/internal"):
            return httpx.Response(200, json={"code": 0, "tenant_access_token": "token", "expire": 7200}, request=request)
        if "/contact/v3/users/" in request.url.path:
            assert request.url.params["user_id_type"] == "open_id"
            return httpx.Response(200, json={"code": 0, "data": {"user": {"name": "石萌"}}}, request=request)
        if "/im/v1/chats/" in request.url.path:
            return httpx.Response(200, json={"code": 0, "data": {"name": "造价智算小组"}}, request=request)
        return httpx.Response(404, request=request)

    api = feishu_app_bot.FeishuApi(
        "cli_test",
        "secret-test",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert api.resolve_user_name("ou_sender") == "石萌"
    assert api.resolve_user_name("ou_sender") == "石萌"
    assert api.resolve_chat_name("oc_chat") == "造价智算小组"
    assert api.resolve_chat_name("oc_chat") == "造价智算小组"
    assert sum("/contact/v3/users/" in path for path in request_paths) == 1
    assert sum("/im/v1/chats/" in path for path in request_paths) == 1


def test_feishu_api_resolves_and_caches_current_bot_identity():
    request_paths: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        request_paths.append(request.url.path)
        if request.url.path.endswith("/auth/v3/tenant_access_token/internal"):
            return httpx.Response(200, json={"code": 0, "tenant_access_token": "token", "expire": 7200}, request=request)
        if request.url.path.endswith("/bot/v3/info"):
            return httpx.Response(
                200,
                json={"code": 0, "msg": "ok", "bot": {"open_id": "ou_current_bot", "app_name": "当前机器人"}},
                request=request,
            )
        return httpx.Response(404, request=request)

    api = feishu_app_bot.FeishuApi(
        "cli_test",
        "secret-test",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert api.resolve_bot_identity() == ("ou_current_bot", "当前机器人")
    assert api.resolve_bot_identity() == ("ou_current_bot", "当前机器人")
    assert sum(path.endswith("/bot/v3/info") for path in request_paths) == 1


def test_feishu_api_name_resolution_falls_back_to_ids_without_optional_permissions():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/auth/v3/tenant_access_token/internal"):
            return httpx.Response(200, json={"code": 0, "tenant_access_token": "token", "expire": 7200}, request=request)
        return httpx.Response(403, json={"code": 41050, "msg": "no authority"}, request=request)

    api = feishu_app_bot.FeishuApi(
        "cli_test",
        "secret-test",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert api.resolve_user_name("ou_sender") == "ou_sender"
    assert api.resolve_chat_name("oc_chat") == "oc_chat"


@pytest.mark.parametrize(
    "domain",
    [
        "http://open.weact.pipechina.com.cn",
        "https://example.com",
        "https://open.weact.pipechina.com.cn/path",
    ],
)
def test_invalid_feishu_domain_falls_back_to_public_feishu(domain):
    assert feishu_app_bot.normalize_feishu_domain(domain) == "https://open.feishu.cn"


def test_app_bot_switch_persists_and_starts_when_enabled(tmp_path, monkeypatch):
    settings_path = tmp_path / "feishu-app-settings.json"
    settings_path.write_text(json.dumps({
        "active_profile": "default",
        "profiles": {
            "default": {
                "label": "默认机器人（普通飞书）",
                "app_id": "cli_default",
                "app_secret": "secret-default",
                "domain": "https://open.feishu.cn",
            },
        },
    }), encoding="utf-8")
    defaults_path = tmp_path / "project-default-settings.json"
    defaults_path.write_text(json.dumps({"feishuAppBot": {"expectedProfiles": {
        "default": {"appId": "cli_default", "domain": "https://open.feishu.cn"},
    }}}), encoding="utf-8")
    control_path = tmp_path / "control.json"
    profile_root = tmp_path / "profiles"
    monkeypatch.setattr(feishu_app_bot, "SETTINGS_PATH", settings_path)
    monkeypatch.setattr(feishu_app_bot, "PROJECT_DEFAULT_SETTINGS_PATH", defaults_path)
    monkeypatch.setattr(feishu_app_bot, "CONTROL_PATH", control_path)
    monkeypatch.setattr(feishu_app_bot, "PROFILE_RUNTIME_ROOT", profile_root)
    monkeypatch.setattr(feishu_app_bot, "DB_PATH", tmp_path / "tasks.sqlite3")
    monkeypatch.setattr(feishu_app_bot, "bot_process_running", lambda profile_id=None: profile_id == "default")
    started: list[str] = []
    monkeypatch.setattr(
        feishu_app_bot,
        "start_enabled_bot_processes",
        lambda: started.append("default") or {"default": True},
    )
    response = TestClient(app).post(
        "/api/collaboration/feishu-app-bot/settings",
        json={"enabled": True, "profile_id": "default"},
    )
    assert response.status_code == 200
    assert json.loads(feishu_app_bot.bot_control_path("default").read_text(encoding="utf-8"))["enabled"] is True
    assert response.json()["profiles"][0]["running"] is True
    assert started == ["default"]


def test_app_bot_profiles_toggle_independently_without_switching_active_profile(tmp_path, monkeypatch):
    settings_path = tmp_path / "feishu-app-settings.json"
    settings_path.write_text(json.dumps({
        "active_profile": "default",
        "profiles": {
            "default": {"label": "默认机器人（普通飞书）", "app_id": "cli_default", "app_secret": "secret-default"},
            "weact_cost": {"label": "Weact机器人（管网内网）", "app_id": "cli_weact", "app_secret": "secret-weact", "domain": "https://open.weact.pipechina.com.cn"},
        },
    }), encoding="utf-8")
    control_path = tmp_path / "control.json"
    defaults_path = tmp_path / "project-default-settings.json"
    defaults_path.write_text(json.dumps({"feishuAppBot": {"expectedProfiles": {
        "weact_cost": {"appId": "cli_weact", "domain": "https://open.weact.pipechina.com.cn"},
    }}}), encoding="utf-8")
    monkeypatch.setattr(feishu_app_bot, "SETTINGS_PATH", settings_path)
    monkeypatch.setattr(feishu_app_bot, "PROJECT_DEFAULT_SETTINGS_PATH", defaults_path)
    monkeypatch.setattr(feishu_app_bot, "CONTROL_PATH", control_path)
    monkeypatch.setattr(feishu_app_bot, "PROFILE_RUNTIME_ROOT", tmp_path / "profiles")
    monkeypatch.setattr(feishu_app_bot, "DB_PATH", tmp_path / "tasks.sqlite3")
    control_path.write_text('{"enabled": false}', encoding="utf-8")
    monkeypatch.setattr(feishu_app_bot, "bot_process_running", lambda profile_id=None: profile_id == "weact_cost")
    started: list[str] = []
    monkeypatch.setattr(
        feishu_app_bot,
        "start_enabled_bot_processes",
        lambda: started.append("weact_cost") or {"weact_cost": True},
    )

    response = TestClient(app).post(
        "/api/collaboration/feishu-app-bot/settings",
        json={"enabled": True, "profile_id": "weact_cost"},
    )

    assert response.status_code == 200
    assert response.json()["active_profile"] == "default"
    assert response.json()["configured"] is True
    assert json.loads(feishu_app_bot.bot_control_path("weact_cost").read_text(encoding="utf-8"))["enabled"] is True
    assert feishu_app_bot.bot_control_path("default").exists() is False
    assert started == ["weact_cost"]


def test_app_bot_rejects_registered_profile_app_id_mismatch(tmp_path, monkeypatch):
    settings_path = tmp_path / "feishu-app-settings.json"
    settings_path.write_text(json.dumps({
        "active_profile": "weact_cost",
        "profiles": {
            "weact_cost": {
                "label": "Weact机器人（管网内网）",
                "app_id": "cli_wrong",
                "app_secret": "secret-weact",
                "domain": "https://open.weact.pipechina.com.cn",
            },
        },
    }), encoding="utf-8")
    defaults_path = tmp_path / "project-default-settings.json"
    defaults_path.write_text(json.dumps({"feishuAppBot": {"expectedProfiles": {
        "weact_cost": {"appId": "cli_verified", "domain": "https://open.weact.pipechina.com.cn"},
    }}}), encoding="utf-8")
    control_path = tmp_path / "control.json"
    monkeypatch.setattr(feishu_app_bot, "SETTINGS_PATH", settings_path)
    monkeypatch.setattr(feishu_app_bot, "PROJECT_DEFAULT_SETTINGS_PATH", defaults_path)
    monkeypatch.setattr(feishu_app_bot, "CONTROL_PATH", control_path)
    monkeypatch.setattr(feishu_app_bot, "PROFILE_RUNTIME_ROOT", tmp_path / "profiles")
    monkeypatch.setattr(feishu_app_bot, "DB_PATH", tmp_path / "tasks.sqlite3")
    monkeypatch.setattr(feishu_app_bot, "bot_process_running", lambda profile_id=None: False)
    monkeypatch.setattr(feishu_app_bot, "start_enabled_bot_processes", lambda: pytest.fail("配置不一致时不应启动"))

    response = TestClient(app).post(
        "/api/collaboration/feishu-app-bot/settings",
        json={"enabled": True, "profile_id": "weact_cost"},
    )

    assert response.status_code == 409
    assert "cli_verified" in response.json()["detail"]
    assert json.loads(feishu_app_bot.bot_control_path("weact_cost").read_text(encoding="utf-8"))["enabled"] is False
    status = TestClient(app).get("/api/collaboration/feishu-app-bot/status").json()
    assert status["configured"] is False
    assert status["profile_consistent"] is False
    assert "cli_verified" in status["configuration_error"]


def test_app_bot_rejects_registered_profile_domain_mismatch(tmp_path, monkeypatch):
    settings_path = tmp_path / "feishu-app-settings.json"
    settings_path.write_text(json.dumps({
        "active_profile": "weact_cost",
        "profiles": {
            "weact_cost": {
                "label": "Weact机器人（管网内网）",
                "app_id": "cli_verified",
                "app_secret": "secret-weact",
                "domain": "https://open.feishu.cn",
            },
        },
    }), encoding="utf-8")
    defaults_path = tmp_path / "project-default-settings.json"
    defaults_path.write_text(json.dumps({"feishuAppBot": {"expectedProfiles": {
        "weact_cost": {"appId": "cli_verified", "domain": "https://open.weact.pipechina.com.cn"},
    }}}), encoding="utf-8")
    monkeypatch.setattr(feishu_app_bot, "SETTINGS_PATH", settings_path)
    monkeypatch.setattr(feishu_app_bot, "PROJECT_DEFAULT_SETTINGS_PATH", defaults_path)

    issue = feishu_app_bot.credential_configuration_issue()

    assert "域名" in issue
    assert "open.weact.pipechina.com.cn" in issue


def test_app_bot_switch_can_disable_without_starting(tmp_path, monkeypatch):
    settings_path = tmp_path / "feishu-app-settings.json"
    settings_path.write_text(json.dumps({
        "active_profile": "default",
        "profiles": {
            "default": {
                "label": "默认机器人（普通飞书）",
                "app_id": "cli_default",
                "app_secret": "secret-default",
            },
        },
    }), encoding="utf-8")
    control_path = tmp_path / "control.json"
    monkeypatch.setattr(feishu_app_bot, "SETTINGS_PATH", settings_path)
    monkeypatch.setattr(feishu_app_bot, "CONTROL_PATH", control_path)
    monkeypatch.setattr(feishu_app_bot, "PROFILE_RUNTIME_ROOT", tmp_path / "profiles")
    monkeypatch.setattr(feishu_app_bot, "DB_PATH", tmp_path / "tasks.sqlite3")
    monkeypatch.setattr(feishu_app_bot, "bot_process_running", lambda profile_id=None: False)
    monkeypatch.setattr(feishu_app_bot, "start_enabled_bot_processes", lambda: {})
    monkeypatch.setattr(feishu_app_bot, "wait_for_bot_process_exit", lambda profile_id=None, timeout_seconds=5.0: True)
    response = TestClient(app).post(
        "/api/collaboration/feishu-app-bot/settings",
        json={"enabled": False, "profile_id": "default"},
    )
    assert response.status_code == 200
    assert response.json()["enabled"] is False
    assert json.loads(feishu_app_bot.bot_control_path("default").read_text(encoding="utf-8"))["enabled"] is False


def test_bot_process_running_detects_a_live_windows_process(tmp_path, monkeypatch):
    pid_path = tmp_path / "runner.pid"
    pid_path.write_text(str(os.getpid()), encoding="utf-8")
    monkeypatch.setattr(feishu_app_bot, "PID_PATH", pid_path)
    assert feishu_app_bot.bot_process_running() is True
