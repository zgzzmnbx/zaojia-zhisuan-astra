# 技术实施方案：在 v0.10.56 上精修 A 整体 + C 局部

**这是待执行设计，不是已运行的补丁。** 事实基线见 [源码审计](02-CODE-AUDIT.md)，视觉目标见 [视觉规格](03-VISUAL-SPEC.md)，来源索引见 [参考资料](07-REFERENCES.md)。本文中的新增模块、接口与数值均须由执行者对当前仓库适配。

## 1. 先决定什么不需要重建

当前链路已经是：

```text
原生 Three.js WebGLRenderer
  + Cycles 离线环境漫射照度（8区）
  + 本地 HDR → 一次 PMREM
  + 现有 PBR 材质、灰泥法线
  + 一盏主光与缓存 PCF 阴影
  + 原有局部聚焦辉光
  → 单次场景 render → ACES → sRGB 输出
```

本次主要解决：白色大面层次不足、不同表面响应过近、圆柱高光不够清楚，以及可能的阴影采样/偏移问题。先做同镜头验证，不把代码中某个数值直接判定为错误。

主路线不新增屏幕空间 AO、全屏 Bloom、景深、反射追踪或实时路径追踪；不迁移渲染框架。已有烘焙用光线追踪离线计算环境照度，网页运行仍是实时光栅渲染。两者分工足以作为此次优化的起点；是否达到目标要看真实运行画面。

## 2. 改哪些文件，在哪里改

以下不带目录前缀的运行文件都在 `03-Src/studio/project-sandbox/`。

| 文件/函数 | 本轮动作 | 保护边界 |
| --- | --- | --- |
| `scene.mjs` / `theme` | 使用统一的增强日间光照参数；协调基本主题、旧增强、新角色覆盖 | 唯一 renderer 与 RAF；夜航；相机、业务状态与回调 |
| `scene.mjs` / 模型加载 | 有角色派生 GLB 时按候选顺序加载并验证；成功后一次性接入场景 | 不在用户交互后悄悄替换整场模型 |
| `materials.mjs` / `createSandboxMaterials` | 保存基底材质身份；原有冷白/夜航/选中判断读取基底身份 | 每区域隔离；不累计着色；原 paint.attach 顺序 |
| `building-paint.mjs` / `attach` | 将材质资格判断改为可接收基底身份的兼容接口 | 四类原材质的资格、空间染色范围、进度语义均不变 |
| `lighting-materials.mjs` | 完整快照/恢复；先应用旧增强，再应用日间角色覆盖；统一 GI 终值 | 不替换材质对象、不覆盖 shader hook、不释放共享纹理 |
| `lighting.mjs` / `loadSandboxLighting` | 默认复用现有资源；只有 UV/贴图变更时才调整资源组 | 同源；一次 PMREM；颜色空间；Promise.allSettled 清理 |
| `building-entrance.mjs` | 主路线不改动画算法；新增资产必须证明原刚性组件未被拆开 | 顶点/深度 shader 组合、同帧阴影、结束精确恢复 |
| `focus-glow.mjs` | 第一轮保留；确有泛白时只微调原光圈参数 | selected/taskTarget 语义、420ms交接、无常驻 RAF |
| `ProjectSandbox.tsx` / `defaults.ts` | 复用原入口和偏好；必要时只补内部诊断 | 不加重复控制项、不重置保存值、不重挂载聊天/场景 |
| 建议新增 `render-profile.mjs` | 导出命名参数与 GI 终值；纯数据 | 不读写偏好、不遍历场景、不启动定时器 |
| 建议新增 `surface-identity.mjs` | 解析基底材质和表面角色；旧模型回退原语义 | 不凭颜色或编号猜管道/储罐 |
| 建议新增 `tools/sandbox/assign-surface-roles.py` | 在发布 GLB 副本上做语义分材质及不变性验证 | 不覆盖原 Blender/GLB，不重新造场景 |

不要为本次改造全面重构。当前 `tools/build-astra.mjs` 会逐项读取 `project-sandbox` 根目录做来源哈希；新增小模块直接放该目录根部。若新建子目录，须先适配构建读取逻辑，否则可能在 readFileSync 处失败。

## 3. 第一轮布光：先让形体出现

### 3.1 参数候选

以下是**未实测的起点**，结构化副本在 [look-proposal.json](specs/look-proposal.json)。第一轮保留现有冷白基色、曝光、输出转换与画布 DPR，以便判断光比效果。

| 参数 | 当前增强日间 | 第一轮候选 | 观察目的 |
| --- | ---: | ---: | --- |
| 主光位置 | [-16,32,20] | [-18,28,20] | 略降低高度，让楼板下、罐体侧面可读 |
| 主光颜色 | 冷白 #F3F8FF | 保留 | 不同时改变白平衡 |
| 主光强度 | 3.0 | 2.8 | 给亮面保留转折 |
| 补光强度 | .20 | .14 | 减少背光面被补平 |
| 半球光强度 | .08 | .06 | 避免与烘焙环境照度重复填充 |
| 环境强度 | .18 | .20 | 支持曲面高光；须与粗糙度一并检查 |
| 曝光 | .84 | .84 | 第一轮控制变量 |
| GI 终值 | .85 | .80 | 保留反弹，观察是否减轻过度填充 |
| 阴影强度 | .72 | .78 | 加强落地感，防止接触处过黑 |
| 阴影图 | 1024² | 1024² | 先改善有效覆盖 |
| normalBias | .065 | .035（视锥校准后试） | 减少阴影与设备底部脱离；同时检查自阴影斑点 |
| bias / radius | -.0002 / 2 | 暂保留 | 不同时改变所有阴影变量 |

**场景级属性也必须恢复。** 当前 sun.position 只在初始化设置，theme 不会自动还原新灯位。此次若调整灯位，scene.theme 每次应先恢复原主光位置 [-16,32,20]、原 target，以及本轮实际改动的环境方向、阴影范围/尺寸等场景属性，再只在增强日间应用新 profile。夜航、增强关闭和资源失败要回到各自原状态，不能只恢复材质而遗留新光方向。灯位/方向实际改变时重算适用的固定阴影视锥并标脏；若试验过 environmentRotation，也须记录与恢复。日间增强之外的阴影范围默认仍按基线处理。

主光方向以真实默认机位下的画面为准，世界坐标“左上”不必等于屏幕左上。整体目标是一个明确主方向，而不是多个强光相互冲淡。

每轮只修改一个因素组。先固定曝光看主/辅光，再看材质；若白墙仍爆亮，不通过继续提高 emissive 补偿。现有冷白 `setRGB` 输入是线性值，不能拿 CSS 颜色数字直接替换。

### 3.2 背景与地台

保留用户选择的地面色调：现有 `gray` 为浅灰 `#dfe3e8`，另有雾白/冰蓝/暖白。以当前保存值验收，不能强制把用户偏好重置为某个截图模式。

外围 `MeshBasicMaterial` 不受光，但有独立 `ShadowMaterial` 承接投影；模型内地台另有材质。第一轮保留外围这套分工，先让模型地台、主体、背景的明度和接触关系分开。不要直接把 300×300 外围平面换成低粗糙度 PBR 地面，造成大面积镜面、高亮或背景接缝。

确有证据表明外围仍显平，可在原结构上做克制的背景明度协调；凡新增受光地面，必须检查其与背景交界、原投影层是否重复加黑、日夜/增强关闭的恢复。C 图中的镜面地板与云状背景不属于目标。

## 4. 材质目标：白色可以有不同表面

| 基底语义 / 日间角色 | roughness 候选 | metalness | normalScale 候选 | 目标 |
| --- | ---: | ---: | ---: | --- |
| Warm plaster / 原建筑 | .76 | 保留原值（当前0） | .030 | 干净的哑光建筑墙面 |
| Porcelain white / 原建筑 | .66 | 0 | .025 | 比灰泥稍细腻，仍是建筑模型 |
| Porcelain white / coated-tank | .34 | 0 | 0；移除灰泥法线 | 圆柱上连续而柔和的高光带 |
| Porcelain white / coated-pipe | .42 | 0 | 0；移除灰泥法线 | 管壁、弯头与法兰清楚，略有缎面反光 |
| Limestone foundation / 原基底 | 第一轮保留资产值 | 保留 | .025 | 哑光承托与接触层次 |
| Ceramic trim | 保留增强值 .32 | 保留 | 保留原行为 | 屋檐/细边清亮 |
| Frosted blue glazing | 保留增强值 .24 | 保留 | 保留原行为 | 少量浅蓝表面响应 |
| Astra blue / Blue river / Cool shadow / Architectural recess | 第一轮保留 | 保留 | 保留 | 控制变量，保护状态与空间层次 |

“设备是金属”与“最外层白色涂层怎样反光”是两个问题。第一轮用非金属白色涂层形成 C 的曲面质感，不需要把储罐全部变成镜面铬。少量裸露银色连接件可在白色涂层方案通过后考虑，前提是其语义可靠、原刚性组件无需拆开且有明确视觉收益。**裸金属不是本轮必做项。**

不同 roughness 在同一环境下决定高光宽窄；环境方向、光源形状与曲面法线共同决定能否看见高光。只降低 roughness 而不检查环境，可能得到黑色反射或刺眼白线。若高光位置不理想，单独试验固定 HDR 方向的 0°/±30° 对照；选定后固定，不做自动旋转环境。

## 5. 可靠地把“建筑白”与“设备白”分开

### 5.1 为什么不能直接按材质名改

`build_scene.py` 中建筑、罐体和管线复用 `Porcelain white`。运行时按区域克隆只能防止不同楼串色，不能把同一区域中的楼墙与设备自动分开。另一方面，`building-paint.mjs` 的资格白名单和 `materials.mjs` 的冷白/夜航判断依赖原材质名称。直接重命名会让设备失去原有状态表现。

角色语义与可验证的分类证据必做。先用当前 GLTFLoader 检查最新模型；若已有可信、兼容的角色数据，则复用并验证，不重复生成资产。本包所审阅基线尚无专用角色运行实现，预计需要下述派生路线。仅在实际修改资产时完整执行派生/不变性检查；跳过项要说明已有证据。

因此角色材质必须同时保存：

- `astraBaseMaterial`：原始基底语义，例如 `Porcelain white`。
- `astraSurfaceRole`：本轮角色，例如 `coated-tank` 或 `coated-pipe`。
- manifest 中的来源 primitive、原刚性组件、匹配证据与输出归属。

尽量保留原 material.name；角色通过 extras 补充，不靠名称后缀识别。`astraBaseMaterial` / `astraSurfaceRole` 必须写在 glTF.materials[].extras 并用锁定版本 GLTFLoader 验证 material.userData；primitive.extras 不会自动成为材质元数据。原 side、alphaTest、透明/裁剪等可见性与交互语义保留。

`zone` 继续从 mesh / 父链的 `userData.zone` 读取。它是场景业务身份，不能从可能共享的材质上猜取。

### 5.2 主路线：以原刚性组件为最小单位分材质

**不能只验证静态三角形相同。** 当前 `assemblyComponents()` 在每个 mesh.geometry 内识别连通组件。若把同一个原刚性组件拆进两个新的 primitive，入场动画会分别算中心、高度、位移与开始时间，可能把一件设备拆开飞走。

本包选择较小的路线：

1. 从已发布 `lighting-v1/sandbox-lightmapped.glb` 读取真实基线，记录 zone、原 primitive ID、世界空间几何、法线、UV0、UV1，以及按当前 entrance 同样算法识别的组件。
2. 只读加载现存 `white-sandbox.blend`，利用被明确命名的源对象提供语义证据；必须先证实它们与当前发布 GLB 匹配。
3. 将角色命中提升到**整个原连通组件**。只有该组件中全部目标面一致属于一个可靠角色，且没有混入楼墙/其他业务构件，才可赋角色。
4. 按 `zone + sourcePrimitiveId + role` 重新分材质批次。允许把一个原 primitive 中的多个完整独立组件分到不同角色批次；不拆单个原组件，不跨来源 primitive 合并。
5. 输出新 GLB 后重新运行组件识别，核对组件数量、每组件世界几何、包围盒和实际装配位移/开始时间等价。导出器可能重排、拆分或合并 primitive，不能仅相信导出前的数据。
6. 与建筑混合、来源不明或匹配歧义的组件维持原材质并记入报告；不能扩大坐标盒子，把相邻墙体一起涂成管道。若这使目标仍未达到，继续定位可靠映射，不能把 C 目标标为通过。

主路线无需新建 PBR 遮罩 shader，也无需修改原装配算法。若必须拆单个原组件，应单独设计并验证跨 primitive 的原组件 ID 与共同动画参数；这属于范围扩展，不能作为未经验证的默认捷径。

### 拆分时的额外硬性约束

- `sourcePrimitiveId` 包含原 node instance、原 glTF mesh index、原 primitive index。局部序号或同名材质不够，不能误合不同节点实例。
- 以生产 GLTFLoader 载入 v1 后的 `assemblyComponents` 结果为起点，保留原局部 POSITION 浮点值、原变换和当前 1e-4 坐标量化连接关系。该量化网格不是允许移动几何的误差额度。
- 每个新 primitive 根据显式“原顶点→新顶点”映射复制其实际需要的全部属性，包括 NORMAL、UV0、UV1、TANGENT（含方向符号）、COLOR 与其他已有属性，并重映射索引、保留绕序与重复三角形。
- 不让新 primitive 共享整楼 POSITION 后只换 indices。现有算法会遍历未被索引引用的顶点，产生幽灵组件。若 v1 自身有未引用顶点，先核对其原行为，不能擅自清理；无法保真则不拆该 primitive。
- 不焊接、重新量化、简化、重算法线或烘焙节点变换。Blender源工程可提供语义证据，目标发布GLB的属性尽量直接复制；工具导出成功不代表等价。
- 重新导入 v1/v2，直接运行当前 createBuildingEntrance，比较临时 aAssemblyMotion 的世界位移与start、grounded顶点集合、每楼parts/end和总total。tick 每次最多推进50ms，不能用一次大delta伪造中间时刻。
- 原算法按每mesh的 Box3 合并 zone bounds。旋转/缩放节点拆批后，即使世界三角形没变，实际 AABB 也可能改变，从而影响装配和聚焦；必须用生产算法比较，失败则保留原 primitive，不伪造 accessor min/max 或 geometry bounds。

### 5.3 语义来源白名单

源码中的候选源对象如下；当前 `.blend` 是否包含同名 evaluated geometry 必须实际读取确认。Blender 自动编号后缀仅在源对象名单匹配时规范化。

| 对象基名 | 预期 zone | 目标角色 |
| --- | --- | --- |
| White pressure vessel / Vessel dome | price | coated-tank |
| Plant connection / Plant connection flange | price | coated-pipe |
| Cross-river pipeline / Cross-river pipeline flange | risk | coated-pipe |

罐缝、蓝色身份带、管鞍、栏杆、底座、楼体、楼顶业务雕塑不自动纳入。最终归属以当前 GLB 的实际 zone 和组件证据为准。

建议匹配三角形世界坐标并校验法线方向、源材质与 zone；不能仅按中心最近距离匹配薄壁。可从 `1e-4` 场景单位的位置容差起步，最终容差要相对模型尺度、最小结构间隙及导出误差校准，并记录最大误差。容差不是“允许移动几何”的额度。

不要依赖单一量化哈希决定匹配。网格量化边界可能导致相同点进入相邻桶，应在候选查找后逐点验证；两个以上可能对应视为歧义。法线、UV 使用各自合适的误差规则，不拿世界坐标容差直接套 UV。

### 5.4 不变性验证与资产输出

建议目录为 `05-视觉识别/02-3D场景/lighting-v2/`，保存派生 `sandbox-surface.glb`、`surface-manifest.json` 和验证报告。原 `white-sandbox-v0.1.0` 与 `lighting-v1` 保持可回退。

验证至少包括：

- 原/新规范化光照区域集合：`ground/import/knowledge/price/report/review/risk/table`；七区业务身份与坐标不变。这里不是要求八种原始 extras.zone：原 land 节点没有 zone，现加载器把已识别的地块缺省归为 ground。建筑七区必须沿父链保有真实 zone，不能把丢失 zone 的建筑当 ground。
- 每个 zone 的世界空间三角形多重集合一致；不要只比较总三角形数或 AABB。
- 每个对应三角形的顶点位置、法线、UV0、UV1 和朝向一致；接缝引起顶点复制允许，形状变化不允许。
- 原组件未被拆散/合并；每组件的世界边界、派生动画参数一致；首次入场与中断路径实际观察通过。
- 原材质属性在离线输出时保持基线，角色效果由运行时增强开关启用，因此关闭增强可以恢复。
- 输出导入后的 glTF extras 被保留、角色覆盖数与预期一致、未知角色为 0；未匹配或混合组件有清单。
- 原/新 primitive 数、材质数与实际 draw calls 记录差值。几个角色不等于固定增加几个 draw calls，不能承诺“最多+3”而不看实际模型。
- 所有输入/输出 SHA256、工具版本、容差、验证结果写入 manifest。

如果 UV1 与原版完全一致，v2 角色 GLB 可显式复用 v1 的八张照度图，并把这一依赖和 UV 指纹写进 manifest。不要无意义复制和重烘焙。

若改变 UV 或做重烘焙，新 GLB 与对应八区贴图作为完整、版本化资源组一起验收和加载；不能混用新 UV 与旧图。HDR/normal 可复用原本地资产，引用关系须明确。

## 6. 材质身份、覆盖顺序与完整恢复

建议兼容接口，名称是提案：

```js
function surfaceIdentity(material) {
  return {
    baseName: material.userData?.astraBaseMaterial ?? material.name,
    role: material.userData?.astraSurfaceRole ?? 'base'
  };
}
```

`base` 表示保留原基底语义，**不表示所有未标记物体都是建筑**。水道、玻璃、蓝色、地面继续按其原材质名处理。

运行顺序：

1. 加载验证后的 GLB。
2. `createSandboxMaterials` 按 source material + zone 克隆，保留 userData/基底身份；原 paint.attach 接收可选 baseName，旧调用仍兼容。
3. `createLightingMaterials` 捕获所有将被增强层修改的属性。
4. `theme` 先恢复并应用原冷白/夜航/选中颜色；增强层再处理物理属性、法线和照度。
5. `entrance` 继续包装原 onBeforeCompile 与 customProgramCacheKey，并在结束时恢复。
6. 选中/主题/开关改变时更新同一组对象，不重新创建材质或整个场景。

### 6.1 状态矩阵

| 状态 | 基本主题与颜色 | 增强表面 | 日间 GI |
| --- | --- | --- | --- |
| 增强关闭或资源失败 | 原冷白/原色/夜航逻辑 | 完整恢复原 GLB 属性 | 恢复原材质值，通常无 lightMap |
| 增强开启、日间稳定 | 原主题 + 原选中/任务语义 | 先应用原增强，再覆盖本轮 A/C profile | 当前 profile 终值 × settle |
| 增强开启、日间装配 | 同上，原装配 shader 工作 | 本轮表面可保留 | 0 |
| 增强开启、落成淡入 | 同上 | 本轮表面 | 原 450ms 渐入当前终值 |
| 增强开启、夜航 | 原夜航主题 | 保留 v0.10.56 原夜航增强行为；不叠本轮日间 A/C 参数 | 0 |
| 聚焦辉光关闭 | 以上各状态照常 | 不受影响 | 不受影响 |

保留原夜航增强行为意味着 HDR/法线及原玻璃/陶瓷粗糙度按旧逻辑处理，角色基底仍可识别为原 Porcelain；不是在夜间一律移除所有增强纹理。

### 6.2 属性所有权

- `materials.mjs` 管基底颜色、emissive、选中/夜航/任务相关语义。增强层不要在它之后用加载时 color 快照把当前主题覆盖掉。
- `lighting-materials.mjs` 管 roughness、metalness、normalMap、normalScale、lightMap、lightMapIntensity；若修改 envMapIntensity、clearcoat、其他贴图或字段，也必须同步捕获/恢复。
- 贴图原对象引用与向量值要正确保存；不能把可变 `normalScale` 引用当成不可变快照。
- 每次根据状态从基线计算目标，避免重复点击使数值累加。
- 贴图有无、通道或 shader 特性改变时才标记 `needsUpdate`；roughness/强度等常规标量不应每帧强制重编译。
- UV 能力须覆盖所有复用同一材质克隆的几何；不能只用第一个 mesh 的 hasUv1 决定后续全部 mesh。

GI 终值必须统一用于 `apply`、`setAssembly`、`tick`，不留一处 .85、一处 .80。原 450ms 计时、可见时间上限和减少动效逻辑保留。

## 7. 阴影：先校准范围和偏移

当前是 PCF 1024、相机横纵范围各 56 世界单位、normalBias .065。细部是否被采样/偏移抹掉，需要固定近景验证。优先：

1. 用主光视角计算投影物与必要接收区域，不把整块 300×300 外围地面都纳入阴影相机。
2. 合并 GLB、真实投影 Logo、投向地面的影子，以及装配时最大可能位移；仅包住静态模型会裁掉悬浮构件或落在外侧的阴影。
3. **第一轮用一个固定包围体同时覆盖稳定与装配状态**，在模型/主光改变时重算，不跟随用户相机每帧移动。
4. 装配位移应从实际算法或生成的 aAssemblyMotion 推导，并覆盖 hover 的峰值；不能把仅供理解的“向上约3.1”当精确最大值。求 light-space near/far 时检查正值和朝向。
5. 修正投影矩阵并按现有 renderer.shadowMap.needsUpdate 协议标脏；不要额外关闭灯的更新门禁后忘记唤醒。
6. 在固定范围下试 normalBias .035，检查麻点与漂浮两种失败；偏移正确后再评价柔边。

当前 theme 会无条件标记 shadowMap.needsUpdate；若此次收口改为只在灯光/阴影设置、投影对象或装配状态实际变化时标脏，应明确记录这一代码变更并保留首次初始化更新。不能把“材质改动不重画深度图”误写成基线已完全做到的事实。

装配时继续每帧更新深度图，结束后恢复静态缓存。相机移动、选中颜色、roughness 改变不等于物体/太阳改变，不应重绘静态阴影。

如果单套固定范围导致仍无法接受的细节，再做 2048 或稳定/装配两套范围的独立对照；前者检查帧耗，后者检查切换时跳影。只保留证据支持的一项，不同时堆高分辨率和模糊半径。

## 8. 烘焙与色彩管理

现有烘焙是中性环境的直接+间接漫射照度，关闭表面颜色和太阳烘焙；主光方向由网页实时灯负责。第一轮沿用。

只有实际看到接缝、漏光、脏边或管罐 UV 岛分辨率不足时才改烘焙。先查 zone/UV1/channel/flipY，检查**有效 UV 岛内部**的照度，而不只看整图最大值。若 UV 岛太小，改善 UV 利用率或仅对问题区域试更高分辨率；只有确认采样噪点才提高 Cycles samples。更高采样不能修复 UV 错误。

当前颜色管理约定：

| 输入/输出 | 当前正确含义 | 本轮要求 |
| --- | --- | --- |
| 八张照度 PNG | 线性照度被编码成 sRGB PNG | 保持 SRGBColorSpace 解码一次、flipY=false、channel=1 |
| 灰泥法线 | OpenGL 法线数据纹理 | NoColorSpace；不做 gamma；只给合适角色 |
| HDR | HDRLoader 高动态线性环境 | 一次 PMREM，不转成 sRGB 或逐帧重算 |
| material.color.setRGB | 当前显式线性 RGB | 新值标明空间，不能与 CSS 数字混用 |
| 输出 | ACESFilmic + SRGBColorSpace | 保持唯一色调映射/输出转换 |
| 局部辉光 | 现有 toneMapped=false + colorspace_fragment | 不再手动做第二次 gamma |

这里“PNG lightMap 使用 sRGB”由该项目的实际编码决定，不是所有 lightMap 的普遍规则。不能一边在线性烘焙里应用 ACES/曝光，一边网页再应用一次。新增 roughness/mask 等数据纹理同样不应标 sRGB。

## 9. 模型加载、回退与资源所有权

当前事实：v1 GLB **下载/HTTP失败**会回退原 GLB；`parseAsync` 失败会进入整体沙盘加载错误。光照纹理失败另走增强 fallback。不要把这三种行为混写为已经存在的全自动回退。

如果接入新角色资产，本轮应补齐有界的候选加载：

```text
v2 角色 GLB：下载 → 解析 → 必需结构/角色验证
失败后释放部分资源
  → v1 lightmapped GLB：下载 → 解析 → 验证
失败后释放部分资源
  → 原 GLB：下载 → 解析
所有失败 → 原沙盘错误入口/经典视图仍可达
Abort/场景已销毁 → 终止，不继续下一候选
```

这是有新资产时需要实现的鲁棒性动作，不是对现状的描述。只有完整模型验证成功才挂入场景并创建 controllers；成功后不再后台替换。旧模型回退可用，但验收报告须注明 C 角色未加载，不能给它判完整视觉通过。

资源责任：

- scene：renderer、controls、观察器/事件、唯一 RAF、基础环境和 PMREM 生命周期。
- lighting bundle：增强环境 renderTarget、8张照度与法线；一次成功后本场景复用。
- material controller：引用共享纹理，恢复引用；不自行 dispose 共享纹理。
- entrance：只释放临时几何/depth material，先恢复原对象与 shader。
- 模型：当前成功模型统一释放；失败候选不能残留几何/材质/纹理。

卸载沿原协议：标记 disposed、结束装配、取消请求与 RAF、解除事件/观察器、恢复材质引用、释放 lighting 与场景资源、销毁 renderer。保留 Promise.allSettled 等待后统一清理，PMREM 在途处理结束后再释放；晚到回调不能重新挂回旧场景。

增强关闭不销毁可复用的已加载资源，重新开启不重复下载或重建整个场景。首次资源失败仍可通过原 off→on 入口重试。业务界面沿用简短降级说明，UV/hash 等细节只写开发诊断和报告。

## 10. 帧调度与状态兼容

新材质配置本身不产生动画。继续让现有 `request/render` 统筹装配、GI淡入、辉光交接、染色、相机、标签、信息流和任务 beacon。

稳定的 lightMap、HDR、roughness 与光圈不请求持续新帧。页面隐藏/离屏时停止，恢复后使用原可见时间逻辑。对静止状态验收前可暂时关闭 flow/autoOrbit 并等待有限动画落定，但结束后恢复用户保存值。

聚焦遵循 `selected || taskTarget`：任务完成不清空最后的任务焦点；返回全景才按原逻辑退出。不可把 runningZone、selected、taskTarget 合并成一个字段以方便调光。

诊断位于真实挂载元素 `.sandbox-canvas.__sandboxState()`，不是 window 全局。`lighting.lightmapped` 统计“绑定图的材质数”，夜航/装配期间仍可能非零；检查 GI 隔离应看实际 lightMapIntensity。可增加只读 `activeLightmapped`、强度范围、roleCounts、资产版本等诊断，不能添加业务状态或新的计时循环。

## 11. 开发者交付时怎样解释取舍

最终必须回答：

- 同机位全景里，A 的层次具体改善在哪里？
- 罐体和管桥分别用了哪个语义角色，原刚性组件如何保真？
- 实际最终数值为何偏离候选？用哪个截图或测量支持？
- 新增了多少 primitive/draw calls/纹理字节？静止是否仍停帧？
- 日夜、增强关闭、装配、任务染色和资源回退各如何验证？
- 哪些参考图差异来自生成图重绘的模型/机位，因此不应移植？
- 是否还有未验证目标设备、无法匹配部件或未通过项？

达到 [验收要求](05-TASKS-AND-ACCEPTANCE.md) 后交付，停止没有证据支持的特效扩展。

