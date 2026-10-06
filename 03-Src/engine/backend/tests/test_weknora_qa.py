import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app import weknora_qa


def test_enhanced_is_disabled_without_explicit_server_opt_in(monkeypatch):
    monkeypatch.delenv("WEKNORA_QA_ENABLED", raising=False)
    monkeypatch.setattr(weknora_qa, "_local_request", lambda request: None)
    client = TestClient(app)
    assert client.get("/api/knowledge/capabilities").json()["available"] is False
    result = client.post("/api/knowledge/ask-stream", json={})
    assert result.status_code == 403
    assert result.json()["detail"]["code"] == "MODULE_DISABLED"


def test_rejects_scope_and_model_override_before_upstream(monkeypatch):
    monkeypatch.setenv("WEKNORA_QA_ENABLED", "1")
    monkeypatch.setenv("WEKNORA_QA_BEARER_TOKEN", "test-only-token")
    monkeypatch.setattr(weknora_qa, "_local_request", lambda request: None)
    client = TestClient(app)
    base = {
        "question": "资料适用范围是什么？",
        "engine_mode": "enhanced",
        "library_ids": ["cost-aiw"],
        "context_type": "general",
        "row_context": None,
        "request_id": "scope-test-1",
    }
    assert client.get("/api/knowledge/capabilities").json()["document_count"] == 13
    for mutation, expected in [
        ({"library_ids": ["project-core"]}, "INVALID_SCOPE"),
        ({"context_type": "row"}, "INVALID_SCOPE"),
        ({"strict_evidence": False}, "UNSUPPORTED_CONTEXT"),
        ({"document_ids": []}, "INVALID_SCOPE"),
        ({"document_ids": ["unknown"]}, "INVALID_SCOPE"),
        ({"engine_mode": "auto"}, "ENGINE_NOT_SUPPORTED"),
    ]:
        response = client.post("/api/knowledge/ask-stream", json={**base, **mutation})
        assert response.status_code == 400
        assert response.json()["detail"]["code"] == expected


def test_reference_allowlist_fails_closed():
    scope = json.loads((Path(__file__).resolve().parents[2] / "config/knowledge-weknora-scope.json").read_text(encoding="utf-8"))
    allowed = {item["knowledge_id"]: item for item in scope["documents"]}
    first = next(iter(allowed))
    refs = weknora_qa._normalize_references([{"id": "chunk-1", "knowledge_id": first, "content": "sample"}], allowed, "test")
    assert len(refs) == 1
    assert refs[0]["host_document_id"] == allowed[first]["asset_id"]
    try:
        weknora_qa._normalize_references([{"id": "foreign", "knowledge_id": "not-approved"}], allowed, "test")
    except ValueError:
        pass
    else:
        raise AssertionError("foreign reference was accepted")


def test_answer_markers_only_expose_verified_citations():
    citations = [
        {"locator_value": "approved", "title": "approved"},
        {"locator_value": "unrelated", "title": "unrelated"},
    ]
    answer, selected = weknora_qa._clean_answer_and_citations(
        '依据 <kb doc="a" chunk_id="approved" kb_id="b" /> **已核实**。', citations
    )
    assert answer == "依据  已核实。"
    assert [item["title"] for item in selected] == ["approved"]
    try:
        weknora_qa._clean_answer_and_citations('<kb chunk_id="foreign" />', citations)
    except ValueError:
        pass
    else:
        raise AssertionError("unverified answer marker was accepted")


def test_scoped_chat_key_is_read_from_protected_file(monkeypatch, tmp_path):
    key_file = tmp_path / "key"
    key_file.write_text("test-key", encoding="ascii")
    monkeypatch.setenv("WEKNORA_QA_ENABLED", "1")
    monkeypatch.setattr(weknora_qa, "ROOT", tmp_path)
    monkeypatch.setenv("WEKNORA_QA_API_KEY_FILE", "key")
    _, token, _ = weknora_qa._settings()
    assert weknora_qa._auth_headers(token) == {"X-API-Key": "test-key"}
