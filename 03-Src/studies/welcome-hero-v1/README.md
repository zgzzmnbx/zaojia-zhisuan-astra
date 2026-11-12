# 欢迎页独立 Demo v1.1.0

2026-11-12。按参考图制作左右分栏预览：左侧放大原有阶梯 Z Logo、造价智算名称、说明及按钮，右侧将原欢迎页的动态流程工作台做成倾斜立体平面，叠加费用汇总与复核浮层。

本目录是候选设计，未替换 `WelcomeScreen.tsx`、正式样式、正式构建、启动链路或业务数据。应用版本仍为 v0.21.3。进入系统、新建任务按钮只显示预览反馈，不进入正式系统、不创建任务；复选框只在本页内展示。右上角提供实际架构图、主题配色和明暗切换，外观选择只作用于独立预览。使用合成数据，字体、图标、Logo、原版 Gork 和流程演示复用项目现有资源。展示标题为参考图风格的局部大字号，不改变正式设计 token。

v1.1.0 按用户反馈增加三个顶栏按钮，Gork 藏在倾斜工作台后露出半个脑袋；标题从桌面 56px / 600 提升到 72px / 800，加载既有苹方 Semibold 字体；费用汇总浮层整体缩放为 80%，主界面不缩小；背景增加低对比点阵、两条弧线与淡分隔线。v1.0.0 构建和截图保留。

## 打开

双击本目录 `打开欢迎页Demo.bat`，或访问 <http://127.0.0.1:5197/>。仅绑定本机地址；端口冲突时不停止其他服务。

从项目根目录手动重建与运行：

```powershell
node node_modules/vite/bin/vite.js build --config 03-Src/studies/welcome-hero-v1/vite.config.mjs
node 03-Src/studies/welcome-hero-v1/serve.mjs
```

构建输出独立存放在 `04-output/welcome-hero-demo-v1.1.0/`，不清空其他构建。预览服务只开放本 Demo 构建及白名单中的三份字体、八个 Gork 脚本和两份系统架构 HTML，没有业务 API 或转发。原版 Gork 复用原组件及渲染器，沿用原资产来源与许可证，没有重画替代角色。正式源码不变。

## 验证

- `npm test`：453 项通过。
- 上述独立 Vite 构建通过；未执行会替换现用根构建的 `npm run build`，未部署。
- Chrome 实际浏览器检查：1600×1000、1280×800；亮暗主题；Logo WebGL 渲染；空间动画时间推进及暂停；流程步骤切换；按钮反馈；复选框；减少动态效果。
- v1.1.0 增量检查通过：Gork 原形象及动态、同步暂停、三个按钮、配色切换及关闭后焦点恢复、两种架构视图、窗口关闭卸载、亮暗主题、两种桌面尺寸、实际矩阵核验浮层比例为 0.8、减少动效。没有 JavaScript 错误或业务 API 请求。
- 页面无 JavaScript 错误、无业务 API 请求。底层 Three.js 有显卡着色器精度警告，不影响本轮可见渲染。构建保留原星图的较大懒加载 chunk 提示。
- 截图、构建日志、453 项测试日志及浏览器检查脚本位于项目 `Codex-Temp/welcome-hero-v1-*` 和 `Codex-Temp/welcome-hero-browser-check.js`。浏览器控制台日志保存为 `Codex-Temp/welcome-hero-v1-console.log`。
- v1.1.0 证据：`Codex-Temp/welcome-hero-v1.1-*`，脚本为 `Codex-Temp/welcome-hero-v11-check.js`。
- 待用户确认视觉方向；这不是正式欢迎页验收或完整业务回归。
