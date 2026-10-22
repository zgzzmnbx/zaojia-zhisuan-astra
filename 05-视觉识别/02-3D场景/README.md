# 造价智算 · 白模沙盘

## water 候选河道 · v0.10.74-water.4

当前 codex/water 在运行时通过 `03-Src/studio/project-sandbox/river-channel.mjs` 派生真实两岸实体、河床与加厚底座。岸面 0.13、水面 -0.23、河床 -0.98、底座下沿 -1.18（场景单位）。原 GLB/Blender 工程保持不变；建筑与桥梁高度不变。`channelProfile` 是本候选河道几何参数入口，原样机不代表此候选更新。验收见 `00-docs/handoff/2026-10-22-water候选分支验收.md`。

## 正式沙盘 · 纯色版

UI v0.10.66 新增「视图 → 纯色版」，默认关闭，复用已确认 Blender 样板光影，保留主沙盘交互与动画。[资产与映射说明](solid-lighting-v1/README.md)；[正式浏览器验收](../../00-docs/handoff/2026-10-21-纯色版沙盘光影验收.md)。



正式工作台 v0.10.26 已加入左前方管网 Logo 白模纪念碑与双层台座，资源复用 [管网 Logo](../03-Logo-管网logo/README.md)，布局在 `03-Src/studio/project-sandbox/logo-monument.mjs`。此更新作用于 5189 正式工作台，下面的独立白模样机保持原版本。
目录版本 **1.0.9** · 2026-10-13；当前白模样机 **0.1.10**。

本目录是当前白模沙盘的唯一维护位置。保留七座功能建筑、表格大屏、浅天蓝河道、依次传递的蓝色信号流、阴影开关及毛玻璃聊天界面。0.1.7 增加材质层次和建筑细节；0.1.8 改用静态接触柔影和缓存投影，移除实时 AO。夜航延用已确认灯光参数。0.1.9 增加七节点状态标牌、完成结果详情卡和加粗名称；点击左下角“完成态示例”查看。0.1.10 调低标牌底色不透明度，让日夜名称与状态条更通透。阴影性能与新版标牌的实际浏览器视觉待复验，现有截图与视频对应 0.1.7。此处仅收录本轮白模沙盘，Logo 仍在 `../01-Logo相关/`，其他候选风格保持原位。

## 项目任务平台概念

[三张状态示例图与完整提示词](任务平台概念-v1.0.0/README.md)：初始首页、任务进行中、夜航结果详情。概念图版本 1.0.0，仅供设计评审，不代表业务已经接入；当前交互样机保持 0.1.10。

## 染色动效研究

[染色动效示例 v1.0.1](染色动效示例-v1.0.0/README.md)：重点立面自下而上雾蓝染色，保留白色骨架，支持新旧方案对照、单楼、全城、暂停与浓度调整。仅为合成视觉示例，正式工作台保持原样。

## 快速定位

| 目的 | 当前成果 |
| --- | --- |
| 打开可旋转、可点击的沙盘 | [打开当前沙盘预览](打开当前沙盘预览.html) |
| 看最新整体效果 | [0.1.7 日间质感参考](white-sandbox-v0.1.0/preview-overview.png) |
| 看夜航模式 | [白模夜航截图](white-sandbox-v0.1.0/preview-night.png)；预览右上角“夜航”切换，暗色哑光建筑与蓝色霓虹 |
| 看信号流动视频 | [实际运行视频](white-sandbox-v0.1.0/information-flow.mp4) |
| 在 Blender 中继续优化 | [含信息管线的 Blender 工程](white-sandbox-v0.1.0/white-sandbox-flow.blend) |
| 编辑原建筑几何 | [建筑 Blender 工程](white-sandbox-v0.1.0/white-sandbox.blend) · [生成脚本](white-sandbox-v0.1.0/build_scene.py) · [细节建模](white-sandbox-v0.1.0/day_details.py) |
| 调整管线走向与流速 | [路线配置](white-sandbox-v0.1.0/pipeline-route.json) · [信号材质与动画](white-sandbox-v0.1.0/information-flow.js) |
| 调整节点标牌和结果卡 | [交互](white-sandbox-v0.1.0/node-results.js) · [示例数据](white-sandbox-v0.1.0/node-results-data.js) · [样式](white-sandbox-v0.1.0/node-results.css) |
| 调整界面与镜头交互 | [main.js](white-sandbox-v0.1.0/main.js) · [style.css](white-sandbox-v0.1.0/style.css) |
| 找版本、构建和验证说明 | [样机 README](white-sandbox-v0.1.0/README.md) · [交付清单](white-sandbox-v0.1.0/delivery-manifest.json) |
| 回看修改前版本 | `white-sandbox-v0.1.0/backups/`；只作历史参考 |

`white-sandbox-v0.1.0` 是最初目录名，当前实际版本以 README 和交付清单中的 **0.1.10** 为准。保留目录名以避免破坏历史引用。

## 后续优化

从上述当前工程和源码继续，不在临时目录另起一套副本。新成果同步更新本页、预览和交付清单。网页通过 GLB 加载建筑，信息流由网页单独绘制；修改 Blender 后需要同步导出 GLB 并重新构建预览，保存 .blend 不会自动更新网页。

从项目根目录执行：

```powershell
node '05-视觉识别/02-3D场景/white-sandbox-v0.1.0/build_preview.mjs'
```

旧 `Codex-Temp/design-concepts/white-sandbox-v0.1.0` 仅保留指向当前目录的兼容联接，旧聊天链接仍可打开，不存在第二套独立成果。目录迁移记录在 [90-迁移记录](90-迁移记录/迁移验收.md)。

本样机仍为独立视觉与交互成果，未接入正式业务；应用 UI 版本、模型版本和用户选择的外观均未因迁移改变。
