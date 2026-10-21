# 沙盘光影独立网页 v0.1.0

目标：将已确认的 Blender 棚灯与银白材质样板转换为可旋转、缩放的真实网页三维场景。

本目录独立于正式产品。用户已授权使用其他端口，预览采用 `http://127.0.0.1:5196/`；正式 5189 服务、网页业务源码、业务状态、原夜景与装配动画均未修改。

## 使用

在本目录执行 `python -m http.server 5196 --bind 127.0.0.1 --directory 04-output`，再打开上述地址。端口被占用时停止，不接管其他进程。服务关闭后可用相同命令重新启动。

- 默认显示实时三维模型，鼠标拖动旋转、滚轮缩放；画布获得键盘焦点后可用左右方向键旋转。
- 顶栏选择全景、储罐近景、管道近景。
- “效果设置”提供烘焙光影、金属反射、自动环游、亮度调节与恢复设置。关闭开关为灰色，开启为蓝色。
- “Blender 参考图”明确显示静态参考图，并回到对应机位；再次点击或按 Esc 返回实时三维。它不参与网页三维的渲染。
- 不保存到正式产品的任何偏好。自动环游默认关闭；静止时停止渲染，页面隐藏停止环游。

## 实现

来源为相邻目录 `blender-lighting-study-v0.1.0/astra-lighting-study.blend`，原工程只读。通过 `bake_web.py` 在独立 Blender 进程中应用原模型修改器，将静态几何按分区合并，保留银白储罐与管道的独立实时材质；背景地面范围针对独立样板调整。

静态建筑的漫反射、直接与间接光经 Cycles 烘焙后由网页纹理承接；OIDN RTLightmap 对线性光照贴图去噪。PNG 保存前缩放辐亮度，网页按清单还原，避免亮部截断。为减轻相交面烘焙产生的纯黑裂缝，网页对静态材质加入基于原底色的最低环境补光；因此最暗接触区与 Cycles 原图存在差别。金属材质使用 Three.js PBR 与一次生成的 PMREM 棚灯环境，保留随镜头变化的反射。

网页采用 Three.js 0.186.1、daisyUI 5.7.47 与 Vite 8.3.2，资源均本地加载，不调用外部模型服务、生产 API 或用户业务数据。构建过程复用此仓库已安装的对应版本依赖，不修改根 package.json 或锁文件。单独移出目录时先安装本目录 package.json 中的依赖。

## 构建与检查

在本目录执行 `npm run build`，构建输出为 `04-output/`；`npm test` 检查 GLB 格式、几何数值、每个静态分区的贴图对应、UV、非空烘焙和参考图完整性。

实际浏览器记录和截图保存在项目 `Codex-Temp/blender-mcp-setup/`；最终检查结果见 `ACCEPTANCE.md`。

重新烘焙需 Blender 5.2 与 Open Image Denoise 2.5.1。设置进程环境变量 `ASTRA_OIDN_LIBRARY` 为本机 OpenImageDenoise.dll 的已核实绝对路径，运行 `blender --background --python bake_web.py` 完成烘焙后，再执行 `python finish_atlases.py` 进行独立去噪；最后重新构建网页。源工程本身不保存或覆盖。`public/assets/bake-manifest.json` 记录来源 SHA256、采样数、贴图大小和辐亮度比例。

## 验收边界

这是静态工业沙盘的视觉样板。它证明所选 Blender 效果可迁移到真实可交互网页；不等同于正式产品的完整集成验收。当前光照烘焙包含固定构件的遮挡，不能直接套用到构件飞入、拆装或夜间场景。若移入正式产品，需要继续适配动画期间的光照切换、动态阴影、夜航泛光、建筑染色和功能开关。

Blender Cycles 与网页 AgX/实时反射仍可能存在视觉差异，不承诺逐像素一致。正式产品版本、根 README / PRD / CHANGELOG 保持原样；本目录单独记录版本。

## 来源与许可

- 场景：本项目原始沙盘与已确认 Blender 样板。
- Three.js（MIT）：https://github.com/mrdoob/three.js
- daisyUI（MIT）：https://github.com/saadeghi/daisyui
- Open Image Denoise（Apache-2.0）：https://github.com/RenderKit/oidn ，光照贴图滤波说明 https://www.openimagedenoise.org/documentation.html

## 版本记录

- v0.1.0（2026-10-21）：独立网页、Blender 静态光影烘焙、实时金属反射、三机位、参考图对照和效果设置。
