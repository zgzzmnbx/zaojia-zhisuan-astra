# 集团 Logo 柔白烘焙 · v1

用于 Astra v0.11.10 候选的集团 Logo 纪念碑。复用原 `model.mjs` 五块实体和贯穿镂空、双层台座，位置 `[-4.3,0.13,4.05]`，Logo 高 1.48、台座高 0.34；未重绘品牌轮廓。

- `group-logo-soft-white.blend`：可编辑的完整场景、物理材质与渲染相机。
- `group-logo.glb`：网页使用的五块 Logo 和两块台座，角色写入 extras.logoRole。
- `logo-light.png`：Blender Cycles 烘焙的 1024×1024 柔白照明。
- `blender-render.png`：真实 Blender 渲染预览，无网页荧光。
- `manifest.json`：Blender 版本、尺寸、照明参数、源轮廓 SHA256 与输出哈希。

重建：先在仓库根运行 `node tools/sandbox-v11/export-logo-source.mjs`，再用已安装的 Blender 后台运行 `tools/sandbox-v11/build-logo-bake.py`，`--` 后传入仓库根路径。中间几何写入 `Codex-Temp/logo-bake/source.json`。

烘焙采用相邻街道 `street-white-v1/street-ground-white.blend` 的场景与遮挡环境，Blender 5.2.2 LTS / World 0.7 / Sun 1.3 / Sun angle 18° / 128 samples / roughness 0.85。原图、原色 GLB、白模 GLB 及原轮廓不改。

运行层 `baked-logo.mjs` 显示烘焙贴图，台座与 Logo 均乘以模型明暗。原色仅染 Logo，台座保持白色。独立荧光由颜色和亮度参数驱动，主要从倒角/厚度发出，复用选择性 UnrealBloomPass，并采样真实场景深度。静态荧光无新增 RAF；所有运行材质、纹理和特效代理销毁时释放。

GLB 内嵌图片在运行时映射到同源 PNG，保持正式 CSP；隐藏偏好不被新增参数覆盖。“原始白色烘焙”仍隐藏该新增纪念碑。
