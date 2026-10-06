from app.knowledge_qa import (
    KnowledgeSearchResult,
    _expand_query_terms,
    build_knowledge_answer_prompt,
    ensure_knowledge_answer,
    normalize_knowledge_answer,
    prepend_ranked_candidate_recommendation,
    split_knowledge_question,
)


def _result(*, snippet: str = "技术工作费调整系数为 0.22。") -> KnowledgeSearchResult:
    return KnowledgeSearchResult(
        id="knowledge-1",
        source_file="项目规则.md",
        source_type="markdown",
        title_path="技术工作费规则 > 表2",
        snippet=snippet,
        score=10.0,
        module="项目规则",
    )


def test_explanatory_prompt_requires_conclusion_evidence_and_boundary_hierarchy():
    prompt = build_knowledge_answer_prompt(
        "技术工作费调整系数为什么是 0.22？",
        [_result()],
    )[1]["content"]

    assert "先看结论、再看依据、最后看边界" in prompt
    assert "## 结论" in prompt
    assert "## 依据与解释" in prompt
    assert "## 项目记忆" in prompt
    assert "## 适用条件与复核" in prompt
    assert "## 使用边界" in prompt
    assert "禁止输出空章节" in prompt
    assert "每条最多 2 句话" in prompt
    assert "禁止输出 HTML/XML 标签" in prompt


def test_dictionary_lookup_keeps_compact_table_without_fixed_sections():
    prompt = build_knowledge_answer_prompt(
        "清单编码 11301001 的清单单价是多少？只回答名称、单位和来源。",
        [_result()],
    )[1]["content"]

    assert "只输出一个简洁的 Markdown 表格" in prompt
    assert "先看结论、再看依据、最后看边界" not in prompt


def test_complex_question_separates_search_answer_and_meta_requirements():
    question = (
        "#知识库：解释0.22技术工作费调整系数：哪些表2项目虽然显示0.22但不参与金额计算？"
        "请用表格回答适用对象、系数、是否参与金额和正式依据。给我讲述原理"
    )

    parts = split_knowledge_question(question)

    assert parts.search_question == "解释0.22技术工作费调整系数：哪些表2项目虽然显示0.22但不参与金额计算"
    assert parts.answer_requirements == "请用表格回答适用对象、系数、是否参与金额和正式依据"
    assert parts.meta_requirements == "给我讲述原理"


def test_complex_question_format_words_do_not_enter_search_terms():
    question = (
        "解释0.22技术工作费调整系数：哪些表2项目虽然显示0.22但不参与金额计算？"
        "请用表格回答适用对象、系数、是否参与金额和正式依据。给我讲述原理"
    )

    terms = _expand_query_terms(question, None)

    assert len(terms) == 18
    assert "技术工作费调整系数" in terms
    assert "工程测量技术工作费" in terms
    assert not any("表格回答" in term for term in terms)
    assert not any("适用对象" in term for term in terms)
    assert "给我讲述原理" not in terms


def test_row_context_values_participate_in_knowledge_retrieval_terms():
    terms = _expand_query_terms(
        "解释这行价格为什么需要复核",
        {
            "sheet_name": "表2-通用工程测量费用",
            "row_number": 5,
            "values": {
                "要素1": "控制测量",
                "要素2": "GPS测量E级",
                "单位": "个",
            },
        },
    )

    assert terms["控制测量"] == 1.5
    assert terms["GPS测量E级"] == 1.5
    assert terms["个"] == 1.5


def test_ranked_ai_fill_candidates_are_guarded_in_model_prompt():
    prompt = build_knowledge_answer_prompt(
        "请解释排序首选",
        [_result()],
        row_context={
            "sheet_name": "表2",
            "row_number": 5,
            "values": {"要素1": "控制测量", "单位": "个"},
            "candidate_recommendations": [
                {"rank": 1, "value": 4274, "similarity": 100, "source": "知识库"},
                {"rank": 2, "value": 3203, "similarity": 75, "source": "知识库"},
            ],
        },
    )[1]["content"]

    assert "candidate_recommendations 已由程序按相似度" in prompt
    assert "只能引用 candidate_recommendations 中已有的数值" in prompt
    assert "最终采用和写入必须由用户确认" in prompt


def test_ranked_ai_fill_answer_always_leads_with_structured_recommendation():
    answer = prepend_ranked_candidate_recommendation(
        "## 依据与解释\n\n模型解释正文。",
        {
            "candidate_recommendations": [
                {
                    "rank": 1,
                    "value": 4274,
                    "similarity": 100,
                    "source": "知识库",
                    "reason": "单位一致，4/4 个非空要素一致。",
                    "risk_tips": ["仍需核对主匹配未采用原因。"],
                }
            ]
        },
    )

    assert answer.startswith("**结构化排序首选：4274**")
    assert "相似度 100%" in answer
    assert "仍需人工确认后写入" in answer
    assert answer.endswith("模型解释正文。")


def test_normalize_knowledge_answer_removes_markup_and_nested_heading_bullets():
    answer = normalize_knowledge_answer(
        "- ### 规则总览\n\n"
        "说明：<text>先识别单项附加调整系数</text>。"
    )

    assert answer == "### 规则总览\n\n说明：先识别单项附加调整系数。"


def test_ensure_knowledge_answer_normalizes_substantive_model_output():
    answer = ensure_knowledge_answer(
        "- ### 依据与解释\n\n说明：<text>技术工作费调整系数为 0.22。</text>",
        "技术工作费调整系数为什么是 0.22？",
        [_result()],
    )

    assert answer.startswith("### 依据与解释")
    assert "<text>" not in answer
    assert "- ###" not in answer


def test_rate_lookup_numeric_guard_uses_the_retrieved_evidence_row():
    result = KnowledgeSearchResult(
        id="rate-1",
        source_file="2024数字与信息化项目投资计价依据-正文问答版.md",
        source_type="reference",
        title_path="数字与信息化项目投资计价依据 / 1. 建设单位管理费",
        snippet=(
            "表4建设单位管理费费率表<table>"
            "<tr><td>工程费用（万元）</td><td>费率(%)</td></tr>"
            "<tr><td>5000</td><td>1.04</td></tr>"
            "</table>"
        ),
        score=20.0,
        module="基价匹配",
    )

    answer = ensure_knowledge_answer(
        "| 工程费用 | 费率 |\n|---|---|\n|5000|1.04%|",
        "按2024年数字与信息化项目投资计价依据，工程费用5000万元时建设单位管理费费率是多少？",
        [result],
    )

    assert "5000" in answer
    assert "1.04" in answer
    assert "4%" not in answer
    assert "建设单位管理费" in answer


def test_evidence_fallback_uses_the_same_answer_hierarchy():
    answer = ensure_knowledge_answer(
        "",
        "一般问题如何处理？",
        [_result(snippet="项目规则要求先核对业务类别，再确认适用条件。")],
    )

    assert answer.startswith("## 结论")
    assert "## 依据与解释" in answer
    assert answer.endswith("## 使用边界\n\n本回答只解释依据，不改变程序填价结果。")


def test_table2_nonparticipating_fee_fallback_only_returns_requested_items():
    answer = ensure_knowledge_answer(
        "",
        "0.22技术工作费调整系数中，表2哪些项目不参与金额计算？",
        [_result(snippet="表2线路航测和走向图编制按专项规则处理。")],
    )

    assert "线路航测" in answer
    assert "走向图编制" in answer
    assert "像控点联测" in answer
    assert "地物地貌调绘" in answer
    assert "DLG/DEM/DOM" in answer
    assert "地图编制" in answer
    assert "历史显示0.22；当前规则输出0" in answer
    assert "表3" not in answer
    assert "表4" not in answer


def test_structured_price_fallback_separates_conclusion_evidence_and_review():
    answer = ensure_knowledge_answer(
        "",
        "地形测量 复杂程度一般 的价格是多少？",
        [
            KnowledgeSearchResult(
                id="price-1",
                source_file="03-知识库-二维数据库制作/【数据库】【导入】.xlsx",
                source_type="excel_rule_card",
                title_path="价格库 > 第12行",
                snippet=(
                    "要素1：地形测量\n"
                    "要素2：复杂程度一般\n"
                    "要素3：控制价\n"
                    "要素4：常规场景\n"
                    "要素5：无\n"
                    "单位：km\n"
                    "基价：1200"
                ),
                score=20.0,
                module="结构化计价库",
            )
        ],
    )

    assert answer.startswith("## 结论")
    assert "## 依据与解释" in answer
    assert "## 适用条件与复核" in answer
    assert "## 使用边界" in answer
