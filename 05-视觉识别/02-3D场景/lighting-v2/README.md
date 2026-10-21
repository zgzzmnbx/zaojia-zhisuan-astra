# 沙盘质感增强 v2.2.0

2026-10-21。基于 v1.0.0 的冷白材质与 Cycles 照度，增加**离线顶点 AO、程序化水面与天空反射、昼隐夜显的河道导轨**。v2.2.0 已于 UI v0.10.57 接入正式沙盘，跟随现有“质感增强”开关；独立预览保留为参数对照与复现入口。

## 本轮内容

- **模型**：`sandbox-detail.glb` 由 v1 的 `sandbox-lightmapped.glb` 派生，只把 `Blue river` 图元的 UV0 改写为世界尺度平面 UV（`x × 0.35`、`z × 0.35`），其余节点、材质、UV1 与三角形不变。这样水面法线可按真实世界比例平铺，不继承原河面拉伸。
- **表面 AO**：`three-mesh-bvh` 沿法线半球发射 64 条射线、半径 2，按顶点写入 `TEXCOORD_1` 图集；ground 为 2048²，其余七区 1024²。AO 只作用于间接光与间接高光，不修改 UV1 里原有的 Cycles 照度图。
- **水面**：独立 `MeshStandardMaterial`，使用世界平面 UV0、程序无缝法线（512²，确定性正弦叠 value noise）、专用等距柱状天空（1024×512，一次 PMREM）。法线每毫秒沿 x 0.000025、y 0.000040 缓慢流动，`prefers-reduced-motion` 时停止。
- **水面不读取 AO / 照度图**：UV1 是给原白模材质烘焙的图集，套到新水面会把天空反射压暗并带出与河面无关的明暗区块。`paintDetail` 显式排除 `Blue river`。
- **河道导轨**：`Cube001_3`（`Frosted blue glazing`）白天隐藏，夜航显示；夜间沿用现有照明规则自发光 `#168fff`、强度 1.05，形成发光流线。白天它原本像四条车道线。
- **玻璃**：`Frosted blue glazing` 粗糙度 0.16、金属度 0.14；`Astra blue` 0.24 / 0.22、环境强度 1.15。夜航两材质分别以 1.05 / 3.2 强度自发光。

### 定稿参数

| 项 | 白天 | 夜航 |
| --- | --- | --- |
| 水面色 | `#2f86ad` | 线性 (0.012, 0.06, 0.13)，约 `#1d4565` |
| roughness / metalness | 0.12 / 0.18 | 同左 |
| 天空 envMapIntensity | 0.45 | 0.35 |
| 法线强度 / repeat | 1.4 / 1×1 | 同左 |
| AO 强度 | 0.9 | 0.55 |
| 导轨 `Cube001_3` | 隐藏 | 显示 + 自发光 |

水面“微光”关闭时恢复基础蓝面：无专用天空、无法线，粗糙度 0.3、金属度 0.05、环境强度 1。关闭“表面细节”只撤掉 AO 与玻璃增强，不影响水面。夜航关闭日间照度烘焙，保留夜间配色。

## 独立预览

`沙盘质感-独立预览.html` 约 23 MB，模型、8 张照度图、8 张 AO、水体法线与天空、HDR、石膏法线全部内联，可直接双击打开，不发起网络请求。提供烘焙、环境、石膏法线、表面细节、水面、阴影、夜航、环游与重置视角；另暴露 `window.__sandboxLightingPreview.renderNow()` 供无头截图同步刷新。

截图 1600×1000，位于 `screenshots/`：

| 文件 | 内容 |
| --- | --- |
| `day-overview.png` | 白天总览，水面与白模整体 |
| `day-materials.png` | 建筑近景，玻璃、金属与管线 |
| `day-river-low.png` | 河面低视角，法线与天空反射 |
| `day-river-top.png` | 河面俯视，波纹尺度 |
| `day-detail-on.png` / `day-detail-off.png` | 同一机位的 AO / 玻璃增强对比 |
| `day-water-on.png` / `day-water-off.png` | 同一机位的水面微光对比 |
| `night-overview.png` | 夜航总览，发光导轨 |
| `night-materials.png` | 夜航玻璃与发光体近景 |
| `night-river-low.png` / `night-river-top.png` | 夜航河面与导轨 |

## 复现

生成脚本保存在本机工作目录 `Codex-Temp/sandbox-detail/`（被 Git 忽略，依赖仅装在本地）：`edit-water-uv.mjs`、`bake-ao.mjs`、`make-water-normal.py`、`make-water-sky.mjs`。参数与输出清单写入 `ao/manifest.json`。

```powershell
# 河流世界平面 UV（源：lighting-v1/sandbox-lightmapped.glb）
node Codex-Temp/sandbox-detail/edit-water-uv.mjs
# 顶点 AO（64 采样 / 半径 2 / TEXCOORD_1）
$env:AO_SAMPLES=64; $env:AO_RADIUS=2; node Codex-Temp/sandbox-detail/bake-ao.mjs
# 水面法线、天空
python Codex-Temp/sandbox-detail/make-water-normal.py
node Codex-Temp/sandbox-detail/make-water-sky.mjs
# 内联预览
node "05-视觉识别/02-3D场景/lighting-v2/build_preview.mjs"
```

依赖：`@gltf-transform/core`、`three-mesh-bvh`、`pngjs`、`three`、Pillow。`bake-ao.mjs` 按节点 `zone` 分组，缺失 POSITION / NORMAL / TEXCOORD_1 会直接失败，不静默跳过。

预览源码在 `preview/`，构建会先写入 `preview-build/`，再把 JS / CSS / 全部 base64 资源内联为单文件。

## 来源与许可

| 项目/资产 | 采用内容 | 许可/判断 |
| --- | --- | --- |
| [Blender Cycles](https://github.com/blender/cycles) | v1 遗留的 8 张路径追踪照度图 | Apache-2.0；不在网页运行时执行 |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | 离线顶点 AO 射线求交 | MIT |
| [glTF-Transform](https://github.com/donmccurdy/glTF-Transform) | 改写河流 UV0 并写回 GLB | MIT |
| [Three.js](https://github.com/mrdoob/three.js) | 材质、PMREM、UV 通道与天空反射 | MIT |
| [Studio Small 09](https://polyhaven.com/a/studio_small_09) | v1 环境反射 HDR | [CC0-1.0](https://polyhaven.com/license) |
| [Plastered Wall 04](https://polyhaven.com/a/plastered_wall_04) | v1 石膏法线 | [CC0-1.0](https://polyhaven.com/license) |
| 水面法线 / 天空 | 本项目脚本确定性生成，无外部纹理 | 随项目交付 |

所有资源均内联在本地文件，不请求外部模型、纹理、HDRI，不上传场景数据，不连接原生产接口。

## 哈希（SHA256）

| 文件 | 字节 | SHA256 |
| --- | --- | --- |
| `sandbox-detail.glb` | 9,839,376 | `b43f9e226ac071fc9d618c8320690d9f8714b12c7f8f42b2e646556ced03ebd4` |
| `water-normal.png` | 76,640 | `6afd26ae5fbfff491c6c69031bea38dc09472a8ebf6cfa6817b15ce7121e4991` |
| `water-sky.png` | 455,772 | `814f98646925aba6bfb2636ebe41395c1b840e5e95abcd0bf78138fe278648dc` |
| `ao/manifest.json` | 2,461 | `5f0c26d33fbc0b7febfcaad1f94bf246249548c127896e71b6ede5386331bbcc` |
| `preview/main.js` | 23,059 | `956e2b0ae272ba207019da83510e86b42c97e57ca523fb73b676dc47bb7e1acc` |
| `preview/index.html` | 4,817 | `b5618a02de8a4e01c398d9f46ee177b493f8c53e8303244167b2a38a290a573c` |
| `preview/style.css` | 7,273 | `67d574d2ab751d39dff31ce97b35aae95b0595ef2ce08d255d79c6259e1e60b7` |
| `沙盘质感-独立预览.html` | 23,986,164 | `823c7cdebd0375d181852e1ec49576ea89aee79402263810821ed9dc9504c91e` |

源输入（lighting-v1，只读复用）：

| 文件 | SHA256 |
| --- | --- |
| `sandbox-lightmapped.glb` | `9b60c4e6cd5a2639d03360340dbc1f2e95fc7a8090d09c5b6adbbdc3479c21cd` |
| `studio_small_09_1k.hdr` | `e7cfda5f4e98e623db12b8bfd0184e048488e4855d9c83e2751fb44a32e80c45` |
| `plastered_wall_04_nor_gl_1k.jpg` | `c0a41dc06e33072ec1156d89f3bd4b481a479616791d4e9df6c5ee7b3283db82` |

AO 八区 PNG 的逐张 SHA256 见 `ao/manifest.json`（ground 2048²，其余 1024²；八区均值 0.38–0.57，无非空像素失败）。

## 边界

这是离线环境漫射照明 + 顶点 AO + 实时光栅化的组合，不宣称浏览器内实时路径追踪、动态多次反弹或真实建筑倒影。水面天空为静态程序贴图，不随昼夜换图；夜航仅靠环境微光与导轨自发光。CubeCamera 实时倒影曾试验，未达到可交付质量，未采用。

## 正式接入（UI v0.10.57）

- 正式沙盘优先加载本目录 `sandbox-detail.glb`，读取失败回退 `white-sandbox.glb`；AO 八区、水面法线与天空随增强路径按需加载。
- 全部效果仍由现有“质感增强”开关控制：关闭即恢复原水材质、导轨可见性与 AO / 玻璃参数；夜航、装配与减少动效沿用原门禁。
- 河道水面不参与建筑染色、照度图与 AO；导轨白天隐藏、夜航显示，与任务染色和标牌无关。
- 接入实现位于 `03-Src/studio/project-sandbox/lighting.mjs` / `lighting-materials.mjs` / `scene.mjs`，测试见 `tests/sandbox-lighting.test.mjs`；正式验收以 5189 生产工作区为准，独立预览不再代表接入后整体画面。
