import bpy,json
from pathlib import Path
assets=Path(__file__).resolve().parent
out=assets/'Blender';out.mkdir(exist_ok=True)
palettes=json.loads((assets/'palettes.json').read_text(encoding='utf-8'))
checks=[]
for palette in palettes:
    source=assets.parent/f"logo-3d-v1.2.1/Blender/造价智算-{palette['name']}-v1.2.1.blend"
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene=bpy.context.scene;scene.render.fps=30
    keep={'Studio_Backdrop','Brand_Camera','Key_Softbox','Fill_Softbox','Rim_Softbox'}
    for obj in list(bpy.data.objects):
        if obj.name not in keep:bpy.data.objects.remove(obj,do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=str(assets/f"GLB/{palette['id']}/ZSuan-{palette['id']}-brand-v1.2.2.glb"))
    for obj in scene.objects:
        if not obj.animation_data:continue
        obj.animation_data.action=None
        for track in obj.animation_data.nla_tracks:track.mute=not track.name.startswith('Pose_Tail_Flyby')
    scene.frame_start=0;scene.frame_end=299;scene.frame_set(0)
    scene['ZSuan_version']='1.2.2';scene['ZSuan_motion']='Pose_Tail_Flyby'
    scene.render.filepath='//renders/ZSuan-'
    for marker in list(scene.timeline_markers):scene.timeline_markers.remove(marker)
    for frame,name in [(0,'静止展示'),(144,'尾块飞出'),(162,'尾块翻转'),(198,'尾块归位'),(216,'恢复完整')]:scene.timeline_markers.new(name,frame=frame)
    hero=scene.objects['Lower_Cube_5'];bpy.ops.object.select_all(action='DESELECT');hero.select_set(True);bpy.context.view_layer.objects.active=hero
    note=bpy.data.texts.get('使用说明') or bpy.data.texts.new('使用说明');note.clear();note.write('v1.2.2：默认尾块飞回，10秒循环。全部部件与 ZSuan_Stepped_Z 根对象均需同步启用同一 NLA 姿态，停用其他轨道。Pose_Static 静止；Pose_Sway 左右摇摆，末帧239；Pose_Tail_Flyby 尾块飞回，末帧299；Pose_Scatter_Return 打散恢复，末帧359。原16条动画保留。')
    bpy.context.preferences.filepaths.save_version=0
    target=out/f"造价智算-{palette['name']}-四姿态-v1.2.2.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    bpy.ops.wm.open_mainfile(filepath=str(target));scene=bpy.context.scene
    assert len(scene.objects['Lower_Cube_5'].animation_data.nla_tracks)==20
    assert len(scene.objects['ZSuan_Stepped_Z'].animation_data.nla_tracks)==4
    scene.frame_set(0);rest=scene.objects['Lower_Cube_5'].matrix_world.translation.copy()
    scene.frame_set(180);flight=(scene.objects['Lower_Cube_5'].matrix_world.translation-rest).length
    assert flight>.8
    scene.frame_set(225);assert (scene.objects['Lower_Cube_5'].matrix_world.translation-rest).length<1e-4
    checks.append({'palette':palette['id'],'file':str(target.relative_to(assets)),'reopened':True,'partClips':20,'rootPoseClips':4,'tailTravel':flight,'returned':True})
    print('POSE_BLEND_READY '+palette['id'],flush=True)
(assets/'blender-verification.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
