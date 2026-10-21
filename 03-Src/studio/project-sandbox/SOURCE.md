# 沙盘接入来源

2026-10-20，UI v0.10.57：优先加载 `lighting-v2/sandbox-surface.glb`，基于 v1 原组件与只读源工程三角形匹配，为储罐和管道增加涂层角色。保留全部局部属性、节点矩阵、UV及实际装配参数；复用 v1 图集。v2 / v1 / 原模型逐级有界回退。输入输出哈希、717 个组件证据见 [v2 manifest](../../../05-视觉识别/02-3D场景/lighting-v2/surface-manifest.json)，实机与恢复见 [验收报告](../../../00-docs/handoff/2026-10-21-沙盘A-C质感验收.md)。

2026-10-14。模型直接引用视觉目录 white-sandbox-v0.1.0/white-sandbox.glb，保留原 Blender 工程与独立样机。接触柔影、夜航 Bloom、管线路线与几何从样机 0.1.10 复制；信息流在开关开启时持续显示，仅作信息传递示意。场景由 Three.js / OrbitControls / GLTFLoader 渲染，不包含样机聊天或示例数据。

模型 SHA256：bf9a428cbcaaa8ef061b5eff358ad697943a16effe677ca8fa588ec653475e26


2026-10-20，UI v0.10.56：上述模型保留为来源与降级资源，正式优先加载 `lighting-v1/sandbox-lightmapped.glb`，只增加烘焙 UV。Cycles、Poly Haven CC0 HDRI / 法线及哈希见 [光影资产来源](../../../05-视觉识别/02-3D场景/lighting-v1/README.md)。用户最终选择仅聚焦建筑底部局部柔光，原夜航全画面 Bloom 已移除；保留深度遮挡，不引入后处理开销。


## v0.10.58 · 本地棚灯环境与 PCSS（2026-10-21）

- 棚灯参考 [pmndrs/env](https://github.com/pmndrs/env) 与 [Drei Lightformer](https://github.com/pmndrs/drei/blob/master/src/core/Lightformer.tsx)（MIT）的高动态范围发光面方法。本项目用原生 Three.js 实现四块本地软箱，首次加载时生成 256 面尺寸 PMREM，临时几何随即释放；无联网资源、上传或额外逐帧环境渲染。夜航保留原 HDR。
- 柔影参考 [Three.js PCSS 官方示例](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shadowmap_pcss.html)（Three.js MIT）的遮挡搜索与半影过滤方法。按现有正交主光的视锥宽度、深度范围适配，16 次遮挡搜索 / 32 次过滤，显式 LOD 0，局部材质注入；不修改全局 ShaderChunk。Three.js 许可证保留于既有依赖与第三方声明中。
- 使用现有 v2 几何、角色、UV 和光照图。维持装配的深度着色器、业务染色及单一 RAF。增强关闭 / 夜航切回原 PCF，日间使用原生深度纹理 PCSS。
- 本轮支持当前 WebGLRenderer 的普通深度方向；没有启用 reversedDepthBuffer。上游阴影片段结构变化时适配器显式失败，升级 Three.js 必须重验。

### v0.10.59 夜航恢复

恢复本项目首次沙盘提交 `44e89b9` 的 `night-renderer.js`（Three.js 官方 EffectComposer / UnrealBloomPass / OutputPass，现有 Three MIT 依赖），沿用 strength=0.60 / radius=0.45 / threshold=0.75。v0.10.56 删除此路径属于视觉回退；日间无全屏后处理、局部聚焦辉光的约束不应删除原夜航效果。夜航泛光与聚焦开关独立，退出夜航释放所有目标，不新增 RAF。
