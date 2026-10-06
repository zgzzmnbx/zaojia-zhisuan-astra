import asyncio
import importlib
import json
import time
from types import SimpleNamespace

import httpx
import pytest

from backend import feishu_bot_runner as runner
from app import feishu_app_bot as bot
from app.feishu_reliability import MessageQueue, REPLY_CONTEXT, RETRY_WINDOW_SECONDS


def payload(key="1", text="你好", age=0, chat="chat-test"):
    return {"header": {"event_id": f"evt-{key}"}, "event": {
        "sender": {"sender_id": {"open_id": "user-test"}},
        "message": {"message_id": f"msg-{key}", "chat_id": chat, "chat_type": "p2p",
                    "content": json.dumps({"text": text}), "create_time": str(int((time.time()-age)*1000))}}}


@pytest.fixture
def queue(tmp_path):
    path = tmp_path / "tasks.sqlite3"
    bot.TaskStore(path)
    return MessageQueue(path, "default")


def enqueue(queue, item):
    return queue.enqueue(item, bot.parse_message_envelope(item), bot.utc_now())


def test_atomic_receipt_and_durable_job_deduplicate_both_ids(queue):
    event = payload()
    assert enqueue(queue, event)
    assert not enqueue(queue, event)
    event["header"]["event_id"] = "changed-event-id"
    assert not enqueue(queue, event)
    with queue.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM bot_inbox").fetchone()[0] == 1
        assert db.execute("SELECT COUNT(*) FROM inbound_message_events").fetchone()[0] == 1


def test_failed_enqueue_rolls_back_deduplication(queue):
    with queue.connect() as db:
        db.execute("DROP TABLE bot_inbox")
    with pytest.raises(Exception):
        enqueue(queue, payload())
    with queue.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM inbound_message_events").fetchone()[0] == 0


def test_failed_send_survives_restart_and_uses_same_uuid(queue):
    item = payload()
    enqueue(queue, item)
    sends = []
    failed = True
    def transport(request):
        nonlocal failed
        if "tenant_access_token" in request.url.path:
            return httpx.Response(200, json={"code": 0, "tenant_access_token": "fake", "expire": 7200})
        sends.append(json.loads(request.content))
        if failed:
            raise httpx.ReadTimeout("Response lost after platform may have accepted it")
        return httpx.Response(200, json={"code": 0, "data": {"message_id": "delivered"}})
    api = bot.FeishuApi("fake", "fake", client=httpx.Client(transport=httpx.MockTransport(transport)))
    def handler(data, **kw):
        api.send_text("chat-test", "你好")
    assert queue.process_once(handler)
    assert not sends  # Persistent queue, no network in the message callback.
    queue.deliver_once(api)
    assert queue.counts()["outbox"]["pending"] == 1
    restarted = MessageQueue(queue.path, "default")
    restarted.recover()
    with restarted.connect() as db:
        db.execute("UPDATE bot_outbox SET due=0")
    failed = False
    restarted.deliver_once(api)
    assert restarted.counts()["outbox"]["done"] == 1
    assert sends[0]["uuid"] == sends[1]["uuid"]
    assert len(sends[0]["uuid"]) <= 50
    assert not enqueue(restarted, item)
    assert not restarted.deliver_once(api)


def test_recovery_never_resets_other_platform_and_does_not_replay_old_sends(queue):
    enqueue(queue, payload())
    first = queue.claim("bot_inbox")
    other = MessageQueue(queue.path, "weact_cost")
    enqueue(other, payload("other"))
    other.claim("bot_inbox")
    queue.recover()
    assert queue.counts()["inbox"]["pending"] == 1
    assert other.counts()["inbox"]["processing"] == 1
    queue.reply(first["id"], 0, "chat-test", "text", {"text": "old"})
    with queue.connect() as db:
        db.execute("UPDATE bot_outbox SET created=?", (time.time()-RETRY_WINDOW_SECONDS-1,))
    assert queue.claim("bot_outbox") is None
    assert queue.counts()["outbox"]["failed"] == 1


def test_retry_reuses_reply_slot_and_cannot_change_audience(queue):
    enqueue(queue, payload())
    row = queue.claim("bot_inbox")
    first = queue.reply(row["id"], 0, "chat-test", "text", {"text": "first"})
    assert first == queue.reply(row["id"], 0, "chat-test", "text", {"text": "regenerated"})
    token = REPLY_CONTEXT.set({"queue": queue, "job_id": row["id"], "slot": 1, "chat_id": "chat-test"})
    api = bot.FeishuApi("fake", "fake", client=httpx.Client(transport=httpx.MockTransport(lambda r: pytest.fail("network"))))
    try:
        with pytest.raises(ValueError, match="原消息会话"):
            api.send_text("other-chat", "must not leave original chat")
    finally:
        REPLY_CONTEXT.reset(token)
    with queue.connect() as db:
        assert json.loads(db.execute("SELECT content FROM bot_outbox").fetchone()[0])["text"] == "first"


def test_per_chat_order_does_not_block_other_chats(queue):
    enqueue(queue, payload("1"))
    enqueue(queue, payload("2"))
    enqueue(queue, payload("3", chat="other"))
    one = queue.claim("bot_inbox")
    two = queue.claim("bot_inbox")
    assert one["chat_id"] == "chat-test" and two["chat_id"] == "other"
    assert queue.claim("bot_inbox") is None
    queue.finish("bot_inbox", one)
    assert queue.claim("bot_inbox")["chat_id"] == "chat-test"


def test_permission_rejection_is_terminal_not_infinite_retry(queue):
    enqueue(queue, payload())
    row = queue.claim("bot_inbox")
    queue.reply(row["id"], 0, "chat-test", "text", {"text": "hello"})
    request = httpx.Request("POST", "https://test.invalid")
    def denied(*a, **kw):
        raise httpx.HTTPStatusError("forbidden", request=request, response=httpx.Response(403, request=request))
    queue.deliver_once(SimpleNamespace(_send_message=denied))
    assert queue.counts()["outbox"]["failed"] == 1


def test_new_client_keeps_reconnect_policy_after_server_config():
    from app.feishu_connection import ReliableClient, sdk
    client = ReliableClient.__new__(ReliableClient)
    config = sdk.JSON.unmarshal(json.dumps({"ReconnectCount": -1, "ReconnectInterval": 90,
                                          "ReconnectNonce": 30, "PingInterval": 120}), sdk.ClientConfig)
    client._configure(config)
    assert (client._reconnect_interval, client._reconnect_nonce, client._ping_interval) == (5, 1, 30)


def test_slow_callback_does_not_block_heartbeat():
    from app.feishu_connection import ReliableClient, sdk
    async def experiment():
        client = ReliableClient.__new__(ReliableClient)
        client._event_handler = SimpleNamespace(do_without_validation=lambda pl: time.sleep(0.2))
        written = []
        async def write(data):
            written.append(data)
        client._write_message = write
        frame = sdk.Frame()
        frame.SeqID, frame.LogID, frame.service, frame.method = 1, 1, 1, 1
        for key, value in [(sdk.HEADER_SUM, "1"), (sdk.HEADER_SEQ, "0"),
                           (sdk.HEADER_TYPE, sdk.MessageType.EVENT.value)]:
            h = frame.headers.add()
            h.key, h.value = key, value
        frame.payload = b"{}"
        task = asyncio.create_task(client._handle_data_frame(frame))
        await asyncio.sleep(0.04)
        assert not task.done()
        await task
        assert json.loads(frame.payload)["code"] == 200
        assert len(written) == 1
    asyncio.run(experiment())


def test_sdk_endpoint_request_has_bounded_timeout_and_explicit_proxy(monkeypatch):
    from app.feishu_connection import ReliableClient
    module = importlib.import_module("app.feishu_connection")
    captured = {}
    class Client:
        def __init__(self, **kw):
            captured.update(kw)
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def post(self, *a, **kw):
            return httpx.Response(200, request=httpx.Request("POST", "https://test.invalid"),
                                  json={"code": 0, "data": {"URL": "wss://test.invalid/"}})
    monkeypatch.setattr(module.httpx, "Client", Client)
    client = ReliableClient.__new__(ReliableClient)
    client.network_mode = "direct"
    client._app_id, client._app_secret, client._domain = "fake", "fake", "https://test.invalid"
    assert client._get_conn_url() == "wss://test.invalid/"
    assert captured["trust_env"] is False
    assert captured["timeout"].connect == 5 and captured["timeout"].read == 10


@pytest.fixture
def runner_harness(tmp_path, monkeypatch, request):
    import threading
    import lark_oapi as lark
    import app.feishu_connection as connection
    captured, texts, events = {}, [], []
    def transport(request):
        if "tenant_access_token" in request.url.path:
            return httpx.Response(200, json={"code": 0, "tenant_access_token": "fake", "expire": 7200})
        texts.append(json.loads(request.content))
        return httpx.Response(200, json={"code": 0, "data": {"message_id": f"sent-{len(texts)}"}})
    api = bot.FeishuApi("fake", "fake", client=httpx.Client(transport=httpx.MockTransport(transport)))
    scenario = getattr(request, "param", "normal")
    identity_calls = []
    def identity():
        identity_calls.append(1)
        if scenario == "identity_failure" and len(identity_calls) <= 4:
            raise httpx.ConnectError("offline")
        return ("bot-test", "Bot")
    monkeypatch.setattr(api, "resolve_bot_identity", identity)
    def health_check():
        if scenario == "backend_offline":
            raise httpx.ConnectError("backend offline")
    class Queue(MessageQueue):
        def start(self, handler, api):
            captured.update(queue=self, handler=handler)
            return threading.Event()
    class Thread:
        def __init__(self, **kw):
            pass
        def start(self):
            pass
    class Builder:
        def register_p2_im_message_receive_v1(self, fn):
            captured["receive"] = fn
            return self
        def register_p2_card_action_trigger(self, fn):
            captured["card"] = fn
            return self
        def build(self):
            return self
    class Ws:
        def __init__(self, *a, **kw):
            pass
        def start(self):
            pass
    monkeypatch.setenv(runner.PROFILE_ENVIRONMENT_KEY, "default")
    attrs = {"DB_PATH": tmp_path / "tasks.sqlite3", "load_bot_defaults": lambda: {},
             "load_credentials": lambda p: {"app_id": "fake", "app_secret": "fake"},
             "credential_configuration_issue": lambda *a: "", "is_bot_enabled": lambda p: True,
             "cleanup_expired": lambda s: None, "FeishuApi": lambda *a, **kw: api,
             "ProfessionalApi": lambda *a: SimpleNamespace(health_check=health_check, ask_knowledge=lambda q: "测试依据答案"),
             "TaskWorker": lambda *a, **kw: None, "bot_pid_path": lambda p: tmp_path / "runner.pid",
             "append_runtime_event": lambda *a, **kw: events.append(a),
             "describe_message_event": lambda *a, **kw: "test event", "MessageQueue": Queue,
             "threading": SimpleNamespace(Thread=Thread, Lock=threading.Lock)}
    for name, value in attrs.items():
        monkeypatch.setattr(runner, name, value)
    monkeypatch.setattr(bot, "CONSOLE_EVENTS_PATH", tmp_path / "events.jsonl")
    monkeypatch.setattr(lark.EventDispatcherHandler, "builder", lambda *a: Builder())
    monkeypatch.setattr(connection, "ReliableClient", Ws)
    assert runner.main() == 0
    return captured, texts, api, events


def test_actual_runner_knowledge_is_not_lost_when_receipt_send_fails(runner_harness):
    captured, texts, api, events = runner_harness
    event = payload(text="知识库：技术工作费调整系数是什么")
    captured["receive"](event)
    queue = captured["queue"]
    assert queue.process_once(captured["handler"])
    assert not texts
    assert queue.counts()["outbox"]["pending"] == 2  # acknowledgement AND actual answer already saved
    failed = SimpleNamespace(_send_message=lambda *a, **kw: (_ for _ in ()).throw(httpx.ConnectError("offline")))
    queue.deliver_once(failed)
    captured["receive"](event)
    assert not queue.process_once(captured["handler"])
    with queue.connect() as db:
        db.execute("UPDATE bot_outbox SET due=0")
    while queue.deliver_once(api):
        pass
    assert len(texts) == 2
    assert queue.counts()["outbox"]["done"] == 2


def test_real_sdk_event_model_is_serialized_before_durable_ack(runner_harness):
    import lark_oapi as lark
    from lark_oapi.api.im.v1 import P2ImMessageReceiveV1
    captured, texts, api, _ = runner_harness
    event = lark.JSON.unmarshal(json.dumps(payload()), P2ImMessageReceiveV1)
    assert not isinstance(event, dict)
    captured["receive"](event)
    captured["receive"](event)
    queue = captured["queue"]
    assert queue.counts()["inbox"]["pending"] == 1
    assert queue.process_once(captured["handler"])
    assert queue.deliver_once(api)
    assert len(texts) == 1


def test_validation_failure_replies_to_persisted_dict_event(runner_harness, monkeypatch):
    captured, texts, api, _ = runner_harness
    def invalid(*args, **kwargs):
        raise ValueError("测试：文件格式不符合要求")
    monkeypatch.setattr(runner, "accept_event", invalid)
    captured["receive"](payload())
    queue = captured["queue"]
    assert queue.process_once(captured["handler"])
    assert queue.deliver_once(api)
    assert len(texts) == 1
    assert "文件格式不符合要求" in str(texts)


def test_actual_runner_stale_and_unmentioned_group_messages_stay_silent(runner_harness):
    captured, texts, api, events = runner_harness
    captured["receive"](payload(age=316))
    unmentioned = payload("2")
    unmentioned["event"]["message"]["chat_type"] = "group"
    captured["receive"](unmentioned)
    while captured["queue"].process_once(captured["handler"]):
        pass
    assert captured["queue"].counts()["outbox"] == {}
    assert not texts
    assert any("过期消息" in e[1] for e in events)


def test_receipt_callback_returns_promptly_when_outbound_unavailable(runner_harness):
    captured, texts, api, events = runner_harness
    started = time.monotonic()
    captured["receive"](payload())
    assert time.monotonic() - started < 0.5
    assert not texts


@pytest.mark.parametrize("runner_harness", ["backend_offline"], indirect=True)
def test_backend_offline_does_not_disable_greetings(runner_harness):
    captured, texts, api, _ = runner_harness
    captured["receive"](payload())
    assert captured["queue"].process_once(captured["handler"])
    assert captured["queue"].deliver_once(api)
    assert len(texts) == 1


@pytest.mark.parametrize("runner_harness", ["identity_failure"], indirect=True)
def test_initial_identity_failure_recovers_without_losing_group_message(runner_harness):
    captured, texts, api, _ = runner_harness
    event = payload()
    event["event"]["message"].update(chat_type="group", mentions=[{"key": "@_user_1", "id": {"open_id": "bot-test"}, "name": "Bot"}])
    event["event"]["message"]["content"] = json.dumps({"text": "@_user_1 你好"})
    captured["receive"](event)
    queue = captured["queue"]
    assert queue.process_once(captured["handler"])
    assert queue.counts()["inbox"]["pending"] == 1
    assert not texts
    with queue.connect() as db:
        db.execute("UPDATE bot_inbox SET due=0")
    queue.process_once(captured["handler"])
    queue.deliver_once(api)
    assert queue.counts()["inbox"]["done"] == 1
    assert len(texts) == 1


def test_server_cannot_disable_reconnect_and_missing_application_pong_closes_socket():
    from app.feishu_connection import ReliableClient, sdk
    client = ReliableClient.__new__(ReliableClient)
    client.health = {"last_pong_at": time.time() - 91, "application_heartbeat_seen": True}
    config = sdk.JSON.unmarshal(json.dumps({"ReconnectCount": 0, "ReconnectInterval": 90,
                                          "ReconnectNonce": 30, "PingInterval": 120}), sdk.ClientConfig)
    client._configure(config)
    assert client._reconnect_count == -1
    client._conn = object()
    closed = []
    async def close():
        closed.append(True)
        client._conn = None
    client._disconnect = close
    asyncio.run(client._check_application_heartbeat())
    assert closed == [True]


def test_live_pong_prevents_false_disconnect():
    from app.feishu_connection import ReliableClient, sdk
    client = ReliableClient.__new__(ReliableClient)
    client.health = {"last_pong_at": 0}
    client._conn_id = ""
    client._conn = object()
    async def experiment():
        frame = sdk.Frame()
        header = frame.headers.add()
        header.key, header.value = sdk.HEADER_TYPE, sdk.MessageType.PONG.value
        await client._handle_control_frame(frame)
        await client._check_application_heartbeat()
    asyncio.run(experiment())
    assert time.time() - client.health["last_pong_at"] < 2
    assert client._conn is not None


def test_gateway_without_application_pong_keeps_native_websocket_heartbeat():
    from app.feishu_connection import ReliableClient
    client = ReliableClient.__new__(ReliableClient)
    client.health = {"last_pong_at": 0, "application_heartbeat_seen": False}
    client._conn = object()
    asyncio.run(client._check_application_heartbeat())
    assert client._conn is not None
