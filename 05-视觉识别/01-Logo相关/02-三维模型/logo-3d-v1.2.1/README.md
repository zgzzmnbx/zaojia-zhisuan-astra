# 造价智算 · 八套配色与组装动效

版本：1.2.1 · 2026-10-13

在 13 个独立立方体的阶梯 Z 上增加 8 套配色。上下横梁紧密拼接、灵动块旋转、拆解与组装、文字及 16 条动画保持原有结构。

## 打开与选择

[打开交互预览](造价智算-多配色与组装动效.html)。在画面下方点配色名称，即时更换模型；可继续打散、组合、单块旋转或切换横式 / 竖式 / 仅图形。

“下载当前配色”导出当前配色和组合形式的 GLB，包含完整 16 条动画。导出使用完整标志的初始姿态及动画轨道，避免把临时打散位置固化为默认姿态；不会打断当前预览。浅 / 深色背景只切换展示环境和文字颜色，图形主色不变；深色背景下下载也保留浅色文字。

首次默认原版蓝，后续记住上次选择。偏好仅存 `zsuan.logo.palette.v1`，不读取或改写正式应用主题。

## 直接取用

| 配色 | 主色 | 实际渲染 | 可编辑工程 | GLB |
| --- | --- | --- | --- | --- |
| 原版蓝 | `#228be6` | [PNG](PNG/造价智算-原版蓝.png) | [.blend](Blender/造价智算-原版蓝-v1.2.1.blend) | [横式](GLB/original/ZSuan-original-brand-v1.2.1.glb) · [竖式](GLB/original/ZSuan-original-vertical-v1.2.1.glb) · [图形](GLB/original/ZSuan-original-icon-v1.2.1.glb) |
| 石墨灰黑 | `#45464d` | [PNG](PNG/造价智算-石墨灰黑.png) | [.blend](Blender/造价智算-石墨灰黑-v1.2.1.blend) | [横式](GLB/graphite/ZSuan-graphite-brand-v1.2.1.glb) · [竖式](GLB/graphite/ZSuan-graphite-vertical-v1.2.1.glb) · [图形](GLB/graphite/ZSuan-graphite-icon-v1.2.1.glb) |
| Astra 蓝 | `#284bd4` | [PNG](PNG/造价智算-Astra 蓝.png) | [.blend](Blender/造价智算-Astra 蓝-v1.2.1.blend) | [横式](GLB/astra/ZSuan-astra-brand-v1.2.1.glb) · [竖式](GLB/astra/ZSuan-astra-vertical-v1.2.1.glb) · [图形](GLB/astra/ZSuan-astra-icon-v1.2.1.glb) |
| Mantine 蓝 | `#228be6` | [PNG](PNG/造价智算-Mantine 蓝.png) | [.blend](Blender/造价智算-Mantine 蓝-v1.2.1.blend) | [横式](GLB/mantine-blue/ZSuan-mantine-blue-brand-v1.2.1.glb) · [竖式](GLB/mantine-blue/ZSuan-mantine-blue-vertical-v1.2.1.glb) · [图形](GLB/mantine-blue/ZSuan-mantine-blue-icon-v1.2.1.glb) |
| 翡翠绿 | `#197452` | [PNG](PNG/造价智算-翡翠绿.png) | [.blend](Blender/造价智算-翡翠绿-v1.2.1.blend) | [横式](GLB/emerald/ZSuan-emerald-brand-v1.2.1.glb) · [竖式](GLB/emerald/ZSuan-emerald-vertical-v1.2.1.glb) · [图形](GLB/emerald/ZSuan-emerald-icon-v1.2.1.glb) |
| 北境蓝 | `#3c6388` | [PNG](PNG/造价智算-北境蓝.png) | [.blend](Blender/造价智算-北境蓝-v1.2.1.blend) | [横式](GLB/nord/ZSuan-nord-brand-v1.2.1.glb) · [竖式](GLB/nord/ZSuan-nord-vertical-v1.2.1.glb) · [图形](GLB/nord/ZSuan-nord-icon-v1.2.1.glb) |
| 丝绒紫 | `#8b4778` | [PNG](PNG/造价智算-丝绒紫.png) | [.blend](Blender/造价智算-丝绒紫-v1.2.1.blend) | [横式](GLB/silk/ZSuan-silk-brand-v1.2.1.glb) · [竖式](GLB/silk/ZSuan-silk-vertical-v1.2.1.glb) · [图形](GLB/silk/ZSuan-silk-icon-v1.2.1.glb) |
| 秋日铜 | `#a14b2d` | [PNG](PNG/造价智算-秋日铜.png) | [.blend](Blender/造价智算-秋日铜-v1.2.1.blend) | [横式](GLB/autumn/ZSuan-autumn-brand-v1.2.1.glb) · [竖式](GLB/autumn/ZSuan-autumn-vertical-v1.2.1.glb) · [图形](GLB/autumn/ZSuan-autumn-icon-v1.2.1.glb) |

PNG 为 Blender 实际渲染的横式静帧，1280×720、Cycles 32 采样；是带背景的位图。Blender 工程保存 1600×900、Cycles 64 采样，打开后空格播放 12 秒循环。需要竖式 / 图形版可直接使用对应 GLB，或在预览中选择后下载。

## 配色规则

- 原版蓝保留 v1.2.0 原色阶；其余七套直接采用 `03-Src/studio/appearance.css` 的亮色主题主色。
- 上浅下深的五级明度保持阶梯层次；中间方块的基础色精确等于主题主色。石墨灰黑来自石墨灰主题；不把黑色涂成无反光的剪影。
- 字标采用对应主题的正文色；亮暗背景分别使用对应正文色。金属度、粗糙度与模型动画未随配色改变。
- Blender 使用统一中性摄影棚，避免冷色光让灰黑版偏蓝；实际屏幕呈色仍受材质、灯光与色彩管理影响，HEX 是基础材质色值。

## 后续优化

在 Astra 根目录：

```powershell
node "05-视觉识别/01-Logo相关/02-三维模型/logo-3d-v1.2.1/build.mjs"
node "05-视觉识别/01-Logo相关/02-三维模型/logo-3d-v1.2.1/verify-palettes.mjs"
node "05-视觉识别/01-Logo相关/02-三维模型/logo-3d-v1.2.1/verify.mjs"
python "05-视觉识别/01-Logo相关/02-三维模型/logo-3d-v1.2.1/package_delivery.py"
```

`palettes.mjs` 管理配色，`model.mjs` 管理几何和动作，`export-model.mjs` 是构建和网页下载共用的导出实现。网页完全离线，无外部图片、字体或脚本请求。

`build_palettes_blender.py` 通过 Blender 的 `--background --python` 执行；以相邻 v1.2 的已验收工程复制摄影棚，再换材质颜色、保留动画并生成 8 个独立工程和静帧。这一步在完整项目目录运行；已交付的各 `.blend` 本身可独立打开。不会改写旧工程或保存全局偏好。

## 验收

- 8 套材质 / 文字颜色、24 个 GLB 重新加载、16 条动画、主题主色与正式源码一致。
- 在打散与旋转的中间姿态换色后，网格、材质实例、几何、位置和旋转保持；网页下载共用函数的灰黑竖式 / 深色文字也经 GLB 回读核验。
- 继承并通过 v1.2 的 13 块、恒定尺寸、全轴旋转、组装、打断后恢复与碰撞检查。
- 8 个 `.blend` 逐个保存 / 重开，关键帧姿态指纹一致，实际输出 8 张 PNG。模型验证见 `verification.json`，配色验证见 `palette-verification.json`，原生验证见 `blender-palettes-verification.json`。
- 项目 245 项测试通过，生产构建通过。内置浏览器此前拒绝 file 协议，未绕过该限制；此次网页实际点击、拖拽、下载与亮暗视觉仍未完成浏览器实测。

本轮没有逐色重新渲染 MP4；完整动作可在网页和任一 Blender 工程播放，原蓝色 MP4 仍保存在 v1.2。历史版本保留，当前版本尚未接入正式业务界面。
