import bpy
import json
from pathlib import Path
from mathutils import Vector

assets = Path(__file__).resolve().parent
target = assets / 'Blender' / '造价智算-阶梯Z-原位翻转-v1.1.0.blend'
bpy.ops.wm.open_mainfile(filepath=str(target))
scene = bpy.context.scene
assert (scene.frame_start, scene.frame_end, scene.render.fps, scene.frame_step) == (0, 197, 30, 1)
assert (scene.render.resolution_x, scene.render.resolution_y, scene.cycles.samples) == (1080, 1080, 64)
assert scene.camera is not None
pieces = [scene.objects[name] for name in ['Lower_Beam', 'Step_Lower', 'Step_Center', 'Step_Upper', 'Upper_Beam']]
center = pieces[2]
scene.frame_set(0)
initial = center.matrix_world.to_quaternion()
fixed = {obj.name: obj.matrix_world.copy() for obj in pieces if obj != center}
samples = []
for frame in range(198):
    scene.frame_set(frame)
    assert center.matrix_world.translation.length < 1e-6
    for name, matrix in fixed.items():
        assert max(abs(scene.objects[name].matrix_world[i][j] - matrix[i][j]) for i in range(4) for j in range(4)) < 1e-6
    if frame in [0, 11, 15, 24, 30, 174, 197]:
        samples.append({'frame': frame, 'scale': list(center.scale), 'quaternion': list(center.matrix_world.to_quaternion())})
assert abs(initial.dot(center.matrix_world.to_quaternion())) > .9999
assert (center.scale - Vector((1, 1, 1))).length < 1e-6
assert samples[1]['scale'][0] < .9
report = {'blend_reopened': str(target), 'frames_checked': 198, 'stationary_meshes_verified': 4, 'centre_no_translation': True, 'loop_restored': True, 'saved_render_resolution': [1080, 1080], 'saved_samples': 64, 'samples': samples}
(assets / 'blender-reopen-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('BLENDER_REOPEN_VERIFIED', flush=True)
