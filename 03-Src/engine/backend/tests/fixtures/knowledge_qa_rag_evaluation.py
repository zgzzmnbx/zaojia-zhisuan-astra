from __future__ import annotations

import argparse
import json
import math
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from statistics import median
from typing import Any, Iterable

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.knowledge_libraries import resolve_knowledge_library_selection  # noqa: E402
from app.knowledge_qa import (  # noqa: E402
    KnowledgeChunk,
    KnowledgeSearchResult,
    hybrid_search_knowledge,
    load_or_build_hybrid_index,
    load_or_build_index,
    search_knowledge,
)


EVAL_PATH = Path(__file__).with_name("knowledge_qa_rag_evaluation.json")
CASES_PATH = Path(__file__).with_name("knowledge_qa_regression_cases.json")
DEFAULT_REPORT_PATH = Path(__file__).with_name("knowledge_qa_classic_baseline.json")
DEFAULT_HYBRID_REPORT_PATH = Path(__file__).with_name("knowledge_qa_hybrid_report.json")


@dataclass(frozen=True)
class EvaluationItem:
    case_id: str
    question: str
    library_ids: tuple[str, ...]
    evaluation_class: str
    golden_evidence: tuple[dict[str, Any], ...]
    must_remain_unsupported: bool
    variant_id: str | None = None


def load_evaluation_items(
    eval_path: Path = EVAL_PATH,
    cases_path: Path = CASES_PATH,
) -> list[EvaluationItem]:
    annotations = json.loads(eval_path.read_text(encoding="utf-8"))
    source_cases = {
        str(case["id"]): case
        for case in json.loads(cases_path.read_text(encoding="utf-8")).get("cases", [])
    }
    items: list[EvaluationItem] = []
    for annotation in annotations.get("cases", []):
        source = source_cases[str(annotation["caseId"])]
        base = EvaluationItem(
            case_id=str(source["id"]),
            question=str(source["question"]),
            library_ids=tuple(str(item) for item in source.get("libraryIds", [])),
            evaluation_class=str(annotation.get("evaluationClass") or source.get("questionType") or "simple"),
            golden_evidence=tuple(annotation.get("goldenEvidence") or ()),
            must_remain_unsupported=bool(annotation.get("mustRemainUnsupported")),
        )
        items.append(base)
        for variant in annotation.get("variants") or []:
            items.append(
                EvaluationItem(
                    case_id=base.case_id,
                    question=str(variant["question"]),
                    library_ids=base.library_ids,
                    evaluation_class=base.evaluation_class,
                    golden_evidence=base.golden_evidence,
                    must_remain_unsupported=base.must_remain_unsupported,
                    variant_id=str(variant.get("id") or "variant"),
                )
            )
    return items


def _normalized(value: Any) -> str:
    return "" if value is None else str(value).replace("\\", "/").casefold()


def _chunk_matches(chunk: KnowledgeChunk, reference: dict[str, Any]) -> bool:
    source_contains = str(reference.get("sourceContains") or "")
    title_contains = str(reference.get("titleContains") or "")
    if source_contains and _normalized(source_contains) not in _normalized(chunk.source_file):
        return False
    if title_contains and _normalized(title_contains) not in _normalized(chunk.title_path):
        return False
    return all(
        _normalized(term) in _normalized(chunk.content)
        for term in (reference.get("contentContains") or [])
    )


def _gold_chunk_ids(chunks: Iterable[KnowledgeChunk], references: Iterable[dict[str, Any]]) -> set[str]:
    return {
        chunk.id
        for chunk in chunks
        if any(_chunk_matches(chunk, reference) for reference in references)
    }


def _dcg(relevance: list[int], k: int) -> float:
    return sum(
        relevance[index - 1] / math.log2(index + 1)
        for index in range(1, min(k, len(relevance)) + 1)
    )


def _ndcg(result_ids: list[str], gold_ids: set[str], k: int = 10) -> float:
    relevance = [1 if result_id in gold_ids else 0 for result_id in result_ids[:k]]
    ideal = [1] * min(len(gold_ids), k)
    ideal_score = _dcg(ideal, k)
    return round(_dcg(relevance, k) / ideal_score, 6) if ideal_score else 1.0


def _timed_search(item: EvaluationItem, *, limit: int, repeats: int) -> tuple[list[KnowledgeSearchResult], list[float]]:
    selection = resolve_knowledge_library_selection(item.library_ids, project_root=PROJECT_ROOT)
    # Warm the source/index cache before measuring hot retrieval.
    search_knowledge(
        item.question,
        limit=limit,
        project_root=PROJECT_ROOT,
        index_path=selection.index_path,
        sources=list(selection.sources),
    )
    results: list[KnowledgeSearchResult] = []
    timings: list[float] = []
    for _ in range(repeats):
        started = time.perf_counter()
        results = search_knowledge(
            item.question,
            limit=limit,
            project_root=PROJECT_ROOT,
            index_path=selection.index_path,
            sources=list(selection.sources),
        )
        timings.append((time.perf_counter() - started) * 1000)
    return results, timings


def evaluate_classic(
    *,
    items: list[EvaluationItem] | None = None,
    repeats: int = 5,
    limit: int = 10,
) -> dict[str, Any]:
    items = items or load_evaluation_items()
    index_cache: dict[tuple[str, ...], list[KnowledgeChunk]] = {}
    rows: list[dict[str, Any]] = []
    retrieval_items = [item for item in items if item.evaluation_class != "curated_demo"]
    for item in items:
        selection = resolve_knowledge_library_selection(item.library_ids, project_root=PROJECT_ROOT)
        cache_key = tuple(str(path.resolve()) for path in selection.sources)
        chunks = index_cache.get(cache_key)
        if chunks is None:
            chunks = load_or_build_index(
                project_root=PROJECT_ROOT,
                index_path=selection.index_path,
                sources=list(selection.sources),
            )
            index_cache[cache_key] = chunks
        if item.evaluation_class == "curated_demo":
            rows.append(
                {
                    "case_id": item.case_id,
                    "variant_id": item.variant_id,
                    "evaluation_class": item.evaluation_class,
                    "excluded_from_retrieval_metrics": True,
                    "reason": "curated_demo 在检索前确定性返回人工审核答案",
                    "golden_evidence_count": len(_gold_chunk_ids(chunks, item.golden_evidence)),
                }
            )
            continue
        results, timings = _timed_search(item, limit=limit, repeats=repeats)
        gold_ids = _gold_chunk_ids(chunks, item.golden_evidence)
        result_ids = [result.id for result in results]
        hit_count = len(set(result_ids[:5]) & gold_ids)
        top_k_count = min(5, len(result_ids))
        retrieval_precision_at_5 = hit_count / top_k_count if top_k_count else (1.0 if not gold_ids else 0.0)
        citation_support_at_5 = hit_count / len(gold_ids) if gold_ids else (1.0 if not results else 0.0)
        unsupported_correct = item.must_remain_unsupported and not results
        rows.append(
            {
                "case_id": item.case_id,
                "variant_id": item.variant_id,
                "evaluation_class": item.evaluation_class,
                "excluded_from_retrieval_metrics": False,
                "golden_evidence_count": len(gold_ids),
                "golden_evidence_recall_at_5": round(hit_count / len(gold_ids), 6) if gold_ids else None,
                "retrieval_precision_at_5": round(retrieval_precision_at_5, 6),
                "citation_support_rate_at_5": round(citation_support_at_5, 6),
                "ndcg_at_10": _ndcg(result_ids, gold_ids, 10),
                "evidence_found": bool(results),
                "unsupported_correct": unsupported_correct if item.must_remain_unsupported else None,
                "top_results": [
                    {
                        "id": result.id,
                        "source_file": result.source_file,
                        "title_path": result.title_path,
                        "score": result.score,
                    }
                    for result in results[:5]
                ],
                "latency_ms": {
                    "median": round(median(timings), 3),
                    "p95": round(max(timings), 3),
                    "samples": len(timings),
                },
            }
        )

    measured = [row for row in rows if not row.get("excluded_from_retrieval_metrics")]
    recall_values = [row["golden_evidence_recall_at_5"] for row in measured if row["golden_evidence_recall_at_5"] is not None]
    ndcg_values = [row["ndcg_at_10"] for row in measured]
    retrieval_precision_values = [row["retrieval_precision_at_5"] for row in measured]
    citation_support_values = [row["citation_support_rate_at_5"] for row in measured if row["golden_evidence_recall_at_5"] is not None]
    unsupported_rows = [row for row in measured if row["unsupported_correct"] is not None]
    latency_values = [row["latency_ms"]["p95"] for row in measured]
    protected_rows = [
        row
        for row in measured
        if row.get("evaluation_class") in {"exact_numeric_guard", "exact_code_guard"}
        and row.get("golden_evidence_recall_at_5") is not None
    ]
    false_answer_count = sum(1 for row in unsupported_rows if not row["unsupported_correct"])
    return {
        "schema_version": 1,
        "mode": "classic",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "environment": {
            "python": sys.version.split()[0],
            "platform": sys.platform,
            "index_cache": "Codex-Temp/runtime/knowledge-qa-index-【codex】.json及按资料库选择派生缓存",
            "source_of_truth": "正式 Markdown/Excel/CSV、规则资产、结构化计价库和已确认知识记忆",
        },
        "dataset": {
            "all_items": len(items),
            "retrieval_items": len(measured),
            "curated_demo_items": len(items) - len(measured),
            "rewrite_items": sum(1 for item in measured if item.get("variant_id")),
            "conflict_items": sum(1 for item in measured if item.get("evaluation_class") == "conflict_guard"),
            "unsupported_items": len(unsupported_rows),
        },
        "metrics": {
            "golden_evidence_recall_at_5": round(sum(recall_values) / len(recall_values), 6) if recall_values else 0.0,
            "retrieval_precision_at_5": round(sum(retrieval_precision_values) / len(retrieval_precision_values), 6) if retrieval_precision_values else 0.0,
            "citation_support_rate_at_5": round(sum(citation_support_values) / len(citation_support_values), 6) if citation_support_values else 0.0,
            "citation_accuracy_at_5": round(sum(citation_support_values) / len(citation_support_values), 6) if citation_support_values else 0.0,
            "precision_code_protection_recall_at_5": round(
                sum(row["golden_evidence_recall_at_5"] for row in protected_rows) / len(protected_rows), 6
            ) if protected_rows else 0.0,
            "ndcg_at_10": round(sum(ndcg_values) / len(ndcg_values), 6) if ndcg_values else 0.0,
            "unsupported_false_answer_rate": round(false_answer_count / len(unsupported_rows), 6) if unsupported_rows else 0.0,
            "hot_retrieval_p95_ms": round(max(latency_values), 3) if latency_values else 0.0,
        },
        "items": rows,
        "notes": [
            "四道预置演示题按设计在检索前返回人工审核答案，未计入 classic 检索召回分母。",
            "retrieval_precision_at_5 是 top-5 检索结果中黄金证据的比例；citation_support_rate_at_5 是有黄金证据题目被 top-5 支撑的比例，二者均不冒充模型正文引用准确率。",
            "citation_accuracy_at_5 在本评测中定义为黄金证据被 top-5 引用集合支撑的比例；检索结果纯度另由 retrieval_precision_at_5 单列。",
            "当前 classic 报告先冻结，不能因为后续 hybrid 评测不达标而修改题面、黄金证据或阈值。",
        ],
    }


def write_classic_report(path: Path = DEFAULT_REPORT_PATH, **kwargs: Any) -> dict[str, Any]:
    report = evaluate_classic(**kwargs)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def evaluate_hybrid(
    *,
    items: list[EvaluationItem] | None = None,
    repeats: int = 5,
    limit: int = 10,
) -> dict[str, Any]:
    items = items or load_evaluation_items()
    rows: list[dict[str, Any]] = []
    for item in items:
        selection = resolve_knowledge_library_selection(item.library_ids, project_root=PROJECT_ROOT)
        chunks = load_or_build_hybrid_index(
            project_root=PROJECT_ROOT,
            index_path=selection.index_path,
            sources=list(selection.sources),
            source_library_ids=selection.source_library_ids,
        )
        if item.evaluation_class == "curated_demo":
            rows.append(
                {
                    "case_id": item.case_id,
                    "variant_id": item.variant_id,
                    "evaluation_class": item.evaluation_class,
                    "excluded_from_retrieval_metrics": True,
                    "reason": "curated_demo 在检索前确定性返回人工审核答案",
                    "golden_evidence_count": len(_gold_chunk_ids(chunks, item.golden_evidence)),
                }
            )
            continue
        # 先预热可重建缓存，再只统计热路径。
        hybrid_search_knowledge(
            item.question,
            limit=limit,
            project_root=PROJECT_ROOT,
            index_path=selection.index_path,
            sources=list(selection.sources),
            source_library_ids=selection.source_library_ids,
        )
        timings: list[float] = []
        response = None
        for _ in range(max(1, repeats)):
            started = time.perf_counter()
            response = hybrid_search_knowledge(
                item.question,
                limit=limit,
                project_root=PROJECT_ROOT,
                index_path=selection.index_path,
                sources=list(selection.sources),
                source_library_ids=selection.source_library_ids,
            )
            timings.append((time.perf_counter() - started) * 1000)
        assert response is not None
        results = response.results
        gold_ids = _gold_chunk_ids(chunks, item.golden_evidence)
        result_ids = [result.id for result in results]
        hit_count = len(set(result_ids[:5]) & gold_ids)
        top_k_count = min(5, len(result_ids))
        unsupported_correct = item.must_remain_unsupported and not results
        retrieval_precision_at_5 = hit_count / top_k_count if top_k_count else (1.0 if not gold_ids else 0.0)
        citation_support_at_5 = hit_count / len(gold_ids) if gold_ids else (1.0 if not results else 0.0)
        rows.append(
            {
                "case_id": item.case_id,
                "variant_id": item.variant_id,
                "evaluation_class": item.evaluation_class,
                "excluded_from_retrieval_metrics": False,
                "golden_evidence_count": len(gold_ids),
                "golden_evidence_recall_at_5": round(hit_count / len(gold_ids), 6) if gold_ids else None,
                "retrieval_precision_at_5": round(retrieval_precision_at_5, 6),
                "citation_support_rate_at_5": round(citation_support_at_5, 6),
                "ndcg_at_10": _ndcg(result_ids, gold_ids, 10),
                "evidence_found": bool(results),
                "evidence_status": response.trace.get("evidence_status"),
                "unsupported_correct": unsupported_correct if item.must_remain_unsupported else None,
                "top_results": [
                    {
                        "id": result.id,
                        "source_file": result.source_file,
                        "title_path": result.title_path,
                        "score": result.score,
                        "channels": list(result.channels),
                        "authority_level": result.authority_level,
                    }
                    for result in results[:5]
                ],
                "trace": response.trace,
                "latency_ms": {
                    "median": round(median(timings), 3),
                    "p95": round(max(timings), 3),
                    "samples": len(timings),
                },
            }
        )
    measured = [row for row in rows if not row.get("excluded_from_retrieval_metrics")]
    recall_values = [row["golden_evidence_recall_at_5"] for row in measured if row["golden_evidence_recall_at_5"] is not None]
    precision_values = [row["retrieval_precision_at_5"] for row in measured]
    citation_values = [row["citation_support_rate_at_5"] for row in measured if row["golden_evidence_recall_at_5"] is not None]
    ndcg_values = [row["ndcg_at_10"] for row in measured]
    unsupported_rows = [row for row in measured if row["unsupported_correct"] is not None]
    latency_values = [row["latency_ms"]["p95"] for row in measured]
    protected_rows = [
        row
        for row in measured
        if row.get("evaluation_class") in {"exact_numeric_guard", "exact_code_guard"}
        and row.get("golden_evidence_recall_at_5") is not None
    ]
    false_answer_count = sum(1 for row in unsupported_rows if not row["unsupported_correct"])
    channel_degradations = [
        reason
        for row in measured
        for reason in row["trace"].get("degradation_reasons", [])
    ]
    return {
        "schema_version": 1,
        "mode": "hybrid",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "environment": {
            "python": sys.version.split()[0],
            "platform": sys.platform,
            "index_cache": "Codex-Temp/runtime/knowledge-qa-index-【codex】.json及按资料库选择派生 hybrid 缓存",
            "source_of_truth": "正式 Markdown/Excel/CSV、规则资产、结构化计价库和已确认知识记忆",
            "embedding": "local-hash-embedding-v1 / 384 dimensions / no external model artifact",
            "reranker": "local-rule-rerank-v1 / stdlib-only",
        },
        "dataset": {
            "all_items": len(items),
            "retrieval_items": len(measured),
            "curated_demo_items": len(items) - len(measured),
            "rewrite_items": sum(1 for row in measured if row.get("variant_id")),
            "conflict_items": sum(1 for row in measured if row.get("evaluation_class") == "conflict_guard"),
            "unsupported_items": len(unsupported_rows),
        },
        "metrics": {
            "golden_evidence_recall_at_5": round(sum(recall_values) / len(recall_values), 6) if recall_values else 0.0,
            "retrieval_precision_at_5": round(sum(precision_values) / len(precision_values), 6) if precision_values else 0.0,
            "citation_support_rate_at_5": round(sum(citation_values) / len(citation_values), 6) if citation_values else 0.0,
            "citation_accuracy_at_5": round(sum(citation_values) / len(citation_values), 6) if citation_values else 0.0,
            "precision_code_protection_recall_at_5": round(
                sum(row["golden_evidence_recall_at_5"] for row in protected_rows) / len(protected_rows), 6
            ) if protected_rows else 0.0,
            "ndcg_at_10": round(sum(ndcg_values) / len(ndcg_values), 6) if ndcg_values else 0.0,
            "unsupported_false_answer_rate": round(false_answer_count / len(unsupported_rows), 6) if unsupported_rows else 0.0,
            "hot_retrieval_p95_ms": round(max(latency_values), 3) if latency_values else 0.0,
            "degradation_count": len(channel_degradations),
        },
        "comparison": {
            "classic_report": str(DEFAULT_REPORT_PATH),
            "default_mode_remains": "classic",
            "hybrid_is_not_allowed_to_change_price_or_coefficient_decisions": True,
        },
        "items": rows,
        "notes": [
            "四道预置演示题按设计在检索前返回人工审核答案，未计入 hybrid 检索召回分母。",
            "citation_support_rate_at_5 表示黄金证据被 top-5 支撑的比例；retrieval_precision_at_5 另列 top-5 结果纯度，均不冒充模型正文引用准确率。",
            "citation_accuracy_at_5 在本评测中定义为黄金证据被 top-5 引用集合支撑的比例；检索结果纯度另由 retrieval_precision_at_5 单列。",
            "local-hash-embedding-v1 和 local-rule-rerank-v1 不产生新证据，不参与价格或三个数字裁决。",
        ],
    }


def write_hybrid_report(path: Path = DEFAULT_HYBRID_REPORT_PATH, **kwargs: Any) -> dict[str, Any]:
    report = evaluate_hybrid(**kwargs)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="生成 classic 知识问答检索基线报告")
    parser.add_argument("--mode", choices=("classic", "hybrid"), default="classic")
    parser.add_argument("--output", type=Path, default=DEFAULT_REPORT_PATH)
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()
    evaluator = write_hybrid_report if args.mode == "hybrid" else write_classic_report
    report = evaluator(args.output, repeats=max(1, args.repeats), limit=max(5, args.limit))
    print(json.dumps({"output": str(args.output), "metrics": report["metrics"], "dataset": report["dataset"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
