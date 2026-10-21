# Blender 光照调试样板 v0.1.0

日期：2026-10-21。独立侧会话成果，未修改网页代码、发布 GLB 或原始 Blender 工程。

## 交付

- `astra-lighting-study.blend`：可编辑工程，保留原灯光并关闭渲染，新灯光位于 `STUDY - softbox lighting` 集合。
- `before.png` / `after.png` / `before-after.png`：同机位真实 Cycles 渲染。before 为原 Blender 工程灯光，不是当前网页截图。
- `tanks-closeup.png` / `pipes-closeup.png`：储罐与管道近景。
- `verification.json`：来源哈希、几何与相机一致性校验。
- `scripts/`：本轮通过 MCP 执行的灯光与材质调整脚本，以及后台渲染脚本。调整脚本为按顺序执行的一次性过程记录，不要在最终工程重复执行以免产生重复灯光/相机。

## 调整内容

原 `white-sandbox-flow.blend` 独立复制；相机和模型布局保持不变。三盏矩形面积光形成左侧主光、右侧弱补光和后侧轮廓光；环境强度 0.12，AgX Medium High Contrast，曝光 0.05。最终主光 12000 W / 9×12，补光 1200 W / 13×16，轮廓光 3000 W / 5×13；尺寸为当前场景单位，并非通用实景参数。

储罐使用独立缎面银白材质（金属度 0.62、粗糙度 0.28），管道使用独立珠光涂层（金属度 0.32、粗糙度 0.24）。建筑保持冷白，蓝色玻璃、河道与信息管线分开调整。未更改业务动画或网页效果开关。

## 验证

| 项目 | 结果 |
| --- | --- |
| Blender MCP 场景读取 | 通过，736 个原场景对象、710 个 Mesh |
| MCP 参数修改与保存 | 通过，灯光/材质/近景相机实际保存至本副本 |
| 原几何与变换 | 733 个 Mesh/Curve/Font 对象逐项哈希一致 |
| 全景相机 | 矩阵、正交尺度与类型一致；尺度 46 |
| 渲染 | Blender 5.2.2 LTS / Cycles / Intel Arc B390 ONEAPI / 64 samples / 去噪 / 1440×1000 |
| 图片检查 | 四张 PNG 均成功解码，已查看全景与两张近景 |
| 网页实现与浏览器验收 | 本轮未进行；该样板不能作为网页验收证据 |

本轮证明了本地 Blender 调试链路可用，并产出光照/材质样板；尚未声称达到目标参考图的全部效果。近景仍可看到原模型的局部多边形边缘。网页实时渲染器不会自动继承 Cycles 的间接光、面积光阴影和色彩管理；迁移时需单独适配、测试、构建与同机位浏览器验收。原夜航泛光、聚焦辉光及业务动画应由主线程按既有门禁保留。

## MCP 配置与启动

- 上游：<https://github.com/ahujasid/mcp-for-blender>，MIT 社区项目，非 Blender 官方插件。
- 安装版本：`mcp-for-blender==2.2.2`，插件协议 14。
- Codex 全局条目：`blender`，STDIO，启动 `C:\Users\zgzzm\.local\bin\mcp-for-blender.exe`。
- Blender 插件已启用并保存偏好；打开 Blender 后自动连接 `127.0.0.1:9876`。仅本机监听，遥测关闭，安全模式开启。
- 完全重启 Codex 后可加载新工具；本轮没有重启正在工作的 Codex，通过独立 MCP 客户端完成真实调用验证。
- 配置与 Blender 偏好备份：`C:\Users\zgzzm\.codex\backups\blender-mcp-20261021-095544\`。
- 安装及测试日志：项目 `Codex-Temp/blender-mcp-setup/`。无需 API Key，未启用外部模型生成服务。

## 版本记录

- v0.1.0：安装并验证 Blender MCP；独立副本灯光、材质调试；交付同机位对照及近景。

项目主版本和根 README / PRD / CHANGELOG 未修改，以免干扰主线程。该目录为独立样板版本。
