from __future__ import annotations

import json
import ssl
from urllib.error import HTTPError, URLError

import pytest

from app import llm


class _FakeResponse:
    def __init__(self, payload: dict):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self) -> bytes:
        return json.dumps(self.payload, ensure_ascii=False).encode("utf-8")

    def close(self) -> None:
        return None


def test_chat_completion_retries_transient_ssl_eof(monkeypatch):
    calls = 0
    delays: list[float] = []

    def fake_urlopen(request, timeout):
        nonlocal calls
        calls += 1
        if calls < 3:
            raise URLError(ssl.SSLEOFError(8, "unexpected eof"))
        return _FakeResponse({"choices": [{"message": {"content": "重试成功"}}]})

    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(llm, "urlopen", fake_urlopen)
    monkeypatch.setattr(llm.time, "sleep", delays.append)

    answer = llm.call_chat_completion(llm.LlmConfig(), [{"role": "user", "content": "你好"}])

    assert answer == "重试成功"
    assert calls == 3
    assert delays == [0.5, 1.5]


def test_chat_completion_does_not_retry_http_error(monkeypatch):
    calls = 0

    def fake_urlopen(request, timeout):
        nonlocal calls
        calls += 1
        raise HTTPError(request.full_url, 400, "bad request", {}, _FakeResponse({"error": "bad"}))

    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(llm, "urlopen", fake_urlopen)

    with pytest.raises(RuntimeError, match="HTTP 400"):
        llm.call_chat_completion(llm.LlmConfig(), [{"role": "user", "content": "你好"}])

    assert calls == 1
