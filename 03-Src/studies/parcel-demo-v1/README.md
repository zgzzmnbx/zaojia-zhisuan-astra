# 包裹运输网页演示 v1.0.4

只供视觉评审，不被正式入口引用。复用当前 V11 白色烘焙场景，通过独立 Vite transform 在此演示构建中挂载 Blender 导出的运输模型和动画；正式 baked-mode.mjs 不修改。

构建：`node node_modules/vite/bin/vite.js build --config 03-Src/studies/parcel-demo-v1/vite.config.mjs`

本机独立发布：`node 03-Src/studies/parcel-demo-v1/publish-local.mjs --publish`。脚本核对当前服务目录，仅复制 parcel-demo 子目录；正式输出与沙盘源码前后 SHA256 比较记录在 Codex-Temp/parcel-conveyor-v1/publications。

入口：http://127.0.0.1:5189/parcel-demo/index.html

验证：设置 PLAQUE_BROWSER 为可用 Chromium 可执行文件，传入已安装 Playwright 的 package.json 绝对路径，分别运行 acceptance.mjs、motion-acceptance.mjs 和 record.mjs。脚本不依赖测试业务账号，不请求 /api，不保存个人偏好。

动画暂停遵循减少动效；手动播放可明确覆盖。页面隐藏冻结时钟，恢复不追赶时间；隐藏传送带不再推进运输动画。页面卸载释放独立几何、材质与动画混合器。正式业务语义、染色和日夜设置均未改动。

演示证据与录像在 Codex-Temp/parcel-conveyor-v1/browser，Blender 源工程在 05-视觉识别/02-3D场景/parcel-conveyor-v1。

本轮：`camera.mjs` 对七个建筑的实际三角面预计算局部高度场，避免用整个分区包围盒把平台也当高楼。第一视角沿包裹方向，遇障碍抬升；相机位置、观察点和 FOV 平滑过渡。`weather.mjs` 使用固定粒子缓冲与可见时间 uniform 实现雨雪，复用全局暂停与减少动效；太阳开关和亮度独立。新版检查入口为 acceptance-v101.mjs、motion-v101.mjs、record-v101.mjs，证据在 browser-1.0.1。初版证据与源文件备份保留在 Codex-Temp/parcel-conveyor-v1/backup-1.0.0。

v1.0.2：`companion-flow.mjs` 沿传送带生成连贯偏移路线，复用正式 `information-flow.js` 的透明管壳、脉冲和节点；Vite 仅在此 Demo 的编译阶段加可选路线参数及已圆角路径入口，原正式文件不修改。暂停/隐藏/后台时冻结信息流。Blender 模型同步拆除护栏并改浅灰带面。最新验收入口为 `acceptance-v102.mjs`、`motion-v102.mjs`，证据和信息流录像在 `Codex-Temp/parcel-conveyor-v1/browser-1.0.2/`。

v1.0.3：Blender 带面改浅色透射玻璃并收窄，网页加载 GLB 原生透射材质。运行 acceptance-v102.mjs 时设置 PARCEL_DEMO_VERSION=1.0.3，证据输出到 browser-1.0.3。

v1.0.4：路线配置位于模型目录 conveyor-route.json，Blender 模型和关键帧由此重建，网页信息管使用导出时间轴同源路线。`python 03-Src/studies/parcel-demo-v1/route-audit.py final` 对冻结三角面作 0.10 网格的保守净空扫描，命中则非零退出。设置 PARCEL_DEMO_VERSION=1.0.4 后运行 acceptance-v101.mjs 与 record-v101.mjs 验证七站和完整第一视角。
