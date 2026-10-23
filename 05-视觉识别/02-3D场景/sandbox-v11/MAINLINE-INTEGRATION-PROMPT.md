# 双模式沙盘主线接入提示词

以下内容交给负责主线的编码助手。最终双模式提交以交付消息中的完整 commit SHA 为准，先固定该提交再开始接入，不只依赖会移动的分支名。

## 接入目标

请把 `codex/sandbox-v11-baked-city` 的双模式沙盘接入我实际正在使用的主线。要求同时保留两套可随时切换的真实画面：

1. **V11 白色烘焙**：保留实验分支目前冻结的柔白光照、材质、细面顶点色、场地和城市配景，不重新调成一个近似版本。
2. **主线原效果**：保留接入前主线自己的模型、材质、光照、阴影、水效及已有设置。不能用 V11 烘焙模型加几盏灯冒充原效果，也不能把主线当前的“纯色棚拍”主题当成 V11。

优先以可选项接入。原主线仍是未启用新模式时的路径，不默认覆盖用户现有选择，不删除旧渲染器或旧资产。新增外围城市显示开关，V11 景深独立开关，明确各模式能力和回退原因。

## 先核对版本和授权范围

- 实验分支创建时的 `main` 基线为 `d91b2297d9e962db4cfc3bf0469a8475f07ea7eb`，版本 `0.10.74-water.4`。
- 冻结 V11 资产首次提交为 `01e9c92d04a78f19ed692c36ac0660398d07d6f3`。该提交保存资产，不包含后续全部双模式改动；双模式源码请取交付消息指定的最终提交。
- 先读 `AGENTS.md`、`DESIGN.md`、根目录 `README.md`、`00-docs/00-PRD/02-当前版本计划.md`，检查实际工作区、未提交改动、当前主线提交和用户运行版本。
- 只读核对远端实际最新 `main`，列出它与上述基线的差异。不要把实验分支的历史基线称为永远最新主线，也不要把旧主线源码整体覆盖回新的主线。
- 先在独立接入分支工作并保留可回退点。不擅自 reset、清理用户改动、重写已发布历史、rebase、合并到 `main`、推送或部署；需要这些动作时先取得对应授权。若用户已明确授权其中某一步，只执行获准范围。
- 先说明接入方案、冲突与待验收项，再按获准范围实施。已有实验分支只完成独立双模式预览，不代表生产业务已接好或用户已认可真实 GPU 画面。

## 必须先查看的现有路径

- 独立入口：`sandbox-v11.html`。
- 独立预览与控制：`03-Src/studies/sandbox-v11/`，其中 `main.js` 是页面入口，`miniature-dof.js` 是 V11 景深。
- 模式生命周期：`03-Src/studies/sandbox-v11/mode-controller.js` 的 `createModeController`；独立偏好：同目录 `viewer-settings.js`。实验键为 `astra.sandbox-v11.preview.v1`，默认 V11 烘焙、V11 配景开、原模式新增配景关、景深开、强度 0.4。
- 原模式适配：`03-Src/studies/sandbox-v11/original-mode.js`，导出 `createOriginalMode(host, options)`、`originalFactoryOptions()`、`createOriginalContext()`。前者返回 `ready` Promise 和 `setActive`、异步 `setContextVisible`、`focusZone`、`reset`、`zoom`、`getViewPose`、`setViewPose`、`capture`、`state`、`dispose`；截图返回 `Promise<Blob>`。相机姿态主要为 `{position, target, fov, viewHeight}`，另带 `projection`、`zoom`、`selected`、`focus`；设姿态不改变选中态和材质。
- 冻结烘焙包：`public/sandbox-v11/model/model.gltf`、同目录 `geometry-0.bin`、`geometry-1.bin`、`texture-00.png` 至 `texture-10.png`、`packing-manifest.json`。
- 资产身份与边界：`05-视觉识别/02-3D场景/sandbox-v11/README.md` 和同目录 `verification/`。
- 正式 React 沙盘与业务连接：`03-Src/studio/project-sandbox/ProjectSandbox.tsx`。
- 正式渲染入口：`03-Src/studio/project-sandbox/scene.mjs` 的 `mountSandbox`。其原模型加载顺序在 `model-loader.mjs` 和调用处核对。
- 主线默认值和渲染设置：同目录 `defaults.ts`、`lighting-trial.ts` 的 `approvedLighting()`、`render-profile.mjs`、`scene-theme.ts`、`water-settings.ts`、`effect-settings.ts`、`view-settings.ts`。
- 主线三层模型回退：`05-视觉识别/02-3D场景/lighting-v2/sandbox-surface.glb`、`lighting-v1/sandbox-lightmapped.glb`、`white-sandbox-v0.1.0/white-sandbox.glb`。
- 主线业务渲染依赖：`zones.js`、`materials.mjs`、`building-paint.mjs`、`paint-progress.mjs`、`building-entrance.mjs`、`marker-layout.ts`、`focus-uplights.mjs`、`river-water.mjs`，均位于 `03-Src/studio/project-sandbox/`。
- 启动与构建：`package.json`、`vite.sandbox-v11.config.js` 和正式构建配置。回归测试包括 `tests/sandbox-v11-*.test.mjs` 及现有 `tests/sandbox-*.test.*`、`tests/project-sandbox.test.ts`。

以上以实际交付提交和实际最新主线为准。先看差异再复用，不能仅凭同名文件推断接口兼容。

本轮对 `scene.mjs` 的改动是可选第十参数 `extensions`，以及 `attachVisualContext`、`getViewPose`、`setViewPose`、`capture`、`refreshViewport` 附加接口。原 `ProjectSandbox.tsx` 调用未改。实验通过 `initialOptions`、独立 `entranceGate` 与 `rememberPose:false` 隔离默认设置、开场和相机缓存。接入最新主线时只适配这些必要接口，不覆盖该主线后来新增的渲染或业务逻辑。

## 两套渲染路径的硬边界

V11 使用自己的场景和渲染路径，主线模式复用实际 `mountSandbox`。不要共享可变材质、环境、色调映射、后处理链或 WebGLRenderer 状态。任何时刻只有当前模式运行和接收输入；切换中处理异步加载竞态，旧请求不得覆盖新选择。隐藏、离屏、后台与销毁必须停帧或释放，不能让两套 RAF、阴影更新或后处理同时运行。

现有实验切换时缓存已载入的实例并停用另一模式，不是每次切换都卸载全部资源。原模式配景是借入场景的私有副本，必须先解绑再由适配器释放；不要让原场景销毁逻辑顺带释放共享的冻结烘焙资源。`ready` 的就绪/降级状态与真实 GPU 画面验收应分别报告。

V11 资产颜色契约必须原样保留：

- 所有材质的 `KHR_materials_unlit` 有效，不能改成参与实时光照的 PBR 材质。
- 大面 PNG 是已经经过 AgX +0.30 展示转换的 sRGB 颜色；小于 texel 的细面使用同一结果的线性 `COLOR_0`。细面白色材质不再乘烘焙纹理。
- `NoToneMapping`、曝光 `1`、输出 `SRGBColorSpace`；材质 `toneMapped=false`。不再施加 AgX、ACES、第二次曝光、AO、环境照明、实时阴影或雾。
- 不删除顶点色、不重排或丢失 UV、不改模型/贴图压缩和分辨率来“顺便优化”。先按清单核验哈希，再讨论单独优化版本。
- 景深是 V11 的可关闭深度后处理，不写入贴图。关闭、强度为零或效果失效时，应回到清晰烘焙直出，不能改变颜色。它不是主线原渲染的一部分，不应自动加到原模式上。

主线原模式保留它自己现有的色调映射、光照、材质、实时水效和后处理，不套用 V11 的 unlit 契约。实验页的原模式以该基线源码默认值展示，不沿用或改写用户设备上的主线个人偏好。真正接入时要沿用用户现有设置，保留 `false`、`0`、`hidden`、`original` 等有效值，不能因为开关来回切换而重置。

## 外围城市开关

V11 的新增配景由三类语义角色共同组成：`background_city`、`background_street`、`background_ground`。关闭时整组隐藏城市、街道和带城市阴影的烘焙大地面，改用干净的中性纯色地面。保留七座 `zone_*` 主体及 `hero_site` 原场地，不能误删主体台座。

主线原模式若显示新增城市，只使用独立的干净配景几何与该模式的实时材质，不得把 V11 烘焙 albedo、`COLOR_0` 中的烘焙结果或 baked-ground 作为主线材质输入。它是可选扩展，关闭后才与接入前“不含新增城市”的原主线做整幅基线对照。不要为开关复制或修改生产建筑几何。

隐藏城市不能擦除已经烘进主体或保留场地中的间接光和遮蔽。替换烘焙大地面可以移除该地面上的城市残影，但不能承诺所有接收面都变成“从未有过城市”的重新烘焙效果。若用户需要完全物理一致的无城市版本，另做一套无城市烘焙资产并分别验收，不用后期增亮掩盖问题。139 栋配景已合并为城市 mesh，不承诺逐栋拾取和编辑。

## 业务与动画接入

独立预览里的七区点击和镜头聚焦只是视觉交互，不是业务验收。原模式也没有复制完整 React 工作室的业务标签、详情和闲置自动环游调度。生产接入必须仍使用同一会话、job、任务状态、成果版本、节点 ID 和既有业务入口；不新建演示任务，不重跑业务，不改变金额、规则、审批或取消语义。

- 保留七区对应：`zone_import`、`zone_knowledge`、`zone_price`、`zone_report`、`zone_review`、`zone_risk`、`zone_table`。几何身份核验不等于原构件动画已经兼容。
- 在 V11 中先保留标签、详情、选择、真实进度和现有业务按钮的行为。要显示任务染色或选中效果，先设计不污染冻结基础外观的独立表现，再验收；禁止直接改共享烘焙材质造成全场串色。
- 冻结烘焙不能正确跟随构件悬浮、拆装或位置变化。需要装配时优先回退完整原主线路径，记录用户选中的视觉模式并明确临时回退原因；结束或取消后只在几何已归位且状态安全时恢复。禁止移动带固定阴影的 V11 构件后宣称光照正确。
- 夜航、实时射灯、水效及暂未适配能力沿用原主线路径或明确暂不支持，不在 V11 上硬叠加以伪装兼容。不要把主线夜景的灯带泛光与 V11 景深混为一项。
- 模式切换不得清除聊天、草稿、选中节点、任务焦点、详情、进行中的任务、失败/取消记录和成果状态。需要资源回退时只切换表现，不改变业务事实。

## 设置和相机

为新模式、配景、V11 景深及强度使用隔离命名空间，正式既有偏好保持原键和语义。不得把实验页偏好无条件迁移成生产默认，也不能首次打开就改写用户旧设置。

实验页支持 `?mode=baked|original&city=0|1&dof=0|1&strength=0..100`，查询参数会更新实验页自己的保存设置。可用 `?mode=baked&city=1&dof=0` 检查冻结清晰基线，用 `?mode=original&city=0` 检查主线源码默认基线；这些不是用户正式个人设置的替代品。

相机只共享可验证的视角语义。V11 可用正交/透视，主线原生为透视，世界尺度、视野、安全区和可用轨道范围不同；位置和目标可做有界近似换算，不承诺切换后逐像素同机位。保留每模式自己的相机状态，非法或越界姿态回到该模式全景，不把近似结果写回用户正式相机偏好。验收时区分“模式间近似保持观察方向”和“同一模式固定相机截图对照”。

现有实验控制器首次进入另一模式时尝试对齐，返回已访问模式时恢复该模式本次页面内的姿态；不要误写为刷新后完整恢复相机或每次强制同步相机。

## 必须完成的验收

1. 先保存接入前主线的目标设备截图和设置快照，再保存 V11 清晰模式/景深模式的参考截图。保持 CSS 视口、DPR、背景、相机和加载完成条件一致；相机不同的两模式不要求像素互等，每个模式应分别对照自己的基线。
2. V11 逐项检查全景、七栋建筑近景、屋顶和细小构件无黑斑，配景开/关、景深开/关和强度边界，不双重调色、不发灰、不意外过曝。
3. 原模式关闭新增配景与接入前原主线对照，验证日间/夜航、当前主题、个人偏好、原模型回退、水效各档、射灯与灯带泛光不回退。
4. 连续切换、加载中切换、失败重试、刷新持久化和返回工作室都正确；每模式设置互不污染，只有一套活动渲染。验证资源失败时的准确提示与可用退路，不把局部失败报告成成功。
5. 检查真实业务选择、自动聚焦、连续任务、完成、失败、取消、染色、装配启动/中断/归位。模式切换不重复开场动画、不丢状态、不产生假完成或重复业务操作。
6. 覆盖减少动效、离屏、页面隐藏、暂停、恢复、卸载与重进；核对 RAF、定时器、事件、纹理、几何、render target 和 WebGL context 的生命周期。
7. 运行 `npm run test:sandbox-v11`、`npm test`、`npm run build`，补充本次接入回归。必须在真实桌面浏览器/GPU 验收 WebGL、景深 shader、连续旋转、水体和截图；记录冷加载、GPU 纹理内存、帧率及重复切换后的资源释放。
8. 原实验的云端环境未完成真实浏览器/GPU 验收：云浏览器无法访问执行器 localhost，独立 Chromium 受运行环境限制。CPU 测试、mock、TypeScript 和构建通过不能补写成浏览器画面或性能通过。

## 交付要求

告诉我改了哪些入口、原主线如何完整保留、两模式怎么切换、配景与景深开关在哪、个人设置是否保持、哪些能力会临时回退。给出实际测试结果、真实 GPU 截图和未完成项，不用“完美兼容”代替证据。

提供接入分支和不可变 commit SHA、回退方法及未授权的后续动作。只有我确认接入效果并授权后，再合并主线或改变默认模式。
