import bpy
import json
from pathlib import Path
from mathutils import Vector
assets=Path(__file__).resolve().parent
blend=assets/'Blender-modular/造价智算-精细模型-组装-v1.2.0.blend'
bpy.ops.wm.open_mainfile(filepath=str(blend))
scene=bpy.context.scene
names=[*[f'Lower_Cube_{i}' for i in range(1,6)],'Step_Lower','Step_Center','Step_Upper',*[f'Upper_Cube_{i}' for i in range(1,6)]]
assert scene.render.fps==30 and scene.frame_end==359
assert scene.render.engine=='CYCLES' and scene.cycles.samples==64
assert len([o for o in scene.objects if o.type=='MESH'])==18 # 13 cubes, 4 characters, backdrop
for name in names:
    obj=scene.objects[name]
    coords=[Vector(c) for c in obj.bound_box]
    extents=[max(p[i] for p in coords)-min(p[i] for p in coords) for i in range(3)]
    assert max(extents)-min(extents)<1e-5, (name,extents)
    assert len(obj.animation_data.nla_tracks)==16
    assert all(track.mute != track.name.startswith('Assembly_Loop') for track in obj.animation_data.nla_tracks)
scene.frame_set(0)
home={name:scene.objects[name].matrix_world.copy() for name in names}
scene.frame_set(27)
assert (scene.objects['Lower_Cube_5'].matrix_world.translation-home['Lower_Cube_5'].translation).length>.7
for name in names:
    if name!='Lower_Cube_5':assert (scene.objects[name].matrix_world.translation-home[name].translation).length<1e-5
scene.frame_set(120)
assert all((scene.objects[name].matrix_world.translation-home[name].translation).length>.3 for name in names)
scene.frame_set(231)
assert (scene.objects['Lower_Cube_5'].matrix_world.translation-home['Lower_Cube_5'].translation).length>.1
for name in names:
    if name!='Lower_Cube_5':assert (scene.objects[name].matrix_world.translation-home[name].translation).length<1e-4
scene.frame_set(285)
assert all((scene.objects[name].matrix_world.translation-home[name].translation).length<1e-4 for name in names)
for i in range(4):assert (scene.objects[f'Wordmark_{i}'].scale-Vector((1,1,1))).length<1e-5
scene.frame_set(325)
assert (scene.objects['Lower_Cube_5'].matrix_world.translation-home['Lower_Cube_5'].translation).length>.7
scene.frame_set(359)
assert all((scene.objects[name].matrix_world.translation-home[name].translation).length<1e-4 for name in names)
report={'version':'1.2.0','reopened':str(blend),'true_cubes':13,'characters':4,'animations_per_cube':16,'fps':30,'frames':360,'hero':'Lower_Cube_5','checks':['all cube dimensions equal','assembly loop selected','hero moves alone at beginning','all thirteen cubes separate','hero returns last','four characters visible in final lockup','hero repeats a turn at end','final pose restored'],'saved_engine':'CYCLES','saved_samples':64}
(assets/'blender-reopen-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('MODULAR_BLEND_VERIFIED',flush=True)
