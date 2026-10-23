# 外围城市柔白烘焙 v1

用于 UI v0.11.3 的「我的调节」。139 栋城市建筑保持原几何/UV/世界变换，仅以新贴图替换 `background_city` 的私有材质贴图。七座主建筑、场地、道路及原源模型均不修改。「原始白色烘焙」恢复原材质及原贴图。

在 Blender 5.2.2 LTS 中导入冻结 glTF，使用统一白色哑光材质、均匀环境光及方向固定的柔和太阳光，避免局部面积灯的距离衰减。Cycles CPU、2048 samples（关闭自适应提前收敛）、2048×2048，保留真实几何遮蔽和间接光。导出 PNG 已使用 Standard sRGB 展示转换；网页按 sRGB 纹理、NoToneMapping 显示，不再次打光。材质/灯光参数见 manifest.json。

- `city-white.blend`：含完整遮挡几何、白色材质、灯光及打包烘焙结果，可编辑。
- `city-white.png`：网页实际使用的新贴图，非截图后期处理。
- 复现：`blender --background --factory-startup --python tools/sandbox-v11/bake-city-white.py -- <项目根目录>`。
- 原始 `public/sandbox-v11/model/` 字节保持不变；旧 `.blend` 与贴图也没有覆盖。

新运行材质不再对城市建筑套用「外围平台」的灰色重映射；平台和道路仍可独立调色，背景明暗仍能整体调节外围明暗。原版页面和原始烘焙预设继续显示原版效果。
