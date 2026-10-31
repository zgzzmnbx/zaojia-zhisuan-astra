# 沙盘局部清理 v1.0.0

对应 UI v0.13.21，2026-11-01。

- 删除中央基座三条旧地面公路，连同路沿、虚线及其路口斑马线。
- 删除智能填价楼顶两端各两个通风机组，共四个；中间标识下的构件保留。
- 删除三个储罐前方门框状管架的横梁、两根立柱、斜撑及脚座。储罐、低位连接管、正式传送带和伴行蓝色信息管道保留。
- 共移除 8,312 个三角面；网页在私有模型实例裁剪并清理无用顶点，冻结 glTF、原始贴图及原有 Blender 文件保持不变。

`site-cleanup.blend` 是从网页冻结模型生成的可编辑清理副本，已打包修复贴图。网页另行叠加的传送带、信息碑、外围柔白预设、夜景和动态水面不在此文件中。保存此文件不会自动发布网页。

`cleanup.json` 记录源 glTF SHA256 与精确三角面区间。`price-clean.png`、`site-clean.png` 仅替换删除构件暴露的接触区域；Blender Cycles 64 样本重新烘焙局部表面照明，再按原 UV 合成。遮罩外像素与原贴图逐字节相同。其余区域不重新烘焙。

在项目根目录依次运行：

1. Blender 后台执行 `tools/sandbox-v11/build-site-cleanup.py`，从冻结模型生成清理副本。
2. Blender 后台执行 `tools/sandbox-v11/bake-site-cleanup.py`，生成局部修复所需照明。
3. Python 执行 `tools/sandbox-v11/compose-cleanup-bake.py`，将局部照明合成到原始 UV 图集。
4. Blender 后台执行 `tools/sandbox-v11/pack-cleanup-bake.py`，打包修复贴图。

验证和发布记录见 `00-docs/handoff/2026-11-01-沙盘道路与小构件清理-v0.13.21.md`。
