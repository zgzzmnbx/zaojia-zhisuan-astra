# 沙盘接入来源

2026-10-14。模型直接引用视觉目录 white-sandbox-v0.1.0/white-sandbox.glb，保留原 Blender 工程与独立样机。接触柔影、夜航 Bloom、管线路线与几何从样机 0.1.10 复制；信息流在开关开启时持续显示，仅作信息传递示意。场景由 Three.js / OrbitControls / GLTFLoader 渲染，不包含样机聊天或示例数据。

模型 SHA256：bf9a428cbcaaa8ef061b5eff358ad697943a16effe677ca8fa588ec653475e26


2026-10-20，UI v0.10.56：上述模型保留为来源与降级资源，正式优先加载 `lighting-v1/sandbox-lightmapped.glb`，只增加烘焙 UV。Cycles、Poly Haven CC0 HDRI / 法线及哈希见 [光影资产来源](../../../05-视觉识别/02-3D场景/lighting-v1/README.md)。用户最终选择仅聚焦建筑底部局部柔光，原夜航全画面 Bloom 已移除；保留深度遮挡，不引入后处理开销。

2026-10-21，UI v0.10.57：正式沙盘改用 `lighting-v2/sandbox-detail.glb`，它由 v1 派生，仅将河流 UV0 改为世界平面；读取失败仍回退上述白模。v2 另提供八区顶点 AO、程序水面法线与天空、昼隐夜显导轨；来源、生成脚本、参数与哈希见 [lighting-v2](../../../05-视觉识别/02-3D场景/lighting-v2/README.md)。原 v1 资产只读复用，生产材质层自行管理加载与释放，不改冻结引擎或业务数据。
