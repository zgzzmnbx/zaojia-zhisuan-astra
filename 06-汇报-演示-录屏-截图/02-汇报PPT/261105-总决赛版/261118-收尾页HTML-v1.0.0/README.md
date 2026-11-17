# 造价智算 · 展示收尾页

版本：v1.0.0 · 2026-11-18

双击 `index.html` 比较三个版本；每个 HTML 都可独立复制、离线打开。画面采用 1920×1080 设计坐标，按窗口或 iframe 等比缩放。图片内嵌，无外部脚本、网络字体或 CDN。预览 JPG 和 PDF 记录最终静态画面，动画以 HTML 为准。

| 文件 | 方向 | 使用建议 |
| --- | --- | --- |
| 01-星轨汇聚.html | 深蓝星空、轨道光点、成果横向汇聚 | 科技展示的连续收尾 |
| 02-光构未来.html | 银白空间、智算核心、连接各业务的光路 | 更贴近智算亮色页面 |
| 03-第一公里.html | 黑金光束、成果矩阵、大字落版 | 比赛收尾，突出最后一句 |

## 内容与素材

- 主来源：同级上层 `总决赛-v1.3/261107-造价智算-总决赛版-v1.3.2-【C-完整视频】.pptx` 的第四页，以 PowerPoint 实际导出画面核对，保留标题、十步流程、六类能力展示。
- 文案来源：`总决赛-v1.3/造价智算_演技稿-astra-demo-cues-v1.3.3.md` 的【P4】：一线员工借助 AI 自主研发、经验转为可复用规则与智能体、从造价走向更多业务、第一公里的收尾表达。
- 第四页有画布之外的旧文本与图形；本交付以实际可见页面及用户补充讲稿为准，未把这些隐藏草稿当作当前页面。
- 界面截图、蓝色阶梯 Z、机器人及黑色助手均来自该 PPT 的原有媒体。GIF 仅提取原首帧，不重绘角色，不嵌入原视频。截图代表原 PPT 当时的演示画面，不是当前正式版状态。
- 文案“规则裁决、知识可追溯、任务可视化、经验可复用、协同有留痕、结果可触达”为原内容的简要概括。未把讲稿中的准确率或效率数字加进收尾页，也未增加未经提供的业绩。
- 字体使用系统苹方 / 微软雅黑 / sans-serif；跨设备可能有字形差异。

## 播放

打开即按层次入场，约 5 秒完成主要文字与成果显现，8 秒发出 `complete` 事件；之后保留画面和低速背景动效，不跳转。

- 页面按钮：暂停、重播、全屏。嵌入模式 `?embed=1` 隐藏页面全屏按钮，保留可键盘操作的暂停与重播。
- 快捷键：空格播放/暂停，R 重播，F 全屏；按钮获得焦点时保留其标准键盘行为。
- 系统“减少动态效果”开启时直接显示完整静态画面，不运行循环。标签页隐藏、页面离屏、宿主明确设为不可见时停算，恢复不追赶积压帧。
- 不播放声音，不自动发消息，不调用模型、不读取业务数据。

## 嵌入智算

本次交付为可嵌入的独立展示文件，未修改或发布智算应用。放入正式静态目录并完成宿主回归后再接入；推荐同源 iframe，隔离页面样式、全局键盘事件与业务 DOM。

```html
<iframe id="closing"
  src="/closing/03-第一公里.html?embed=1"
  title="造价智算展示收尾"
  allow="fullscreen"
  style="width:100%;height:100%;border:0">
</iframe>
```

容器须有明确高度。页面内部自带 16:9 缩放与留边；宿主无需套第二层缩放。默认每个文件约 2.1 MB，加载一个版本即可。

### 控制协议

仅接受同源父窗口消息；HTTP(S) 同源服务下启用。跨域与 `file:` 的不透明来源不开放消息控制；本地双击时可用子页面按钮。

```js
const frame = document.querySelector('#closing');
const control = (action, extra = {}) => frame.contentWindow.postMessage({
  channel: 'zsuan-closing', action, ...extra
}, location.origin);

// 在 iframe load 后、切换到收尾时：
control('set-visible', { visible: true });
control('replay');

// 收起或离开收尾页时（必须与宿主的面板状态联动）：
control('set-visible', { visible: false });

// 如需暂停 / 定格 / 卸载：
control('pause');
control('seek', { time: 8 });
control('dispose'); // 终止实例；再次使用需重载 iframe

window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.channel !== 'zsuan-closing') return;
  // event.data.event: ready / state / complete
});
```

可用动作：`play`、`pause`、`replay`、`seek`、`set-visible`、`dispose`。同源代码也可使用 `frame.contentWindow.ZSuanClosing` 的同名方法，以及 `getState()`。隐藏采用独立可见性状态，不覆盖用户暂停选择。窗口切换不访问或清空宿主任务、会话和沙盘。

文件设置 `connect-src 'none'`，仅使用内嵌脚本、样式及 data 图片。正式服务若额外下发禁止内嵌脚本的 CSP，需按服务的 nonce/hash 规范适配；不要为了展示页放宽整个宿主策略。正式菜单入口、部署路径、宿主 CSP 和实际面板切换尚未在正式服务验收。

## 验证

验收结果见 `验收记录.md`。本次未修改应用源码、依赖、启动链或正式数据，未运行会发布应用的构建流程。原 PPT 与讲稿保持只读。
