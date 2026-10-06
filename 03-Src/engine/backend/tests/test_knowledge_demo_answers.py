from app.knowledge_demo_answers import (
    DEMO_QUESTION_BRIDGE_CHART,
    DEMO_QUESTION_COST_CODES,
    DEMO_QUESTION_ROUTE_MAP_PRICE,
    DEMO_QUESTION_TECHNICAL_FEE,
    OFFLINE_DEMO_FILL_PRESET_ID,
    demo_questions,
    get_demo_answer,
    get_row_demo_answer,
)


def test_demo_questions_keep_the_required_front_page_order():
    assert demo_questions() == (
        DEMO_QUESTION_TECHNICAL_FEE,
        DEMO_QUESTION_ROUTE_MAP_PRICE,
        DEMO_QUESTION_COST_CODES,
        DEMO_QUESTION_BRIDGE_CHART,
    )


def test_demo_question_matching_allows_only_punctuation_and_spacing_changes():
    assert get_demo_answer("勘察测量: 技术工作费调整系数如何确定?") is not None
    assert get_demo_answer("勘察测量，实物工作费调整系数如何确定？") is None


def test_demo_code_answer_is_the_requested_markdown_table_only():
    answer = get_demo_answer(DEMO_QUESTION_COST_CODES)

    assert answer is not None
    assert answer["answer"].startswith("| 管径 | 单位 | 清单单价 | 来源定位 |")
    assert "D1016" in answer["answer"]
    assert "2,250元" in answer["answer"]
    assert answer["chart"] is None


def _offline_demo_fill_context(**overrides):
    context = {
        "sheet_name": "表2-通用工程测量费用",
        "row_number": 6,
        "values": {
            "内容": "首级控制测量",
            "类别": "GPS测量E级",
            "比例尺": "中等",
            "单位": "个",
            "基价（元）": "3203",
        },
    }
    context.update(overrides)
    return context


def test_row_demo_answer_matches_only_the_exact_ai_fill_row():
    question = "请根据已排序的结构化候选，推荐本行基价并说明差异。候选列表已经排序。"
    answer = get_row_demo_answer(question, _offline_demo_fill_context())

    assert answer is not None
    assert answer["id"] == OFFLINE_DEMO_FILL_PRESET_ID
    assert answer["answer"].startswith("## 结论")
    assert "离线演示保障｜未调用外部大模型" not in answer["answer"]
    assert "3203 元/个" in answer["answer"]
    assert "该值不是由大模型生成" in answer["answer"]
    assert "单位和4个非空要素全部匹配" in answer["answer"]
    assert "经验池中另有1条同条件记录" in answer["answer"]
    assert "排名第3的候选为2821元/个" in answer["answer"]
    assert "其要素5为“简单”，与本行“中等”不一致" in answer["answer"]
    assert "只把确认值写入输出副本，不修改原始Excel" in answer["answer"]
    assert "边界说明" not in answer["answer"]
    assert "离线演示兜底" not in answer["answer"]
    empty_price_values = dict(_offline_demo_fill_context()["values"])
    empty_price_values["基价（元）"] = ""
    assert get_row_demo_answer(
        question,
        _offline_demo_fill_context(values=empty_price_values),
    ) is not None
    assert get_row_demo_answer(question, _offline_demo_fill_context(row_number=5)) is None
    assert get_row_demo_answer(question, _offline_demo_fill_context(sheet_name="表3-地质测绘")) is None
    assert get_row_demo_answer("这行为什么待复核？", _offline_demo_fill_context()) is None


def test_row_demo_answer_rejects_changed_business_values():
    question = "请根据已排序的结构化候选，推荐本行基价。候选列表已经排序。"
    changed_values = dict(_offline_demo_fill_context()["values"])
    changed_values["类别"] = "GPS测量C级"

    assert get_row_demo_answer(question, _offline_demo_fill_context(values=changed_values)) is None
    changed_values = dict(_offline_demo_fill_context()["values"])
    changed_values["基价（元）"] = "500000"
    assert get_row_demo_answer(question, _offline_demo_fill_context(values=changed_values)) is None
