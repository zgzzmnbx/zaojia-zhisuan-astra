# Astra 沙盘质感提升 · Codex 指导包

**目标：在现有真实交互沙盘上，复现 A「冷白建筑模型」的整体光感，并吸收 C「银白工业展陈」中储罐、管道的局部表面质感。**

本包基于 GitHub 仓库 **zgzzmnbx/zaojia-zhisuan-astra** 的 `main`，固定审阅提交为 **79e1418b2be169537a8cca643af61063b4350521**，UI **v0.10.56**。提交时间：2026-10-20 08:52:30 UTC / 北京时间 16:52:30。编制日期：2026-10-20。

## 怎么交给 Codex

1. 将本包完整解压到 Codex 能读取的位置，保留 `assets/` 与 `specs/`。
2. 在 Astra 的真实仓库工作区打开 Codex，将 [01-CODEX-TASK.md](01-CODEX-TASK.md) 全文发给它；也可以使用压缩包外单独提供的同名执行指令。
3. 要求 Codex **先实际打开 A、C 两张图**，再检查当前工作区和源码。它应在现有产品中完成本地实现、真实浏览器验收和交付，不能只回复方案。
4. 后续仓库若有更新，以当前用户代码和有效项目指令为准，先核对差异。本包的旧提交只是可追溯基线，不能为了对齐它覆盖新代码。

## 包内阅读顺序

| 文件 | 作用 |
| --- | --- |
| [01-CODEX-TASK.md](01-CODEX-TASK.md) | 可直接发给 Codex 的完整执行任务书 |
| [02-CODE-AUDIT.md](02-CODE-AUDIT.md) | 最新源码事实、关键函数、旧建议修正及当前限制 |
| [03-VISUAL-SPEC.md](03-VISUAL-SPEC.md) | 两张图怎样使用、每个部件要呈现什么、不能照抄什么 |
| [04-IMPLEMENTATION-GUIDE.md](04-IMPLEMENTATION-GUIDE.md) | 文件级实施路线、材质角色、光照、资产、生命周期和故障回退 |
| [05-TASKS-AND-ACCEPTANCE.md](05-TASKS-AND-ACCEPTANCE.md) | 分阶段任务、行为与视觉验收、性能测法和完成条件 |
| [06-ACCEPTANCE-REPORT-TEMPLATE.md](06-ACCEPTANCE-REPORT-TEMPLATE.md) | Codex 必须填写的真实结果模板 |
| [07-REFERENCES.md](07-REFERENCES.md) | 固定提交源码与 GitHub / Three.js 官方参考 |
| [specs/source-baseline.json](specs/source-baseline.json) | 固定提交、已读文件索引、资产与参数事实 |
| [specs/look-proposal.json](specs/look-proposal.json) | 明确标注“未实测”的第一轮调参候选 |
| [specs/material-role-contract.json](specs/material-role-contract.json) | 建筑与管罐分材质的语义约定 |
| [specs/acceptance-cases.json](specs/acceptance-cases.json) | 验收用例的结构化索引 |

## 参考图优先级

**真实业务与现有几何 > A 的整体风格 > C 的局部材质 > 原截图的历史背景。**

- [A-primary-cool-white.png](assets/A-primary-cool-white.png)：整体目标。
- [C-local-silver-white.png](assets/C-local-silver-white.png)：只参考储罐、管道及极少量连接件的高光和粗糙度。
- [00-original-context.png](assets/00-original-context.png)：用户最初截图，仅作历史比较；最新运行结果才是 before。

A/C 是生成的设计参考，图中数字、文字、几何布局、相机偏移、光斑不能直接当成产品规格。C 的反光地面和背景光斑不在本次目标内。未收入 B，避免把暖光方向混入此次执行。

## 最新代码带来的关键判断

v0.10.56 已有 **Cycles 离线照度、本地 HDR、灰泥法线、质感增强开关和局部聚焦辉光**。本次工作要细化这些能力。正式运行路径不应恢复全画面 Bloom，也不需要迁移 R3F、WebGPU 或实时路径追踪。

管罐与建筑部分共用 `Porcelain white`。因此“让瓷白材质全变金属”会破坏建筑。应先建立可靠的部件角色，再细分粗糙度与法线；大面积白色涂层通常仍使用非金属表面模型，少数裸露连接件可采用浅银色金属。

## 本包的证据范围

本包完成的是最新 GitHub 文本源码、资产清单、已有测试和参考图的审阅与实施设计。**未修改仓库、未运行 Astra、未解码本轮 GLB、未在用户设备上测试帧率。** 参数范围是调参起点，验收表中的空项须由执行 Codex 实测填写。完整仓库和运行资产继续从用户自己的 GitHub / 工作区获取，不以本包替代。

文件完整性可用 [CHECKSUMS.sha256](CHECKSUMS.sha256) 核对；该清单覆盖除其自身以外的全部包内文件。

