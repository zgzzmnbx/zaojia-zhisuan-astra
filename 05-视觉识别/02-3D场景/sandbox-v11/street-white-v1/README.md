# 街道柔白烘焙 v1

UI v0.11.4 使用。承接 city-white-v1 的 Blender 工程、均匀环境光和柔和太阳光，将外围道路与路缘重新烘焙为柔白微缩模型风格，协调内圈场地。道路保留浅灰阴影和真实高差，不使用黑色路面。

- `street-white.blend`：可编辑 Cycles 场景，包含完整遮挡几何及打包贴图。
- `street-white.png`：2048×2048、2048 samples、非自适应采样，Standard sRGB 输出。
- `street-uv.json`：按照原 glTF 材质和三角形顺序保存新 UV。网页只展开索引并替换 UV，顶点位置与法线不改。
- 新材质关闭旧顶点色，避免旧灰色烘焙与新贴图相乘；原始预设恢复源材质、源几何和旧顶点色。
- 原始 `public/sandbox-v11/model/` 不修改。平台颜色及背景明暗仍作用于新道路，业务建筑、水体与动画沿用既有实现。
- 复现：`blender --background --python tools/sandbox-v11/bake-street-white.py -- <项目根目录>`。先确保 city-white-v1 工程存在。

新烘焙不增加逐帧渲染通道；增加两张纹理和两份私有 UV 几何，退出时释放。manifest.json 记录参数及 SHA256。

接地层也在同一 Blender 场景重新烘焙，移除旧地面上的硬黑街道阴影。`ground-white.png` 沿用原地面 UV；完整接地烘焙工程为 `street-ground-white.blend`，复现脚本为 `tools/sandbox-v11/bake-street-ground.py`（先执行街道脚本）。
