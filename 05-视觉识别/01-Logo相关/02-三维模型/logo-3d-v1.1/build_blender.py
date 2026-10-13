"""Import the new animation into a copy of the existing studio. No global prefs saved."""
import bpy
import json
from pathlib import Path
from mathutils import Vector

assets = Path(__file__).resolve().parent
destination = assets / 'Blender'
destination.mkdir(exist_ok=True)
old_scene = assets.parent / 'logo-3d-v1' / 'Blender' / '造价智算-阶梯Z-v1.0.0.blend'
bpy.ops.wm.open_mainfile(filepath=str(old_scene))
scene = bpy.context.scene
scene.render.fps = 30
logo_names = ['Lower_Beam', 'Step_Lower', 'Step_Center', 'Step_Upper', 'Upper_Beam', 'ZSuan_Stepped_Z']
for obj in list(scene.objects):
    if obj.name in logo_names:
        bpy.data.objects.remove(obj, do_unlink=True)
for action in list(bpy.data.actions):
    if action.users == 0:
        bpy.data.actions.remove(action)
bpy.ops.import_scene.gltf(filepath=str(assets / 'ZSuan-Stepped-Z-animated-v1.1.glb'))
scene.frame_start, scene.frame_end = 0, 197
scene.frame_step = 1
center = scene.objects['Step_Center']
logo_meshes = [scene.objects[name] for name in logo_names[:5]]
assert len(logo_meshes) == 5
report = {'version': '1.1.0', 'blender': bpy.app.version_string, 'fps': 30, 'frames': 198, 'duration_seconds': 6.6, 'samples': []}
for frame in (0, 10, 15, 24, 30, 40, 75, 105, 135, 165, 174, 197):
    scene.frame_set(frame)
    location, rotation, scale = center.matrix_world.decompose()
    assert location.length < 1e-6
    report['samples'].append({'frame': frame, 'position': list(location), 'quaternion': list(rotation), 'scale': list(scale)})
scene.frame_set(0)
home_rotation = center.matrix_world.to_quaternion()
scene.frame_set(15)
assert home_rotation.rotation_difference(center.matrix_world.to_quaternion()).angle > 1
scene.frame_set(174)
assert abs(home_rotation.dot(center.matrix_world.to_quaternion())) > .9999
assert (center.scale - Vector((1, 1, 1))).length < .001
scene.frame_set(0)
scene.render.engine = 'CYCLES'
cycles = bpy.context.preferences.addons['cycles'].preferences
cycles.refresh_devices()
gpu = [device for device in cycles.devices if device.type == 'ONEAPI' and device.use]
scene.cycles.device = 'GPU' if gpu else 'CPU'
report['device'] = scene.cycles.device
report['gpu_names'] = [device.name for device in gpu]
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = str(destination / '造价智算-原位翻转-v1.1.png')
bpy.ops.object.select_all(action='DESELECT')
center.select_set(True)
bpy.context.view_layer.objects.active = center
blend_path = destination / '造价智算-阶梯Z-原位翻转-v1.1.0.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
report['blend'] = str(blend_path)
bpy.ops.render.render(write_still=True)
report['still_rendered'] = True
(assets / 'blender-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
# Render every frame for a smooth 30 fps preview. Saved project stays at 1080/64.
frames = destination / 'frames'
frames.mkdir(exist_ok=True)
scene.render.resolution_x = scene.render.resolution_y = 720
scene.cycles.samples = 16
scene.render.use_persistent_data = True
scene.render.filepath = str(frames / 'frame_')
bpy.ops.render.render(animation=True)
assert len(list(frames.glob('frame_*.png'))) == 198
report['animation_frames_rendered'] = 198
report['preview_resolution'] = [720, 720]
(assets / 'blender-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('BLENDER_MOTION_COMPLETE', flush=True)
