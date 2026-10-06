# 核心技术路线建议（给 Codex 消化）

**生成日期**：2026-07-03  
**基于版本**：造价智算 v5.3.7  
**性质**：外部建议，供 Codex 后续消化吸收，不直接污染当前 PRD

> **重要声明**：本文件只是建议，不要求 Codex 原样照搬。Codex 应结合现有代码、测试和 PRD 自行消化吸收。所有 API 命名、模块命名、文件结构均为草案，以 Codex 结合现状的判断为准。

---

## 一、当前架构应保持什么

| 保持项 | 理由 |
|---|---|
| React + TS + Vite 前端 / FastAPI 后端 / Tauri 第三入口的三层结构 | 已稳定运行，所有新功能在此结构内扩展 |
| "结构化规则裁决 + 大模型解释 + 人工兜底"三层判断 | 项目立身之本，所有新功能必须服从 |
| 二维 Excel 知识库 + Excel/CSV 规则表的资产形态 | 业务人员可维护，不引入数据库服务 |
| 要素1-5+单位的 A/B 匹配模式作为同类识别底座 | 新功能找同类一律复用，不另造匹配 |
| 合并单元格默认口径全项目统一 | 新读表模块必须沿用 |
| 运行输出只写 `Codex-Temp/runtime/` 与任务目录，不碰原始输入 | 所有新功能沿用 |
| 大模型旁路设计（先本地检索证据，再解释） | 新 AI 能力沿用同一模式 |
| 单机本地运行、无数据库、无用户体系 | 近期不引入 DB/登录，留痕用 JSON 文件 |

---

## 二、哪些模块可以复用（新功能的积木）

| 现有模块 | 可复用能力 | 被哪些新功能复用 |
|---|---|---|
| `normalization.py` | 归一化 | 所有匹配类新功能 |
| `knowledge_base.py` | 二维库读取、A/B 匹配 | 辅助填价候选、知识库质量检测、估概算核对 |
| `experience_warning.py` | 找同类、均值、偏离分级、阈值配置 | 辅助填价候选、结算审核比对、经验池治理 |
| `fill_engine.py` | 读表、列映射、合并单元格、待复核口径 | 结算审核读表、估概算读表（**只导入复用，不改其主流程**） |
| `formula_resolver.py` / `excel_recalc.py` | 公式兜底计算 | 结算审核行级/汇总计算核查 |
| `report.py` | Word 模板生成 | 审核意见草稿 |
| `/api/preview/cell` 写回 + `preview-manual-edits.json` 留痕 | 校验+写值+批注+留痕 | 辅助填价确认写入、人工复核闭环 |
| 前端"跳到表格"定位 | 跨模块定位+闪烁 | 风险卡片、审核工作台、复核清单 |
| `tools/check_prd_consistency.py` 模式 | 检查脚本骨架 | 知识库质量检测、经验池治理 |

---

## 三、哪些模块建议新增

按 V1→V3 顺序（详见 `03-近期功能优先级与版本路线.md`）：

| 新模块 | 形态 | 版本 |
|---|---|---|
| 知识库质量检测 | `tools/check_knowledge_quality.py`（脚本起步，可后接 API） | V1 |
| 经验池治理 | `tools/check_experience_pool.py` 或并入上者 | V1 |
| 结构化风险清单（风险报告增强） | `schemas.py` 增 RiskItem/RiskCard + 现有风险报告接口结构化 | V1 |
| 演示模式 | 前端为主（引导层 + 一键样例加载 API） | V1 |
| 依据追溯 | 规则表加"标准依据"列 + 行级详情透出 | V1 |
| 辅助填价 | `backend/app/fill_assist.py` + 前端 `FillAssistDialog` | V2 |
| 人工复核闭环 | 复核状态 JSON + 前端清单 | V2 |
| 结算审核助手 | `backend/app/settlement_review.py` + 前端审核模块页 | V2 |
| 审核意见草稿 | `report.py` 扩展或 `review_report.py` | V2 |
| 估概算核对模式 | 复用 settlement_review 的比对引擎换基准源 | V3 |
| 项目复盘库 | 任务元数据归档 JSONL + 列表页 | V3 |

**原则**：新业务逻辑放新文件，通过 import 复用旧模块；不修改 `fill_engine.py`、`knowledge_base.py`、`experience_warning.py` 的既有函数签名与行为。

---

## 四、可能新增的后端服务（API 草案）

> 命名风格沿用现有 `/api/*`。均为草案。

```text
# V1
GET  /api/quality/knowledge          知识库质量检测报告（或仅 tools 脚本，不上 API）
GET  /api/quality/experience-pool    经验池治理报告（同上）
GET  /api/risk/summary               结构化风险清单（现有风险数据统一为 RiskItem[]）
POST /api/demo/load-sample           演示模式一键加载预置样例

# V2
POST /api/fill-assist/candidates     {sheet,row,field} -> 候选列表（来源/理由/相似度/风险/分级）
POST /api/fill-assist/confirm        {sheet,row,field,value,candidateMeta,note} -> 复用 preview/cell 写回+留痕
POST /api/review-status/set          {sheet,row,status,note} 复核状态标记
GET  /api/review-status/list         复核进度与清单
POST /api/settlement/inspect         结算表+基准表结构读取（复用 inspect 模式）
POST /api/settlement/review          执行比对 -> RiskCard[]
POST /api/settlement/export          风险/问题清单导出 Excel
POST /api/settlement/draft-report    审核意见草稿 Word（二阶段）
```

**数据 schema 关键点**：`RiskItem`/`RiskCard` 在 `schemas.py` 统一定义，V1 风险报告增强与 V2 结算审核共用一套，避免两套风险结构。

---

## 五、可能新增的前端组件

| 组件 | 说明 | 约束 |
|---|---|---|
| `RiskCardList` / `RiskCardDrawer` | 风险卡片列表/抽屉，等级筛选 chip，跳转定位 | daweiba-* 命名空间；抽屉属浮层可有阴影，卡片列表扁平无阴影 |
| `FillAssistDialog` | 本项填价窗口（模态） | 结构见 `04-辅助填价功能PRD建议.md` 第五节 |
| `ReviewProgress` | 待复核清单 + 复核进度（N/M） | 挂在填价工作台工作状态区或结果预览侧 |
| `SettlementWorkbench` | 结算审核模块页（上传区+卡片列表） | 左侧导航新增"结算审核"项 |
| `DemoGuide` | 演示模式引导条/高亮 | 不改业务逻辑，可随时关闭 |
| 依据追溯展示 | 行级详情内出处区块 | 复用现有行级详情/AI 上下文展示 |

---

## 六、可能新增的规则文件 / 配置文件 / 数据表

| 文件 | 用途 | 位置建议 |
|---|---|---|
| `fill-assist-settings-*.json` | 候选排序权重、可信度阈值、候选上限 | `05-经验池-预警数据/`（与现有 settings 同风格） |
| `settlement-review-settings-*.json` | 审核阈值（独立于预警阈值）、容差 | 同上 |
| 规则表新增"标准依据"列 | 依据追溯映射 | 直接加列在 `technical_fee_rules.xlsx/csv`（**须先确认读取代码对新增列的容忍性，并同步说人话版规则表**） |
| `review-status-*.json` | 复核状态留痕 | 任务运行目录 |
| 留痕统一 schema | 人工修改/辅助填价/复核动作共用，`source` 字段区分 | 建议演进 `preview-manual-edits.json` 而非新开多套 |
| 审核意见书 Word 模板 | 草稿生成模板 | `03-知识库-二维数据库制作/01-报告模板-*/` 旁新增，标注【模板勿动】 |
| 审核问题库模板（V3） | 类经验池模板 | `05-经验池-预警数据/` 或新目录 |

---

## 七、数据流草案

### 辅助填价

```text
用户点待复核行"辅助填价"
→ POST /api/fill-assist/candidates
   → knowledge_base（A/B + 候选专用相似匹配）
   → experience_warning（找同类+均值）
   → 填价操作日志（历史确认）
→ 前端 FillAssistDialog 展示（排序/分级/风险提示均后端结构化生成）
→ 用户选定 → POST /api/fill-assist/confirm
   → 复用 preview/cell 校验写回 → 批注/底色 → 统一留痕(source=fill-assist)
→ 预览刷新；用户手动"重算公式"（沿用 v5.3.7 口径）
```

### 结算审核

```text
上传结算表+基准表 → inspect（列映射确认，复用合并单元格口径）
→ POST /api/settlement/review
   → 行对齐（要素1-5+单位 A→B；一对多列为无法唯一对齐）
   → 逐类比对（单价/工程量/行计算/合同外/系数/经验偏离）
   → RiskCard[]（等级由阈值判定）
→ 前端卡片列表 → 跳转定位 / 标记处理（人工）
→ 导出清单 Excel / （二阶段）意见草稿 Word（大模型仅润色文字，金额结构化填充后校验一致）
```

### 大模型边界（所有新功能一致）

```text
结构化引擎产出数字与等级 → 大模型只做：解释、摘要、措辞润色
→ 润色后关键数字与结构化源数据逐一校验，不一致以结构化数据为准
```

---

## 八、测试重点

1. **回归零破坏**：每个新功能合入后全量 `python -m pytest backend/tests -v`；100 行样例输出与答案表逐行一致仍是金标准。
2. **候选生成正确性**（`test_fill_assist.py`）：相似匹配边界（单位不一致必须出局）、排序稳定性、无候选空态。
3. **写回安全**：公式单元格/合并非左上角/系统列拒写（复用现有用例扩展）。
4. **结算比对正确性**（`test_settlement_review.py`）：构造已知问题样例（改单价/加量/合同外/算错），检出全且无误报；"无法比对"显式输出。
5. **留痕完整性**：每次写入/复核动作的 JSON 记录字段齐全、可追溯。
6. **金额一致性**：意见草稿/风险导出中的金额与结构化数据一致（大模型润色不改数）。
7. **质量检测脚本**：用带已知缺陷的测试库/测试经验池验证检出率。
8. **前端**：`npm run frontend:build` 通过；新组件不破坏三栏布局与折叠行为。

---

## 九、不能破坏的现有能力（合入门禁）

1. 上传→匹配→输出 Excel/Word 主流程与答案表一致性。
2. 绿/黄/红三层颜色口径与逐行说明。
3. 经验池预警手动触发、A→B→D 口径、阈值行为。
4. 工作量抓取（含术语归并边界不外溢）。
5. 预览人工修改 + 重算公式（v5.3.6/5.3.7 行为）。
6. 问问智算证据检索边界（无证据即提示人工复核）。
7. 评委绿色版与 Tauri 壳启动链。
8. 主匹配 A/B 两档不放宽；模式 C 仅限候选生成场景。

---

## 十、最小可验收版本

**最小组合（若只做一件事）**：辅助填价 MVP（基价字段、2 个候选来源、确认写入+留痕）。验收 = `04-辅助填价功能PRD建议.md` 第十七节 MVP 验收 7 条。

**推荐最小组合（一个小版本）**：知识库质量检测 + 结构化风险清单 + 演示模式。三者均低风险，直接强化"规则可信、输出可核验、演示稳定"。

---

## 十一、给 Codex 的开发顺序建议

```text
1. V1 质量底座：知识库质量检测 → 经验池治理 → RiskItem schema + 风险报告结构化
2. V1 展示冲刺：演示模式 → 依据追溯（规则表加列先做容忍性确认）
3. V2 写入机制统一：留痕 schema 统一设计（人工修改/辅助填价/复核共用）
4. V2 辅助填价 MVP → 人工复核闭环 → 结算审核 MVP → 意见草稿
5. V3 横向验证：估概算核对 → 问题库/指标库/复盘库 → 统信阶段1验证（可与业务并行）
```

每步完成：模块 PRD 状态更新 → CHANGELOG → 全量回归 → 按 AGENTS.md 口径存档。

---

## 十二、再次声明

本文件是外部顾问的技术路线**建议**，不是开发指令。Codex 接手时应：

1. 先读现有代码确认复用点的真实函数边界（本文对模块内部结构的描述基于代码合并文档的有限阅读，可能与最新代码有出入）。
2. 与用户确认版本优先级后，把选中的功能写成正式模块 PRD 再开发。
3. 发现本文与现有代码/PRD/AGENTS.md 冲突时，**一律以项目现状为准**，并可在消化文档中记录差异。
