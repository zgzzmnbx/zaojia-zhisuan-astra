# 分层展开 · 柔白装配样板 v1.0.0

2026-10-30。用户选择先验收独立样板，未接入正式开场。

- 查看：http://127.0.0.1:5189/assembly-demo/index.html
- 原动画同机位对照：http://127.0.0.1:5189/assembly-before/index.html
- 支持重播、暂停保留画面、直接归位；不连接业务任务、不写个人偏好。
- 分层散开幅度、垂直抬升增加，短暂悬停后沿弧线错峰归位；各构件保持刚性，不做变形或随机翻转。总时长约 4.65 秒（可见动画时钟）。
- Blender Cycles 六方向漫反射补光烘焙用于临时修复暴露的灰黑接触面；不是整套建筑贴图重新烘焙。完成及打断后恢复源材质、几何和着色器。
- 候选入口仅在本目录 Vite 构建中替换。生产 building-entrance.mjs 未修改。

## 构建与检查

在项目根目录运行：

```powershell
node --test 03-Src/studies/assembly-demo-v1/assembly.test.mjs
npx vite build --config 03-Src/studies/assembly-demo-v1/vite.config.mjs
```

设置 ASSEMBLY_BASELINE=1 可构建原动画对照。输出在 Codex-Temp/assembly-demo-v1/dist 与 before。仅将这两份输出复制到正式静态目录的 assembly-demo / assembly-before 子目录，不覆盖正式入口。

验收记录：00-docs/handoff/2026-10-30-装配视觉样板-v1.0.0.md。
