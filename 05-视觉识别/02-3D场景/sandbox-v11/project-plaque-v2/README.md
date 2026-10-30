# 信息碑右移 v2

源工程 project-plaque-v1 保留。本版中心 x 从 -2.3 移到 7.2，其余尺寸、斜角及高度不变。直接复用原碑体与 UV，plaque-light.png 字节一致；周围建筑占位与接地阴影重新计算并用 Blender Cycles 128 samples 烘焙。

重建入口：tools/sandbox-v11/move-project-plaque.py，通过 Blender 后台运行，-- 后传项目根目录。manifest.json 记录位置、清除的城市楼块和资产 SHA256。网页聚焦与文字位置共同读取该 manifest。
