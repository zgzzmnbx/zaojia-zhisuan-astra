import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

out = Path(__file__).parent
assets = out.resolve().parents[1] / '02-三维模型' / 'logo-3d-v1'
destination = assets / 'Blender'
destination.mkdir(exist_ok=True)
report = {'version': bpy.app.version_string, 'source': str(assets / 'ZSuan-Stepped-Z-animated-v1.glb')}

# This process starts with the factory scene; edits are saved only to a new file.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.fps = 30
bpy.ops.import_scene.gltf(filepath=report['source'])
scene.frame_start = 0
scene.frame_end = 209
meshes = [obj for obj in scene.objects if obj.type == 'MESH']
assert len(meshes) == 5, f'Expected five logo meshes, found {len(meshes)}'
center = next(obj for obj in meshes if obj.name.startswith('Step_Center'))
report['meshes'] = [obj.name for obj in meshes]
report['actions'] = [action.name for action in bpy.data.actions]
report['animation_samples'] = []
for frame in (0, 27, 54, 105, 209):
    scene.frame_set(frame)
    report['animation_samples'].append({'frame': frame, 'center_world': list(center.matrix_world.translation), 'quaternion': list(center.matrix_world.to_quaternion())})
assert (Vector(report['animation_samples'][0]['center_world']) - Vector(report['animation_samples'][2]['center_world'])).length > 1.0, 'Imported animation did not move the middle block'
assert (Vector(report['animation_samples'][0]['center_world']) - Vector(report['animation_samples'][3]['center_world'])).length < .01, 'Imported animation did not return home'
scene.frame_set(0)

corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
min_z = min(point.z for point in corners)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, min_z - .012))
ground = bpy.context.object
ground.name = 'Studio_Ground'
ground_material = bpy.data.materials.new('Studio_Paper')
ground_material.use_nodes = True
bsdf = ground_material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (.87, .90, .95, 1)
bsdf.inputs['Roughness'].default_value = .8
ground.data.materials.append(ground_material)

def point_at(obj, position=(0, 0, 0)):
    obj.rotation_euler = (Vector(position) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def area(name, location, power, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size, data.color = power, 'DISK', size, color
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj)

area('Key_Softbox', (-4, -5, 7), 1100, 5, (1, .96, .92))
area('Fill_Softbox', (5, -2, 3), 650, 4, (.76, .87, 1))
area('Rim_Softbox', (0, 4, 6), 1000, 3, (.83, .91, 1))
world = bpy.data.worlds.new('Studio_World')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.8, .88, 1, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35
scene.world = world

camera_data = bpy.data.cameras.new('Logo_Camera')
camera = bpy.data.objects.new('Logo_Camera', camera_data)
scene.collection.objects.link(camera)
camera.location = (-5.2, -11, 4)
point_at(camera)
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 5.9
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.render.resolution_x = scene.render.resolution_y = 320
scene.render.resolution_percentage = 100
scene.cycles.samples = 8
scene.cycles.use_denoising = False

prefs = bpy.context.preferences
cycles = prefs.addons['cycles'].preferences
cycles.compute_device_type = 'ONEAPI'
cycles.refresh_devices()
gpu_devices = [device for device in cycles.devices if device.type == 'ONEAPI']
for device in cycles.devices:
    device.use = device.type == 'ONEAPI'
report['devices'] = [{'name': device.name, 'type': device.type, 'use': device.use} for device in cycles.devices]
scene.cycles.device = 'GPU' if gpu_devices else 'CPU'
report['selected_render_device'] = scene.cycles.device
scene.render.filepath = str(destination / 'gpu-smoke-test.png')
try:
    bpy.ops.render.render(write_still=True)
    report['gpu_smoke_passed'] = bool(gpu_devices)
except Exception as exc:
    report['gpu_error'] = str(exc)
    report['gpu_smoke_passed'] = False
    scene.cycles.device = 'CPU'
    scene.render.filepath = str(destination / 'cpu-smoke-test.png')
    bpy.ops.render.render(write_still=True)
    report['selected_render_device'] = 'CPU'
    cycles.compute_device_type = 'NONE'

# Persist only after a real render succeeds. Keep data-block names untranslated.
languages = [item.identifier for item in prefs.view.bl_rna.properties['language'].enum_items]
if 'zh_HANS' in languages:
    prefs.view.language = 'zh_HANS'
elif 'zh_CN' in languages:
    prefs.view.language = 'zh_CN'
prefs.view.use_translate_interface = True
prefs.view.use_translate_tooltips = True
prefs.view.use_translate_new_dataname = False
prefs.filepaths.save_version = 2
prefs.filepaths.use_auto_save_temporary_files = True
prefs.filepaths.auto_save_time = 2
bpy.ops.wm.save_userpref()
report['language'] = prefs.view.language
report['saved_preferences'] = True

scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = 1080
scene.render.filepath = str(destination / '造价智算-阶梯Z-Blender预览.png')
for screen in bpy.data.screens:
    for space_area in screen.areas:
        if space_area.type == 'VIEW_3D':
            space = space_area.spaces.active
            space.region_3d.view_perspective = 'CAMERA'
            space.overlay.show_overlays = False
            space.shading.type = 'MATERIAL'
            space.shading.use_scene_world = False
            space.shading.use_scene_lights = False
bpy.ops.object.select_all(action='DESELECT')
center.select_set(True)
bpy.context.view_layer.objects.active = center
blend_path = destination / '造价智算-阶梯Z-v1.0.0.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
report['blend_file'] = str(blend_path)
report['preview_file'] = scene.render.filepath
(out / 'configuration.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('BLENDER_CONFIG ' + json.dumps(report, ensure_ascii=True), flush=True)
bpy.ops.render.render(write_still=True)
report['full_preview_passed'] = True
(out / 'configuration.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('BLENDER_SETUP_COMPLETE', flush=True)
