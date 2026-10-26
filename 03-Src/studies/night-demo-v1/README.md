# 夜览候选 Demo v1.0.0

2026-10-25。基于正式 v0.11.18 的历史独立样板，用户已确认并整合至 v0.11.19。入口：http://127.0.0.1:5189/night-demo/index.html。

复用当前真实 V11 模型、OrbitControls、建筑聚焦、信息流、卡通河流、小船和 Logo。baseline/ 保存整合前受影响模块，独立 Vite 构建在加载该快照后仅于编译阶段替换夜间材质与 Bloom 的代码，生产模块本身不写入、不导入 Demo。没有业务 API 请求、项目执行、正式设置保存或 localStorage 写入。

## 使用

- 当前夜览 / 候选夜览保持同一机位，A 对照固定为建筑明暗 45%、辉光 110%；不读取或改写个人设置。
- 候选支持建筑层次、灯芯亮度、柔光强度、外围窗光四项调节，刷新恢复候选默认。
- 全景、储罐、管道、大屏有固定机位；可手动旋转、缩放，点击建筑聚焦。
- 日间检查提供候选开关；开启与关闭的日间画布必须完全一致。
- 暂停覆盖河流、小船、信息流；减少动效遵循系统设置，后台停算沿用正式生命周期。

## 实现与取舍

`candidate.glsl` 只在 `cityNight > .5 && demoEnabled > .5` 下替换输出；根据建筑分区和高度区分顶端标识、普通窗户、储罐灯带。保留白亮中心，蓝晕采用 Screen 合成。建筑增加有方向的灰蓝明暗，外围窗点减少并降低亮度。

这是艺术化灯光候选，不是重新烘焙或光线追踪。立面补光是局部视觉近似；本轮未新增窗灯真实投影或水面场景倒影。原灯具、聚焦和河流继续复用。细节上的蓝色烘焙边缘仍存在，待用户选定方向再判断是否需要更精细的发光遮罩。

## 构建与本机发布

在项目根目录运行：

```powershell
node node_modules/vite/bin/vite.js build --config 03-Src/studies/night-demo-v1/vite.config.mjs
node 03-Src/studies/night-demo-v1/publish-local.mjs --publish
```

发布脚本仅面向已核实的本机运行工作树，新增 `04-output/night-demo/`。脚本先记录正式输出和沙盘源码哈希，发布后逐项核对；不替换正式入口、JS、CSS、资产或配置。正式全量重建可能移除这个附属目录，可用以上命令重新生成。

截图及验收日志：`Codex-Temp/night-demo-v1/`。浏览器脚本 `acceptance.mjs` 和 `motion-acceptance.mjs` 接受本机 Playwright 包路径，Chrome 可执行文件由 `PLAQUE_BROWSER` 提供；独立测试浏览器与个人会话隔离。
