# 前侧项目信息碑 · v0.11.9

按用户标出的主平台前侧长条区域制作。石碑面相对水平面倾斜 20°，宽 19.4、深 2.65，最高边 Y=-0.1355，低于主平台顶面 Y=0。让出占位或遮挡碑面的 5 栋外围建筑；七座业务建筑与源冻结资产不变。

- `project-plaque.blend`：可编辑完整场景、物理材质、照明与渲染相机。
- `project-plaque.glb`：网页使用的石碑与原管网轮廓浮雕。
- `plaque-light.png`：石碑 Cycles 烘焙，2048×512、128 samples。
- `plaque-ground.png`：清除五栋楼后重新烘焙的地面，避免原建筑阴影留在空地上。
- `blender-render.png`：Blender 物理渲染预览，动态业务文字由网页绘制，未刻入静态资产。
- `manifest.json`：尺寸、移除范围、Logo 来源 SHA256、照明和资产哈希。

生成脚本：`tools/sandbox-v11/build-project-plaque.py`，通过 Blender 后台运行，`--` 后传入仓库根目录。基础工程使用相邻街道的 `street-white-v1/street-ground-white.blend`。Blender 5.2.2 LTS，World 0.7 / Sun 1.3 / Sun angle 18°，柔白石材 roughness 0.85；管网 Logo 复用原 contours.json，白色浮雕保留镂空。

运行层 `project-plaque.mjs` 使用私有城市几何副本和派生地面贴图。“原始白色烘焙”完整恢复原建筑及地面，并隐藏信息碑；“我的调节”显示信息碑。文字绑定当前项目文件名和真实成果，四段分别为清单导入、智能填价、风险复核、报告生成，4/4 不代表已审核。仅数据或字体变化时刷新文字贴图，无新增动画时钟。

验收见 `00-docs/handoff/2026-10-24-v0.11.9-地面项目信息碑.md`；正式 5189 发布单独执行，本目录交付不代表已部署。
