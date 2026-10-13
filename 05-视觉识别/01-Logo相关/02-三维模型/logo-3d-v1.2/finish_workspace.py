import bpy
from pathlib import Path
assets=Path(__file__).resolve().parent
target=assets/'Blender-modular/造价智算-精细模型-组装-v1.2.0.blend'
bpy.ops.wm.open_mainfile(filepath=str(target))
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            view=area.spaces.active
            view.region_3d.view_perspective='CAMERA'
            view.overlay.show_overlays=False
            view.shading.type='MATERIAL'
            view.shading.use_scene_world=False
            view.shading.use_scene_lights=False
scene=bpy.context.scene
scene['ZSuan_version']='1.2.0'
scene['Independent_cubes']=13
scene['Hero_cube']='Lower_Cube_5'
note=bpy.data.texts.get('使用说明') or bpy.data.texts.new('使用说明')
note.clear()
note.write('造价智算 v1.2.0\n13个独立立方体：顶梁5块、阶梯3块、底梁5块。\n底梁最右端 Lower_Cube_5 为灵动块，已默认选中。\n空格播放/暂停，F12 渲染当前帧。循环12秒，30fps。\nNLA轨道中默认只启用 Assembly_Loop；切换其他动画请先停用原轨道。\nWordmark_0 至 Wordmark_3 为造价智算四字的三维轮廓网格。\n本文件不依赖完整字体或相邻旧版工程，未修改全局偏好。\n')
scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('WORKSPACE_FINISHED',flush=True)
