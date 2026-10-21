# 最新源码审计：Astra 沙盘 v0.10.56

本文件保留固定提交的源码事实与历史记录。实施方案以 [04-IMPLEMENTATION-GUIDE.md](04-IMPLEMENTATION-GUIDE.md) 为准。

- 审计时间：2026-10-20。
- 固定仓库：zgzzmnbx/zaojia-zhisuan-astra，main。
- 固定提交：79e1418b2be169537a8cca643af61063b4350521。
- 提交时间：2026-10-20T08:52:30Z。
- 对比提交：5ff1025ca644eeb831f944c8b485df93366529e0。
- package.json 和 README 均为 UI v0.10.56。
- 本记录只读检查源码、既有测试和仓库验收文档；没有修改仓库，没有运行应用或测试。仓库中的历史验收数字不能写成本轮实测。
- 文中行号均指本提交；后续执行者先核对本地 HEAD 和工作树，不能清理用户未提交改动来追齐本提交。

## 1. 最重要的修订：旧方案中的若干“待建能力”已经存在

| 旧审计可成立的描述 | 新提交的源码事实 | 指导包应如何改写 |
| --- | --- | --- |
| 只有 RoomEnvironment，没有外部环境资产 | 已有本地 1K HDRI + PMREM，RoomEnvironment 保留为基础回退 | 优化已有环境的方向、强度和材质响应，不重复接入一个环境系统 |
| 没有模型细部的离线照度图 | 已有 Cycles 96采样、4次漫射反弹的8张区域照度图 | 调优并验收已有烘焙与实时光比，不笼统“从零加入AO” |
| 没有灰泥法线 | 已有本地灰泥法线，强度0.055、repeat 3×3 | 评估是否可见、是否过粗，不重复下载另一套整墙彩色纹理 |
| 夜航用全画面Bloom | 正式 night-renderer.js 已删除；日夜直接渲染 | 保持局部辉光，不能恢复用户已取消的全画面Bloom |
| 没有聚焦辉光 | 已有7个局部SDF平面，当前焦点独占，420ms交接 | 只微调其光宽、亮度和颜色，与材质优化分开 |
| 烘焙会在装配时留脏影，应新增隔离 | 已有装配/夜航强度0、落成450ms淡入 | 保留并回归，不再当新特性开发 |
| 质感增强需要新开关 | 视图已有“质感增强”“聚焦辉光”独立开关 | 复用既有UI和偏好，不另建第二套质量控制入口 |
| 原模型缺少倒角与材质 | 原模型本就有倒角、加权法线、瓷白/灰泥/陶瓷/石基/凹槽/玻璃分组 | 通过调光和表面分层使已有细节显现，不扩建无关建筑 |

最新实现属于“离线环境漫射光追烘焙 + 实时光栅交互”。它没有浏览器实时路径追踪、动态多次反弹或动态反射。它没有额外SSAOGTAO后处理，但已有环境漫射烘焙所形成的遮蔽与间接光，不宜简单称为“没有AO效果”。

## 2. 适用项目指令

已读取根 AGENTS.md（326行）以及 DESIGN.md 相关章节、根 README 和当前版本计划的 v0.10.56 条目。目录树中没有 studio 或 project-sandbox 下的额外 AGENTS；engine/AGENTS.md 不属于此次渲染改动范围。

重点约束：

1. AGENTS.md 3–18：DESIGN.md 是唯一UI标准；使用daisyUI与既有封装；默认只验收桌面；前端只连接同源5189；不自动推送、部署或外发消息；不得改冻结业务规则。
2. AGENTS.md 32：“本地Cycles光照与CC0环境/法线”“日间烘焙不照亮悬浮构件或夜航”“局部辉光不重绘全场做Bloom”“静止光圈不保持RAF”“第二套UV显式指定且核对非空”。
3. AGENTS.md 47–53：装配阴影逐帧同步；入场按页面生命周期仅一次；结束/中断/销毁恢复原几何、材质着色器和深度材质，清理标签透明度。
4. AGENTS.md 中“任务结束不得清空相机任务焦点”“保存值逐项优先，包括false/hidden/original”“七个建筑标题保留”“装配、染色、聚焦与任务身份独立”均须保留。
5. DESIGN.md 11–20：纸白、浅灰、主题色强调、细边框、克制渐变；对话与任务状态不由布局重置。
6. DESIGN.md 113–157：字号28/20/16/14/13/12，业务文字不小于12；主题色从token消费；文字与状态可读性优先。
7. DESIGN.md 376–408：动效单一控制器、后台/离屏停算、减少动效、加载/失败可辨、键盘可达。
8. AGENTS.md 要求每轮真正实现后运行 npm test、npm run build 和对应浏览器交互验收。当前产出指导包不是实现轮次，不应为了“验收通过”声称已运行。

后续执行者遵守当前项目工作流约束；本包不修改 AGENTS.md。

## 3. 文件与函数地图

| 文件 | 函数/行段 | 当前职责 |
| --- | --- | --- |
| package.json | 顶部及 dependencies | UI0.10.56；原生Three0.186.1、React19.2.7、Vite8.3.2，无R3F/drei |
| project-sandbox/defaults.ts | 2–11 | 默认开关、相机与持久化读取/保存；缺失值回退，显式off保留 |
| project-sandbox/ProjectSandbox.tsx | 34–37、64–68、108 | 两个光影开关、storage同步、mount回调、选项传递、视图UI |
| project-sandbox/scene.mjs | mountSandbox 30起 | 渲染场景总生命周期、灯光、资源加载、相机、装配、材质协调 |
| scene.mjs | 32–44 | renderer、PMREM、主辅光、外围地面、接触阴影、局部辉光初始化 |
| scene.mjs | ensureLighting 59–67 | 按需加载光照资源、失败降级和消息；关闭再开启允许重试 |
| scene.mjs | theme 78–94 | 基础/增强、日/夜、冷白、选中材质协调；设置焦点辉光 |
| scene.mjs | render 143–172 | 共用可见帧时间轴、装配、450ms照度淡入、420ms辉光、静止停帧 |
| scene.mjs | 205–208 | 加载lightmapped GLB；HTTP/下载失败时回退原GLB；绑定材质与几何 |
| scene.mjs | 212–221 | setOptions、focusTask、select、home、诊断state、dispose |
| materials.mjs | createSandboxMaterials 6–37 | 每区域材质克隆；主题、冷白、夜色、选中与局部任务染色 |
| lighting.mjs | loadSandboxLighting 9–35 | 本地8张照度、1张法线、1张HDR；颜色空间/UV通道/PMREM与清理 |
| lighting-materials.mjs | createLightingMaterials 4–38 | 捕获原材质值；挂载/恢复照度和法线；装配及日夜隔离 |
| focus-glow.mjs | createFocusGlow 15–69 | 7个地面SDF平面；焦点交接；深度遮挡；0帧缓冲；静止不续帧 |
| contact-shadows.js | createContactShadows | 沿用22个静态接触脚印、128²纹理、一次实例化绘制 |
| building-entrance.mjs | createBuildingEntrance 45–108 | 拆散原有刚性构件、合成染色/深度着色器、结束精确恢复资源 |
| scene-layout.ts / marker-layout.ts / marker-motion.ts | 原函数 | 聊天/右侧卡片共同安全区，持续标签坐标和避让 |
| tools/sandbox/bake-lighting.py | 14–129 | 原GLB只读；第二UV；Cycles烘焙；非空与哈希；导出副本 |
| tools/sandbox/fetch-lighting-assets.py | 全文 | 获取已指定CC0资源，保留来源和哈希 |
| 05-视觉识别/02-3D场景/lighting-v1/ | 资源目录 | 新GLB、8张照度、HDRI、法线、清单与复现文档 |

表中省略前缀的文件均位于 03-Src/studio/project-sandbox/。

## 4. 当前真实参数：基础与增强不要混用

### 4.1 渲染器与太阳阴影（scene.mjs 32–43）

- WebGLRenderer：antialias=true，powerPreference='low-power'。
- DPR上限1.5；SRGBColorSpace；ACESFilmicToneMapping。
- PCFShadowMap，1024×1024，autoUpdate=false。
- 阴影相机left/right/top/bottom为±28，near=.5，far=100。
- 主光位置(-16,32,20)，补光位置(20,18,-25)。
- 日间normalBias=.065，bias=-.0002，radius=2。
- 外围地面仍为300×300 MeshBasicMaterial，toneMapped=false。
- 外围投影另由ShadowMaterial opacity=.14承接；不能说“外围没有阴影”。

### 4.2 theme() 的日间实际值（scene.mjs 78–94）

| 参数 | 基础冷白 | 增强资源就绪且开启 |
| --- | ---: | ---: |
| 环境来源 | RoomEnvironment | 本地studio_small_09_1k.hdr经PMREM |
| 环境强度 | .22 | .18 |
| 半球光强度 | .45 | .08 |
| 补光强度 | .32 | .20 |
| 主光强度 | 3.2 | 3.0 |
| 曝光 | .80 | .84 |
| 主光阴影强度 | .85 | .72 |
| 照度贴图目标强度 | 原材质值 | .85 × settle |

主光日间冷白色0xf3f8ff；暖白选项0xfffbf5。补光为0xe2edff。不可将截图偏平直接归因为“缺环境光”，也不可照搬基础参数评价增强画面。

### 4.3 材质与法线（materials.mjs；lighting-materials.mjs 17–36）

- Porcelain white冷白线性RGB=[.83,.89,.97]。
- Warm plaster冷白线性RGB=[.86,.91,.98]。
- 增强法线只赋给Warm plaster、Porcelain white、Limestone foundation。
- normalScale=(.055,.055)；纹理repeat=(3,3)。
- 增强Frosted blue glazing粗糙度=.24，Ceramic trim=.32。
- 其余粗糙度沿用原材质。
- 夜航仍可用增强HDR和表面法线，但日间照度lightMapIntensity=0。
- 装配时lightMapIntensity=0；落成后450ms至.85。
- 关闭增强恢复捕获的roughness、normalMap、normalScale、lightMap、lightMapIntensity。

材质执行顺序是：GLB加载 → createSandboxMaterials按区域克隆 → createLightingMaterials捕获克隆后的原值 → theme先应用基础主题/局部染色，再应用增强材质。后续调色必须遵循此顺序，不能在随机mesh上临时改色后指望主题切换保留。

### 4.4 聚焦辉光（focus-glow.mjs）

- 7个固定footprint，不包含楼顶雕塑与长管线。
- 每个平面比footprint宽高各增加2.4世界单位。
- haze=exp(-abs(d)*4.2)*.44。
- core=exp(-d*d/.005)*.56。
- day alpha系数=.64，night=.70。
- 420ms线性交接；深度测试保持默认开启，depthWrite=false，toneMapped=false。
- 自定义着色器末尾已有colorspace_fragment。
- 无renderTarget，稳定仅当前建筑一个平面可见；交接期新旧两个可见。
- 减少动效直接至目标；装配阶段全部隐藏。
- configure焦点来自selected || taskTarget；任务结束保留taskTarget，返回全景退出。
- getState().visible[].opacity是entry.value（0–1过渡），不是最终材质alpha；最终还乘.64/.70。

## 5. 资源和烘焙边界

源码事实：

1. 即使增强开关关闭，也优先加载 sandbox-lightmapped.glb（9,847,828 bytes）；原GLB（6,917,092 bytes）是下载失败回退。开关不替换几何。
2. 光照资源在增强开启时ensureLighting加载；8张照度并行，法线和HDR并行，Promise.allSettled等待全部结束后统一清理失败资源，避免晚到纹理泄漏。
3. 7栋建筑照度1024²，地块2048²；照度flipY=false，channel=1，SRGBColorSpace；最大各向异性4。
4. 贴图是环境直接+间接漫射照度，不烘焙表面颜色、不烘焙太阳。
5. 第二套UV名BakedLight，明确传给bpy.ops.object.bake(...uv_layer='BakedLight')；输出GLB包含TEXCOORD_1。
6. bake脚本保留原zone、材质名和三角形，只增加UV及接缝顶点；烘焙后恢复原共享材质身份。
7. 检查linearMax>.1和litFraction>.1；保存8张区域图哈希及输入源GLB哈希。
8. 代码自带缺uv1模型降级：不赋lightMap，但法线/环境可继续。
9. 原三维源工程与原GLB不覆盖；新资产目录lighting-v1保存本轮副本。
10. 所有运行资源均同源本地，CSP不为材质优化放宽。

清单记录：8区域共183748个三角形（应以执行者读取GLB再次核对，不能以手工相加替代验收）。原材质/模型脚本已有真实倒角与加权法线，本轮主要应聚焦光比、微表面和少数强调材质。

## 6. 失败路径和诊断：避免写出无效验收

### 6.1 三种失败不是同一条路径

- 新GLB下载/HTTP失败：scene.mjs 206回退原GLB。
- 新GLB下载成功但parseAsync失败：到208整体沙盘加载失败，不走原GLB回退。
- 照度/HDR/法线任一加载失败：lighting.mjs统一清理，scene.mjs lightingStatus='fallback'，显示基础画面；切换增强off→on会把fallback重置idle允许重试。

前两条是当前代码事实。若指导包认为“损坏GLB也必须自动回退”，应明确列为新增鲁棒性修复并设计针对性验证，不能声称已经具备。

### 6.2 现有诊断的语义

scene.mjs 220暴露容器__sandboxState()：

- lighting.enabled：用户开关。
- lighting.status：idle/loading/ready/fallback。
- lighting.lightmapped：绑定了lightMap的材质数。
- bloom.mode='local-ground-glow'，scenePasses=1，renderTargets=0。
- textures、triangles、drawCalls、frames、shadowDraws、pending。
- entrance、selected、taskTarget、paint、flow、orbit等。

重要：夜航和装配只是lightMapIntensity归零，lightMap仍绑定，因此lightmapped可能仍为60。不能用“lightmapped===0”验收夜间隔离。需要检查实际强度或画面对照；若需要更可靠自动检查，可以在只读诊断加activeLightmapped/intensity范围，不能改业务状态来方便测试。

稳定辉光不请求新帧，但flow、orbit、运行beacon等仍可合法续帧。测试停帧前必须显式排除这些驱动，不把信息流开启后的连续渲染当辉光泄漏。

## 7. 性能事实与历史记录

源码事实：

- 仍为单次renderer.render(scene,camera)，没有EffectComposer。
- 所有新微表面/照度与既有材质复用，不增加React逐帧状态。
- 阴影缓存保留；装配每帧needsUpdate，落成静态。
- 条件续帧同时覆盖装配、辉光过渡、照度淡入、染色、相机、环游、信息流、标签和任务beacon。
- dispose取消事件、观察器、RAF、几何/材质/深度材质/光照贴图/PMREM/renderer并释放context；异步资源完成后仍检查disposed。

仓库历史验收（00-docs/handoff/2026-10-20-沙盘光影增强验收.md 14–20）：

- 主目录348项、活动工作区346项测试，两处构建通过。
- 1489×993桌面、同一智能填价聚焦、信息流开启：增强+局部辉光约59.95FPS，p95帧间隔16.8ms；关闭二者约58.40FPS，p95 16.9ms。
- 稳定辉光69 vs关闭68次绘制，单场景pass，无后处理目标。
- 夜航关信息流、镜头停稳后900ms新增0渲染，pending=false。
- 首次入场115个有效装配采样帧，落成约4001ms，60个材质加载成功。
- 最终保留用户染色40%、34°/85%/135%、白模Logo、浅灰外围与已保存偏好。

这些只是既有文档中的短时同设备样本；没有普适帧率承诺，也不能推导“增强反而更快”。后续视觉升级需在同一机器、尺寸、任务、镜头和相同信息流/环游设置下重新对比，兼顾冷加载成本与稳定状态。

## 8. 既有测试能力与应保留回归

### 8.1 新专项 tests/sandbox-lighting.test.mjs

| 行 | 覆盖 |
| --- | --- |
| 11–35 | 辉光交接、关闭、减少动效、装配隐藏、静止false、单pass/0targets、销毁 |
| 48–59 | 分区域照度隔离；关闭增强恢复材质；几何不重建 |
| 60–77 | 夜航/装配强度0；染色与装配shader叠加；落成450ms到.85 |
| 78–83 | 缺uv1旧模型不误绑定照度 |
| 88–105 | 原/新GLB三角形和zone一致、TEXCOORD_1、96采样清单、源哈希、8份非空且各自不同 |

若未来有意调整.055或.85等视觉参数，可同步由统一配置驱动测试；不能只改数值断言而丢失“分区隔离、关闭可复原、装配夜航隔离、无新增渲染循环”等行为检验。

### 8.2 tests/sandbox-materials.test.mjs

- 19–68：刚性构件识别跨UV接缝不拆绘制批次、染色与深度shader组合、结束仅清理一次、减少动效/导航即时完成、页面仅一次。
- 70–96：共享GLB材质按楼隔离、反复选中不累计染色、冷白可逆且不改变夜色。
- 97–140：不确定进度只走可见时间、完成前不染满、历史不重播、重试仅当前楼、失败/取消冻结、减少动效不模拟推进、job与对话隔离。

### 8.3 tests/project-sandbox.test.ts

- 16–50：右侧实测宽度与相机/标签共享安全区；当前任务金额、匹配、风险和成果边界。
- 51–100、187–204：运动时标签不重新打包、悬停/键盘锁定、拥挤先收次状态、位移不累积。
- 114–169、205–244：真实阶段身份、失败/取消、未知百分比、空闲环游门禁和显式off。
- 254–337：聚焦建筑/详情共用安全区，背景标签自然隐藏、余量恢复、持续坐标/连续中断、退出画布再隐藏。
- 338–361：帧率计量、玻璃偏好、简约/经典/沙盘身份独立。

### 8.4 其他

- sandbox-view.test.ts 39–62：保存相机覆盖默认、false/hidden有效、染色0有效。
- group-logo.test.mjs：白模/原色/隐藏、镂空、夜间轮廓、首次默认白模可见、位置和几何保留。
- 真实浏览器仍需检查：增强关闭→开启、日夜→日、装配中断、连续快速切楼、任务完成后保持近景、全景退出、键盘焦点、聊天草稿、资料/表格/报告仍可达、离开再进无资源累计。
- 数据业务回归只读投影或独立测试副本；不为画质验收擅自触发真实匹配、报告生成、外部派发或Watch消息。

## 9. 事实、推测与建议分开

### 已确认且仍可作为优化入口

- 大面积白色线性基色接近，主题冷白覆盖仍在materials.mjs中。
- 外围MeshBasic与背景同色，不响应灯光渐变；另有投影层。
- 阴影图1024、覆盖56世界单位，normalBias=.065。
- 照度烘焙使用均匀中性冷白天空；微表面局部差异主要由法线/粗糙度而非彩色纹理表现。
- 当前玻璃是名为Frosted blue glazing的既有材质，增强只把roughness调整至.24；未见新开transmission/动态反射系统。
- 局部辉光已经明显聚焦语义化，不应转成整个园区常亮描边。

### 待同镜头画面验证的假设

H1. 大面积白色基色、照度填充与ACES压缩共同影响顶/侧/凹槽灰阶分离。必须固定曝光、相机做分项对照，不能凭代码断言某值错误。
H2. 1024阴影覆盖56单位约.055单位/texel，模型细槽约.01–.075，normalBias=.065与小构件接近；细部投影可能被采样或偏移弱化。先试收紧阴影边界/局部2048对照，再决定，不直接拉4096。
H3. 现有微法线是否足够可见、是否造成粉化，取决于截图倍率和照明方向。优先改善高光方向，不随意加粗法线。
H4. 焦点光圈若显得过亮，降低现有alpha/core/halo宽度即可；不需要追加另一套辉光引擎。

### 本包已确定的实施边界

最终路线见 [技术实施方案](04-IMPLEMENTATION-GUIDE.md)：精修现有光照系统，按完整原刚性组件区分白色管罐涂层；不默认新增 AO、全屏 Bloom 或渲染引擎。C 仅作用于储罐/管道局部，不扩大到整个地台与建筑。所有候选参数未实测。

最新交叉审查补充：材质拆分会改变 mesh / primitive 边界，而现有 assembly 按单 geometry 识别组件。静态几何不变不足以证明动画不变；必须核对原组件、局部属性、实际 zone bounds、aAssemblyMotion 与选中/标签行为。完整规则见技术方案第5节及资产验收 A01—A08。

## 10. 永久源码链接

所有引用以固定提交为基线，根地址：
https://github.com/zgzzmnbx/zaojia-zhisuan-astra/tree/79e1418b2be169537a8cca643af61063b4350521

- [AGENTS.md](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/AGENTS.md)
- [DESIGN.md](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/DESIGN.md)
- [scene.mjs](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/03-Src/studio/project-sandbox/scene.mjs)
- [lighting.mjs](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/03-Src/studio/project-sandbox/lighting.mjs)
- [lighting-materials.mjs](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/03-Src/studio/project-sandbox/lighting-materials.mjs)
- [focus-glow.mjs](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/03-Src/studio/project-sandbox/focus-glow.mjs)
- [光照资源README](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/05-视觉识别/02-3D场景/lighting-v1/README.md)
- [专项测试](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/tests/sandbox-lighting.test.mjs)
- [既有验收记录](https://github.com/zgzzmnbx/zaojia-zhisuan-astra/blob/79e1418b2be169537a8cca643af61063b4350521/00-docs/handoff/2026-10-20-沙盘光影增强验收.md)

