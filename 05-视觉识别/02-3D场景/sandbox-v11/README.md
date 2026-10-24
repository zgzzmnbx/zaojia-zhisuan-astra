# V11 白色烘焙沙盘

当前源码 UI v0.11.9 已是主工作台唯一沙盘。运行入口为 `/`，使用正式 5189 受控宿主。独立双模式实验页、原效果与夜航链路已归档并移除；旧实验说明和恢复启动方式保存在项目外归档 README。

冻结 glTF 位于 `public/sandbox-v11/model/`，按 packing-manifest.json 核验。七座业务建筑、139 栋外围建筑、道路及地坪保持冻结来源；模型、贴图、材质和显示效果本轮不变。外围柔白为 city-white-v1，街道和接地层为 street-white-v1，保留原始白色烘焙 / 我的调节预设。

运行实现 `03-Src/studio/project-sandbox/baked-mode.mjs` 继续使用原 NoToneMapping / sRGB / 景深和所有个人参数。装配只添加首次可见的临时构件位移，结束后恢复原几何和材质；鸟瞰远近支持 35–140%。

旧源码、Blender、原模型、来源/许可证与截图说明统一位于 `D:\Codex-Temp\归档备份\智算Astra-主线原效果-v0.11.5-20261023`；独立恢复时从该包提取原路径，禁止回接当前业务运行库或凭据。

新增 [20° 项目信息碑](project-plaque-v1/README.md)（v0.11.9 候选，尚未部署）。石碑、Logo、地面采用 Blender 派生烘焙；原始预设可恢复。
