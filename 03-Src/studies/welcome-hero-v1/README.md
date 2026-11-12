# 欢迎页独立 Demo v1.0.0

2026-11-12。按参考图制作左右分栏预览：左侧放大原有阶梯 Z Logo、造价智算名称、说明及按钮，右侧将原欢迎页的动态流程工作台做成倾斜立体平面，叠加费用汇总与复核浮层。

本目录是候选设计，未替换 `WelcomeScreen.tsx`、正式样式、正式构建、启动链路或业务数据。应用版本仍为 v0.21.3。按钮只显示预览反馈，不进入正式系统、不创建任务；复选框只在本页内展示。使用合成数据，字体、图标、Logo 和流程演示复用项目现有资源。展示标题为参考图风格的局部大字号，不改变正式设计 token。

## 打开

双击本目录 `打开欢迎页Demo.bat`，或访问 <http://127.0.0.1:5197/>。仅绑定本机地址；端口冲突时不停止其他服务。

从项目根目录手动重建与运行：

```powershell
node node_modules/vite/bin/vite.js build --config 03-Src/studies/welcome-hero-v1/vite.config.mjs
node 03-Src/studies/welcome-hero-v1/serve.mjs
```

构建输出独立存放在 `04-output/welcome-hero-demo-v1.0.0/`，不清空其他构建。预览服务仅开放本 Demo 构建和两份本地苹方字体，没有业务 API 或转发。独立构建用同源 Icon 适配层避免初始化与预览无关的 Gork 设置存储；正式源码不变。

## 验证

- `npm test`：453 项通过。
- 上述独立 Vite 构建通过；未执行会替换现用根构建的 `npm run build`，未部署。
- Chrome 实际浏览器检查：1600×1000、1280×800；亮暗主题；Logo WebGL 渲染；空间动画时间推进及暂停；流程步骤切换；按钮反馈；复选框；减少动态效果。
- 页面无 JavaScript 错误、无业务 API 请求。底层 Three.js 有显卡着色器精度警告，不影响本轮可见渲染。构建保留原星图的较大懒加载 chunk 提示。
- 截图、构建日志、453 项测试日志及浏览器检查脚本位于项目 `Codex-Temp/welcome-hero-v1-*` 和 `Codex-Temp/welcome-hero-browser-check.js`。浏览器控制台日志保存为 `Codex-Temp/welcome-hero-v1-console.log`。
- 待用户确认视觉方向；这不是正式欢迎页验收或完整业务回归。
