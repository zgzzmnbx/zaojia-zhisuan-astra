"""Self-contained studio creation from the exported brand GLB; no saved user prefs."""
import bpy
import json
import math
import shutil
import time
import sys
from pathlib import Path
from mathutils import Vector
assets=Path(__file__).resolve().parent
out=assets/'Blender-modular'
out.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(assets/'ZSuan-brand-v1.2.glb'))
report={'version':'1.2.0','blender':bpy.app.version_string,'tracks':{}}
for obj in scene.objects:
    data=obj.animation_data
    if not data: continue
    report['tracks'][obj.name]=[track.name for track in data.nla_tracks]
    if data.nla_tracks:
        for track in data.nla_tracks: track.mute=not track.name.startswith('Assembly_Loop')
        assert any(not track.mute for track in data.nla_tracks), obj.name
        data.action=None
        data.use_nla=True
scene.frame_start,scene.frame_end=0,359
scene.frame_set(0)
meshes=[obj for obj in scene.objects if obj.type=='MESH']
assert len(meshes)==17
report['logo_meshes']=[obj.name for obj in meshes]
center=scene.objects['Step_Center']
initial=center.location.copy()
scene.frame_set(95)
assert (center.location-initial).length>2
scene.frame_set(359)
assert (center.location-initial).length<1e-4
for i in range(4): assert (scene.objects[f'Wordmark_{i}'].scale-Vector((1,1,1))).length<1e-4
scene.frame_set(0)
for frame,label in [(0,'完整标志'),(9,'灵动块探出旋转'),(54,'十三块分离'),(102,'多轴旋转'),(150,'由下向上组装'),(213,'灵动块最后归位'),(249,'完整标志'),(306,'灵动块再次旋转')]:
    scene.timeline_markers.new(label,frame=frame)

def aim(obj,p=(0,0,0)): obj.rotation_euler=(Vector(p)-obj.location).to_track_quat('-Z','Y').to_euler()
def light(name,position,energy,size,color):
    d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='DISK';d.size=size;d.color=color
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=position;aim(o)
light('Key_Softbox',(-4,-6,6),850,5.0,(1,.97,.93))
light('Fill_Softbox',(5,-3,1),420,4,(.80,.9,1))
light('Rim_Softbox',(0,1,5),650,3,(.8,.9,1))
world=bpy.data.worlds.new('Paper_Studio');world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.82,.89,1,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
scene.world=world
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,3,0),rotation=(math.pi/2,0,0))
back=bpy.context.object;back.name='Studio_Backdrop'
mat=bpy.data.materials.new('Paper');mat.use_nodes=True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.88,.915,.965,1)
mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.95
mat.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(.88,.915,.965,1)
mat.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.7
back.data.materials.append(mat)
camdata=bpy.data.cameras.new('Brand_Camera');cam=bpy.data.objects.new('Brand_Camera',camdata);scene.collection.objects.link(cam)
cam.location=(0,-20,0);aim(cam);camdata.type='ORTHO';camdata.ortho_scale=12.0;scene.camera=cam
scene.render.resolution_x,scene.render.resolution_y=1600,900
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='AgX'
scene.render.engine='CYCLES'
cycles=bpy.context.preferences.addons['cycles'].preferences
cycles.compute_device_type='ONEAPI'
cycles.refresh_devices()
for device in cycles.devices: device.use=device.type=='ONEAPI'
gpu=[d.name for d in cycles.devices if d.type=='ONEAPI' and d.use]
scene.cycles.device='GPU' if gpu else 'CPU';scene.cycles.samples=64;scene.cycles.use_denoising=True
report['gpu']=gpu
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.overlay.show_overlays=False
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.shading.use_scene_world=False
            area.spaces.active.shading.use_scene_lights=False
scene['ZSuan_version']='1.2.0'
scene['Independent_cubes']=13
scene['Hero_cube']='Lower_Cube_5'
bpy.ops.object.select_all(action='DESELECT');hero=scene.objects['Lower_Cube_5'];hero.select_set(True);bpy.context.view_layer.objects.active=hero
blend=out/'造价智算-精细模型-组装-v1.2.0.blend'
scene.render.filepath=str(out/'造价智算-横式组合.png')
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.render.render(write_still=True)
report['still_rendered']=True

# Portrait lockup uses the same objects; text remains actual mesh geometry.
holder=scene.objects['Icon_Presentation'];word=scene.objects['Wordmark']
holder.location=(0,0,.58);holder.scale=(.78,.78,.78)
word.location=(0,-.2,-1.66);word.scale=(.68,.68,.68)
scene.render.resolution_x,scene.render.resolution_y=1000,1200;camdata.ortho_scale=5.4
scene.render.filepath=str(out/'造价智算-竖式组合.png')
bpy.ops.render.render(write_still=True)
holder.location=(-2.7,0,0);holder.scale=(.85,.85,.85)
word.location=(1.5,0,0);word.scale=(.94,.94,.94)
camdata.ortho_scale=12

# Eevee produces a smooth 30 fps review film. The saved project remains Cycles 64.
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x,scene.render.resolution_y=1280,720
if hasattr(scene.eevee,'taa_render_samples'): scene.eevee.taa_render_samples=64
if hasattr(scene.eevee,'use_raytracing'): scene.eevee.use_raytracing=False
frames=out/'frames';frames.mkdir(exist_ok=True)
report['movie_engine']='BLENDER_EEVEE'
started=time.monotonic()
scene.frame_set(0);scene.render.filepath=str(frames/'frame_0000.png');bpy.ops.render.render(write_still=True)
report['eevee_first_frame_seconds']=round(time.monotonic()-started,2)
(assets/'blender-progress.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if '--probe' in sys.argv:
    print('BLENDER_PROBE_COMPLETE',flush=True)
    sys.exit(0)
for frame in [*range(9,46),*range(54,249),*range(306,343)]:
    scene.frame_set(frame);scene.render.filepath=str(frames/f'frame_{frame:04d}.png')
    bpy.ops.render.render(write_still=True)
for frame in [*range(1,9),*range(46,54),*range(249,306),*range(343,360)]:
    shutil.copyfile(frames/'frame_0000.png',frames/f'frame_{frame:04d}.png')
assert len(list(frames.glob('frame_*.png')))==360
report['frames']=360;report['duration_seconds']=12;report['fps']=30;report['animation_seconds']=round(time.monotonic()-started,2)
report['blend']=str(blend)
(assets/'blender-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('BLENDER_ASSEMBLY_COMPLETE',flush=True)
