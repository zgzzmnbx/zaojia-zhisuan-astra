# 第三方来源与许可记录

> 本文件保留上游来源声明。模型、布局数据和原始资产保存在本地备份。下文的 `assets/source/`、`brand/`、`qa/` 等路径相对于本地完整原交付包，`data/` 路径相对于本目录。

本记录对应 H1 办公室数字孪生 v0.3 交付包。各组成部分按其自身的来源和许可使用；代码的开源许可不授予商标、企业标识、用户资料或三维素材的权利。

## Google Drive 既有办公器具素材

按用户指示，本版复用其 Google Drive 中此前生成的办公器具。来源检索依据《530 款低多边形模型图片总目录》对应的分类索引快照，时间为 `2026-10-26T08:42:39.852677+00:00`。本轮选取 10 个独立来源资产，整理为 12 个白模模板；修订版与从同一来源拆出的部件不另算新来源。

| 来源资产 | 版本 | 本版模板 | 保留的源目录 |
| --- | --- | --- | --- |
| `0007 quantity_survey_desk` | r2 | 完整造价阅图桌、独立图纸工具组 | `assets/source/0007_quantity_survey_desk_r2/` |
| `0009 desktop_workstation` | r2 | 独立显示器、独立台式主机 | `assets/source/0009_desktop_workstation_r2/` |
| `0025 wideformat_plotter` | r2 | 大幅面绘图仪 | `assets/source/0025_wideformat_plotter_r2/` |
| `0026 laptop_computer` | r2 | 笔记本电脑 | `assets/source/0026_laptop_computer_r2/` |
| `0231 mechanical_keyboard` | v1 | 键盘 | `assets/source/0231_mechanical_keyboard_v1/` |
| `0232 ergonomic_mouse` | v1 | 鼠标 | `assets/source/0232_ergonomic_mouse_v1/` |
| `0235 desktop_webcam` | v1 | 摄像头 | `assets/source/0235_desktop_webcam_v1/` |
| `0236 multifunction_laser_printer` | v1 | 激光打印机 | `assets/source/0236_multifunction_laser_printer_v1/` |
| `0237 flatbed_scanner` | r2 | 扫描仪 | `assets/source/0237_flatbed_scanner_r2/` |
| `0240 portable_projector` | v1 | 投影仪 | `assets/source/0240_portable_projector_v1/` |

原始 GLB、BLEND、manifest 及相应的来源记录保存在各源目录。`assets/source/SOURCES.json` 记录 Drive 包 ID、原 URL、包摘要、来源版本、原文件 SHA256 和索引快照；各目录的 `SOURCE.json` 提供逐项记录。修订素材使用 `revisions/<id>/r2` 中的版本；未将旧批次或 `render-inputs` 副本重复计入。

源清单将这些模型记录为原有集合的程序生成几何，声明未使用外部模型或纹理；部分几何工具来自该集合此前批次。源清单没有授予公开再分发许可。本项目按用户本次指示复用这些既有素材，**不据此新增 MIT、CC0 或其他开放资产许可**。Three.js 等代码许可不适用于这些模型的来源授权。

本轮只通过自行编写的脚本读取 GLB，保留原始 `.blend` 作来源文件，未运行源包脚本或启用 `.blend` 自动执行。白模转换包括语义拆分、底面中心原点整理、四种中性 PBR 材质映射及运行用 mesh 合并。场景以等比缩放保持源几何比例；转换记录、模板和源文件摘要见 `data/furniture_assets.json`，324 个实际实例的来源关联见 `data/furniture_integration.json`。

打印机和扫描仪下的 2 个支撑柜为本轮程序生成的基础几何，单独标记为支撑家具，不计入 10 个 Drive 来源或 324 个素材实例。原办公室桌椅、沙发、柜体沿用建筑基线。器具布置是空间展示示意，不是实物设备盘点，也不包含员工、设备在线状态或任务数据。

素材总览的中文标签使用系统 Noto Sans CJK SC 渲染为图片，未新增分发该字体二进制。图集光照、地面和阴影只用于展示；模板 GLB 不包含展示地台、烘焙阴影或外部纹理。

## 国家管网标识

楼顶图形复用用户指定的 GitHub 仓库现有素材：

- 仓库：`zgzzmnbx/zaojia-zhisuan-astra`。
- 分支：`codex/conveyor-integrated-white`。
- 固定提交：`0fdbe5d3fbea72b371afe089b88037f1c9966238`。
- 原目录：`05-视觉识别/03-Logo-管网logo/`。
- 原始 PNG、原色与白色 GLB、SVG 轮廓及原来源文档保留在 `brand/`；逐文件原路径、Git blob 和 SHA256 见 `brand/SOURCES.json`。
- 原来源：[仓库中的 Logo 说明](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/0fdbe5d3fbea72b371afe089b88037f1c9966238/05-视觉识别/03-Logo-管网logo/README.md)。

上游说明原始图形由用户提供。现有轮廓源自 129 × 127 像素 PNG 的提取与简化，**不是官方矢量母版**；本轮未另行猜画标识。没有发现该标识独立的开放资产许可。国家管网标识及相关品牌权利仍属原权利人，本包不将其标注为 MIT、CC0，也不将“用户已有素材”解释为商标权转让。

## 楼顶中文与 H1 字符

`brand/NotoSansCJKSC-BrandSubset.otf` 是系统字体 `/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc` 的简体中文 SC face（集合索引 2）子集，仅保留“国家管网H1”六个字符，供 Blender 将文字转为模型网格。

字体内部名称为 Noto Sans CJK SC Bold，版本 2.004；字体内部版权记录为 © 2014–2021 Adobe。字体采用 **SIL Open Font License 1.1**；原交付包保留 `brand/Noto-font-license.txt` 和 `brand/font-provenance.json`。许可文件同时包含 Debian 打包说明，其中 `debian/*` 的 GPL 条款是打包文件条款，不是本字体的许可。

这些文字是通用字体生成的空间标注，**不是国家管网官方字标轮廓**。品牌图形与通用字体分别记录，不能混同来源或授权。

## Astra 界面来源

`astra_ui/` 复用用户现有 Astra 仓库的真实样式、主题属性、组件类和图标入口，来源仓库、分支和提交与上述固定版本相同。Astra 包版本为 `0.22.5`；来源文件清单见 [astra_ui/source-index.json](astra_ui/source-index.json)，具体改动与校验见 [astra_ui/style-manifest.json](astra_ui/style-manifest.json) 及 [astra_ui/STYLE_ALIGNMENT.md](astra_ui/STYLE_ALIGNMENT.md)。

独立查看器的样式入口保留原组件规则，移除需要构建器处理的首部指令，并加入无构建环境的导入与主题适配。来源记录没有为 Astra 自有代码声明统一开放许可，本记录也不重新授予或扩大其许可。用户自己的 Astra 内容按此次项目复用范围处理。

上游引用的 PingFang WOFF2 文件未包含在仓库和本包中。查看器使用原字体栈及本机已安装字体回退；没有分发 PingFang 字体文件，也没有用 Noto 子集冒充原界面字体。详情见 [astra_ui/fonts/README.md](astra_ui/fonts/README.md)。

### Astra 随带的开放组件

| 组件 | 本包范围与版本 | 许可及保留位置 |
| --- | --- | --- |
| daisyUI | `astra_ui/vendor/daisyui-5.7.47.css`，版本 5.7.47，复用当前 Astra 仓库现有文件 | MIT，Copyright © 2020 Pouya Saadeghi；`astra_ui/upstream/public/assets/daisyui-LICENSE.txt` |
| Tailwind CSS | `astra_ui/vendor/tailwind-preflight-4.3.3.css`，版本 4.3.3 | MIT，Copyright © Tailwind Labs, Inc.；`astra_ui/vendor/tailwind-LICENSE.txt` |
| Phosphor Icons | 当前 Astra 固定提交中的 duotone glyphs 与图标目录 | MIT，Copyright © 2023 Phosphor Icons；`astra_ui/upstream/03-Src/vendor/phosphor-duotone/LICENSE.txt` |

## Three.js

查看器的 Three.js 固定为 **0.186.1**（运行时 REVISION 186），与此次读取的 Astra `package.json` 相同。`three.module.js`、`three.core.js`、`GLTFLoader`、`OrbitControls`、`BufferGeometryUtils` 和 `SkeletonUtils` 均保留在 `viewer/vendor/`，用于离线 HTTP 加载。

- 上游：[mrdoob/three.js](https://github.com/mrdoob/three.js)。
- 固定 npm/CDN 来源与逐文件 SHA256：[viewer/vendor/sources.json](viewer/vendor/sources.json)。
- 许可：**MIT**；完整版权及许可见 [viewer/vendor/LICENSE.txt](viewer/vendor/LICENSE.txt)。
- 此处的上游模块未修改；没有配置远程运行时解码服务。

## 格式校验工具

制作阶段的格式校验使用 Khronos 官方 `gltf-validator` npm 包 `2.0.0-dev.3.10`，来源为 [KhronosGroup/glTF-Validator](https://github.com/KhronosGroup/glTF-Validator)，许可为 **Apache-2.0**。该工具复用制作环境中已安装的固定版本，不是查看器运行依赖；本版保留其输出报告，未将工具安装目录声明为交付内容。模板报告见 `assets/white/validation/`，整楼报告见 `qa/gltf-static-report.json` 和 `qa/gltf-animation-report.json`；上游许可可在上述官方仓库查阅。

## Polyfork 人物可选风格

Seated Office Worker 与 Crane Banksman 的免费 GLB 按 **CC BY 4.0** 随包提供。作者 Polyfork，逐项来源、许可证链接与运行时改动见 [people/README.md](people/README.md)。未复制受单独许可约束的 .mjs 生成器或 HD 素材。

## 用户提供的建筑资料

建筑照片与九层平面图按用户此次指示作为模型参照使用。该来源说明不另行授予第三方使用图纸、照片或其中信息的权利。模型中的其他楼层外壳和尺寸假设，以项目的建模依据与模型元数据为准。
