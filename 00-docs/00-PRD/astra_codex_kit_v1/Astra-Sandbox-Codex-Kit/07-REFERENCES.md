# 参考资料、源码与证据来源

检查日期：2026-10-20。下列源码链接固定到本包审阅提交；编码时仍需核对当前工作区和锁定依赖。外部演示的库版本不构成本项目升级依赖的理由。

## 1. Astra 第一手源码

仓库：[zgzzmnbx/zaojia-zhisuan-astra](https://github.com/zgzzmnbx/zaojia-zhisuan-astra)  
固定提交：[79e1418b2be169537a8cca643af61063b4350521](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/commit/79e1418b2be169537a8cca643af61063b4350521)

| 引用 | 用途 |
| --- | --- |
| [AGENTS.md](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/AGENTS.md) | 本地工作流、离线光照/局部辉光、状态/资源约束 |
| [package.json](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/package.json) | v0.10.56、Three.js 0.186.1、构建测试入口 |
| [scene.mjs](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/03-Src/studio/project-sandbox/scene.mjs) | renderer、主辅光、增强参数、单次render、加载/回退/销毁 |
| [materials.mjs](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/03-Src/studio/project-sandbox/materials.mjs) | 区域材质克隆、冷白/夜航/选中 |
| [lighting-materials.mjs](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/03-Src/studio/project-sandbox/lighting-materials.mjs) | 法线、照度、恢复、450ms淡入 |
| [lighting.mjs](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/03-Src/studio/project-sandbox/lighting.mjs) | 本地资源、UV通道、颜色空间、PMREM与清理 |
| [building-paint.mjs](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/03-Src/studio/project-sandbox/building-paint.mjs) | 名称白名单、shader注入和局部任务染色 |
| [building-entrance.mjs](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/03-Src/studio/project-sandbox/building-entrance.mjs) | 按mesh连通组件、装配位移/时序、临时资源恢复 |
| [focus-glow.mjs](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/03-Src/studio/project-sandbox/focus-glow.mjs) | 局部地面辉光、420ms交接、单pass/0后处理目标 |
| [bake-lighting.py](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/tools/sandbox/bake-lighting.py) | Cycles、第二UV、照度编码、非空与哈希 |
| [build_scene.py](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/05-视觉识别/02-3D场景/white-sandbox-v0.1.0/build_scene.py) | 源对象命名、共享白材质、保存工程与按zone合并 |
| [现有光影验收记录](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/00-docs/handoff/2026-10-20-沙盘光影增强验收.md) | 仅供理解既有历史测量；不是本包实测 |

逐文件 Git blob SHA 与阅读范围见 [source-baseline.json](specs/source-baseline.json)。未把完整私有仓库打入包；执行者应继续使用用户自己的真实工作区。

## 2. 值得看什么 GitHub 作品

| 作品 | 可以学的内容 | 在本项目如何使用 |
| --- | --- | --- |
| [pmndrs/examples · lusion-connectors](https://github.com/pmndrs/examples/blob/main/examples/lusion-connectors/src/App.tsx) / [演示](https://pmndrs.github.io/examples/lusion-connectors/) | 白色物体通过不同粗糙度和环境光形状产生表面区分 | 学高光与表面层次；不迁移R3F、物理碰撞或其AO渲染链路 |
| [ProceduralBuildingsThreeJS](https://github.com/achrefelouafi/ProceduralBuildingsThreeJS) | 建筑体块、白色城市背景和有方向的布光 | 学建筑尺度与主次关系；不搬建筑、城市生成器或业务无关装饰 |
| [N8AO](https://github.com/N8python/n8ao) | 屏幕空间遮蔽的实现与取舍 | 作为理解其他路线的参考；本包不安装、不作为完成条件 |
| [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) | 路径追踪材质/光照的质量上限与运行约束 | 仅对比渲染原理；当前main要求WebGPU，本包不迁移 |

这些作品不是“复制即可得到A”的模板。A/C是本次生成的设计参考，Astra已有自己的几何、业务状态、shader与资源生命周期，需要按现有代码实现相同视觉关系。

## 3. 官方技术资料

- [MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html)：PBR表面、粗糙度/金属度、照度与法线输入。支持按表面外层区分白墙与白色涂层，不等于所有工业设备都设metalness=1。
- [PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html)：为不同粗糙度提供预过滤环境。复用一次生成的环境，避免每帧重做。
- [LightShadow](https://threejs.org/docs/pages/LightShadow.html)：贴图尺寸、normalBias、投影范围和静态更新。更大阴影图有成本，偏移过大可使阴影变形。
- [Scene](https://threejs.org/docs/pages/Scene.html)：环境强度等场景属性。具体可用接口仍以仓库锁定版本为准。

Astra的照度PNG编码/解码规则直接以本仓库 bake脚本和lighting加载器为依据，不泛化为所有项目的贴图规则。

## 4. 资产来源

现有 `lighting-v1/sources.json` 记录两项本地来源，声明为 `CC0-1.0`：

- `studio_small_09_1k.hdr`：https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr
- `plastered_wall_04_nor_gl_1k.jpg`：https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/plastered_wall_04/plastered_wall_04_nor_gl_1k.jpg

来源声明、字节数与SHA256一并收录在基线JSON。运行时继续使用同源本地资产，不改成CDN请求。复用外部代码/资产时保留适用许可与来源，不因只是参考而复制整套无关依赖。

## 5. 事实、推断和建议的区分

- **已确认事实**：固定提交源码、版本、资源清单、既有测试内容。
- **仓库历史记录**：旧验收文档中的帧率、测试数量与截图条件；未在本轮复跑。
- **待验证假设**：当前画面平淡是否主要来自补光、曝光压缩、法线或阴影偏移。
- **本包建议**：主路线、角色契约、参数候选、验收设备/阈值；需要执行Codex在实机上验证。
- **设计参考**：A/C图的光感和局部材质；不提供精确业务数据或几何证据。

