import importlib.util
import json
import sys
import threading
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace

import httpx
import lark_oapi
import pytest
from lark_oapi.event.callback.model.p2_card_action_trigger import P2CardActionTrigger


SOURCE = Path(__file__).resolve().parents[1] / "03-Src"
sys.path.insert(0, str(SOURCE))
sys.path.insert(0, str(SOURCE / "engine" / "backend"))

from app import feishu_app_bot, feishu_connection
import weact_read_only


READ_ONLY = "oc_read_only_fixture"
OTHER = "oc_other_fixture"


@pytest.fixture(autouse=True)
def bind_fixture_group(monkeypatch):
    monkeypatch.setattr(weact_read_only, "READ_ONLY_CHAT_SHA256", sha256(READ_ONLY.encode()).hexdigest())


def test_group_sends_are_refused_before_network_or_upload():
    class Api(feishu_app_bot.FeishuApi):
        pass

    weact_read_only.install(Api)
    requests = []

    def handle(request):
        requests.append(request)
        if request.url.path.endswith("/internal"):
            return httpx.Response(200, json={"tenant_access_token": "test-token"})
        if request.method == "GET":
            return httpx.Response(200, json={"data": {"name": "Renamed group"}})
        return httpx.Response(200, json={"data": {"message_id": "sent"}})

    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        api = Api("test-app", "test-secret", client=client)
        file = Path("file-must-not-be-opened.xlsx")
        blocked_operations = (
            lambda: api.send_text(READ_ONLY, "text"),
            lambda: api.send_card(READ_ONLY, {}),
            lambda: api.send_card_to(READ_ONLY, "chat_id", {}),
            lambda: api.send_file(READ_ONLY, file),
            lambda: api.send_file_to(READ_ONLY, "chat_id", file),
            lambda: api._send_message(READ_ONLY, "text", {"text": "queued"}, uuid="retry"),
        )
        for operation in blocked_operations:
            with pytest.raises(RuntimeError, match="静默群"):
                operation()
        assert requests == []

        assert api.resolve_chat_name(READ_ONLY) == "Renamed group"
        with pytest.raises(RuntimeError, match="静默群"):
            api.send_text(READ_ONLY, "after rename")
        assert api.send_text(OTHER, "allowed") == "sent"
        assert api.send_card_to("ou_test", "open_id", {}) == "sent"
        assert len(requests) == 4


def test_runner_ignores_silent_group_events_and_card_actions(monkeypatch, tmp_path):
    spec = importlib.util.spec_from_file_location("astra_test_runner", SOURCE / "professional-assets" / "feishu_bot_runner.py")
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    handlers = {}
    enqueued = []

    class HandlerBuilder:
        def register_p2_im_message_receive_v1(self, handler):
            handlers["message"] = handler
            return self

        def register_p2_card_action_trigger(self, handler):
            handlers["card"] = handler
            return self

        def build(self):
            return self

    def start_queue(handler, _api):
        handlers["queued"] = handler
        return threading.Event()

    def unexpected_work(*_args, **_kwargs):
        pytest.fail("A read-only event started a reply or task operation")

    store = SimpleNamespace(recover_interrupted=lambda _: 0, record_inbound_message=unexpected_work)
    dispatch_store = SimpleNamespace(get_task=lambda _: {"target_chat_id": READ_ONLY}, claim_task=unexpected_work)
    api = SimpleNamespace(resolve_bot_identity=lambda: ("ou_bot", "Robot"), send_text=unexpected_work)
    queue = SimpleNamespace(start=start_queue, enqueue=lambda _payload, envelope, _time: enqueued.append(envelope.chat_id))

    monkeypatch.setenv(runner.PROFILE_ENVIRONMENT_KEY, "weact_cost")
    monkeypatch.setattr(runner, "load_bot_defaults", lambda: {})
    monkeypatch.setattr(runner, "load_credentials", lambda _: {"app_id": "test-app", "app_secret": "test-secret"})
    monkeypatch.setattr(runner, "credential_configuration_issue", lambda *_: "")
    monkeypatch.setattr(runner, "is_bot_enabled", lambda _: True)
    monkeypatch.setattr(runner, "bot_pid_path", lambda _: tmp_path / "runner.pid")
    monkeypatch.setattr(runner, "append_runtime_event", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(runner, "TaskStore", lambda _path: store)
    monkeypatch.setattr(runner.external_task_dispatch, "ExternalDispatchStore", lambda _path: dispatch_store)
    monkeypatch.setattr(runner, "cleanup_expired", lambda _store: None)
    monkeypatch.setattr(runner, "TaskWorker", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(runner, "ProfessionalApi", lambda _url: SimpleNamespace(health_check=lambda: None))
    monkeypatch.setattr(runner, "FeishuApi", lambda *_args, **_kwargs: api)
    monkeypatch.setattr(runner, "MessageQueue", lambda *_args, **_kwargs: queue)
    thread = SimpleNamespace(start=lambda: None)
    monkeypatch.setattr(runner, "threading", SimpleNamespace(Lock=threading.Lock, Thread=lambda **_kwargs: thread))
    monkeypatch.setattr(lark_oapi, "EventDispatcherHandler", SimpleNamespace(builder=lambda *_: HandlerBuilder()))
    monkeypatch.setattr(feishu_connection, "ReliableClient", lambda *_args, **_kwargs: SimpleNamespace(start=lambda: None))
    assert runner.main() == 0

    message = {
        "header": {"event_id": "event-1"},
        "event": {
            "sender": {"sender_type": "user", "sender_id": {"open_id": "ou_sender"}},
            "message": {"message_id": "message-1", "chat_type": "group", "chat_id": READ_ONLY,
                        "message_type": "text", "content": json.dumps({"text": "@_user_1 hello"}),
                        "mentions": [{"key": "@_user_1", "id": {"open_id": "ou_bot"}}]},
        },
    }
    handlers["message"](message)
    handlers["queued"](message, durable=True)
    assert not enqueued

    for context in ({"open_chat_id": READ_ONLY}, None):
        card = P2CardActionTrigger({"event": {"context": context, "action": {"value": {
            "action": "claim_external_task", "task_id": "old-task",
        }}}})
        response = handlers["card"](card)
        assert response.card is None and response.toast is None

    message["event"]["message"]["chat_id"] = OTHER
    handlers["message"](message)
    assert enqueued == [OTHER]
