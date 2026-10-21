# 沙盘光影增强 v1.0.0

2026-10-20，正式 UI v0.10.56。保持现有冷白、蓝色、哑光建筑风格；不改造业务状态或建筑结构。原 `white-sandbox-v0.1.0/` 工程与 GLB 保留。

## 离线光照与运行方式

- `sandbox-lightmapped.glb`：从当前正式 GLB 导入 Blender 5.2.2，保留 8 个区域、60 个绘制分组及全部三角形，只增加第二套 UV 与对应 UV 接缝顶点。
- `ground.png` 与七张建筑贴图：**Cycles 路径追踪烘焙**，96 采样、4 次漫反射反弹。计算中性冷白天空的直接与间接漫射光照，不烘焙表面颜色、不烘焙太阳。sRGB PNG 在 Three 中解码为线性照度。
- 日间读取光照贴图；太阳及装配投影仍是缓存阴影图，不是实时光追。装配期间静态烘焙光照关闭，落成后 450ms 淡入。夜航停用日间烘焙照度，保留夜间配色。
- 运行时环境反射来自本地 1K HDRI，载入时一次 PMREM 预过滤。只使用低强度灰泥法线，**不使用其彩色底纹**，以保留白模本色。
- 用户最终选择局部辉光：仅在点击/任务聚焦建筑的底部绘制柔和轮廓，420ms 交叉淡入淡出，全景自动退出。采用地面局部 SDF 着色平面，保留深度遮挡；稳定时仅增加 1 次绘制、2 个三角形，无全屏后处理、额外帧缓冲或新增循环。夜航也直接绘制，停用旧版全画面 Bloom。
- 关闭“质感增强”恢复基础环境与材质；关闭“聚焦辉光”淡出当前光圈。独立偏好 `astra.sandbox.enhanced` / `astra.sandbox.bloom`，缺省开启，保存的关闭值优先。资源失败降级基础画面，并在视图面板提示。

这是离线环境漫射光照 + 实时光栅化交互，不宣称浏览器实时路径追踪、动态反射或动态多次反弹。相机仍可自由环游，用户不需要等待逐帧收敛。

## 复现

从项目根执行（Blender 可执行文件由本机环境提供）：

```powershell
python tools/sandbox/fetch-lighting-assets.py
blender --background --python tools/sandbox/bake-lighting.py
npm test
npm run build
```

`sources.json` 保留下载 URL / SHA256，`bake-manifest.json` 保留引擎、输入哈希、采样、区域、非空像素校验及输出哈希。烘焙脚本显式指定 `BakedLight` UV，保存前不重新设置图像色彩空间，避免 Blender 清空浮点图像缓存。

## 独立预览

`沙盘光影-独立预览.html` 可直接双击打开：模型、8 张照度图、HDR 与法线均已内联，不发起网络请求。它复用正式沙盘的白昼/夜航光照参数，并提供烘焙光照、环境反射、石膏法线、实时阴影、夜航、自动环游与重置视角，用于快速核对模型与烘焙贴图，不承载业务标签、信息流、聚焦辉光或 Gork 屋顶标识。

预览源码在 `preview/`，重新生成（项目根目录）：

```powershell
node "05-视觉识别/02-3D场景/lighting-v1/build_preview.mjs"
```

## GitHub 调研与来源

| 项目/资产 | 采用内容 | 许可/判断 |
| --- | --- | --- |
| [Blender Cycles](https://github.com/blender/cycles) | 已安装 Blender 中的 Cycles 离线烘焙 | 引擎官方镜像 Apache-2.0；不向网页分发 Blender |
| [Three.js 选择性辉光示例](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_postprocessing_unreal_bloom_selective.html) | 已调研；最终按用户要求改用局部地面柔光，不采用全屏 Bloom | MIT；包内 LICENSE 保留 |
| [Three.js PMREM](https://threejs.org/docs/pages/PMREMGenerator.html) | 本地 HDRI 一次预过滤 | MIT |
| [Poly Haven 公共 API](https://github.com/Poly-Haven/Public-API) | 验证官方资产清单和下载哈希 | 资产许可独立于 API 代码许可 |
| [Studio Small 09](https://polyhaven.com/a/studio_small_09) | `studio_small_09_1k.hdr`，低强度环境反射 | [CC0-1.0](https://polyhaven.com/license) |
| [Plastered Wall 04](https://polyhaven.com/a/plastered_wall_04) | `plastered_wall_04_nor_gl_1k.jpg`，0.055 强度法线 | [CC0-1.0](https://polyhaven.com/license) |
| [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) | 已调研，未安装 | 持续路径追踪与当前交互、装配及低开销目标不符 |
| [three-lightmap-baker](https://github.com/Ibrahim-3d/three-lightmap-baker) | 已调研，未安装 | 其已声明的 Three 版本范围不含本项目 0.186.1，当前无 Node 离线烘焙 |

所有运行资产均随本地构建发布，无外部纹理、HDRI 或模型网络请求；没有上传用户场景和项目数据。
