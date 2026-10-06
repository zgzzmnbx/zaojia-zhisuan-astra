from __future__ import annotations

import re
import unicodedata
from copy import deepcopy
from typing import Any


DEMO_QUESTION_TECHNICAL_FEE = "勘察测量，技术工作费调整系数如何确定？"
DEMO_QUESTION_ROUTE_MAP_PRICE = (
    "走向图编制、地图编制、Ⅱ类、1:50000，价格如何确定？"
    "以及相邻比例尺价格如何确定？"
)
DEMO_QUESTION_COST_CODES = (
    "对比清单编码10504014、10504015、10504016，"
    "只回答管径、单位、清单单价和来源定位，用Markdown表格。"
)
DEMO_QUESTION_BRIDGE_CHART = (
    "查询清单编码10504001至10504016的过路过桥费，"
    "按管径从小到大输出柱状图，并指出价格平台区间和最高单价，"
    "只使用造价通用知识库数据，不进行区间插值。"
)
OFFLINE_DEMO_FILL_PRESET_ID = "offline-demo-fill-table2-row6"


def _normalized_question(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", str(value or "")).lower()
    return re.sub(r"[\s\u3000，,。；;：:？?、“”\"'（）()\-_—–]+", "", normalized)


def _source(
    source_file: str,
    title_path: str,
    snippet: str,
    *,
    module: str,
    library_id: str,
    library_name: str,
) -> dict[str, Any]:
    return {
        "source_file": source_file,
        "source_type": "curated_demo_answer",
        "title_path": title_path,
        "snippet": snippet,
        "score": 100.0,
        "module": module,
        "library_id": library_id,
        "library_name": library_name,
    }


_PROJECT_RULE_SOURCE = _source(
    "03-【匹配规则】-勘察测绘知识库-匹配规则提炼/【重要匹配规则】项目以及总体匹配规则介绍.md",
    "技术工作费调整系数",
    "系数先按费用表、专业和技术类别匹配第一层规则；第一层未命中时才进入第二层经验提示和人工复核。",
    module="项目规则",
    library_id="project-core",
    library_name="项目正式知识库",
)

_PRICE_DATABASE_SOURCE = _source(
    "03-知识库-二维数据库制作/【数据库】【导入】.xlsx",
    "【母表】第129—134行",
    "走向图编制—地图编制在1:10000和1:50000下分别保存Ⅰ、Ⅱ、Ⅲ类独立价格记录。",
    module="结构化计价库",
    library_id="project-core",
    library_name="项目正式知识库",
)

_COST_LIBRARY_SOURCE = _source(
    "06-知识库问答资料/造价AIW资料库/2024全费用清单单价-第1册油气输送管道工程-Excel问答版.md",
    "过路过桥费 / Excel第829—844行",
    "清单编码10504001至10504016分别对应D219.1至D1422过路过桥费，单位为km。",
    module="造价通用知识库",
    library_id="cost-aiw",
    library_name="造价通用知识库",
)

_OFFLINE_DEMO_FILL_SOURCE = _source(
    "03-知识库-二维数据库制作/【数据库】【导入】.xlsx",
    "【母表】首级控制测量 / GPS测量E级 / 中等 / 个",
    "结构化计价库中的目标要素组合对应基价3203元，AI填价只解释该确定性候选，最终仍由人工确认写入。",
    module="结构化计价库",
    library_id="project-core",
    library_name="项目正式知识库",
)


_DEMO_ANSWERS: dict[str, dict[str, Any]] = {
    _normalized_question(DEMO_QUESTION_TECHNICAL_FEE): {
        "id": "technical-fee-determination",
        "question": DEMO_QUESTION_TECHNICAL_FEE,
        "answer": """技术工作费调整系数不是全项目统一采用一个数值，而是先识别费用表和专业类别，再识别技术工作类别及特殊项目。

| 适用范围 | 技术类别或项目 | 系数 |
| --- | --- | ---: |
| 表2 工程测量 | 普通工程测量项目 | 0.22 |
| 表2 工程测量 | 线路航测、走向图编制 | 0 |
| 表3、表4 岩土工程勘察 | 甲级、乙级、丙级 | 1.2、1.0、0.8 |
| 表4 水文地质勘察 | 简单、中等、复杂 | 0.27、0.30、0.33 |
| 表4 工程水文 | 工程水文类 | 0.22 |
| 表4 工程物探 | 甲级、乙级、丙级、物探 | 1.2、1.0、0.8、0.22 |
| 表4 室内试验 | 甲级、乙级、丙级、试验 | 1.2、1.0、0.8、0.10 |
| 表4 勘探点测放 | 特殊项目 | 0 |

确定顺序是：第一层标准规则 → 第二层经验提示 → 人工复核。特殊项目优先于同表默认规则；第一层未命中或规则冲突时，不由大模型猜测系数，而是进入经验提示或标记“待复核”。

计算口径为：技术工作费＝调整后实物工作费小计×技术工作费调整系数。""".strip(),
        "sources": [_PROJECT_RULE_SOURCE],
        "chart": None,
    },
    _normalized_question(DEMO_QUESTION_ROUTE_MAP_PRICE): {
        "id": "route-map-price",
        "question": DEMO_QUESTION_ROUTE_MAP_PRICE,
        "answer": """目标条件与二维计价库记录完全匹配：

| 项目 | 类型 | 比例尺 | 单位 | 基价/单价 |
| --- | --- | --- | --- | ---: |
| 走向图编制—地图编制 | Ⅱ类 | 1:50000 | 幅 | 4,983.36元/幅 |

价格采用“要素1—5＋单位”结构化精确匹配，不按比例尺做数学换算。

| 比例尺 | Ⅰ类（元/幅） | Ⅱ类（元/幅） | Ⅲ类（元/幅） |
| --- | ---: | ---: | ---: |
| 1:10000 | 1,991.38 | 2,742.11 | 3,517.45 |
| 1:50000 | 3,645.35 | **4,983.36** | 7,533.19 |

1:10000等其他比例尺应分别查询对应的独立价格记录。如果知识库中没有目标比例尺，不能在两条记录之间插值或外推，应输出“待复核”。走向图编制的技术工作费调整系数另按第一层特殊规则取0。""".strip(),
        "sources": [_PRICE_DATABASE_SOURCE, _PROJECT_RULE_SOURCE],
        "chart": None,
    },
    _normalized_question(DEMO_QUESTION_COST_CODES): {
        "id": "cost-code-comparison",
        "question": DEMO_QUESTION_COST_CODES,
        "answer": """| 管径 | 单位 | 清单单价 | 来源定位 |
| --- | --- | ---: | --- |
| D1016 | km | 2,250元 | 《建设项目全费用工程量清单单价》第1册，Excel第842行 |
| D1219 | km | 3,000元 | 《建设项目全费用工程量清单单价》第1册，Excel第843行 |
| D1422 | km | 4,500元 | 《建设项目全费用工程量清单单价》第1册，Excel第844行 |""",
        "sources": [_COST_LIBRARY_SOURCE],
        "chart": None,
    },
    _normalized_question(DEMO_QUESTION_BRIDGE_CHART): {
        "id": "bridge-fee-chart",
        "question": DEMO_QUESTION_BRIDGE_CHART,
        "answer": """过路过桥费随管径总体呈阶梯式增长。D457—D559均为600元/km，D610—D660均为900元/km，D711—D813均为1,500元/km，D914—D1016均为2,250元/km。最高单价为D1422的4,500元/km。

以上价格均为造价通用知识库中的独立清单记录，不能据此对其他管径进行区间插值。""".strip(),
        "sources": [_COST_LIBRARY_SOURCE],
        "chart": {
            "type": "bar",
            "title": "不同管径过路过桥费对比",
            "x_axis_label": "管径",
            "y_axis_label": "清单单价（元/km）",
            "unit": "元/km",
            "items": [
                {"label": "D219.1", "value": 200},
                {"label": "D273.1", "value": 200},
                {"label": "D323.9", "value": 280},
                {"label": "D355.6", "value": 350},
                {"label": "D406.4", "value": 450},
                {"label": "D457", "value": 600},
                {"label": "D508", "value": 600},
                {"label": "D559", "value": 600},
                {"label": "D610", "value": 900},
                {"label": "D660", "value": 900},
                {"label": "D711", "value": 1500},
                {"label": "D813", "value": 1500},
                {"label": "D914", "value": 2250},
                {"label": "D1016", "value": 2250},
                {"label": "D1219", "value": 3000},
                {"label": "D1422", "value": 4500, "highlight": True},
            ],
        },
    },
}


def get_demo_answer(question: str) -> dict[str, Any] | None:
    answer = _DEMO_ANSWERS.get(_normalized_question(question))
    return deepcopy(answer) if answer is not None else None


def _row_context_value(values: dict[str, Any], aliases: tuple[str, ...]) -> str:
    normalized_aliases = tuple(_normalized_question(alias) for alias in aliases)
    for key, value in values.items():
        normalized_key = _normalized_question(key)
        if any(alias == normalized_key or alias in normalized_key for alias in normalized_aliases):
            return _normalized_question(value)
    return ""


def get_row_demo_answer(question: str, row_context: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(row_context, dict):
        return None
    normalized_question = _normalized_question(question)
    if "推荐本行基价" not in normalized_question or "候选" not in normalized_question:
        return None
    if _normalized_question(row_context.get("sheet_name")) != _normalized_question("表2-通用工程测量费用"):
        return None
    try:
        if int(row_context.get("row_number")) != 6:
            return None
    except (TypeError, ValueError):
        return None
    values = row_context.get("values")
    if not isinstance(values, dict):
        return None
    price = _row_context_value(values, ("基价（元）", "基价/单价", "基价", "单价"))
    expected_values = (
        (_row_context_value(values, ("内容", "要素2")), _normalized_question("首级控制测量")),
        (_row_context_value(values, ("类别", "要素4")), _normalized_question("GPS测量E级")),
        (_row_context_value(values, ("比例尺", "要素5")), _normalized_question("中等")),
        (_row_context_value(values, ("单位",)), _normalized_question("个")),
    )
    if any(actual != expected for actual, expected in expected_values) or price not in {"", "3203"}:
        return None
    return {
        "id": OFFLINE_DEMO_FILL_PRESET_ID,
        "question": question,
        "answer": """## 结论

本行建议采用结构化排序首选 **3203 元/个**。目标条件为“控制测量 / 首级控制测量 / GPS测量E级 / 中等 / 个”，与首选候选的单位及4个非空要素完全一致。

## 判断依据

- 当前定位：表2-通用工程测量费用，第6行，基价单元格 H6。
- 首选候选来自项目结构化计价知识库，相似度100%，单位和4个非空要素全部匹配，属于当前条件下依据最完整的候选。
- 经验池中另有1条同条件记录，取值同为3203元/个，可作为交叉印证；但样本量仅1条，不单独作为最终定价依据。

## 候选比较

- 排名第2的经验池候选同为3203元/个，与首选值一致，但因样本量有限，可信度低于结构化知识库候选。
- 排名第3的候选为2821元/个，相似度75%；其要素5为“简单”，与本行“中等”不一致，因此不建议替代首选值。
- 其余候选未在结构化匹配完整性和依据可靠性上优于首选候选，不具备优先采用条件。

## 复核与写入

- 3203元/个来自结构化候选排序，该值不是由大模型生成；AI填价仅负责解释候选差异和采用理由。
- 请确认本行测量等级、难度和计量单位无误后，再点击“采用并写入”完成人工确认。
- 系统只把确认值写入输出副本，不修改原始Excel；如当前行要素有误，应先修正条件后重新匹配。""".strip(),
        "sources": [_OFFLINE_DEMO_FILL_SOURCE],
        "chart": None,
        "bypass_reason": "offline_demo_fill_answer",
    }


def demo_questions() -> tuple[str, ...]:
    return tuple(answer["question"] for answer in _DEMO_ANSWERS.values())
