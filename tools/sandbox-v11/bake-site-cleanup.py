"""Bake neutral replacement lighting for only the cleaned site's exposed receivers.
The following compositing step keeps every original pixel outside local repair masks.
"""
import bpy,math,json,time
from mathutils import Vector
from pathlib import Path
r=Path.cwd();out=r/'05-视觉识别/02-3D场景/sandbox-v11/site-cleanup-v1';tmp=r/'Codex-Temp/sandbox-cleanup-v01321'
bpy.ops.wm.open_mainfile(filepath=str(out/'site-cleanup.blend'))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=64;s.cycles.use_adaptive_sampling=False;s.render.threads_mode='FIXED';s.render.threads=12;s.cycles.max_bounces=4
s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=0;s.view_settings.gamma=1
w=bpy.data.worlds.new('Cleanup daylight');w.use_nodes=True;bg=next(n for n in w.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(1,1,1,1);bg.inputs['Strength'].default_value=.7;s.world=w
sun=bpy.data.lights.new('Cleanup soft key','SUN');sun.energy=1.3;sun.angle=math.radians(18);lamp=bpy.data.objects.new('Cleanup soft key',sun);s.collection.objects.link(lamp);lamp.rotation_euler=Vector((.45,.35,-.82)).to_track_quat('-Z','Y').to_euler()
targets={'V10 · Baked unlit zone_price':'price','V10 · Baked unlit site':'site'};images={};objects={}
for ob in s.objects:
 if ob.type!='MESH':continue
 for slot in ob.material_slots:
  old=slot.material;m=bpy.data.materials.get('Cleanup '+old.name)
  if m is None:
   m=bpy.data.materials.new('Cleanup '+old.name);m.use_nodes=True;p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(.8,.8,.8,1);p.inputs['Roughness'].default_value=.85
   size=2048 if old.name in targets else 4;im=bpy.data.images.new('Bake '+old.name,size,size,alpha=False,float_buffer=True);t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;m.node_tree.nodes.active=t
   if old.name in targets:images[targets[old.name]]=im;objects[targets[old.name]]=ob
  slot.material=m
s.render.bake.use_pass_direct=True;s.render.bake.use_pass_indirect=True;s.render.bake.use_pass_color=True;s.render.bake.margin=4
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.render.image_settings.color_depth='8'
for name,ob in objects.items():
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
 start=time.time();bpy.ops.object.bake(type='DIFFUSE');images[name].save_render(str(tmp/(name+'-clean-bake.png')),scene=s);print('BAKED',name,time.time()-start,flush=True)
