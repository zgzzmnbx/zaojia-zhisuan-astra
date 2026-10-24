# 造价智算 · V11 白色烘焙

当前源码 UI v0.11.12。模型冻结资源在 `public/sandbox-v11/model/`，可编辑 V11 工程及烘焙说明在 [sandbox-v11](sandbox-v11/README.md)，外围柔白在 [city-white-v1](sandbox-v11/city-white-v1/README.md)，街道与地面在 [street-white-v1](sandbox-v11/street-white-v1/README.md)。

原写实主线的 white-sandbox-v0.1.0、lighting-v1、lighting-v2 及旧对照样机已从当前目录移除。删除前的源码、模型、Blender、截图、来源/许可证、逐文件 SHA256 与恢复方法统一保存在 `D:\Codex-Temp\归档备份\智算Astra-主线原效果-v0.11.5-20261023`。归档在项目之外，不参与构建。

V11 日间显示效果保留；支持首次可见装配、地面信息碑、Blender 柔白集团 Logo 及独立夜览。夜览使用运行期私有材质，不修改冻结模型和烘焙贴图。共享河流法线移至 [shared-water](sandbox-v11/shared-water/README.md)，字节不变。其他独立研究成果保持原位，历史原效果引用须从归档恢复后使用。

新增 [20° 项目信息碑](sandbox-v11/project-plaque-v1/README.md)（v0.11.9 候选，尚未部署）。石碑、Logo、地面采用 Blender 派生烘焙；原始预设可恢复。

卡通河流（v0.11.12）在 `03-Src/studio/project-sandbox/toon-river.mjs` 中以私有河面细分和运行着色实现；主模型与冻结烘焙不变。水体、小船与流动分别可控，关闭还原源河面。
