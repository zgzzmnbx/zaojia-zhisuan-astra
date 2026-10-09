# Astra UI 设计标准

设计系统版本 **1.0.32** · 2026-10-09 · 实现基线：造价智算 UI v0.9.69

适用对象：桌面 Web 工作台、专业业务工具、对话式智能体。本文是本项目后续 UI 的唯一设计标准，也可单独交给其他项目，重建相近的视觉和交互。设计系统版本与应用版本分别管理。

**后续新组件只参考本文和 daisyUI 组件。旧版智算仅作为业务功能、规则与数据语义来源，不再作为布局、配色、标题层级或交互外观的参考。**

文中的“必须 / 禁止”是验收门槛；“默认”允许有明确业务理由的局部调整。现有历史代码不一定已全部符合本文；新增或改动组件必须按本文验收，不得用旧代码中的不一致做法作为例外依据。本轮制定标准不等于重新验收全部历史界面。

## 1. 设计目标与不可变原则

视觉关键词：**纸白内容、浅灰导航、主题色强调、细边框、适量留白、轻量浮层、清晰数字、克制渐变。**

1. 内容优先：把空间留给对话、表格、文稿和图表。
2. 一个窗口一条主标题栏。标题、页签、状态与常用操作能合并就合并。
3. 不用重复标题、口号、长篇功能说明和无意义文件名占据顶部。
4. 默认亮色；主题配色与明暗是两个独立维度，由用户选择并持久化。
5. 统一组件：daisyUI 提供基础组件，项目适配层定义尺寸、颜色及组合方式。不能只引入 daisyUI 后继续任意手画一套按钮。
6. 默认只设计和验收桌面。除用户明确要求，不新增平板 / 手机适配任务，不进行这些尺寸的测试；现有响应式代码可保留。
7. 对话、草稿、文件、任务、结果和当前 Sheet 的身份独立于布局；换主题、展开、收起、全屏不能重置业务状态。
8. 图形来自真实数据。加载、未配置、未检查、失败与真实零值必须分别表达。

## 2. 技术组成与责任边界

| 层级 | 当前实现基线 | 责任 |
| --- | --- | --- |
| 应用 | React 19 + TypeScript | 业务状态、可访问行为、事件与生命周期 |
| 样式 | Tailwind CSS 4.3.3 + daisyUI 5.7.47 | 基础组件、语义颜色、工具样式 |
| 图标 | 本地 Phosphor Icons Core 2.1.1（MIT） | 业务 / 导航统一 Duotone，紧凑控制用同库 Regular；不用 emoji |
| 图表 | Recharts 3.10.0；简单费用图用 SVG / CSS | 真实比例、轴、图例、提示与主题渐变 |
| 窗口 | 原生 `dialog` / Popover + daisyUI 外观 | 顶层显示、焦点与返回，不靠无限增加 z-index |
| 动效 | CSS + Web Animations API | 可见时入场、暂停与释放，不模拟业务进度 |

以上版本用于复现当前外观，不代表其他项目必须永久锁死该版本。升级需重新验收主题变量、原生弹窗和图表渲染。Mantine 仅提供色阶思路，本项目没有因此引入 Mantine 组件库。

daisyUI 的类名负责视觉，**不自动完成所有键盘、异步和焦点逻辑**。例如页签方向键、菜单 Escape、发送防重、关闭后焦点恢复，由组件实现。

## 3. 标题与工具栏硬规则

### 3.1 垂直空间预算

界面品牌统一为“造价智算”，包含欢迎页、浏览器标题、导航提示、无障碍名称与下载名称。聊天署名英文名称使用“ZSuan”。“智算Astra”仅为内部项目代号；代码标识、配置与原始资产保持原名。

| 区域 | 默认高度 | 内容与约束 |
| --- | ---: | --- |
| 应用顶栏 | 58px | 品牌造价智算、导航与全局操作；全屏时品牌后追加当前页面名称 |
| 内容面板主栏 | 56px | 模块标题或页签、紧凑状态、右对齐动作；左右分栏底线对齐 |
| 项目摘要标题栏 | 48px | “项目信息”与关闭；不再加副标题带 |
| 专业工具栏 | 36–44px | 只有必要时出现：Sheet、筛选、搜索、缩放等合在一行 |
| 内容底栏 | 36–44px | 范围 / 状态与下载或主要动作合并；没有内容则不渲染 |

应用顶栏普通布局只显示“造价智算”；用户指定全屏时显示“造价智算 · 当前页面名称”，页面名跟随实际页签，以较轻字重和弱化分隔点衔接。项目归属只在左侧项目列表和对话详情呈现。模块内默认一条主栏，最多再加一条必需工具栏；这不是允许再添加两条标题。全屏沿用原主栏，只更换全屏动作，不增加“全屏模式”横幅。

导航左下角以 12px 辅助字号显示实际前端构建版本，版本由 package.json 在构建时注入，不手填常量、不随宿主重启猜测。调试操作的提交、拒绝和未确认反馈紧邻操作按钮；错误原因用中文，原始代码保留在折叠诊断。

### 3.2 合并决策

- 已有“表格 / 风险 / 文字报告”页签时，页内不要再写“表格预览”“风险工作区”“报告中心”等重复大标题。
- 项目总览、全国项目、地图展示、运行记录放同一行页签；筛选入口放可用的同栏空间，放不下才用紧凑工具栏。
- 文件名确需显示时与版本、下载合并；长名称省略并可查看完整值，不撑出第二行标题。
- 数量做标题旁的小数字或 badge，不另起“共 X 项”横幅。
- 低频操作放更多菜单或弹窗。可以横向滚动的 Sheet 不改成多行页签墙。
- 若删去标题会导致用户无法辨认任务，应保留最短、最具体的对象名；若只是重复上一层信息，应删除。

推荐结构：

```text
┌ 表格 · 风险 · 文字报告                    依据  全屏  关闭 ┐
├ Sheet 1  Sheet 2  Sheet 3            搜索  筛选  列设置 ┤
│                                                        │
│                  实际内容，弹性填满                      │
│                                                        │
└ 前 50 行预览 · 100 行总计                    Excel  Word ┘
```

禁止结构：`模块大标题 → 副标题 → 功能说明 → 页签 → 子页大标题 → 工具栏 → 内容`。

## 4. 页面骨架与四种布局

| 布局 | 场景 | 默认表现 |
| --- | --- | --- |
| 纯聊天 | 空态、输入、初步确认 | 对话居中，内容容器最大宽约 980px |
| 聊天 + 摘要 | 当前项目概览 | 对话为主，右侧约 448px 摘要面板；为面板预留空间，不盖住消息 |
| 聊天 + 专业内容 | 用户主动查看表格、报告、依据 | 可拖动双栏；分隔操作区 12px，视觉上只有细线 |
| 内容全屏 | 密集表格、图谱、看板、文稿 | 内容占工作区，保留返回入口与原会话状态 |

- 左侧图标轨道默认 60px；展开项目 / 会话导航属于可收起辅助区域，不侵占永久业务层级。
- 页面固定于 `100dvh`。外层不出现与内容重复的滚动条，滚动归属到消息区、表格区或面板正文。
- Grid 的弹性行必须用 `minmax(0, 1fr)`；Flex / Grid 中间节点必须有 `min-width:0; min-height:0`。
- 聊天输入固定在聊天容器底部，不能被长消息挤出窗口。
- 摘要面板下沿随窗口高度调整，正文可滚动，底部入口可访问；禁止用固定内容高度在下方留出大片空白。
- 主动回到聊天时默认显示项目摘要；后台结果不抢占用户正在看的界面。上传后聊天保留简洁资料确认卡，项目名称、工作表选择、表头和字段映射放入右侧编制设置卡；识别完成自动展开，底部固定转换按钮，关闭 / 重开保留选择和编辑。只有用户主动查看专业内容才展开大预览。
- 拖动分隔区的底色与面板一致，握柄只在悬停、聚焦或拖动时强调；禁止灰色宽槽和标题左侧突兀灰块。

## 5. 留白、密度与对齐

| 用途 | 标准 |
| --- | --- |
| 基础间距序列 | 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48px |
| 图标与短文字 | 6–8px |
| 相邻控件 | 8px；关联控件组间 12–16px |
| 卡片内边距 | 16px；摘要紧凑块 10–12px；大弹窗内容 24px |
| 卡片之间 | 12–16px；聊天轮次 24–28px |
| 专业正文区 | 16–24px；数据表与文稿阅读面可贴容器边线 |
| 宽聊天 / 聊天 + 摘要 | 消息左右最少 48px，居中内容宽约 960px |
| 窄聊天分栏 | 消息左右 20–24px，不把卡片贴在分割线上 |

宽聊天留白可采用 `max(48px, calc((100% - 960px) / 2 + 48px))`。输入区与消息视觉对齐，不因摘要出现突然贴边。不能为了塞下一屏而缩小业务字体；优先减少重复信息、折叠明细、降低图表高度。

新组件使用上述间距档位；1px 边框、7px 图标间距等来自既有组件的微调可局部保留，不把每次微调新增为全局 token。

## 6. 字体与数字

| 级别 | 字号 | 字重 | 用途 |
| --- | ---: | ---: | --- |
| 展示数字 / 欢迎标题 | 28px | 600–700 | 关键总额、主要指标、欢迎句 |
| 模块 / 弹窗标题 | 20px | 600–700 | 弹窗、独立模块；不可重复出现在已有页签下面 |
| 面板 / 卡片标题 | 16px | 600 | 项目名、任务结果标题 |
| 正文 | 14px | 400 | 对话和一般说明，行高 1.65–1.85 |
| 控件 / 表格 / 紧凑标题 | 13px | 400–600 | 按钮、表格、表单、紧凑信息块 |
| 辅助 | 12px | 400–500 | 单位、状态、图例、元信息，行高至少 1.45 |

必须使用 `--dws-font-size-*`，业务文字禁止小于 12px。新组件不新增 11、15、18、22px 等游离字号。历史少数 18px 统计值在该组件下次改动时归并，不声称本次文档已修改它们。

字体栈：`'Zaojia PingFang SC', 'PingFang SC', 'Microsoft YaHei UI', sans-serif`。表单控件继承字体。数字开启 `font-variant-numeric: tabular-nums`；金额靠右、单位靠近数值、百分比保留合理精度。其他项目只有具备字体授权时才能复制本地字体文件，否则使用系统回退字体。

## 7. 颜色与主题契约

颜色分三层：原始颜色 → 语义 token → 组件 token。组件消费语义变量，禁止散落固定蓝色。

| 语义 | 规范 token | 当前组件别名 | 用途 |
| --- | --- | --- | --- |
| 内容表面 | `--astra-paper` | `--paper` | 面板、卡片、弹窗 |
| 工作区底色 | `--astra-canvas` | `--canvas` | 页面底层 |
| 导航底色 | `--astra-rail` | `--rail` | 侧栏 |
| 正文 | `--astra-ink` | `--ink` | 主要文字 |
| 次要文字 | `--astra-muted` | `--muted` | 辅助信息；不作为禁用的唯一表示 |
| 边框 | `--astra-line` | `--line` | 1px 边线、表格分隔 |
| 浅色块 | `--astra-soft` | `--soft` | 次级按钮、分段轨道、输入区 |
| 主按钮 | `--astra-primary` | daisyUI `--color-primary` | 主操作底色；Mantine 蓝用同色系渐变 |
| 主按钮文字 | `--astra-primary-content` | daisyUI `--color-primary-content` | 所有启用的主题主按钮均为白字 `#FFFFFF` |
| 可读强调 | `--astra-accent` | `--blue`（兼容旧命名） | 链接、选中、焦点，深色时提亮 |

`--blue` 是主题强调色别名，不保证永远是蓝色。主按钮与强调文字不能混用，否则深色文字对比度容易不足。默认 Astra 蓝 + 亮色；用户可选 Mantine 蓝（`#228BE6` / `rgb(34,139,230)`）、翡翠绿、北境蓝、丝绒紫、秋日铜、石墨灰。完整 14 套明暗数值在文末 CSS 中。

Mantine 蓝的亮暗主色均精确保留 `#228BE6`；亮色强调文字为 `#1971C2`、深色为 `#74C0FC`。主按钮统一反白文字；Mantine 蓝按钮采用同色系较深渐变 `#1971C2 → #1864AB` 保持白字可读，主色 / 图表基色仍为精确的 `#228BE6`。hover 保持渐变色阶。选中态仅用主题浅底渐变，正文 / 表格 / 文稿维持纸白或深色纸面。原六套配色保持。

通用成功 / 待确认 / 错误状态采用下表；风险展示按用户指定使用当前主题色阶，以等级文字保留风险含义：

| 语义 | 亮色文字 / 浅底 | 深色文字 / 浅底 |
| --- | --- | --- |
| 成功 / 已确认 | `#278564` / `#edf8f2` | `#8aceb2` / `#203d34` |
| 待确认 / 经验提示 | `#a46b18` / `#fff7e6` | `#e4bf78` / `#3e3322` |
| 错误 | `#c35142` / `#fff0ed` | `#f39c8f` / `#412b2b` |

正文和控件文字以至少 4.5:1 对比度为验收目标，不能只看 token 名称宣称达标；尤其检查 disabled、tooltip、Portal、渐变背景及主题后的状态文字。状态必须同时有文字 / 图标，不能只靠红绿辨认。

## 8. 边框、圆角、阴影与图标

- 线宽默认 1px；焦点轮廓 2px，偏移 2px。表格选中不使用整行强蓝色上下粗线，可用浅色底与清晰的单元格焦点。
- 圆角：小状态 6px，输入 / 按钮 / Sheet 8px，分段轨道 11px，卡片 12px，浮动摘要 / 菜单 16px，大设置弹窗 20px。只读业务纸张不强行圆角。
- 普通面板无阴影或很轻；聊天卡参考 `0 3px 14px #182b4910`；浮层参考 `0 16px 48px #152a491f, 0 3px 10px #152a490c`。阴影不是所有区块的默认分隔手段。
- 禁止在每层容器都加边框与阴影，造成“卡片套卡片套卡片”。同一卡内优先用留白和细分隔线分组。
- 图标通常 16–18px，卡片图标 19px 放在 36px 浅色底块中；次级小图标 12–14px。Phosphor 以填充轮廓与浅色面表达形状；不可叠加旧线性图标的 stroke。
- 图标按钮必须有可访问名称与 hover / focus 提示；设置入口固定齿轮。全局 CSS 不得把图表 SVG 误设为图标宽高。

### 8.1 统一图标库

**本项目统一使用 [Phosphor Icons](https://phosphoricons.com/)，以 [Core 2.1.1](https://github.com/phosphor-icons/core) 本地 SVG 为资源基线，采用 MIT 许可证。后续新界面与组件必须沿用此库及本项目封装。**

- 业务、导航、设置、功能卡片：使用 **Duotone（双色扁平）**。实色轮廓与低透明度浅面共用当前主题色，不给每个功能随意分配彩虹颜色。
- 关闭、箭头、页签滚动、加减、加载等小尺寸控制：使用同库 **Regular**，保证 12–18px 下轮廓清楚。加载图标保留原动画类和减少动效行为。
- 原始 SVG 几何与浅面透明度保留，使用 `viewBox="0 0 256 256"`、`fill="currentColor"`、`stroke="none"`。不得套用旧线性 SVG 的描边规则。
- 颜色继承所在控件：默认正文 / 次要色，选中与可操作强调用主题可读强调色，主按钮内反白；状态色遵循第 7 节及具体模块约定。图标不能独自承担风险等级、成功或禁用信息。
- 图标尺寸沿用本节基础尺寸；快捷菜单采用 28px 图标 + 36px 浅色底块，紧凑布局见第 11 节。不能把快捷菜单的大底块套到所有工具栏。
- 禁止新增 Lucide、其他图标库、emoji 或文本字符拼成的功能图标；需要的图标缺失时从同版 Phosphor 补充。既有第三方隔离依赖不作为新组件选型依据。
- 品牌标识、Gork、图表、地图及原始架构插图是专用资产，不作为普通界面图标替换；不要给全局 `svg` 设置图标专属宽高、填充或描边。

### 8.2 按意图选图

同一功能跨菜单、导航、标题和卡片复用同一意图映射；选择图标前先辨认动作 / 对象，不按旧图形长相替换，不用星光泛指所有功能。

| 功能意图 | Phosphor 图形 | 使用说明 |
| --- | --- | --- |
| 当前聊天 / 新对话 / 历史记录 | `chat-circle-text` / `note-pencil` / `clock-counter-clockwise` | 分别表示交谈、创建与回溯 |
| 项目分组 / 项目看板 | `folder-open` / `kanban` | 文件归属与统计看板区分 |
| Excel 文件 / 表格工作区 | `file-xls` / `table` | 附件类型与表格操作区分 |
| Word 报告 / 通用文稿 / 风险报告 | `file-doc` / `file-text` / `file-magnifying-glass` | 不把所有报告都画成同一张纸 |
| 费用分析 / 批量匹配 | `chart-donut` / `intersect` | 分析费用构成与执行匹配区分 |
| 经验池预警 / 审核通过 | `shield-warning` / `shield-check` | 预警与通过不能混用 |
| 知识问答 / 资料库 / 数据库 | `book-open-text` / `books` / `database` | 问答依据、文章资料与结构化数据区分 |
| 同事复核 / 复核进度 / 派发 | `users-three` / `clock-countdown` / `paper-plane-tilt` | 人员、进度与发送动作区分 |
| 项目地图 / 能力星图 / 系统架构 | `map-trifold` / `planet` / `tree-structure` | 地理位置、能力空间与系统关系区分 |
| 全局设置 / 编制参数 / 专业工具 | `gear-six` / `sliders-horizontal` / `toolbox` | 设置入口固定齿轮，参数与工具另有含义 |
| 机器人设置 / 联动连接 | `robot` / `link` | 网页形象与连接操作区分 |
| 任务轨迹 / 工作量抓取 / 专业能力 | `path` / `stack` / `puzzle-piece` | 路径、层叠来源与能力组件区分 |
| 放大 / 缩小 / 搜索 | `magnifying-glass-plus` / `magnifying-glass-minus` / `magnifying-glass` | 缩放按钮不再用孤立字符表示 |

此表说明选型原则，完整实际映射唯一维护于 [`03-Src/icon-catalog.js`](03-Src/icon-catalog.js)。历史消息保存的图标名通过适配层兼容，不为换图标改写业务历史。

### 8.3 代码入口与复用

| 入口 | 用途 |
| --- | --- |
| [`icon-catalog.js`](03-Src/icon-catalog.js) | 通用名称、能力 ID、旧 React 名称映射；`viewIconName(view)` 解析页面意图 |
| [`studio/ui.tsx`](03-Src/studio/ui.tsx) 的 `Icon` | 工作室 JSX，传语义名称，尺寸由现有控件样式管理 |
| [`icons.js`](03-Src/icons.js) 的 `icon` / `paintIcons` | 公共 SVG 输出及静态预览适配，禁止在业务组件散写路径 |
| [`PhosphorIcons.tsx`](03-Src/PhosphorIcons.tsx) | 迁入专业组件的 React 图标，兼容 `size`、`color`、`className`、`ref`、ARIA 与加载类 |
| [`studio/QuickFeatureIcon.tsx`](03-Src/studio/QuickFeatureIcon.tsx) | 按能力 ID 取图，保留紧凑菜单的专用底块 |
| [`vendor/phosphor-duotone/`](03-Src/vendor/phosphor-duotone/) | 本地几何、`LICENSE.txt`、`README.md` 和 `manifest.json` 来源 / 权重 / SHA256 |

以下示例放在 `03-Src/studio/` 下，其他目录按位置调整相对路径：

```tsx
import {Icon} from './ui';
import {viewIconName} from '../icon-catalog.js';
import {FileDoc, Loader2} from '../PhosphorIcons';

// 普通控件：业务名称，不散写 SVG。
<button type="button" aria-label="打开设置" title="打开设置">
  <Icon name="settings"/>
</button>

// 页面标题：沿用能力目录，不再单独维护一套图形映射。
<Icon name={viewIconName('analysis')}/>

// 专业组件：保留尺寸与控件语义，图标默认作为装饰。
<button type="button"><FileDoc size={16}/>Word 报告</button>
<span role="status"><Loader2 size={16} className="spin"/>正在读取</span>
```

`spin` 复用所属模块的加载动画，适配器本身不创建动画。已有按钮文字时图标默认 `aria-hidden`，纯图标按钮必须有可访问名称；图标本身承载说明时使用 React 适配器的 `title` 或 `aria-label`，不得丢失键盘焦点和状态提示。

### 8.4 新增与验收

1. 先检索 `icon-catalog.js` 是否已有同意图图标；已有则复用，避免近义功能在不同入口各选一种。
2. 确需新增时，从同版官方 Core 资源选取 Duotone / Regular SVG，保留许可证，记录原文件权重与 SHA256 至 `manifest.json`，几何进入本地 `glyphs.js`；不依赖运行时 CDN。
3. 补充相应意图映射；若专业 React 组件需要新名称，同时补充 `PhosphorIcons.tsx` 导出。占位问号仅为未知名称降级，交付页面不得留有未映射图标。
4. 执行现有 `tests/icon-system.test.mjs`（已并入 `npm test`）与正式构建；在实际桌面检查亮暗、小尺寸、禁用、白字主按钮、焦点和加载状态，核对图表 / 地图 / Gork 未受全局 SVG 规则影响。

## 9. daisyUI 基础组件标准

| 组件 | 基础类 / 元素 | Astra 外观与组合 |
| --- | --- | --- |
| 主按钮 | `btn btn-primary` | 高 34px、13px 字、左右 12px；每个决策区域只突出一个主要动作 |
| 次按钮 | `btn btn-ghost` / 中性边框按钮 | 中性色、轻 hover，不与主按钮同样醒目 |
| 图标按钮 | `btn btn-ghost btn-square` | 常规 32–36px；应用顶栏快捷入口可 44px |
| 文本动作 | 原生 button + 项目类 | 12–13px，保留焦点；低频 / 次级动作 |
| 输入框 | `input`、`textarea` | 单行高 38px、13px；textarea 14px；细边框、完整 label |
| 下拉 | `select` | 紧凑高 34px；与同排输入框组合时统一到 38px |
| 勾选 | `checkbox` | 17px、4px 圆角；整段 label 可点击 |
| 状态标签 | `badge` | 高约 24px、12px、左右 8px；语义色浅底 |
| 业务卡 | `card` + 项目封装 | 12px 圆角、1px 线、16px 留白；覆盖无关默认间距 |
| 消息 | `chat` / `chat-bubble` + 语义文章 | 用户浅色气泡，助手以正文和卡片表达，不强迫所有消息气泡化 |
| 表格 | `table` + 滚动容器 | 13px、粘性表头、列内对齐、内部水平滚动 |
| 折叠 | `collapse` 或 `details/summary` | 有意义的明细按需展开，默认只显示一行摘要 |
| 菜单 | `menu` / `dropdown` + 项目封装 | 紧凑分组，键盘可操作；不把普通导航硬套 ARIA menu |
| 弹窗 | 原生 `dialog` + `modal/modal-box` | 标题一行、正文滚动、动作清楚；Esc 与焦点恢复 |
| 反馈 | `alert` / `toast` / `loading` | 短句，持续性错误放相关区域，临时成功提示不遮住内容 |
| 页签 | tablist + tab / 项目分段封装 | 使用第 11 节，不沿用多排下划线标题导航 |

特殊尺寸属于组件变体，不通过任意缩小字体实现。组件源码要覆盖 default、hover、pressed、focus-visible、disabled、loading、error、selected 等适用状态。

### 状态行为

| 状态 | 视觉 | 行为 |
| --- | --- | --- |
| Hover | 浅色底 / 边框轻强调，约 160–180ms | 不造成布局位移，不仅依赖 tooltip 说明功能 |
| Focus | 2px 可见轮廓 | 键盘可达，不能为了美观全局 `outline:none` |
| Pressed / Selected | 主题浅底、文字强调、必要图标 | 与 hover 有明显区别；同步 aria 状态 |
| Disabled | 浅底、弱化文字 | 原生 disabled；说明阻塞原因，不能只点了没反应 |
| Loading | 保持按钮宽度，spinner + 当前动作 | 防重复提交；可取消任务提供取消入口 |
| Error | 语义红色、具体短原因 | 保留输入、可重试；不把请求失败当空数据 |

## 10. 卡片家族

### 对话任务卡

顺序固定：`图标 + 一句结果标题 + 状态 → 必要数据 / 待确认项 → 一行操作`。

- 标题 16px，说明 13–14px，来源 / 单位 12px。
- 只有在区别任务类型确有帮助时保留小 caption；不要给每张卡重复增加一行分类标题。
- 底部主按钮靠左，次操作紧随；背景可用 canvas，与内容用细线分隔。
- 待执行确认卡明确显示将做什么；完成卡显示结果和下一步，不保留可重复执行的旧按钮。
- 上传文件名显示在资料卡，聊天标题上方不再常驻一排上传文件名。

### 项目摘要卡

固定信息次序：`项目名 → 关键金额 → 费用构成 → 匹配进度 → 风险复核 → 资料折叠行 → 统一入口`。

- 项目名最多合理换行，长名称不冲掉关键金额；状态与金额同区。
- 普通费用圆环约 180px，紧凑摘要约 136px；柱条高 10–12px。内容优先，不能让两个大图占满整屏。
- 金额、不含税、税额口径明确；缺失显示“暂无”，人工修改后标“待重算”。
- 风险区域显示等级计数和最重要的可操作事项；未检查、读取中、失败、真实零风险分别呈现。弹窗与侧栏风险计数圆点统一主题 7 / 5 / 3 / 2 色阶表示高 / 中 / 低 / 其他；重点风险图标使用可读强调色，浅底取对应主题色阶，不再使用固定红 / 黄 / 青色。等级文字、数量与操作保留。
- 文件放一行可展开摘要，不堆长路径、运行 ID、内部实现说明和免责声明段落。
- 底部“资料 / 计算表 / 看板”等入口统一大小；需要时吸底，不能遮住正文。

### 指标与统计卡

小标签 + 28px 数字 + 必要的 12px 口径。普通卡片保持轻边框。只有主要指标或可操作选中态使用浅色强调；避免每张卡一种鲜艳背景。

## 11. 分段页签、Sheet 与快捷菜单

- 三项内容切换使用 38px 高滑块：轨道 soft、内边距 4px、选中块 paper、内圆角 8px、滑块过渡 320ms。通过位移移动同一选中块，不逐按钮闪烁。
- 页签文字 13–14px；选中态 600 字重。使用 `role=tablist/tab/tabpanel`、`aria-selected`、`aria-controls`，单一 Tab 停靠点；方向键 / Home / End 切换。
- 多个文件 Sheet 使用显式横向页签，包含可见选中态、左右滚动按钮和当前位置。切换与容器尺寸变化后选中项仍可见。
- 项目看板和知识模块各只有一组主页签。不能在下面再加一组同义功能导航。
- 聊天快捷菜单把手靠输入框上沿左侧，面板左对齐，动效原点位于左下角。悬停后向上展开，不挤动消息和输入框；离开时短暂过渡，跨越间隙不意外收起。
- 快捷菜单也支持点击 / Enter / Space 打开、Esc 关闭并恢复焦点；隐藏时 `inert` 与 `aria-hidden`，避免 Tab 进入不可见项。

- 快捷功能沿用第 8 节统一图标库，36px 浅主题底块配 28px 图标；面板最大宽 560px，按钮最小高 68px，图文 / 网格间距 4px、分组间距 8px；文字 13px，按钮透明底、悬停浅主题面，不堆满整片实色按钮。常用与全部功能共用能力 ID 映射，禁用门禁及原提示保持。

- 知识库聊天回答使用独立卡片，标题旁使用小型 Phosphor Duotone 装饰图标（模型 brain、WeKnora graph、检索 book-open-text、预设 list-checks），浅主题色底块，不增加标题层级；回答表格采用主题浅色表头、柔和斑马纹、横向分隔与悬停行强调，数字使用等宽数字，长内容可横向滚动。单行注明原问答 / WeKnora 与生成方式；回答正文、图表及知识候选入口归于同一卡片。出处只显示“引用依据 · N 条”按钮，点击在右侧摘要区展示来源卡片，不在聊天内展开；绑定所点回答快照，呈现来源编号、名称、定位与完整摘录，保留版本核验 / 原文入口及统一入场动效，Escape / 关闭返回触发按钮，切换会话清空；依据不足 / 预设非模型等标识不能隐藏。仅在表头与全部数据行列数一致时修复错误的 Markdown 分隔线，不改写数值、来源或代码示例。

## 12. 表格、风险、报告与知识界面

| 类型 | 必须保留 | 必须压缩 / 删除 |
| --- | --- | --- |
| 专业表格 | Sheet、字段、编辑、来源依据、范围说明、下载 | 重复表格标题、顶部多张统计卡、已完成按钮占位 |
| 风险复核 | 偏离率图、当前值 / 基准、等级、依据、定位 | 只有长文字的无层次风险清单 |
| Word / 文稿 | 真实分页预览、缩放、版本、下载 | 重复“预览”按钮、假纸张中的抽取正文替代实际 DOCX |
| 知识库 | 搜索、文章 / 问答 / 图谱页签、引用和原文 | 三层页面标题、把引用和回答混成一个来源不明正文 |
| 地图 / 架构 | 图本体、图例、必要控制、全屏 | 图上大段介绍、悬浮控制遮住关键节点 |

表格行默认约 40–44px，按内容自然增高；表头 13px、字重 600，数字右对齐。实际只返回前 50 行时必须标明范围，不画虚假全量分页。搜索按需展开，完整长文本可通过 title 或详情查看。

风险百分比保持原业务口径；为展示极值压缩坐标时必须明确说明并提供原值，不在前端偷偷改风险等级。报告源文档的字体、颜色、金额不因界面主题变化而改写。

## 13. 图表与渐变

### 图形选型

| 数据关系 | 首选 | 约束 |
| --- | --- | --- |
| 同类数值比较 | 横向 / 纵向柱状图 | 从零起轴，单位清楚；长名称优先横柱 |
| 构成占比 | 圆环 | 中心放总量或主要比例，外侧图例含名称与数值 |
| 真实时间序列 | 折线 / 面积图 | 无时间数据不画趋势；周期不足给简短空态 |
| 完成覆盖 | 进度条 + 原始计数 | 不将匹配覆盖率标为审核通过率 |
| 偏离 / 风险 | 对比柱与偏离率 | 看板与具体风险页使用主题深浅色阶；保留等级文字、方向与实际百分比 |

### 外观

- 看板风险排行按用户 2026-10-07 指定使用主题渐变：高风险 5→7、低风险 2→3，图例对应 7 / 3；保留等级文字、原数量与点击筛选。具体风险页按用户补充要求也使用主题色：高风险 5→7、中风险 3→5、低风险 2→3；标记 / 标签底色对应主题深浅，数值与标签文字用可读强调色，经验均值柱用主题浅色。保留风险等级文字、比例、方向、判级和定位。其他页面的单元格提示与业务状态语义色仍按各自规则。

- 采用当前主题同色系深浅色阶；从 `--astra-chart-2/3/5/6/7/9` 取色。色阶基色必须读取当前主题的 `--astra-primary`，禁止另设不同色相或饱和度的固定图表基色；深色通过色阶提亮。
- Mantine 蓝新增 `--astra-primary-gradient` 和 `--astra-selected-gradient`，用于主按钮、品牌标记、主题预览与选中态；不增加渐变动画，不覆盖通用错误 / 成功状态。
- **柱形、面积图和圆环都允许并默认使用克制渐变。**渐变不改变几何面积或数值含义。
- 柱形从较浅的 5 到较深的 7 纵向渐变；对照系列从 2 到 3。顶部圆角约 5px。
- 面积从 5 色阶约 38% 不透明度渐隐至约 2%；折线保持 7 色阶、2–2.5px 线宽。
- 圆环每段使用自己的同色系渐变，保留 2° 左右间隔和表面色描边；不能用整张图片的彩虹渐变掩盖类别。
- 圆环渐变参考：0% 为基准色 72% + 白色，52% 为基准色，100% 为基准色 80% + 9 色阶。方向左上到右下。图例用对应基准色。
- 模型 / 来源可按 `[7,3,5,9,2,6]` 取色，优先拉开相邻段。颜色只是辅助，标签与数值必须可读。
- 看板绘图区一般高 240–300px；环图一般 160–220px。摘要按第 10 节缩小。桌面两列分析图，主趋势可占约 2/3；不要把所有图做成小缩略图，也不要一个图霸占整屏。
- 网格线用 line；轴 / 图例最小 12px；tooltip 用 paper、ink、line，不能在暗色时变成白底白字。
- 关键数字真实显示，不做虚构数字滚动。过渡沿用统一入场，不叠加 Recharts 自带动画。
- SVG 渐变 ID 使用组件实例唯一标识；多个窗口 / 多个图不得重复使用全局固定 ID。

图表色阶为 Astra 自定义、受 Mantine 思路启发的派生色，不宣称是 daisyUI 内置图表方案或 Mantine 完整原版色板。

## 14. 设置、弹窗与层级

- Wiki关系星图复用知识图谱玻璃阅读卡（宽clamp(340px,29vw,400px)、顶部分类 / 关闭、正文独立滚动、底部返回）。阅读卡与搜索 / 筛选均浮在完整画布内；工具开关不重建星图，搜索与筛选窗口支持Esc与焦点恢复。Wiki目录与资料检查仍保留并排阅读布局。

- AI 填价候选采用紧凑卡片，折叠差异与填写动作同行，字号保持12px以上。详情窗最大1440px，左侧三分之一纵排分布与匹配记录，右侧三分之二展示独立滚动明细；百分比采用主题强调底色与白字标签，保留相似度并非命中概率的说明。

- 顶栏独立太阳 / 月亮按钮直接切换明暗，并同步欢迎页、专业 iframe 与外观偏好；保留旁边配色入口。已健康运行的平台仅“运行中”文字使用当前主题强调色。
- 全局设置从左下角齿轮进入统一弹窗；其他设置入口只选择该弹窗的对应分类，不能占用右侧成果窗口。
- 设置弹窗默认宽 `min(1080px, 100vw - 48px)`，高 `min(800px, 100dvh - 64px)`，左侧分类 192px，正文独立滚动。
- 通用弹窗默认最大宽约 650px，正文内边距 24px；高不超过窗口减去 40–64px。标题、关闭、保存中状态合为一行。
- 弹窗内分类名与父标题重复时不再加大标题；分组 label 与表单相邻，不用标题条隔开每一组设置。
- `showModal()` 进入顶层，打开记录触发按钮，关闭恢复焦点；Esc、背景关闭与正在保存时的行为一致。
- 使用原生顶层解决被 overflow / container-type 裁切的问题，不给所有元素随意分配 999999 的 z-index。
- 语义层序：业务正文 → 面板浮层 / 拖动柄 → 菜单 → 原生 modal → 当前 modal 内的必要悬浮角色。下层不可点击时不要遗留悬浮热点。

## 15. 动效规范

- 三维知识 / Wiki 星图提供立体星云（默认）、旋臂银河、球状星团缩略选项与空间厚度滑块（0.3–1.8倍）。布局只改变显示坐标，按条目ID确定稳定位置，不修改分组或业务关系；节点与光路同步平滑变形，不重建场景 / GPU几何或重置光流。关闭动效时直接到位，离屏暂停。

| 对象 | 默认时间 | 表现 |
| --- | ---: | --- |
| Hover / 颜色 | 160–180ms | 颜色、边框轻过渡 |
| 快捷菜单 | 180–220ms | 淡入、向上 14px、轻微缩放 |
| 分段滑块 | 320ms | 选中面平滑滑动 |
| 卡片入场 | 520ms | 从下方约 18px 淡入 |
| 面板 / 弹窗 | 560ms | 从下方约 22px、0.97 到 1 |
| 卡片图标 | 650ms | 小幅缩放回弹，只随卡片首次出现 |
| 看板图表 | 900ms | 裁切显露 + 淡入 |
| 简单柱条 / 圆环 | 1000 / 1100ms | 比例显露，最终数值始终真实 |
| 弹窗遮罩 | 220ms | 单次淡入 |

统一缓动参考 `cubic-bezier(.16,1,.3,1)`。一个元素只由一个动效控制器负责，禁止 CSS 与 WAAPI / 图表库重复播放。

首次进入视口播放；已完成入场不因输入、颜色切换或普通 rerender 重播。入场被滚动打断后可以再次可见时重播。离屏、页面隐藏、卸载取消动画并释放观察器；无 JavaScript 时内容仍可见。`prefers-reduced-motion` 下去掉位移、旋转与增长，可用不超过 180ms 淡入。

## 16. 状态、文案与无障碍

- 空态：一个图标、一句原因、一个有用动作。不要给空态安排三段产品宣言。
- 加载：骨架 / spinner 占住原布局；未知进度不画百分比。异步区域设置适当的 `aria-busy`。
- 失败：说明哪一步失败，保留输入，提供重试；局部失败不清空整页。
- 同事复核确认受阻时在确认框旁逐平台说明缺少的配置、方式、人员或已有复核任务；全部已启用平台准备完成才能勾选。不因解释不清绕过逐平台 / 人员 / 版本发送门禁。
- 保存：未保存、保存中、已保存、保存失败必须可辨；关闭前按实际需要处理未保存内容。
- 未配置 / 未核验 / 已连接分开；有配置不代表连接成功，发送请求成功不代表消息送达。
- 文案优先“查看报告”“重新检查”“保存设置”等动作。不要“规则决定数字，你掌握关键决策”式常驻口号，不把开发环境说明塞进业务流程。
- 对话 Enter 发送、Shift+Enter 换行；输入法组合输入不能意外发送。发送后保留可追溯的当前任务上下文。
- 使用原生 button / input / select，不用 div 模拟点击控件。标题语义连续；不因视觉删标题就删掉区域可访问名称。
- 临时反馈可用 `role=status`，重要错误用合适的 alert；不要每次动画或轮询都打断屏幕阅读。
- 缩放至 125% / 150% 后检查桌面内容仍可访问，不通过隐藏功能应付空间不足。

## 17. 角色、欢迎页与特殊内容

本节属于 Astra 可选品牌扩展，其他项目无需复制机器人。

- Gork 使用原始渲染器与合法资产，不重绘近似替代。聊天中在输入区呈现一个活动角色，历史消息不用活动画布。
- 全屏由约 64px 悬浮头像接替，默认左下角；可拖至四角、键盘切角，不能阻挡主要操作。
- 按当前用户约定，可见 Gork 持续眨眼、平滑跟随，无单独暂停按钮；这个特例不扩散到其他动画。隐藏 / 离屏停算，同一时间只有一个可见实例播放。
- 欢迎页上方角色与下方只读示例分开，示例内不再重复放机器人。示例数据标注合成，不操作真实任务。
- 架构图每次显式打开默认动态横版、应用内全屏、自动播放，并临时使用整套深色外观（包括顶栏、导航、工具栏与底栏）；保留暂停。自动深色不改写用户偏好，退出恢复此前明暗；用户显式切换仍可生效。这是 Astra 的明确业务入口约定，知识图谱按下一条约定自动全屏，其余模块保持原布局。
- 显式进入知识图谱默认应用内全屏；全屏知识页签、返回对话与关闭合入品牌顶栏，移除第二排内容标题，选中页签承担页面名称，保留原内容实例、搜索与节点状态。分栏时使用内容页签栏，返回分栏不自动再次全屏。知识图谱可见时临时使用整套深色，切换页签、关闭内容或离开工作室后恢复原明暗偏好；不把自动深色写入偏好。知识图谱默认复用 3d-force-graph 三维星云，知识节点以类别名称固定映射低饱和矿物色，现有 10 类各有独立色，未知类暂用中性灰；禁止按出现顺序循环用色。颜色不表示风险，关联数量通过节点尺寸表达；自发光和光晕默认恢复原强度（0.22、基础 0.1 / 选中 0.18、半径 2.2 倍），提供自发光强度、光晕强度 / 大小滑块，保留柔和高光，选中通过光环和关联线强调，设置中提供文字分组图例。节点名称使用柔和灰蓝色，名称亮度滑块范围 0–100%、默认 60%，平滑生效并记忆。名称显示按明确优先级：选中时显示自身与直接邻居（邻居亮度为自身 75%），未选中而搜索时只显示命中，鸟瞰时只显示悬停；不再按关联数阈值常驻名称。字号仍为 13px，淡化不靠缩小字体。节点随环绕视角呈现旋转与纵深，关系连线有流光；鸟瞰默认弱化连线至原亮度 25%，右上角星图设置提供旋转速度、画面缩放、节点大小、节点不透明度（0–100%，越高越实）、光流速度、鸟瞰 / 关联线亮度和粗细，实时渐变、独立本地记忆及恢复默认；调整设置不能重建场景或重置光流相位，Escape 优先关闭设置；选中后仅当前节点的直接关联线保留流动光路，线宽 / 亮度 / 光流采用连续渐变；光流计时与镜头独立，不因搜索、拖动、镜头推近或切换节点重建 / 归零；滚轮与按钮缩放不打断旋转；点击节点用约 480ms 镜头推近并突出节点，默认观察距离须容纳该节点及全部直接相邻节点；提供独立“点选放大倍率”滑块（0.5–2.5 倍，默认 1 倍），越高镜头越近，用户主动放大允许局部观察；已选中时平滑实时调整，鸟瞰视角及放回位置不受此项影响；显示邻居名称与连线，并围绕此关系范围缓慢观察；全屏画布给详情窗留出空间，放回时恢复先前视角。全屏选中时显示侧边原文详情窗，采用主题底色半透明磨砂玻璃、背景模糊和轻微边缘高光，正文保持不透明；按用户明确要求启用玻璃材质，强制色彩模式使用实底，无背景模糊支持时提高底色不透明度。关闭 / Escape 只退出观察，不退出全屏；详情请求须取消过期回执。拖动与搜索暂缓旋转，文字始终朝向视角；减少动效或手动关闭时镜头直接定位。保留二维切换及 WebGL 失败降级。沿用动效开关，默认遵守减少动态效果，只有用户主动开启才覆盖；不可见时暂停，离开卸载并释放动画与观察器。
- 地图、Word 原稿、独立架构资产保留自身必要颜色语义，不强制全图染成主题色。

## 18. 实现骨架：新项目如何复用

1. 将本文放入新项目根目录 `DESIGN.md`，在其 AGENTS / README 中设为唯一视觉标准。
2. 使用 daisyUI + Tailwind，接入文末完整 token；根节点显式设定 `data-astra-palette="astra" data-astra-scheme="light" data-theme="light"`。
3. 先实现 PageShell、PanelHeader、Button、SegmentedTabs、TaskCard、StatusBadge、SettingsDialog 七类封装，再做业务页面。
4. 采用四布局和单主栏结构；业务不以对话为中心时可省去聊天栏，但不新增重复标题层。
5. 持久化键使用新项目自己的命名空间，不能共享 `astra.*` 会话、偏好或数据存储。
6. 引用本项目组件只复用外观和通用交互，重新接入新项目的业务控制器；不复制 Astra 的真实数据、密钥、机器人配置或硬编码来源路径。

### 单主栏组合示意

以下只展示结构；`views`、回调、键盘页签逻辑和业务区域由新项目实现，不是可直接运行的完整应用。

```tsx
<section className="astra-panel" aria-label="当前成果">
  <header className="astra-panel-header">
    {/* 页签已经说明内容，不再额外放“成果预览”大标题 */}
    <SegmentedTabs views={views} value={view} onChange={setView} />
    <div className="astra-panel-actions">
      <button className="btn btn-ghost" onClick={openEvidence}>依据</button>
      <button className="btn btn-ghost" onClick={toggleFullscreen}>全屏</button>
      <button className="btn btn-ghost btn-square" aria-label="关闭成果" onClick={close}>×</button>
    </div>
  </header>
  {needsToolbar && <div className="astra-panel-toolbar">{toolbar}</div>}
  <div className="astra-panel-body">{content}</div>
</section>
```

```css
.astra-panel{display:grid;grid-template-rows:auto auto minmax(0,1fr);min-width:0;min-height:0;background:var(--astra-paper);color:var(--astra-ink)}
/* 没有工具栏时移除对应行，避免隐式网格改变正文高度。 */
.astra-panel:not(:has(>.astra-panel-toolbar)){grid-template-rows:auto minmax(0,1fr)}
.astra-panel-header{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 18px;border-bottom:1px solid var(--astra-line)}
.astra-panel-actions{display:flex;align-items:center;gap:8px;margin-left:auto;flex-shrink:0}
.astra-panel-toolbar{display:flex;align-items:center;gap:8px;min-height:40px;padding:4px 16px;border-bottom:1px solid var(--astra-line)}
.astra-panel-body{min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain}
```

### 可直接交给其他项目的实施提示

> 以 DESIGN.md（Astra UI 设计标准 1.0.0）作为唯一视觉标准，使用 daisyUI + Tailwind 实现。先建立统一 token 和组件封装，再组合页面。默认桌面、亮色、可切换七套主题。一个窗口只保留一条主标题栏，标题、页签、状态、动作尽量合并，专业内容最多补充一条必要工具栏。保留正文留白、统一字号、主题渐变图表、轻动效及完整状态。不要参考旧项目 UI，不复制旧业务数据；旧项目只用于核对功能逻辑。交付前按本文验收清单检查。

## 19. 本项目组件索引与维护规则

| 规范领域 | 当前文件 |
| --- | --- |
| 基础组件 / 字体 / daisyUI | `03-Src/style.css`、`03-Src/studio/ui.tsx` |
| 七主题与明暗 | `03-Src/studio/appearance.css`、`appearance.ts`、`AppearanceControls.tsx` |
| 四种布局与接缝 | `03-Src/studio/workbench/four-surface.css`、`workbench-layout.css`、`usePresentation.ts` |
| 内容滑块 / 看板页签 | `03-Src/studio/workbench/ContentViewTabs.tsx`、`ProjectViewTabs.tsx` |
| Sheet | `03-Src/studio/table/SheetTabs.tsx`、`sheet-tabs.css` |
| 对话卡片 | `03-Src/studio/ConversationCard.tsx`、`conversation-cards.css` |
| 项目摘要与费用 | `03-Src/studio/workbench/CurrentProjectCard.tsx`、`03-Src/studio/FeeSummary.tsx` |
| 看板与渐变 | `03-Src/studio/project-dashboard/ProjectCharts.tsx`、`astra-dashboard.css` |
| 风险与报告 | `03-Src/studio/RiskReview.tsx`、`DocumentPanel.tsx` |
| 菜单 / 设置 | `03-Src/studio/ComposerQuickMenu.tsx`、`SettingsDialog.tsx` |
| 动效 | `03-Src/studio/entrance-motion.ts`、`entrance-motion.css` |

开发前读取本文和对应组件；优先扩展现有组件，不另建相似但尺寸不同的一套。`00-docs/00-PRD/03-UI设计规范.md` 仅保留项目接入索引，不再维护第二份视觉数值。

新增 token、变更布局、调整字号或增加组件变体，必须同批更新本文及必要测试 / 截图。局部确有例外时，写明范围和原因，不能悄悄建立“旧版标准”。不把本次没有改动的历史模块自动判为已达标。

## 20. 交付验收清单

- [ ] 一个模块一条主栏；没有连续三层标题、重复文件名、重复导航或口号。
- [ ] 1440×900、1366×768 桌面检查；默认不检查平板与手机。短窗口不丢输入框和底部操作。
- [ ] 明暗两种模式、六主题切换后文字 / 图例 / tooltip / 弹窗可读；状态色含义不变。
- [ ] 消息有左右留白，摘要下沿自适应，表格只在内容区滚动；没有灰色宽接缝。
- [ ] 按钮、字号、圆角、间距、图标来自统一规范；没有低于 12px 的业务字。
- [ ] 键盘焦点可见，页签 / 菜单 / 弹窗键盘可操作，关闭恢复焦点；输入法不误发送。
- [ ] 空、加载、失败、禁用、待配置、未检查、零结果分别可理解，重要操作不重复提交。
- [ ] 图表数值、比例、单位真实；圆环 / 柱 / 面积渐变正确，SVG ID 无冲突，图例不丢失。
- [ ] 动画实际播放且不重复叠加；减少动效、隐藏页面、卸载时停止并保留可读内容。
- [ ] 换主题、布局、全屏、页签不会丢草稿、滚动、选中项、当前任务与文件版本。
- [ ] 本项目 UI 代码变更执行 `npm test`、`npm run build` 及对应桌面交互验收；文档单独变更核对数值、路径、示例和引用，不声称重新通过全部业务验收。

## 21. 官方来源与复现基线

正文主要来自 Astra 当前代码与用户确认，daisyUI 官方文档用于核对基础组件能力和配置语法，核对日期 2026-10-07：

- [daisyUI 配置](https://daisyui.com/docs/config/)：Tailwind CSS 中的 plugin 与默认主题配置。
- [daisyUI 主题](https://daisyui.com/docs/themes/) 与 [语义颜色](https://daisyui.com/docs/colors/)：主题变量与组件用色。
- [daisyUI 原生弹窗](https://daisyui.com/components/modal/)：dialog 与 modal 外观组合。
- [Mantine 官方默认色阶](https://github.com/mantinedev/mantine/blob/master/packages/@mantine/core/src/core/MantineProvider/default-colors.ts)：2026-10-08 核对 blue[6] = `#228BE6`。
- [Mantine 主题](https://mantine.dev/theming/theme-object/)：多级色阶参考，不作为组件依赖。

## 22. 可移植 token CSS

下列代码供新项目复制。主题原始值与 Astra v0.9.5 的 `appearance.css` 一致；后半部分将字体、尺寸与组件别名收敛为便于复用的入口。**本项目仍由既有源文件提供运行时样式，不要再把此代码作为第二套覆盖重复加载。**

新项目将代码放在自己的样式入口中；`@plugin` / `@import` 由 Tailwind 构建处理，不是直接放进浏览器 `<style>` 就能加载依赖。`.astra-ui` 为建议作用域，body 或应用根元素使用该类。

```css
@import "tailwindcss";
@plugin "daisyui" { themes: light --default, dark; logs: false; }

[data-astra-palette="astra"][data-astra-scheme="light"]{--astra-paper:#ffffff;--astra-canvas:#f7f8fa;--astra-rail:#f4f5f7;--astra-ink:#202838;--astra-muted:#637084;--astra-line:#e5e8ee;--astra-soft:#f0f3f8;--astra-primary:#284bd4;--astra-accent:#284bd4;}
[data-astra-palette="astra"][data-astra-scheme="dark"]{--astra-paper:#161a21;--astra-canvas:#11151c;--astra-rail:#0d1117;--astra-ink:#edf1f8;--astra-muted:#a4afc0;--astra-line:#303946;--astra-soft:#222b39;--astra-primary:#4564cd;--astra-accent:#a6baff;}
[data-astra-palette="mantine-blue"][data-astra-scheme="light"]{--astra-paper:#ffffff;--astra-canvas:#f5f9fd;--astra-rail:#edf4fb;--astra-ink:#203044;--astra-muted:#586d82;--astra-line:#dce7f1;--astra-soft:#eaf3fb;--astra-primary:#228be6;--astra-accent:#1971c2;--astra-primary-content:#fff;--astra-primary-gradient:linear-gradient(135deg,#1971c2,#1864ab);--astra-selected-gradient:linear-gradient(135deg,#e7f5ff,#f5f9fd);}
[data-astra-palette="mantine-blue"][data-astra-scheme="dark"]{--astra-paper:#16212d;--astra-canvas:#101923;--astra-rail:#0c141e;--astra-ink:#edf4fc;--astra-muted:#a6bad0;--astra-line:#304356;--astra-soft:#213549;--astra-primary:#228be6;--astra-accent:#74c0fc;--astra-primary-content:#fff;--astra-primary-gradient:linear-gradient(135deg,#1971c2,#1864ab);--astra-selected-gradient:linear-gradient(135deg,#213b54,#16212d);}
[data-astra-palette="emerald"][data-astra-scheme="light"]{--astra-paper:#fcfefc;--astra-canvas:#f3f8f4;--astra-rail:#eaf2ec;--astra-ink:#24372c;--astra-muted:#5a6f62;--astra-line:#dbe7df;--astra-soft:#e9f3ed;--astra-primary:#197452;--astra-accent:#176648;}
[data-astra-palette="emerald"][data-astra-scheme="dark"]{--astra-paper:#17221c;--astra-canvas:#101b16;--astra-rail:#0c1712;--astra-ink:#e8f1eb;--astra-muted:#a4b9ab;--astra-line:#304438;--astra-soft:#233b2d;--astra-primary:#287652;--astra-accent:#92d5af;}
[data-astra-palette="nord"][data-astra-scheme="light"]{--astra-paper:#fafcfe;--astra-canvas:#eef3f8;--astra-rail:#e8eef4;--astra-ink:#293748;--astra-muted:#5b6b7e;--astra-line:#d8e2eb;--astra-soft:#e7eef5;--astra-primary:#3c6388;--astra-accent:#3c6388;}
[data-astra-palette="nord"][data-astra-scheme="dark"]{--astra-paper:#202833;--astra-canvas:#18212c;--astra-rail:#141d27;--astra-ink:#e8edf3;--astra-muted:#a9b7c7;--astra-line:#384758;--astra-soft:#2b3a4b;--astra-primary:#48678c;--astra-accent:#adcbe5;}
[data-astra-palette="silk"][data-astra-scheme="light"]{--astra-paper:#fffbfe;--astra-canvas:#f9f3f8;--astra-rail:#f3eaf1;--astra-ink:#3c2e3a;--astra-muted:#7d6375;--astra-line:#eadbe6;--astra-soft:#f3e8f0;--astra-primary:#8b4778;--astra-accent:#84426e;}
[data-astra-palette="silk"][data-astra-scheme="dark"]{--astra-paper:#251c26;--astra-canvas:#1d151e;--astra-rail:#180f1a;--astra-ink:#f3eaf2;--astra-muted:#c3a8bc;--astra-line:#49374a;--astra-soft:#3b293a;--astra-primary:#905379;--astra-accent:#e6afd1;}
[data-astra-palette="autumn"][data-astra-scheme="light"]{--astra-paper:#fffdf9;--astra-canvas:#fcf6ee;--astra-rail:#f4ece1;--astra-ink:#42342b;--astra-muted:#766456;--astra-line:#e9dfd2;--astra-soft:#f5eadd;--astra-primary:#a14b2d;--astra-accent:#964529;}
[data-astra-palette="autumn"][data-astra-scheme="dark"]{--astra-paper:#26201c;--astra-canvas:#1e1814;--astra-rail:#19120f;--astra-ink:#f5ebe2;--astra-muted:#c4b09e;--astra-line:#493b32;--astra-soft:#3c2d23;--astra-primary:#a15a37;--astra-accent:#efbd99;}
[data-astra-palette="graphite"][data-astra-scheme="light"]{--astra-paper:#ffffff;--astra-canvas:#f6f6f6;--astra-rail:#efefef;--astra-ink:#292b30;--astra-muted:#696b72;--astra-line:#e0e1e3;--astra-soft:#eeeeef;--astra-primary:#45464d;--astra-accent:#45464d;}
[data-astra-palette="graphite"][data-astra-scheme="dark"]{--astra-paper:#212225;--astra-canvas:#191a1d;--astra-rail:#141518;--astra-ink:#eeeeef;--astra-muted:#b1b3ba;--astra-line:#393b41;--astra-soft:#2d2f35;--astra-primary:#555963;--astra-accent:#d5d7e0;}

:root{--astra-chart-seed:var(--astra-primary)}
:root{
 --astra-chart-2:color-mix(in oklab,var(--astra-chart-seed) 25%,white);
 --astra-chart-3:color-mix(in oklab,var(--astra-chart-seed) 43%,white);
 --astra-chart-5:color-mix(in oklab,var(--astra-chart-seed) 72%,white);
 --astra-chart-6:color-mix(in oklab,var(--astra-chart-seed) 88%,white);
 --astra-chart-7:var(--astra-chart-seed);
 --astra-chart-9:color-mix(in oklab,var(--astra-chart-seed) 78%,#17243b);
}
:root[data-astra-scheme="dark"]{
 --astra-chart-2:color-mix(in oklab,var(--astra-chart-seed) 30%,white);
 --astra-chart-3:color-mix(in oklab,var(--astra-chart-seed) 48%,white);
 --astra-chart-5:color-mix(in oklab,var(--astra-chart-seed) 67%,white);
 --astra-chart-6:color-mix(in oklab,var(--astra-chart-seed) 77%,white);
 --astra-chart-7:color-mix(in oklab,var(--astra-chart-seed) 87%,white);
 --astra-chart-9:var(--astra-chart-seed);
}

:root {
 --dws-font-family-ui:'Zaojia PingFang SC','PingFang SC','Microsoft YaHei UI',sans-serif;
 --dws-font-size-12:12px;--dws-font-size-13:13px;--dws-font-size-14:14px;
 --dws-font-size-16:16px;--dws-font-size-20:20px;--dws-font-size-28:28px;
 --astra-space-1:4px;--astra-space-2:8px;--astra-space-3:12px;--astra-space-4:16px;
 --astra-space-5:20px;--astra-space-6:24px;--astra-space-8:32px;--astra-space-12:48px;
 --radius-selector:.5rem;--radius-field:.5rem;--radius-box:.75rem;
 --border:1px;--depth:0;--noise:0;
}
:root[data-astra-palette] {
 --color-primary:var(--astra-primary);--color-primary-content:var(--astra-primary-content,#fff);
 --color-base-100:var(--astra-paper);--color-base-200:var(--astra-soft);
 --color-base-300:var(--astra-line);--color-base-content:var(--astra-ink);
 color-scheme:light;background:var(--astra-paper);
}
:root[data-astra-scheme="dark"]{color-scheme:dark}
.astra-ui {
 --paper:var(--astra-paper);--canvas:var(--astra-canvas);--rail:var(--astra-rail);
 --ink:var(--astra-ink);--muted:var(--astra-muted);--line:var(--astra-line);--soft:var(--astra-soft);
 --blue:var(--astra-accent);--blue-wash:color-mix(in srgb,var(--astra-accent) 10%,var(--astra-paper));
 --green:#278564;--green-wash:#edf8f2;--amber:#a46b18;--amber-wash:#fff7e6;--red:#c35142;--red-wash:#fff0ed;
 color:var(--ink);background:var(--paper);margin:0;
 font:400 var(--dws-font-size-14)/1.65 var(--dws-font-family-ui);font-variant-numeric:tabular-nums;
 -webkit-font-smoothing:antialiased;
}
[data-astra-scheme="dark"] .astra-ui {
 --green:#8aceb2;--green-wash:#203d34;--amber:#e4bf78;--amber-wash:#3e3322;--red:#f39c8f;--red-wash:#412b2b;
}
.astra-ui :where(button,input,textarea,select){font-family:inherit}
.astra-ui .btn{min-height:34px;height:34px;padding:0 12px;gap:7px;font-size:var(--dws-font-size-13);font-weight:600;border-radius:8px;box-shadow:none;text-transform:none}
.astra-ui .btn-primary{background:var(--astra-primary-gradient,var(--astra-primary));border-color:var(--astra-primary);color:var(--astra-primary-content,#fff)}
.astra-ui .btn-ghost{background:transparent;color:var(--ink);border-color:transparent}
.astra-ui .btn-ghost:hover{background:var(--soft)}
.astra-ui .btn:disabled{background:var(--soft);color:var(--muted);border-color:var(--line);cursor:not-allowed}
.astra-ui :where(button,input,textarea,select):focus-visible{outline:2px solid var(--astra-accent);outline-offset:2px}
.astra-ui :is(.input,.select){height:38px;min-height:38px;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:8px;font-size:var(--dws-font-size-13);box-shadow:none}
.astra-ui .card{border:1px solid var(--line);border-radius:12px;background:var(--paper);color:var(--ink);box-shadow:0 3px 14px #182b4910}
.astra-ui .card-body{padding:16px;gap:12px}
.astra-ui .badge{min-height:24px;height:auto;padding:3px 8px;border:0;border-radius:6px;font-size:var(--dws-font-size-12);line-height:1.5;background:var(--soft);color:var(--muted)}
.astra-ui .badge-success{background:var(--green-wash);color:var(--green)}
.astra-ui .badge-warning{background:var(--amber-wash);color:var(--amber)}
.astra-ui .badge-error{background:var(--red-wash);color:var(--red)}
.astra-ui :is(.table,.table td,.table th){font-size:var(--dws-font-size-13)}
.astra-ui .table th{background:var(--soft);color:var(--ink);font-weight:600}
.astra-ui .table td{border-color:var(--line);padding:12px 10px}
.astra-ui .modal-box{background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:16px;padding:24px;max-width:650px;max-height:calc(100dvh - 48px)}
```

以上 CSS 是跨项目起步样式，不包含业务布局状态机、快捷菜单键盘逻辑和图表渲染器。后续按第 9—18 节补齐组件行为。

## WeKnora 接入试验区（2026-10-09）

知识工作区第四页签为“WeKnora 试验区”，保留原问答/文章库/图谱。内部用紧凑单行工具切换Wiki目录、关系图谱和资料检查，统计并入筛选行。阅读与来源使用同一侧窗，正文首标题与窗口标题重复时仅在呈现层隐藏重复标题。图谱复用现有2D/3D资源，可见时临时深色，离开恢复偏好。连接、错误、分页截取、版本及只读状态按真实结果显示；就此提问只填草稿，不自动发送。

## AI 填价卡片

表格只保留带文字的 AI 填价按钮，表头、空行和合计行不显示。打开后恢复左聊天右表格，在聊天用序号、金额、来源、解释与确认按钮展示最多三个不同价格或系数；首项以主题浅底强调，模型分析独立标明真实状态。详细信息使用原生 dialog，合并标题 / 行号，分布只取真实计价候选和同类经验样本，分别展示排序与来源。历史快照不自动调用模型，不允许旧候选覆盖更新成果。
