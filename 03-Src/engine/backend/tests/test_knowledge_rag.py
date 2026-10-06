from __future__ import annotations

import json
from pathlib import Path

from app.knowledge_qa import search_knowledge


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "knowledge_qa_regression_cases.json"
EVAL_PATH = Path(__file__).parent / "fixtures" / "knowledge_qa_rag_evaluation.json"


def test_rag_evaluation_keeps_existing_regression_cases_and_adds_required_categories():
    cases = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))["cases"]
    assert len(cases) >= 10
    assert {case["id"] for case in cases} >= {
        "demo_route_map_price",
        "project_table2_complex",
        "project_table3_levels",
        "cost_code_10101002",
        "cost_digital_management_5000",
        "project_no_evidence",
    }
    evaluation = json.loads(EVAL_PATH.read_text(encoding="utf-8"))
    assert any(case["evaluationClass"] == "conflict_guard" for case in evaluation["cases"])
    assert any(case.get("variants") for case in evaluation["cases"])


def test_rag_evaluation_annotations_have_stable_golden_evidence():
    evaluation = json.loads(EVAL_PATH.read_text(encoding="utf-8"))
    for case in evaluation["cases"]:
        if case["evaluationClass"] == "unsupported":
            assert case["goldenEvidence"] == []
            continue
        assert case["goldenEvidence"]
        for reference in case["goldenEvidence"]:
            assert reference.get("sourceContains")


def test_classic_search_preserves_the_known_table2_exception_evidence():
    result = search_knowledge("表2哪些项目不参与技术工作费金额计算？", limit=5)
    assert result
    assert any(
        "表2-通用工程测量费用规则" in item.title_path
        and "线路航测" in item.snippet
        for item in result
    )


def test_classic_search_preserves_the_no_evidence_boundary():
    assert search_knowledge("火星土豆怎么收费？", limit=5) == []
