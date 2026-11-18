import json
from types import SimpleNamespace

import httpx

from serve import GROUP_NAME, SPEAKER_NAME, WeActFeed, latest_speech, pin_office_build, sha256_file


def message(message_id, when, *, chat="oc_test", sender="ou_owner", text="Hello", kind="text", deleted=False):
    return {
        "chat_id": chat, "sender": {"id": sender, "sender_type": "user"}, "message_id": message_id,
        "create_time": str(when), "msg_type": kind, "deleted": deleted,
        "body": {"content": json.dumps({"text": text})},
    }


def test_keeps_only_new_text_from_the_bound_speaker_and_group():
    items = [
        message("wrong_chat", 112, chat="oc_elsewhere"),
        message("colleague", 111, sender="ou_other"),
        message("card", 110, kind="interactive"),
        message("deleted", 109, deleted=True),
        message("old", 91),
        message("newest", 106, text=" <b>Literal</b> "),
        message("earlier", 105),
    ]
    assert latest_speech(items, "oc_test", "ou_owner", 100) == ((106, "newest"), "<b>Literal</b>")


def test_live_feed_uses_a_shared_read_cache_and_does_not_repeat_a_message():
    requests = []
    returned = []

    def history(request):
        requests.append(request)
        assert request.method == "GET"
        assert request.url.params["container_id"] == "oc_test"
        return httpx.Response(200, json={"code": 0, "data": {"items": returned}})

    with httpx.Client(transport=httpx.MockTransport(history)) as client:
        api = SimpleNamespace(
            base_url="https://weact.test/open-apis",
            client=client,
            _headers=lambda: {},
            list_chats=lambda: [{"name": GROUP_NAME, "chat_id": "oc_test"}],
            list_chat_members=lambda _: {"members": [{"name": SPEAKER_NAME, "member_id": "ou_owner"}]},
        )
        feed = WeActFeed(api)
        returned.append(message("new", feed.since_ms + 1))
        first = {"state": "ready", "message": {"text": "Hello", "sequence": 1}}
        assert feed.snapshot() == first
        assert feed.snapshot() == first
        assert len(requests) == 1
        feed.next_poll = 0
        assert feed.snapshot() == first
        assert len(requests) == 2


def test_office_snapshot_keeps_a_matched_page_and_script_during_publication(tmp_path):
    build = tmp_path / "build"
    cache = tmp_path / "cache"
    viewer = build / "office-twin" / "viewer"
    viewer.mkdir(parents=True)
    page = viewer / "index.html"
    script = viewer / "sandbox-layout.js"
    manifest = build / "astra-build.json"

    def publish(page_bytes, script_bytes):
        page.write_bytes(page_bytes)
        script.write_bytes(script_bytes)
        sources = {f"public/{file.relative_to(build).as_posix()}": sha256_file(file) for file in (page, script)}
        manifest.write_text(json.dumps({"sources": sources}), encoding="utf-8")

    publish(b"old page", b"old script")
    first = pin_office_build(build, cache)
    script.write_bytes(b"new script")
    assert pin_office_build(build, cache) == first
    assert (first / "office-twin/viewer/sandbox-layout.js").read_bytes() == b"old script"

    publish(b"new page", b"new script")
    second = pin_office_build(build, cache)
    assert second != first
    assert (second / "office-twin/viewer/index.html").read_bytes() == b"new page"
    assert (second / "office-twin/viewer/sandbox-layout.js").read_bytes() == b"new script"
