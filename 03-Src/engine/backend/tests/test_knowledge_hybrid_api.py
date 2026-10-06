from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_knowledge_search_defaults_to_classic_and_returns_mode_trace():
    response = TestClient(app).post(
        "/api/knowledge/search",
        json={"question": "0.22 是哪来的？", "limit": 5},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["requested_retrieval_mode"] == "classic"
    assert payload["retrieval_mode_used"] == "classic"
    assert "classic" in payload["retrieval_channels"]
    assert payload["evidence_status"] in {"sufficient", "memory_only"}


def test_knowledge_search_hybrid_returns_real_trace_and_preserves_evidence_boundary():
    response = TestClient(app).post(
        "/api/knowledge/search",
        json={
            "question": "清单编码10101002的名称、单位、清单单价、规费和安全生产费是多少？",
            "library_ids": ["cost-aiw"],
            "retrieval_mode": "hybrid",
            "limit": 5,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["requested_retrieval_mode"] == "hybrid"
    assert payload["retrieval_mode_used"] == "hybrid"
    assert payload["retrieval_channels"]["bm25"]["hits"] > 0
    assert payload["retrieval_channels"]["structured"]["hits"] > 0
    assert payload["retrieval_channels"]["vector"]["available"] is True
    assert payload["results"]
    assert all(result["library_id"] == "cost-aiw" for result in payload["results"])


def test_knowledge_ask_curated_demo_stays_outside_both_retrieval_modes():
    response = TestClient(app).post(
        "/api/knowledge/ask",
        json={
            "question": "勘察测量，技术工作费调整系数如何确定？",
            "retrieval_mode": "hybrid",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["preset_answer"] is True
    assert payload["requested_retrieval_mode"] == "hybrid"
    assert payload["retrieval_mode_used"] == "curated_demo"
    assert payload["retrieval_trace"]["bypassed_retrieval"] is True


def test_knowledge_ask_hybrid_degrades_to_evidence_when_model_is_unavailable(monkeypatch):
    import app.main as main_module

    def unavailable(*args, **kwargs):
        raise RuntimeError("model unavailable for test")

    monkeypatch.setattr(main_module, "call_chat_completion", unavailable)
    response = TestClient(app).post(
        "/api/knowledge/ask",
        json={"question": "0.22 是哪来的？", "retrieval_mode": "hybrid"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["evidence_found"] is True
    assert payload["answer_mode"] == "evidence_fallback"
    assert payload["debug"] is None
    assert any("model_unavailable" in reason for reason in payload["degradation_reasons"])
    assert "本回答只解释依据，不改变程序填价结果。" in payload["answer"]


def test_knowledge_libraries_reports_offline_hybrid_capability():
    response = TestClient(app).get("/api/knowledge/libraries")

    assert response.status_code == 200
    capabilities = response.json()["retrieval_capabilities"]
    assert capabilities["default_mode"] == "classic"
    assert capabilities["offline"] is True
    assert capabilities["embedding"]["provider"] == "local-hash"
    assert capabilities["rerank"]["provider"] == "local-rule"


def test_invalid_retrieval_mode_is_rejected():
    response = TestClient(app).post(
        "/api/knowledge/search",
        json={"question": "0.22 是哪来的？", "retrieval_mode": "unknown"},
    )

    assert response.status_code == 400
