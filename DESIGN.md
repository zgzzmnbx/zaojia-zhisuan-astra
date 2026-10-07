# Astra UI 设计标准

设计系统版本 **1.0.0** · 2026-10-07 · 实现基线：智算 Astra UI v0.9.5

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
| 图标 | lucide-react 1.17.0 | 一套线性图标，不混用彩色 emoji 做业务图标 |
| 图表 | Recharts 3.10.0；简单费用图用 SVG / CSS | 真实比例、轴、图例、提示与主题渐变 |
| 窗口 | 原生 `dialog` / Popover + daisyUI 外观 | 顶层显示、焦点与返回，不靠无限增加 z-index |
| 动效 | CSS + Web Animations API | 可见时入场、暂停与释放，不模拟业务进度 |

以上版本用于复现当前外观，不代表其他项目必须永久锁死该版本。升级需重新验收主题变量、原生弹窗和图表渲染。Mantine 仅提供色阶思路，本项目没有因此引入 Mantine 组件库。

daisyUI 的类名负责视觉，**不自动完成所有键盘、异步和焦点逻辑**。例如页签方向键、菜单 Escape、发送防重、关闭后焦点恢复，由组件实现。

## 3. 标题与工具栏硬规则

### 3.1 垂直空间预算

| 区域 | 默认高度 | 内容与约束 |
| --- | ---: | --- |
| 应用顶栏 | 58px | 当前上下文、连接状态、外观等全局入口；整个应用只有一条 |
| 内容面板主栏 | 56px | 模块标题或页签、紧凑状态、右对齐动作；左右分栏底线对齐 |
| 项目摘要标题栏 | 48px | “项目信息”与关闭；不再加副标题带 |
| 专业工具栏 | 36–44px | 只有必要时出现：Sheet、筛选、搜索、缩放等合在一行 |
| 内容底栏 | 36–44px | 范围 / 状态与下载或主要动作合并；没有内容则不渲染 |

应用顶栏不重复模块标题。模块内默认一条主栏，最多再加一条必需工具栏；这不是允许再添加两条标题。全屏沿用原主栏，只更换全屏动作，不增加“全屏模式”横幅。

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
- 主动回到聊天时默认显示项目摘要；后台结果不抢占用户正在看的界面。上传与字段确认先留在聊天小卡片中，只有用户主动查看专业内容才展开大预览。
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
| 主按钮 | `--astra-primary` | daisyUI `--color-primary` | 配白字的实底主操作 |
| 可读强调 | `--astra-accent` | `--blue`（兼容旧命名） | 链接、选中、焦点，深色时提亮 |

`--blue` 是主题强调色别名，不保证永远是蓝色。主按钮与强调文字不能混用，否则深色文字对比度容易不足。默认 Astra 蓝 + 亮色；用户可选翡翠绿、北境蓝、丝绒紫、秋日铜、石墨灰。完整 12 套明暗数值在文末 CSS 中。

状态颜色独立，不随紫色、灰色等主题变成相同的品牌色：

| 语义 | 亮色文字 / 浅底 | 深色文字 / 浅底 |
| --- | --- | --- |
| 成功 / 已确认 | `#278564` / `#edf8f2` | `#8aceb2` / `#203d34` |
| 待确认 / 经验提示 | `#a46b18` / `#fff7e6` | `#e4bf78` / `#3e3322` |
| 错误 / 高风险 | `#c35142` / `#fff0ed` | `#f39c8f` / `#412b2b` |

正文和控件文字以至少 4.5:1 对比度为验收目标，不能只看 token 名称宣称达标；尤其检查 disabled、tooltip、Portal、渐变背景及主题后的状态文字。状态必须同时有文字 / 图标，不能只靠红绿辨认。

## 8. 边框、圆角、阴影与图标

- 线宽默认 1px；焦点轮廓 2px，偏移 2px。表格选中不使用整行强蓝色上下粗线，可用浅色底与清晰的单元格焦点。
- 圆角：小状态 6px，输入 / 按钮 / Sheet 8px，分段轨道 11px，卡片 12px，浮动摘要 / 菜单 16px，大设置弹窗 20px。只读业务纸张不强行圆角。
- 普通面板无阴影或很轻；聊天卡参考 `0 3px 14px #182b4910`；浮层参考 `0 16px 48px #152a491f, 0 3px 10px #152a490c`。阴影不是所有区块的默认分隔手段。
- 禁止在每层容器都加边框与阴影，造成“卡片套卡片套卡片”。同一卡内优先用留白和细分隔线分组。
- 图标通常 16–18px，卡片图标 19px 放在 36px 浅色底块中；次级小图标 12–14px。SVG 描边风格保持一致。
- 图标按钮必须有可访问名称与 hover / focus 提示；设置入口固定齿轮。全局 CSS 不得把图表 SVG 误设为图标宽高。

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
- 风险区域显示等级计数和最重要的可操作事项；未检查、读取中、失败、真实零风险分别呈现。
- 文件放一行可展开摘要，不堆长路径、运行 ID、内部实现说明和免责声明段落。
- 底部“资料 / 计算表 / 看板”等入口统一大小；需要时吸底，不能遮住正文。

### 指标与统计卡

小标签 + 28px 数字 + 必要的 12px 口径。普通卡片保持轻边框。只有主要指标或可操作选中态使用浅色强调；避免每张卡一种鲜艳背景。

## 11. 分段页签、Sheet 与快捷菜单

- 三项内容切换使用 38px 高滑块：轨道 soft、内边距 4px、选中块 paper、内圆角 8px、滑块过渡 320ms。通过位移移动同一选中块，不逐按钮闪烁。
- 页签文字 13–14px；选中态 600 字重。使用 `role=tablist/tab/tabpanel`、`aria-selected`、`aria-controls`，单一 Tab 停靠点；方向键 / Home / End 切换。
- 多个文件 Sheet 使用显式横向页签，包含可见选中态、左右滚动按钮和当前位置。切换与容器尺寸变化后选中项仍可见。
- 项目看板和知识模块各只有一组主页签。不能在下面再加一组同义功能导航。
- 聊天快捷菜单把手靠输入框上沿右侧。悬停后向上展开，不挤动消息和输入框；离开时短暂过渡，跨越间隙不意外收起。
- 快捷菜单也支持点击 / Enter / Space 打开、Esc 关闭并恢复焦点；隐藏时 `inert` 与 `aria-hidden`，避免 Tab 进入不可见项。

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
| 偏离 / 风险 | 对比柱与偏离率 | 风险色独立，标方向与实际百分比 |

### 外观

- 采用当前主题同色系深浅色阶；从 `--astra-chart-2/3/5/6/7/9` 取色。默认图形色可比按钮更明快。
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

- 全局设置从左下角齿轮进入统一弹窗；其他设置入口只选择该弹窗的对应分类，不能占用右侧成果窗口。
- 设置弹窗默认宽 `min(1080px, 100vw - 48px)`，高 `min(800px, 100dvh - 64px)`，左侧分类 192px，正文独立滚动。
- 通用弹窗默认最大宽约 650px，正文内边距 24px；高不超过窗口减去 40–64px。标题、关闭、保存中状态合为一行。
- 弹窗内分类名与父标题重复时不再加大标题；分组 label 与表单相邻，不用标题条隔开每一组设置。
- `showModal()` 进入顶层，打开记录触发按钮，关闭恢复焦点；Esc、背景关闭与正在保存时的行为一致。
- 使用原生顶层解决被 overflow / container-type 裁切的问题，不给所有元素随意分配 999999 的 z-index。
- 语义层序：业务正文 → 面板浮层 / 拖动柄 → 菜单 → 原生 modal → 当前 modal 内的必要悬浮角色。下层不可点击时不要遗留悬浮热点。

## 15. 动效规范

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
- 架构图默认动态横版、应用内全屏、自动播放；保留暂停。这是 Astra 的明确业务入口约定，其他模块不自动全屏。
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

> 以 DESIGN.md（Astra UI 设计标准 1.0.0）作为唯一视觉标准，使用 daisyUI + Tailwind 实现。先建立统一 token 和组件封装，再组合页面。默认桌面、亮色、可切换六套主题。一个窗口只保留一条主标题栏，标题、页签、状态、动作尽量合并，专业内容最多补充一条必要工具栏。保留正文留白、统一字号、主题渐变图表、轻动效及完整状态。不要参考旧项目 UI，不复制旧业务数据；旧项目只用于核对功能逻辑。交付前按本文验收清单检查。

## 19. 本项目组件索引与维护规则

| 规范领域 | 当前文件 |
| --- | --- |
| 基础组件 / 字体 / daisyUI | `03-Src/style.css`、`03-Src/studio/ui.tsx` |
| 六主题与明暗 | `03-Src/studio/appearance.css`、`appearance.ts`、`AppearanceControls.tsx` |
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
- [Mantine 主题](https://mantine.dev/theming/theme-object/)：多级色阶参考，不作为组件依赖。

## 22. 可移植 token CSS

下列代码供新项目复制。主题原始值与 Astra v0.9.5 的 `appearance.css` 一致；后半部分将字体、尺寸与组件别名收敛为便于复用的入口。**本项目仍由既有源文件提供运行时样式，不要再把此代码作为第二套覆盖重复加载。**

新项目将代码放在自己的样式入口中；`@plugin` / `@import` 由 Tailwind 构建处理，不是直接放进浏览器 `<style>` 就能加载依赖。`.astra-ui` 为建议作用域，body 或应用根元素使用该类。

```css
@import "tailwindcss";
@plugin "daisyui" { themes: light --default, dark; logs: false; }

[data-astra-palette="astra"][data-astra-scheme="light"]{--astra-paper:#ffffff;--astra-canvas:#f7f8fa;--astra-rail:#f4f5f7;--astra-ink:#202838;--astra-muted:#637084;--astra-line:#e5e8ee;--astra-soft:#f0f3f8;--astra-primary:#284bd4;--astra-accent:#284bd4;}
[data-astra-palette="astra"][data-astra-scheme="dark"]{--astra-paper:#161a21;--astra-canvas:#11151c;--astra-rail:#0d1117;--astra-ink:#edf1f8;--astra-muted:#a4afc0;--astra-line:#303946;--astra-soft:#222b39;--astra-primary:#4564cd;--astra-accent:#a6baff;}
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

:root{--astra-chart-seed:#4263eb}
:root[data-astra-palette="emerald"]{--astra-chart-seed:#12a882}
:root[data-astra-palette="nord"]{--astra-chart-seed:#228be6}
:root[data-astra-palette="silk"]{--astra-chart-seed:#ae3ec9}
:root[data-astra-palette="autumn"]{--astra-chart-seed:#e87524}
:root[data-astra-palette="graphite"]{--astra-chart-seed:#697582}
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
 --color-primary:var(--astra-primary);--color-primary-content:#fff;
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
.astra-ui .btn-primary{background:var(--astra-primary);border-color:var(--astra-primary);color:#fff}
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
