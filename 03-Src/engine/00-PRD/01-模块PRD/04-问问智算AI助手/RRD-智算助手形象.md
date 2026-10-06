# RRD-智算助手形象

## 文件定位

本文单独承载“问问智算可动虚拟形象”的调研、规划和候选开源项目清单。

它服务 `04-问问智算AI助手/PRD.md` 中的 P2“可动虚拟形象状态层”，不替代主 PRD，不直接触发前端实现。

## 需求来源

大尾巴希望给智算 AI 增加一个可动的虚拟形象，重点状态包括：

- 平时：右侧智算侧栏待机、陪伴、轻量存在感。
- 思考：检索依据、整理证据、生成回答、批量匹配等待时有明确动效。
- 出问题：大模型不可用、知识库无依据、接口报错、处理失败时有克制的异常反馈。

整体风格偏扁平化、简约、专业，不做厚重 3D、拟真角色、独立桌宠窗口或遮挡表格的浮动形象。

## 设计结论

推荐采用“抄结构，不直接抄形象”的路线：

1. 第一优先级：抄 `YanceyOfficial/talon` 的状态机思路。它明确有 `idle / thinking / speaking / error` 这类 Lottie 状态，和本项目的“平时 / 思考 / 出问题”高度匹配。
2. 视觉实现不直接拿 Talon 的头像素材，而是为造价智算做一个自有扁平化 SVG / Lottie 形象，避免外观同质化和授权风险。
3. 技术上先做轻量 SVG + CSS 状态动画，后续如果有更成熟素材，再接入 Lottie / dotLottie 播放器。
4. 形象只放在右侧“问问智算”侧栏顶部身份区、折叠入口和演示讲解节点，不新增独立桌宠窗口。

## 推荐开源项目清单

| 优先级 | GitHub 项目 | 可抄内容 | 授权 / 风险 | 对造价智算的建议 |
| --- | --- | --- | --- | --- |
| A | [YanceyOfficial/talon](https://github.com/YanceyOfficial/talon) | Lottie-based avatar；`idle / thinking / speaking / error` 状态分层；AI 助手与聊天面板绑定 | MIT；但它是 macOS 浮窗助手，不能照搬浮窗交互 | 重点抄状态机、状态命名、头像与消息流联动方式；不抄 always-on-top 浮窗 |
| A | [LottieFiles/dotlottie-web](https://github.com/LottieFiles/dotlottie-web) | 官方 dotLottie / Lottie Web 播放器，支持 React、Web Components，支持主题、状态机等能力 | MIT；比旧 React 包更适合作为后续正式播放器 | 如果最终素材采用 `.lottie` 或多状态 Lottie，优先考虑它 |
| A- | [airbnb/lottie-web](https://github.com/airbnb/lottie-web) | Lottie Web 基础运行时；支持 `playSegments`、`goToAndStop`、`setSpeed` 等低层控制 | MIT；成熟但偏底层，需要自己封 React 组件 | 如果只拿到单个 JSON 动画并要按帧段切状态，可用它 |
| B+ | [boringdesigners/boring-avatars](https://github.com/boringdesigners/boring-avatars) | 极简 SVG 头像生成；可根据名字和色板生成几何头像 | MIT；不是“会动的助手”，只是头像底座 | 可抄几何化、扁平化、低复杂度头像方向；再用 CSS 自己加动效 |
| B | [rive-app/rive-react](https://github.com/rive-app/rive-react) | Rive React runtime；天然适合交互式状态机动画 | MIT；需要额外 Rive 资产生产流程，引入新工具链 | P2 不优先；以后如果要做高质量状态机形象再考虑 |
| B- | [aryan877/candidai](https://github.com/aryan877/candidai) | SVG avatar、10 个表情、动作事件，如 `set_expression`、`nod_head`、`raise_eyebrows` | 仓库页面未明确显示 MIT；先按参考结构处理 | 只参考“表达状态由事件驱动”的设计，不直接复制代码或素材 |
| C | [tensology/decisionsai](https://github.com/tensology/decisionsai) | `skin.json` 皮肤思路；每套皮肤有 idle / thinking / working / attention 状态 | TENSOLOGY COMMUNITY LICENSE；不适合直接拷贝到本项目 | 只参考皮肤配置 schema，不能直接拿素材或代码 |
| C | [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits) | 大量 React 动效组件，可参考轻量动效节奏 | MIT + Commons Clause；依赖和视觉偏展示化 | 只抄微动效手法，不作为核心依赖 |

## 不建议采用的路线

| 路线 | 不建议原因 |
| --- | --- |
| Live2D / 二次元类虚拟形象 | 风格与造价工作台不匹配，资源重，容易变成展示噱头 |
| Three.js / 3D 角色 | 开发和性能成本高，容易压过表格主视觉 |
| 独立桌宠 / always-on-top 窗口 | 会遮挡 Excel 表格和右侧智算输入框，不符合当前 PRD 边界 |
| 直接拿商业角色或知名 IP 形象 | 授权风险高，不适合作为参赛和工作场景交付 |
| 只换一张头像不做状态机 | 无法满足“平时 / 思考 / 出问题”不同动效的需求 |

## 智算助手形象方向

### 形象定位

智算助手不是客服机器人，也不是营销吉祥物。它应像“随行复核员 / 造价数字员工”的轻量状态徽标。

建议形象关键词：

- 扁平化。
- 几何化。
- 低色彩。
- 小尺寸可读。
- 专业、可信、克制。
- 可以和 `Z` 徽标融合。

### 视觉草案

建议做一个“Z 智算核心”形象：

- 外形：圆角方形或圆形徽标，内含简化 `Z`。
- 五官：可选极简眼点 / 扫描线，不做完整拟人五官。
- 状态环：外圈细线作为状态反馈，可变为蓝色检索、琥珀色注意、红色异常、绿色完成。
- 尺寸：展开侧栏顶部 `48px-64px`；折叠态 `28px-36px`；消息气泡旁仍保留现有 `Z` / `U` 头像规则。

## 状态设计

| 状态 | 触发场景 | 动效 | 颜色 | 文案配合 |
| --- | --- | --- | --- | --- |
| 平时 `idle` | 无任务、等待输入、问答完成后 | 慢速呼吸、轻微上下浮动、偶发眨眼或状态环轻扫 | 中性灰蓝 + 少量绿色 | “随行待命”或不显示额外文案 |
| 思考 `thinking` | 检索依据、整理证据、调用模型、批量匹配等待 | 外圈点状旋转、扫描线移动、眼点左右扫视 | 知识库蓝 `#2563EB` | 必须同步显示“检索依据 / 整理证据 / 生成回答” |
| 出问题 `error` | API 失败、无依据、处理异常、文件识别失败 | 短促左右抖动 1 次、外圈红色闪 1 次，随后降到静态异常态 | 待复核红 `#B42318` | 必须显示明确错误原因或人工复核提示 |
| 命中 `success` | 知识库命中、报告生成完成、批量匹配完成 | 状态环由蓝转绿，小幅扩散一次 | 标准命中绿 | 可显示“已调用知识库”“报告已生成” |
| 注意 `warning` | 发现高风险、低风险、待复核较多 | 琥珀色状态点轻闪 2 次，不持续闪烁 | 经验提示黄 / 琥珀色 | 必须显示风险清单或跳转入口 |

P2 最小实现只要求前三个核心状态：平时、思考、出问题。命中和注意可作为同一批实现里的增强项。

## 技术方案对比

### 方案 A：纯 SVG + CSS 状态动画

做法：

- 自己写一个 `ZhisuanAvatar` React 组件。
- 用 SVG 分层：底板、`Z` 标识、眼点 / 扫描线、状态环。
- 用 `data-state="idle|thinking|error|success|warning"` 切换 CSS keyframes。

优点：

- 零新增运行依赖。
- 最符合当前 Vite + React 简单依赖结构。
- 文件小，容易统一 Navattic 极简风格。
- 状态和颜色可完全按项目 token 控制。

缺点：

- 动效精致度不如专业 Lottie。
- 需要前端自己调动画细节。

结论：P2 首选。

### 方案 B：Lottie / dotLottie 多状态动画

做法：

- 设计或下载一组 Lottie 状态动画。
- 用 `@lottiefiles/dotlottie-react`、`@lottiefiles/dotlottie-web` 或 `lottie-web` 播放。
- 通过状态名或帧段切换平时、思考、出问题。

优点：

- 动效更顺滑，视觉更容易出彩。
- Talon 已验证这类 AI 助手状态很适合 Lottie。

缺点：

- 新增依赖和资产管理。
- Lottie 素材授权需要逐个核实。
- 若素材风格不统一，容易破坏当前极简工作台。

结论：适合第二步替换增强，不建议第一步就押宝。

### 方案 C：Rive 状态机

做法：

- 用 Rive Editor 做一个状态机文件。
- 用 `rive-react` 控制状态输入。

优点：

- 状态机能力强，适合复杂互动。
- 运行时开源。

缺点：

- 新增资产生产工具链。
- 对当前三状态需求偏重。

结论：作为 P3 高级形象方案保留。

## 推荐实施路线

### 第一阶段：抄 Talon 的状态模型，自制 SVG 形象

目标：

- 在右侧智算侧栏顶部身份区落一个 `ZhisuanAvatar`。
- 实现 `idle / thinking / error` 三状态。
- 与现有文字阶段提示并存。
- 侧栏折叠时只显示小尺寸状态徽标。

状态映射：

| 本项目状态 | 可抄项目状态 | 说明 |
| --- | --- | --- |
| 平时 | Talon `idle` | 待机轻动效 |
| 思考 | Talon `thinking` | 检索 / 生成 / 批量处理 |
| 出问题 | Talon `error` | 错误 / 无依据 / 失败 |
| 回答中 | Talon `speaking` | 可暂时并入思考，后续再细分 |

### 第二阶段：补成功 / 注意状态

目标：

- 增加 `success` 和 `warning`。
- 知识库命中、报告完成用 `success`。
- 高风险、待复核、接口降级用 `warning` 或 `error`。

### 第三阶段：换成 Lottie / dotLottie

前提：

- 已有确定授权的自有 Lottie 素材。
- 第一阶段 SVG 状态逻辑稳定。
- 前端构建和运行性能无明显问题。

## 验收口径

- 形象必须在普通笔记本宽度下不挤压表格主工作区。
- 关闭或降低动效后，问问智算功能完全不受影响。
- 出问题状态不能只靠动效提示，必须同时有文字错误说明。
- 动效不得持续高频闪烁，避免长时间办公疲劳。
- 所有状态颜色必须沿用项目语义色：知识库 / AI 检索蓝、标准命中绿、经验提示黄、待复核红。
- 不改变问问智算路由、知识库检索、风险评级、价格 / 系数候选生成和写回逻辑。

## 当前推荐选择

建议大尾巴先看两个方向：

1. `A1：Talon 状态机 + 自制 SVG 扁平 Z 形象`。这是最稳的落地路线。
2. `A2：Talon 状态机 + dotLottie 正式素材`。这是更漂亮但需要素材和授权确认的路线。

如果只是为了当前 P2 快速落地，选 `A1`。后续参赛展示需要更强记忆点时，再把内部实现换成 `A2`。

## v5.5.0 实现记录

本轮已采用 `A1：Talon 状态机 + 自制 SVG 扁平 Z 形象` 路线落地，不新增 Lottie、Rive、Live2D、Three.js 或桌宠依赖。

### 实现文件

| 文件 | 作用 |
| --- | --- |
| `frontend/src/components/ZhisuanAvatar.tsx` | 智算机器人内联 SVG 主体，所有状态共用同一个 SVG DOM |
| `frontend/src/components/ZhisuanAvatar.css` | 状态动效、呼吸光晕、放大镜工作态、预警 / 异常 / 完成符号 |
| `frontend/src/App.tsx` | 根据现有前端任务状态计算 `zhisuanAvatarState`，接入右侧智算标题区和折叠入口 |
| `frontend/src/styles.css` | AI Dock 头像布局、折叠态机器人入口、匹配质量环莫兰蒂配色 |
| `01-assets/02-助手形象/zhisuan_avatar_minimal_unified_assets/` | 形象设计参考包、状态映射和 demo 资料 |

### 当前状态映射

| 前端状态 | 触发来源 | 当前动效 |
| --- | --- | --- |
| `idle` 待命 | 无任务、输入框未聚焦、无待处理动作 | 蓝色呼吸光晕、外圈节奏变化、状态点脉冲、本体轻微缩放 |
| `listening` 听取输入 | 问问智算输入框聚焦或已有草稿 | 轻微倾斜和眼点变化 |
| `thinking` 思考中 | 大模型问答、行级 AI 复核、助手气泡吐字 | 浅绿色呼吸光晕、扫描线、眼点扫视、简约放大镜轻摆 |
| `processing` 处理中 | 转换、批量匹配、预览刷新、经验池预警、风险报告、经验池导入、工作量抓取等长任务 | 浅绿色呼吸光晕、状态点脉冲、放大镜圆圈晃动 |
| `warning` 需复核 | 已产生待复核、经验池预警或风险提示 | 琥珀色屏幕和提示符号，短促提示动效 |
| `error` 异常 | 前端错误、预警失败、辅助填价弹窗错误 | 红色异常符号和短促抖动；仍需文字错误说明 |
| `success` 已完成 | 输出 Excel、预警完成、风险报告生成或人工修改成功 | 绿色完成符号和轻微弹出 |

### 已确认边界

- 形象只嵌入右侧“问问智算”Dock，不新增独立窗口、桌宠或遮挡表格的悬浮层。
- 形象动作只表达状态，不替代聊天气泡、按钮、阶段文案、错误说明或风险明细。
- 不改后端 API、知识库检索、风险评级、价格 / 系数候选生成和 Excel 写回逻辑。
- 不新增运行依赖；降动效用户由 CSS `prefers-reduced-motion` 兜底。
- 折叠态显示机器人形象作为展开入口，文字仅保留给无障碍标签。

## 资料来源

- [YanceyOfficial/talon](https://github.com/YanceyOfficial/talon)：Lottie-based avatar，含 idle / thinking / speaking / error 状态。
- [LottieFiles/dotlottie-web](https://github.com/LottieFiles/dotlottie-web)：官方 Web 播放器，MIT，支持 React、Vue、Svelte、SolidJS 和 Web Components。
- [airbnb/lottie-web](https://github.com/airbnb/lottie-web)：Lottie Web 基础运行时，MIT，可控制播放、暂停、帧段和速度。
- [boringdesigners/boring-avatars](https://github.com/boringdesigners/boring-avatars)：MIT，React SVG 头像生成库。
- [rive-app/rive-react](https://github.com/rive-app/rive-react)：MIT，Rive React runtime，适合复杂状态机动画。
- [aryan877/candidai](https://github.com/aryan877/candidai)：SVG avatar + expressions / actions 事件设计，授权需再核实。
- [tensology/decisionsai](https://github.com/tensology/decisionsai)：皮肤状态配置思路，社区许可，不建议直接复用代码或素材。
- [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits)：React 动效组件集合，MIT + Commons Clause，适合参考微动效。
