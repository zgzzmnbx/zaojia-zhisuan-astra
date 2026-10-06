from __future__ import annotations

import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app import main as main_module  # noqa: E402
from app.knowledge_libraries import resolve_knowledge_library_selection  # noqa: E402
from app.knowledge_qa import (  # noqa: E402
    HybridRetrievalError,
    hybrid_index_path,
    hybrid_search_knowledge,
    rebuild_hybrid_index,
)


REPORT_PATH = Path(__file__).with_name("knowledge_qa_hybrid_fault_injection_report.json")


def run_fault_injection() -> dict[str, object]:
    selection = resolve_knowledge_library_selection(("project-core",), project_root=PROJECT_ROOT)
    question = "表2哪些项目不参与技术工作费金额计算？"
    with TemporaryDirectory(prefix="zaojiazhisuan-rag-fault-") as temp_dir:
        base_index = Path(temp_dir) / "knowledge.json"
        valid = hybrid_search_knowledge(
            question,
            limit=5,
            project_root=PROJECT_ROOT,
            index_path=base_index,
            sources=list(selection.sources),
            source_library_ids=selection.source_library_ids,
        )
        target = hybrid_index_path(base_index)
        assert target is not None and target.exists()
        valid_bytes = target.read_bytes()

        target.write_text("{broken", encoding="utf-8")
        try:
            hybrid_search_knowledge(
                question,
                limit=5,
                project_root=PROJECT_ROOT,
                index_path=base_index,
                sources=list(selection.sources),
                source_library_ids=selection.source_library_ids,
            )
        except HybridRetrievalError as exc:
            corrupt_signal = str(exc)
        else:
            raise AssertionError("corrupt hybrid index did not fail closed")

        target.write_bytes(valid_bytes)
        vector_degraded = hybrid_search_knowledge(
            question,
            limit=5,
            project_root=PROJECT_ROOT,
            index_path=base_index,
            sources=list(selection.sources),
            source_library_ids=selection.source_library_ids,
            vector_backend="unavailable",
        )
        rerank_degraded = hybrid_search_knowledge(
            "表4水文地质勘察简单、中等、复杂技术工作费调整系数分别是多少？",
            limit=5,
            project_root=PROJECT_ROOT,
            index_path=base_index,
            sources=list(selection.sources),
            source_library_ids=selection.source_library_ids,
            rerank_delay_ms=250,
        )

        with (
            patch.object(main_module, "RUNTIME_DIR", Path(temp_dir) / "runtime"),
            patch.object(main_module, "_record_llm_request", lambda *args, **kwargs: None),
            patch.object(main_module, "call_chat_completion", side_effect=RuntimeError("injected model outage")),
        ):
            model_response = TestClient(main_module.app).post(
                "/api/knowledge/ask",
                json={"question": "0.22 是哪来的？", "retrieval_mode": "hybrid"},
            )
        model_payload = model_response.json()

        target.write_bytes(valid_bytes)
        restored = hybrid_search_knowledge(
            question,
            limit=5,
            project_root=PROJECT_ROOT,
            index_path=base_index,
            sources=list(selection.sources),
            source_library_ids=selection.source_library_ids,
        )
        rebuilt = rebuild_hybrid_index(
            project_root=PROJECT_ROOT,
            index_path=base_index,
            sources=list(selection.sources),
            source_library_ids=selection.source_library_ids,
        )

    return {
        "red": {"fault": "corrupt_vector_index", "signal": corrupt_signal},
        "degraded": {
            "vector": vector_degraded.trace["degradation_reasons"],
            "rerank": rerank_degraded.trace["degradation_reasons"],
            "model": {
                "status_code": model_response.status_code,
                "answer_mode": model_payload.get("answer_mode"),
                "reasons": model_payload.get("degradation_reasons"),
            },
        },
        "restored": {
            "rebuild_chunks": len(rebuilt),
            "search_results": len(restored.results),
            "evidence_status": restored.trace.get("evidence_status"),
            "green": bool(valid.results and restored.results and model_response.status_code == 200),
        },
    }


if __name__ == "__main__":
    report = run_fault_injection()
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
