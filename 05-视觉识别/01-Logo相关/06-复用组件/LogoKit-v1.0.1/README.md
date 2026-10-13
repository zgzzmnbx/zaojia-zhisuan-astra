# 造价智算 LogoKit 1.0.1

当前系统：[Logo 与动效设置页](http://127.0.0.1:5189/logo.html)。也可从主系统“设置 → Logo 与动效”，或欢迎页 Logo 的悬停设置进入。

## 现成成果

- `GLB/`：八套固定配色，每份包含 13 个独立立方体和 22 条动画。直接导入 Blender 或 Three.js / 其他支持 glTF 动画的工具。
- 六种姿态：静止、动态待机、左右摇摆、尾块飞回、打散恢复、组装循环。
- 其余动画保留原组装、散开、归位和 13 个方块独立旋转。动作名保持可读，动态待机为 `Pose_Idle_Cube_Wave`。
- 页面可导出当前 PNG、全部动画 GLB、JSON 配置；JSON 可导回页面恢复配色、动作、速度、背景与文字组合。
- PNG 支持横向、上下和仅图形，以及透明背景。GLB 为三维图形本体，中文文字由网页排版提供；需要已有三维文字工程可使用 `../../02-三维模型/logo-3d-v1.2.2/Blender/`。

## 动态待机

周期 12 秒：先静止 0.6 秒，按顶梁左至右 → 三个台阶向下 → 底梁左至右依次活动，最后静止 1 秒。每块占 0.8 秒，仅向前探出 0.22 个模型单位，轻转 90° 再回正；顶梁向上、底梁向下各让开 0.16，绕横轴转动，三个台阶绕竖轴。相邻方块交替转向，整体保持静止。相比 v1.0.0 的一圈旋转、1.08 前出和 22 秒，更贴近原轮廓、节奏更紧凑。

所有动作保持真实方块尺寸。已通过 120Hz OBB 碰撞检查，动态待机逐块参与、循环无漂移检查，以及八份 GLB 的真实动画回读。`verification.json` 记录逐文件结果。

## 网页复用

将本目录中的 `.mjs` 文件复制到目标前端工程；安装依赖 `three@0.186.1`，使用支持 ES 模块的构建器。下面是最小接入示例：

```js
import {mountLogo} from './logo-kit/logo-renderer.mjs';

const host = document.querySelector('#logo');
// host 需要可见尺寸，例如 width: 320px; height: 320px。
const logo = mountLogo(host, () => { host.textContent = '三维预览暂不可用'; });
logo.update({
  mode: 'idle', palette: 'original', seed: '#228be6',
  dark: false, paused: false, speed: 1, active: true,
});

logo.playOnce('explode');       // 散开后保持
logo.playOnce('assemble');      // 回到组合
logo.playOnce('spin', 4);       // 尾巴块旋转一圈
logo.restart();                // 恢复所选循环动作
// 页面离开时调用 logo.dispose()。
```

普通配色取 `palettes.mjs`；`palette: 'theme'` 使用传入 `seed` 派生主题色阶。纯动作采样使用 `sampleMotion(id, seconds)`，返回全部方块的位置/旋转以及整体旋转。`poseClips()` 可生成六种姿态的 Three.js AnimationClip。

渲染器自动处理后台、离屏暂停与清理；宿主应用应像设置页一样尊重 `prefers-reduced-motion`，默认传入静止，仅用户显式播放后启用动作。宿主隐藏时传 `active:false`；离开时销毁实例。

## 来源与版本

- 用户选定第 5 号阶梯 Z；13 块几何延续模型 v1.2.2。历史模型、Blender 和动画交付保持原样。
- 本目录为新增动作与复用模块的规范快照，应用副本位于 `03-Src/studio/brand/`。修改动作后同步两处并重新导出 GLB、运行验证、更新哈希清单。
- Three.js、RoundedBoxGeometry、RoomEnvironment、GLTFExporter 为 MIT 许可，见 `THIRD-PARTY-LICENSES.txt`。本包不包含或分发本机中文字体文件。
- 应用集成版本 v0.9.113；配置格式 `zhisuan-logo-preset` v1。
