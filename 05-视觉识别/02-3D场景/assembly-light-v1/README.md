# 装配专用柔白补光 v1.0.0

bake.py 使用 Blender Cycles 对六个朝向的白色校准平面烘焙漫反射（32 samples）。direction-0…5.png 对应 +x/-x/+y/-y/+z/-z 的 Three.js 世界方向；lighting.json 保存内部像素线性 RGB 平均值；assembly-fill.blend 为可复现工程。

用途：为拆分时暴露的烘焙暗面提供平滑方向补光。仅候选装配期间使用，归位后撤除。不是建筑几何重建，也不是逐建筑 UV 重新烘焙。原冻结模型、贴图与正式开场未改。

可通过 Blender --background --python bake.py 重新生成，具体参数见脚本。候选取值有限幅以避免补光过曝。
