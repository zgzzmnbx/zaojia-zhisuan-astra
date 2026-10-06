# 数智员工上岗证据包 PRD

## 模块目标

把项目现有的 Task、专业 Skill、可信 Tool、人工复核、正式 Artifact 和受治理 Experience 组织为一套真实、可核验、可导出的岗位证据。模块统一回答四个问题：**能上岗、能干活、能成长，而且不越权。**

> 造价智算，是面向长输管道勘察测量最高投标限价编制岗位的可信造价数智员工原型：能够接住任务，调用专业 Skill 和可信 Tool，按照规则完成工作，把异常交给人复核，并把确认后的经验带到下一项任务。

本模块进入现有“专业能力中心”，不新增左侧一级菜单、不建设第二套 Dashboard，也不复制 Task、Skill 或 Experience 状态机。原计划名称中的模块 21 已被“竖屏与触控适配”占用，因此按现行唯一顺序编号为模块 22，不改名或搬动既有模块。

## 需求清单

| 状态 | 需求 | 说明 | 验收口径 |
| --- | --- | --- | --- |
| [已完成] | 岗位证据界面 | 在专业能力中心聚合岗位、Skill、职责、成果和边界 | 已上线 Skill 可看到完整证据；规划中 Skill 只显示不足态且不可创建任务 |
| [已完成] | 四项上岗判断 | 分别展示能上岗、能干活、能成长、不越权 | 每项均来自 Registry、Manifest、Task、实际 Tool、Artifact、Experience 或验证事实，不展示估算指标 |
| [已完成] | Task—Skill—Tool—Artifact—Experience 血缘 | 只读复用既有任务详情、事件、成果版本、复核与经验血缘 | 有真实 Task 时可展开冻结 Skill、实际 Tool、成果、复核和 Experience；无 Task 时显示诚实空态 |
| [已完成] | V3.1 正式验证事实 | Manifest 只引用安全的机器可读验收摘要 | 页面显示验证日期、样例、1254 个目标单元格及差异为 0 的事实，并明确已知限制 |
| [已完成] | Experience 状态隔离 | 候选、已确认、已撤销、疑似失效分别呈现 | 候选不冒充已确认；聚合失败时按候选保守显示并给出降级提示 |
| [已完成] | 同源 Markdown 导出 | 页面和导出共用同一个只读证据响应 | 导出包含生成时间、Skill ID / 版本、数据来源、完成证据、事实边界、不足项和免责声明 |
| [已完成] | 安全聚合与降级 | 新增只读聚合接口；各来源可独立失败 | 不返回绝对路径、Manifest 哈希、平台 ID、秘密或个人敏感信息；聚合异常不阻断专业主流程 |
| [已完成] | UI 与可访问性 | 使用局部 CSS、自托管苹方和 `--dws-*` 令牌 | 28 / 20 / 16 / 14 / 13 / 12px；深浅色、键盘、减少动态、1366 / 1440 / 1920 与窄屏通过 |
| [待开发] | 生产级身份与组织授权证明 | 当前证据仅证明本机原型的能力与治理边界 | 接入可信企业身份、岗位授权、审批策略与组织级审计后另行验收 |

## 数据与接口

- 只读接口：`GET /api/professional-skills/{skill_id}/onboarding-evidence`。
- Registry / Manifest：岗位、Skill ID、版本、能力声明、运行就绪与安全验证资产。
- `BusinessTaskStore` / TaskEvent：最近真实 Task、冻结 Skill、实际 Tool、成果、复核与 Experience 血缘。
- 可信经验：只读治理状态与真实指标；不写知识、价格、系数、规则或复核结论。
- V3.1：`business-skills/survey-measurement-limit-price/evals/V3.1正式成对验收事实.json`，只保存可对外展示的验证事实，不保存绝对路径、完整哈希或运行秘密。

## 功能边界

- 测试专用 Skill 不进入真实岗位证据；结算审核 MVP 不冒充第二个 Registry 专业 Skill。
- 不显示虚构任务数、准确率、节省时间、ROI 或全场景成功率。
- 大模型只解释和组织表达，不猜价格、不自动改规则、不自动批准 Experience、不绕过人工确认。
- 本证据包不代表生产级统一身份、组织授权或全场景准确率承诺。
- 导出文件为证据快照；实时状态以系统当前只读聚合为准。

## 关联资产

| 类型 | 文件 | 用途 |
| --- | --- | --- |
| 前端入口 | `frontend/src/components/skills/ProfessionalSkillCenter.tsx` | 现有正式入口，不新增菜单 |
| 证据界面 | `frontend/src/components/skills/DigitalEmployeeEvidencePanel.tsx` | 展示、下钻与导出 |
| 同源导出 | `frontend/src/components/skills/digitalEmployeeEvidence.ts` | 数据契约与 Markdown 生成 |
| 局部样式 | `frontend/src/components/skills/DigitalEmployeeEvidencePanel.css` | 字体、主题、响应式与可访问性 |
| 聚合接口 | `backend/app/main.py` | 只读聚合及失败隔离 |
| 证据构建 | `backend/app/digital_employee_evidence.py` | 脱敏、事实边界与诚实状态 |
| Task 聚合 | `backend/app/business_tasks.py` | 按 Skill 读取最近真实 Task |
| Skill 验证 | `backend/app/professional_skills.py` | 安全读取 Manifest 声明的验证事实 |
| 正式验证 | `business-skills/survey-measurement-limit-price/evals/V3.1正式成对验收事实.json` | V3.1 成对验收摘要 |

## 验收口径

1. 已上线勘察测量 Skill 显示真实岗位、Task、实际 Tool、成果、复核、Experience 和 V3.1 验证事实。
2. 规划中 Skill 显示缺失输入、规则、模板、验证与 Task 的不足态，不能创建任务。
3. 无 Task、无 Experience、验证失效和聚合错误均显示可理解的诚实状态。
4. 页面与导出 Markdown 同源，且均不出现绝对路径、平台标识、秘密和完整哈希。
5. 聚合接口失败不改变 Excel、三个数字匹配、风险、报告、知识问答和智能协同。
6. 运行专项、全量、生产构建、UI 检查、PRD 巡检、真实浏览器和 V3.1 正式成对回归。
