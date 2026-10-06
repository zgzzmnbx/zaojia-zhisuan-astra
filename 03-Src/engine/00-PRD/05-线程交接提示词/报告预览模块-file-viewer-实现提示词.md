# 报告预览模块开发线程提示词

> 2026-09-26 路线调整：Tauri 已暂缓归档，本文涉及 Tauri 的历史实现、发布、版本同步及验收要求不再执行；只有用户明确要求恢复后才重新评估。归档入口：`docs/归档/Tauri-20260926/README.md`。其余网页业务要求继续有效。

你正在接手“造价智算-工程造价辅助智能体”的 **P1 报告预览模块**。请直接在当前项目中实现、测试和交付，不要只给方案，也不要改坏现有填价、预警、人工修改、Word 生成、下载和问问智算功能。

## 一、项目与任务

项目根目录：

```text
D:\Codex-Temp\260612-【ai大赛】-管勘智算-V2.0
```

任务目标：

- 沿用左侧一级菜单“Word 报告”，不新增“报告预览”一级菜单。
- 在现有 Word 报告页中，用当前任务实际生成的 `.docx` 替换现有由摘要字段拼出的模拟预览。
- 使用 [flyfish-dev/file-viewer](https://github.com/flyfish-dev/file-viewer) 的 React Word 预览能力。
- 保留下载 Word、下载 Excel、风险清单、右侧问问智算和现有任务流程。
- 开发版、Windows 绿色版、Windows Tauri 桌面版均须在断网状态下可预览，不访问 CDN 或在线 Office。

## 二、开始前必须完整阅读

按顺序读取，不要跳过：

```text
AGENTS.md
README.md
CHANGELOG.md
00-PRD/02-当前版本计划.md
00-PRD/01-模块PRD/12-报告预览模块/PRD.md
00-PRD/01-模块PRD/06-Word报告生成/PRD.md
00-PRD/03-整体UI设计PRD.md
00-PRD/03-UI设计规范.md
docs/绿色版说明.md
docs/Tauri桌面壳MVP说明.md
```

然后重点检查：

```text
frontend/src/App.tsx
frontend/src/styles.css
frontend/package.json
backend/app/main.py
backend/app/report.py
tools/build_green_release.py
tools/build_tauri_release.py
```

先用 `git status --short` 记录工作树基线。当前仓库可能存在用户未提交文件，禁止覆盖、删除、移动或顺手提交与本任务无关的改动。

## 三、已经确认的产品决策

这些不是待讨论项：

1. 页面仍叫“Word 报告”，预览是该页内部能力。
2. 当前真实预览对象只支持造价智算自己生成的 `.docx`。
3. 预览只读，不在网页中编辑 Word，不做批注协同。
4. 报告预览不参与价格、系数、风险等级裁决，不反写 Excel、模板、规则、知识库或经验池。
5. 不引入服务端转码、LibreOffice / OnlyOffice、在线 Office、第三方云预览或远程 iframe。
6. 不引入 `@file-viewer/react-full`、`@file-viewer/preset-all`；P1 只装配 Word renderer。
7. 预览失败必须保留下载 Word 兜底，不能让整个报告页白屏。
8. 不重构 `backend/app/report.py` 和核心匹配流程；默认复用现有报告下载接口。

## 四、上游组件知识与推荐接入

开发前打开并核对以下官方页面和实际安装版本的 TypeScript 类型：

```text
https://github.com/flyfish-dev/file-viewer
https://github.com/flyfish-dev/file-viewer/tree/main/packages/components/react
https://github.com/flyfish-dev/file-viewer/tree/main/packages/renderers/word
https://doc.file-viewer.app/
```

2026-07-10 调研时 npm 最新一致版本为 `2.1.25`。实施时先运行 `npm view` 再确认；无充分理由不要追逐新的未验证版本。File Viewer 相关运行包必须锁定同一版本，并提交 `frontend/package-lock.json` 的对应变化。

预期依赖边界：

```powershell
npm --prefix frontend install --save-exact @file-viewer/react@2.1.25 @file-viewer/renderer-word@2.1.25
```

如果真实验证表明需要 Vite 插件复制离线资产，再增加同版本开发依赖：

```powershell
npm --prefix frontend install --save-dev --save-exact @file-viewer/vite-plugin@2.1.25
```

不要机械复制上述版本；如果 npm 当前版本已变化，先说明并选择一套同版本、React / Vite 兼容且经过测试的稳定版本。禁止各包版本混用。

官方当前用法方向如下，最终代码以安装后的 `.d.ts` 为准：

```ts
import FileViewer from "@file-viewer/react";
import { wordRenderer } from "@file-viewer/renderer-word";

const options = {
  rendererMode: "replace",
  renderers: [wordRenderer],
  theme: "light",
  docx: {
    workerUrl: "/file-viewer/vendor/docx/docx.worker.js",
    workerJsZipUrl: "/file-viewer/vendor/docx/jszip.min.js",
  },
};
```

File Viewer React 标准包支持二进制 `file` 和显式 `name / filename / type`。当前后端 URL 以 `/report` 结尾，没有 `.docx` 扩展名，因此推荐：

1. 通过现有 `result.downloads.report` 获取 Blob。
2. 使用 `result.summary.output_report` 或 `Content-Disposition` 解析出的文件名构造 `File`。
3. 确保文件名以 `.docx` 结尾，MIME 为 `application/vnd.openxmlformats-officedocument.wordprocessingml.document`。
4. 把 `File` 传给预览组件，不依赖 URL 后缀猜格式。

DOCX Worker 默认需要：

```text
/file-viewer/vendor/docx/docx.worker.js
/file-viewer/vendor/docx/jszip.min.js
```

这些资源必须在开发版、绿色版和 Tauri 的同源静态路径可访问。可以选择：

- 使用 `@file-viewer/vite-plugin` 的 `fileViewerRenderers({ copyAssets: true })`；或
- 使用官方资产复制 CLI，把必要资产复制到 `frontend/public/file-viewer`。

选择前先验证实际生成路径和包体，优先只携带 Word 所需资产。不要手工伪造 Worker，不要引用 unpkg / jsDelivr。

## 五、实施要求

### 1. 先做基线验证

在改代码前至少运行：

```powershell
npm run frontend:build
python -m pytest backend/tests -v
```

如果基线失败，先记录具体失败，不要把旧问题当成本次造成，也不要为了让测试变绿而改无关模块。

### 2. 拆出独立预览适配组件

优先新建职责单一的组件，例如：

```text
frontend/src/components/report/WordReportPreview.tsx
```

组件建议只接收必要属性：

- `jobId`
- `reportUrl`
- `reportFilename`
- `revisionKey`
- `isAvailable`
- 必要的回调或下载兜底

组件内部负责：

- `idle / loading / ready / stale / error` 状态。
- `fetch(..., { cache: 'no-store', signal })` 获取当前报告。
- Blob → 带 `.docx` 文件名的 `File`。
- 动态加载 File Viewer / Word renderer，避免首页首包和填价页无条件加载。
- `AbortController` 取消旧任务请求。
- 如果创建 object URL，在任务切换和卸载时撤销。
- 捕获 File Viewer 生命周期 / renderer 错误并展示可恢复错误页。
- 对 late response 做 job / revision 校验，旧请求不得覆盖新任务。

不要把所有逻辑继续堆进已经很大的 `App.tsx`。但也不要为了“架构漂亮”重构现有应用状态管理；只做本任务所需的最小边界拆分。

### 3. 改造现有 Word 报告页

当前 `App.tsx` 的 `daweiba-report-module` 已有：

- 报告状态。
- 下载 Excel / Word。
- 风险清单。
- 指标摘要。
- 由 `summary.report_text` 等字段拼出的模拟报告页。

改造要求：

- 保留前四类已有能力。
- 删除或降级模拟报告页，不再让它冒充真实 Word 预览。
- 页面重排为“紧凑顶部状态 / 操作 + 主体真实报告预览”，预览窗口占据主要空间。
- 顶部增加“刷新预览”；正在加载时有明确状态和禁用策略。
- 报告未生成时不挂载重型预览器。
- `matching_status === 'pending'` 时继续遵守当前待批量匹配边界。
- 风险报告成功写回、手动重算成功、result / job 变化后，使 `revisionKey` 更新，自动刷新一次或明确标记“报告已更新”。
- 不删除“风险清单”及其跳转结果预览能力。
- 右侧智算“去 Word 报告”和“下载 Word”继续正常。

### 4. 样式要求

在 `.shell.layout-daweiba` 作用域内维护样式：

- 白底、浅灰分区、1px 细边框、低圆角、无常驻阴影。
- 报告预览主体横向铺满中间区域，不再保留 `320px + 520px` 的大比例双卡布局挤压文档。
- 预览容器必须有稳定高度；用父容器 / 视口剩余高度、`minmax()`、`clamp()`、`min-height` 等响应式规则，不只适配 1366 或 1920 的单点宽高。
- 文档内部滚动，避免整个页面无限变长。
- 第三方工具栏不得覆盖正文；造价智算自己的下载按钮权重高于第三方重复下载按钮。
- 提供“网页预览用于快速核对，正式排版以下载 Word 为准”的轻提示。
- 加载、错误、空态不能只靠颜色；按钮需有键盘焦点态和 `aria` 标签。

### 5. 离线与打包

必须验证三条链路：

1. 开发版：Vite `5174` + FastAPI `8000`。
2. 绿色版：复制前端源码、依赖和 `public/file-viewer` 后由 Vite 启动。
3. Tauri：`frontend/dist` 被复制后由 FastAPI 静态托管。

重点检查：

- `frontend/dist/file-viewer/vendor/docx/docx.worker.js` 存在。
- `frontend/dist/file-viewer/vendor/docx/jszip.min.js` 存在。
- 实际 HTTP 请求返回 JavaScript，不是 404，也不是 SPA 的 `index.html`。
- 断开公网或禁用外网请求后仍能预览当前 DOCX。
- 如现有 `tools/build_green_release.py` / `tools/build_tauri_release.py` 已通过复制 `frontend` / `frontend/dist` 自动携带资产，则不要无意义改脚本；只有真实缺失时才做最小修复。

### 6. 错误隔离

至少覆盖：

- 无 result。
- 待批量匹配。
- 报告 URL 为空。
- 404 / 500。
- 空 Blob。
- 无法识别的文件或损坏 DOCX。
- Worker / JSZip 加载失败。
- renderer 异常。
- job 切换时旧请求晚返回。
- 用户连续点击刷新。

任何失败都不得影响：

- 填价和批量匹配。
- 结果预览和人工修改。
- 经验池预警。
- 风险清单。
- Word / Excel 下载。
- 右侧问问智算。

## 六、测试要求

### 前端自动化

如果项目已有前端测试基础，新增组件测试；如果没有，不要为了一个组件引入笨重测试框架而扩大任务，但至少把可测试逻辑拆为纯函数并进行构建验证。建议覆盖：

- 文件名归一化为 `.docx`。
- Content-Disposition 中文文件名解析（如实际实现）。
- Blob 为空时错误。
- job / revision 改变时旧请求作废。
- loading → ready、loading → error。
- 刷新触发新请求。

### 后端回归

默认不新增后端接口。若必须调整下载响应头或缓存策略：

- 只做向后兼容修改。
- 保持原下载 URL 和下载行为。
- 新增测试验证 DOCX MIME、文件名、404 和缓存语义。

### 构建与运行验证

至少运行：

```powershell
npm run frontend:build
python -m pytest backend/tests -v
python tools/check_prd_consistency.py --strict
```

如果修改绿色版 / Tauri 构建脚本，再追加项目 AGENTS 要求的对应 `py_compile`、健康检查和实际打包验证。

使用当前实际生成的 Word 报告做浏览器运行态验证，至少核对：

- 标题、正文、金额、费用表格、匹配摘要。
- 风险报告写回前后刷新变化。
- 下载 Word 与预览来自同一个当前报告。
- Chrome / Edge 以及 Tauri WebView。
- 1366px、宽屏和侧栏收起 / 展开。
- 断网状态。

## 七、不得做的事

- 不新增左侧一级菜单。
- 不删除或弱化 Word / Excel 下载。
- 不让预览器修改报告文件。
- 不把第三方组件源代码整仓复制进项目。
- 不引入全格式 preset/full 包。
- 不访问 CDN、外部在线转换或第三方文件上传服务。
- 不打印报告全文、敏感价格、绝对磁盘路径或密钥。
- 不改价格匹配、系数规则、知识库、经验池和风险等级逻辑。
- 不覆盖原始输入和 Word 模板。
- 不碰与本任务无关的用户未提交文件。
- 不自动换用其他端口；运行态验证仍使用 `8000` / `5174`。

## 八、文档与交付

实现并验证后：

1. 把 `00-PRD/01-模块PRD/12-报告预览模块/PRD.md` 中真正完成的需求从 `[待开发]` 更新为 `[已完成]`；未完成的保持原状态，不得虚报。
2. 同步 `00-PRD/01-模块PRD/06-Word报告生成/PRD.md`、`README.md` 和 `00-PRD/02-当前版本计划.md` 的实际状态。
3. 这是正式 P1 功能实现，应按项目版本规则评估升级版本号并更新 `CHANGELOG.md`；如更新 CHANGELOG，运行 `python tools/trim_changelog.py`。
4. 按项目规则运行本地 Git 存档，只提交本任务文件，不自动 push。
5. 最终说明：改了什么、如何验证、版本和文档是否更新、仍有哪些真实限制。

最终标准不是“出现一个预览框”，而是：同一份 Word 报告在开发版、绿色版和 Tauri 中都能真实、稳定、离线地预览；失败时可恢复且不伤主流程；刷新不会串任务；现有下载、风险、填价和智算能力全部保持可用。
