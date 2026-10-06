from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.knowledge_libraries import resolve_knowledge_library_selection
from app.knowledge_qa import (
    HybridRetrievalError,
    hybrid_index_path,
    hybrid_search_knowledge,
    rebuild_hybrid_index,
)


def _selection(library_ids: tuple[str, ...] = ("project-core",)):
    return resolve_knowledge_library_selection(library_ids, project_root=Path.cwd())


def test_hybrid_search_exposes_real_channels_metadata_and_numeric_gate():
    selection = _selection(("cost-aiw",))
    response = hybrid_search_knowledge(
        "清单编码10101002的名称、单位、清单单价、规费和安全生产费是多少？",
        limit=5,
        project_root=Path.cwd(),
        index_path=selection.index_path,
        sources=list(selection.sources),
        source_library_ids=selection.source_library_ids,
    )

    assert response.results
    assert response.trace["retrieval_mode_used"] == "hybrid"
    assert response.trace["channels"]["bm25"]["hits"] > 0
    assert response.trace["channels"]["structured"]["hits"] > 0
    assert response.trace["channels"]["vector"]["hits"] > 0
    assert response.trace["hard_gate"]["constraints"]["codes"] == ["10101002"]
    assert any("10101002" in result.snippet for result in response.results)
    assert all("cost-aiw" == result.library_id for result in response.results)


def test_hybrid_vector_failure_degrades_to_lexical_and_structured_channels():
    selection = _selection()
    response = hybrid_search_knowledge(
        "表2哪些项目不参与技术工作费金额计算？",
        limit=5,
        project_root=Path.cwd(),
        index_path=selection.index_path,
        sources=list(selection.sources),
        source_library_ids=selection.source_library_ids,
        vector_backend="unavailable",
    )

    assert response.results
    assert response.trace["degraded"] is True
    assert "vector_backend_unavailable" in response.trace["degradation_reasons"]
    assert response.trace["channels"]["vector"]["available"] is False
    assert response.trace["channels"]["bm25"]["hits"] > 0
    assert response.trace["channels"]["structured"]["hits"] > 0


def test_hybrid_rerank_timeout_keeps_fused_results():
    selection = _selection()
    response = hybrid_search_knowledge(
        "表4水文地质勘察简单、中等、复杂技术工作费调整系数分别是多少？",
        limit=5,
        project_root=Path.cwd(),
        index_path=selection.index_path,
        sources=list(selection.sources),
        source_library_ids=selection.source_library_ids,
        rerank_delay_ms=250,
    )

    assert response.results
    assert response.trace["degraded"] is True
    assert any("rerank_timeout" in reason for reason in response.trace["degradation_reasons"])
    assert response.trace["rerank"]["available"] is False


def test_corrupt_hybrid_index_is_reported_and_explicit_rebuild_restores_it(tmp_path):
    selection = _selection()
    base_index = tmp_path / "knowledge.json"
    response = hybrid_search_knowledge(
        "表2哪些项目不参与技术工作费金额计算？",
        limit=5,
        project_root=Path.cwd(),
        index_path=base_index,
        sources=list(selection.sources),
        source_library_ids=selection.source_library_ids,
    )
    assert response.results
    target = hybrid_index_path(base_index)
    assert target is not None and target.exists()
    target.write_text("{broken", encoding="utf-8")

    with pytest.raises(HybridRetrievalError, match="hybrid_vector_index_corrupt"):
        hybrid_search_knowledge(
            "表2哪些项目不参与技术工作费金额计算？",
            limit=5,
            project_root=Path.cwd(),
            index_path=base_index,
            sources=list(selection.sources),
            source_library_ids=selection.source_library_ids,
        )

    rebuilt = rebuild_hybrid_index(
        project_root=Path.cwd(),
        index_path=base_index,
        sources=list(selection.sources),
        source_library_ids=selection.source_library_ids,
    )
    assert rebuilt
    payload = json.loads(target.read_text(encoding="utf-8"))
    assert payload["hybrid_index_version"]
