# 价格匹配 · xyflow 交互预览

独立 demo **v1.0.0** · 2026-10-17。入口 `/price-xyflow-study/`，与 `/price-relief-study/` 使用同一组截图摘录示例。

实际使用 `@xyflow/react@12.12.0`（MIT），自定义条件、候选和结果节点，Handle 与受控连线；保留 React Flow 署名。来源：[自定义节点](https://reactflow.dev/learn/customization/custom-nodes)、[连线](https://reactflow.dev/learn/customization/custom-edges)。

- 节点可拖动，滚轮缩放、适应画布、复位布局；切换候选不会重置用户拖动的位置。
- 点击候选查看4个要素差异、来源行和经验参考；点击条件集中显示对应路径。蓝色一致、棕色差异，相似度不是正确概率。
- 播放一次6秒的匹配演示，结束、停止、后台或卸载取消计时；减少动效不播放连线流动。空闲无应用计时器。
- 模拟填写经过原生 dialog 确认，切换候选清除本页模拟结果。无业务 API、模型、工作簿、localStorage 写入。
- 独立浅色/深色预览。正式价格匹配窗口及 UI 版本不变。

构建：`node tools/build-price-xyflow.mjs` → `public/price-xyflow-study/`，再 `npm run build` 复制进静态输出。React Flow 仅由本独立页导入，未加入正式业务窗口。

验收：候选联动、条件聚焦、拖动后保持位置、缩放/复位、一次播放/停止、浅暗主题与模拟确认。记录保存在 `Codex-Temp/price-xyflow-*`。

验收结果：主目录336项、活动工作区334项既有测试及两边正式构建通过；浏览器验证候选选择（含键盘）、两项差异确认、切换清除模拟结果、节点拖动后切换保持位置、布局复位、路径筛选、亮暗主题和播放自动结束，控制台无错误。
