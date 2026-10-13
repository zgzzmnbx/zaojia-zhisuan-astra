# 造价智算 · 四种姿态与多配色动效

版本 1.2.2 · 2026-10-13。沿用 13 个独立立方体和八套配色；上下横梁各五块紧密拼接，底梁最右侧为灵动块。

[打开姿态预览](造价智算-姿态与多配色动效.html)。姿态选择、原组装循环、打散/组合、单块旋转、八色及横式/竖式/仅图形均保留。“下载当前配色”导出全部 20 条动画，不将临时姿态固化。

| 姿态 | 节奏 | 动画名 |
| --- | --- | --- |
| 静止 | 完整组合，无循环计算 | `Pose_Static` |
| 左右摇摆 | 8 秒一轮，水平约 ±9.7°，轻微侧倾 | `Pose_Sway` |
| 尾块飞回 | 10 秒一轮，前 4.8 秒静止；尾块用 2.4 秒飞出、翻转、归位；其余时间完整展示 | `Pose_Tail_Flyby` |
| 打散恢复 | 12 秒一轮，13 块分离、转动、依次恢复，归位后停留展示 | `Pose_Scatter_Return` |

## 直接取用

| 配色 | 可编辑工程 | GLB |
| --- | --- | --- |
| 原版蓝 | [Blender](<Blender/造价智算-原版蓝-四姿态-v1.2.2.blend>) | [横式](GLB/original/ZSuan-original-brand-v1.2.2.glb) · [竖式](GLB/original/ZSuan-original-vertical-v1.2.2.glb) · [图形](GLB/original/ZSuan-original-icon-v1.2.2.glb) |
| 石墨灰黑 | [Blender](<Blender/造价智算-石墨灰黑-四姿态-v1.2.2.blend>) | [横式](GLB/graphite/ZSuan-graphite-brand-v1.2.2.glb) · [竖式](GLB/graphite/ZSuan-graphite-vertical-v1.2.2.glb) · [图形](GLB/graphite/ZSuan-graphite-icon-v1.2.2.glb) |
| Astra 蓝 | [Blender](<Blender/造价智算-Astra 蓝-四姿态-v1.2.2.blend>) | [横式](GLB/astra/ZSuan-astra-brand-v1.2.2.glb) · [竖式](GLB/astra/ZSuan-astra-vertical-v1.2.2.glb) · [图形](GLB/astra/ZSuan-astra-icon-v1.2.2.glb) |
| Mantine 蓝 | [Blender](<Blender/造价智算-Mantine 蓝-四姿态-v1.2.2.blend>) | [横式](GLB/mantine-blue/ZSuan-mantine-blue-brand-v1.2.2.glb) · [竖式](GLB/mantine-blue/ZSuan-mantine-blue-vertical-v1.2.2.glb) · [图形](GLB/mantine-blue/ZSuan-mantine-blue-icon-v1.2.2.glb) |
| 翡翠绿 | [Blender](<Blender/造价智算-翡翠绿-四姿态-v1.2.2.blend>) | [横式](GLB/emerald/ZSuan-emerald-brand-v1.2.2.glb) · [竖式](GLB/emerald/ZSuan-emerald-vertical-v1.2.2.glb) · [图形](GLB/emerald/ZSuan-emerald-icon-v1.2.2.glb) |
| 北境蓝 | [Blender](<Blender/造价智算-北境蓝-四姿态-v1.2.2.blend>) | [横式](GLB/nord/ZSuan-nord-brand-v1.2.2.glb) · [竖式](GLB/nord/ZSuan-nord-vertical-v1.2.2.glb) · [图形](GLB/nord/ZSuan-nord-icon-v1.2.2.glb) |
| 丝绒紫 | [Blender](<Blender/造价智算-丝绒紫-四姿态-v1.2.2.blend>) | [横式](GLB/silk/ZSuan-silk-brand-v1.2.2.glb) · [竖式](GLB/silk/ZSuan-silk-vertical-v1.2.2.glb) · [图形](GLB/silk/ZSuan-silk-icon-v1.2.2.glb) |
| 秋日铜 | [Blender](<Blender/造价智算-秋日铜-四姿态-v1.2.2.blend>) | [横式](GLB/autumn/ZSuan-autumn-brand-v1.2.2.glb) · [竖式](GLB/autumn/ZSuan-autumn-vertical-v1.2.2.glb) · [图形](GLB/autumn/ZSuan-autumn-icon-v1.2.2.glb) |

8 个 Blender 工程默认播放尾块飞回，30 fps，帧 0–299；保留摄影棚、文字和灯光。打开工程按空格播放。切换姿态时在 NLA 中让 `ZSuan_Stepped_Z` 根对象与所有方块启用同名轨道、停用其他轨道；摇摆末帧 239，尾块末帧 299，打散末帧 359。根对象轨道负责整体摇摆，不能只切方块轨道。工程内“使用说明”也包含这些步骤。

## 欢迎页

应用 v0.9.109 在标题左侧引用同源几何与四姿态，默认尾块飞回；下方小型选择框切换动作，旁边按钮暂停/继续。配色由正式主题自动驱动，亮暗切换不重建场景。系统减少动效默认静止，明确选择播放可在本次欢迎页覆盖；离屏、后台停止，进入系统销毁，WebGL 失败显示静态标志。

## 维护与验证

在 Astra 项目根目录执行 `node "05-视觉识别/01-Logo相关/02-三维模型/logo-3d-v1.2.2/build.mjs"` 生成网页和 24 个 GLB；`verify.mjs` 回读全部模型并实际播放四姿态，对比位置与旋转。运行 `python "05-视觉识别/01-Logo相关/02-三维模型/logo-3d-v1.2.2/package_delivery.py"` 生成交付包。

Blender 用 `--background --python build_blender.py` 构建，脚本需完整目录中相邻 v1.2.1 摄影棚作为输入；已经交付的 `.blend` 可独立打开，无外部字体链接。应用快照在 `03-Src/studio/brand/`，来源 SHA 见 `SOURCE.md`。

- 四姿态在 120 Hz 采样下无方块碰撞、尺寸不缩放，循环闭合；独立尾块动作时其他方块保持原位。
- 24 个 GLB 各 20 条动画，重新加载并逐姿态播放，与规范动作位置/旋转一致；见 `glb-verification.json`。
- 8 个 Blender 工程全部保存/重开，20 条部件轨道与 4 条根轨道齐全，默认尾块实际飞出并回到原位；见 `blender-verification.json`。
- 欢迎页四姿态、七套主题、明暗、暂停、减少动效、离屏/后台、返回偏好、WebGL 故障回退经真实 Chrome 实测，249 项项目测试及构建通过。应用验收详见 `00-docs/handoff/2026-10-13-欢迎页Logo姿态验收.md`。
- 独立 HTML 的浏览器点击/拖拽/下载仍未实测：此前内置浏览器拒绝 file 协议，未绕过。上述实际浏览器验收针对欢迎页集成，不混作独立 HTML 的验收。

本版未重新逐色输出 PNG / MP4；静帧可使用相邻 v1.2.1 的八色渲染，旧 MP4 仍在 v1.2，均代表此前动作版本。需要新动作视频可直接在本版 Blender 渲染。
