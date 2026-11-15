# Astra 样式基础

这份目录为独立办公室查看器直接复用 Astra 的界面样式。组件 CSS、主题色、字体栈和图标来自同一源提交；查看器只补充画布与导航面板的位置、尺寸和响应式布局。

## 已固定的来源

- 仓库：`zgzzmnbx/zaojia-zhisuan-astra`
- 开发分支：`codex/conveyor-integrated-white`
- 提交：[`0fdbe5d3fbea72b371afe089b88037f1c9966238`](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/tree/0fdbe5d3fbea72b371afe089b88037f1c9966238)
- `package.json`：0.22.5；`DESIGN.md`：1.1.38。
- 该提交的 React 19.2.7、daisyUI 5.7.47、Tailwind CSS 4.3.3、Three.js 0.186.1、Vite 8.3.2。

`upstream/` 保留 17 份原文件；`source-index.json` 记录每个源文件的 Git blob SHA 和固定提交 URL。源文件已逐一按 Git blob 格式计算 SHA，与 GitHub 返回的 SHA 相符。`vendor/daisyui-5.7.47.css` 是仓库已编译的完整 CSS，其 Git blob SHA 也与该提交相符。`style-manifest.json` 记录入口、适配项和本地文件摘要。

## 直接引用

```html
<html lang="zh-CN" data-theme="light"
      data-astra-palette="astra" data-astra-scheme="light">
  <head><link rel="stylesheet" href="../astra_ui/astra-ui.css"></head>
  <body class="studio">
    <div id="shell" class="live-shell">…</div>
  </body>
</html>
```

```js
import { icon, paintIcons } from '../astra_ui/icons.js';
import { applyAstraTheme } from '../astra_ui/theme.js';
paintIcons();
applyAstraTheme({ palette: 'astra', scheme: 'light' });
```

入口 `astra-ui.css` 可通过普通 HTTP 静态服务直接加载，不需要 React、Vite 或 Tailwind 构建。它按顺序组合 Tailwind 原始 preflight、Astra 的完整 daisyUI 产物、基础样式、studio、工作台、外观和复核窗口 CSS。

若要重新构建整个原 Astra 项目，应在原项目独立检出相同提交后使用其锁文件执行 `npm ci` 与 `npm run build`。本目录不包含完整应用，不能作为原应用的构建根目录。

## 组件对应关系

| 查看器界面 | 直接使用的 Astra 类 | 来源 |
| --- | --- | --- |
| 顶栏、标题、操作按钮 | `topbar four-surface-topbar`、`studio-identity`、`studio-brand`、`top-actions` | `workbench/four-surface.css`、`studio.css` |
| 按钮、徽章、输入 | `btn`、`btn-primary`、`btn-ghost`、`badge`、`input` | 原 daisyUI + Astra 覆盖规则 |
| 画布窗口和空间导航窗口 | `rw-window rw-inline` | `review-workflow.css` |
| 窗口标题、模式栏、内容、页脚 | `rw-header`、`rw-tabs`、`rw-inspector`、`rw-footer` | `review-workflow.css` |
| 空间说明与详情 | `rw-artifact`、`rw-details` | `review-workflow.css` |
| SVG 图标 | `astra-icon`、原 `icon()` / `paintIcons()` | 原 Phosphor Duotone glyphs 与语义映射 |

主题切换采用原 DOM 契约：`data-astra-palette`、`data-astra-scheme`、`data-theme` 和 `body[data-dark]`。支持 Astra 原有七组调色板。`theme.js` 只修改这些属性，不读写 Astra 用户偏好、身份或业务状态。

## 唯一的样式源适配

`derived/astra-foundation.css` 来自原 `03-Src/style.css`：移除前两行编译指令，前三个字体声明改由 `fonts.css` 提供。其余选择器和声明值保持原文。原文件仍完整保存在 `upstream/03-Src/style.css`。

**原 PingFang WOFF2 字体文件当前未取得。** GitHub 当前提交不含这些二进制文件，工作区也未找到。默认 `fonts.css` 只查找已安装的 PingFang，随后沿用 Astra 的系统字体回退栈；没有下载或伪造同名字体。已有合法的 Astra 字体资源可按 `fonts/README.md` 放入，并启用 `fonts.original.optional.css`。因此当前已复用原始 CSS 和图标，但不能声明所有机器上的字体字形、宽度和截图逐像素一致。

## 核验与范围

- 已验证原文件 blob SHA、静态 CSS 导入、图标模块依赖和字体入口；`component-reference.html` 为可运行的原组件对照页。
- 本机 Chromium 启动时被运行环境拒绝 `socket()`，未取得浏览器截图。没有将静态检查描述为完成浏览器视觉验收。
- `astra-sandbox.css` 是可选的原沙盘容器样式；独立查看器默认不加载，避免引入与本项目布局无关的沙盘控件。
- 三维模型的材质、烘焙、灯光与相机需要另行核验。当前查看器使用原生 Three.js、正交相机、sRGB 和 NoToneMapping；未烘焙的白模采用实时灯光，不能据此声称已实现 Astra V11 烘焙材质的全部视觉效果。
- 独立 CSS 会影响其所在文档的全局 `.studio` 等类。后续最小隔离方式为同源 iframe；若改为 React 内嵌组件，应复用宿主已有样式，不重复注入整套 CSS。
