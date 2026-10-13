# 造价智算 Logo 复用来源

系统 v0.9.115，LogoKit v1.0.3，2026-10-13。用户选定第 5 号阶梯 Z；13 块几何沿用历史模型 v1.2.2，新动作与渲染模块的规范快照位于 `05-视觉识别/01-Logo相关/06-复用组件/LogoKit-v1.0.3/`。

设置页、独立 `logo.html`、欢迎页复用这些模块。`LogoPreview.tsx` 为 React 生命周期适配，配置与导出无业务 API 调用。八套固定配色保留原值；主题跟随中心块等于实际主色，上梁保留 v0.9.110 的加白 32%。

| 文件 | SHA256 |
| --- | --- |
| `logo-config.mjs` | `ede6ca956110f92c85346605ab3ad29a32871f8464e6dfbc553dc2a7a2ba932c` |
| `logo-export.mjs` | `fff733ebbdc308b9947bcb677dcd61eb050dc4519d668c2acd2acac87bcd6188` |
| `logo-renderer.mjs` | `3497f4974d8e34bd08d3e6d6b6c69f70d753d744cbfc8dc94ab177db174131f4` |
| `model.mjs` | `8be793282dff46500ab30009a49822ea9eb4b525bce9d95b0d7e0f3b31158242` |
| `motion-options.mjs` | `67d97b05896cda7204c3c943578817f39c85a878d7db66022477b716bb10d623` |
| `motions.mjs` | `34b989314bd32999e7fd954e94ca24fa239e49cdb4bf4d6044058962d91b8a05` |
| `palettes.mjs` | `5cf7416f2ec988791e858f78cb4e9d9de59f61c47e25bb5a3af89e9ce0bb743a` |

Three.js、附属几何、RoomEnvironment 与 GLTFExporter 使用项目的 MIT 依赖。中文文字在网页/PNG 使用当前合法本机字体，复用包不包含字体。GLB 仅图形本体，包含全部 24 动画；动态待机为 `Pose_Idle_Cube_Wave`。旧 Blender 与 GLB v1.2.2 的原 20 动画保留，不将其声明为已包含新增动作。

修改后同步应用和规范快照，重跑动作碰撞/配置测试，动作变化时重新导出八套 GLB 并回读验证，再更新哈希及复用包。

## 导航静态标识（v0.9.112）

`BrandMark.tsx` 与 `brand-mark.css` 使用 `navigation-mark.json` 的矢量投影。几何来自本目录 `model.mjs` v1.2.2，朝向沿用 `(0.22, 0.43, -0.025)`；上下五块紧密横梁各取整体外轮廓，避免小尺寸接缝。颜色取系统主题，未修改三维核心或 LogoKit v1.0.0 快照。生成依据保存在 `Codex-Temp/sidebar-logo-v09112/generate-mark.mjs`。

投影 SHA256：`f0f06fb7bb3cf61a5df0ba72a7abe1fade3738d1ea1dc4c5d9bf9202dc2b32ba`。

动态待机在 v0.9.113 缩短为 12 秒，每块轻转 90° 再回正、前出 0.22，横梁外让 0.16。其他动作不变，旧 LogoKit v1.0.0 保留历史参数。

新增圆环 `Pose_Ring_Reunion`（10 秒）与波浪 `Pose_Wave_Stretch`（8 秒）。网页显示比例自适应仅负责构图；GLB 保留原尺寸的方块和完整空间运动。

页面编排新增 `sequences.mjs`，SHA256 `3c400e9d5cfb20cabe58067e50644c78092eba32924b5037aa7c14e392fd2e33`。导航现复用三维渲染及 studio 循环，原矢量保留为加载/失败/减少动效回退。GLB 与 v1.0.2 相同。
