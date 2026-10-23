"""Rebake only city UVs under spatially uniform daylight; retain immutable V11 source."""
import bpy,math,json,hashlib,time
from pathlib import Path
from mathutils import Vector
# Project root is supplied explicitly for reproducible Windows/macOS use.
import sys
root=Path(sys.argv[sys.argv.index('--')+1]).resolve()
out=root/'05-视觉识别/02-3D场景/sandbox-v11/city-white-v1';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(root/'public/sandbox-v11/model/model.gltf'))
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=2048;scene.cycles.use_adaptive_sampling=False
scene.render.threads_mode='FIXED';scene.render.threads=12
scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=4
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
world=bpy.data.worlds.new('Uniform soft daylight');world.use_nodes=True
background=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');background.inputs['Color'].default_value=(1,1,1,1);background.inputs['Strength'].default_value=.70;scene.world=world
sun=bpy.data.lights.new('Distant soft key','SUN');sun.energy=1.30;sun.angle=math.radians(18)
lamp=bpy.data.objects.new('Distant soft key',sun);scene.collection.objects.link(lamp)
# Fixed direction for every building; unlike nearby area lights there is no distance falloff.
lamp.rotation_euler=Vector((.45,.35,-.82)).to_track_quat('-Z','Y').to_euler()
city=next(o for o in scene.objects if o.get('role')=='background_city')
mat=bpy.data.materials.new('Soft white matte · uniform city');mat.use_nodes=True
bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bsdf.inputs['Base Color'].default_value=(.9,.9,.9,1);bsdf.inputs['Roughness'].default_value=.85
occluder=mat.copy();occluder.name='Neutral bake occluders';next(n for n in occluder.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'].default_value=(.8,.8,.8,1)
for o in scene.objects:
 if o.type=='MESH':
  o.data.materials.clear();o.data.materials.append(mat if o==city else occluder)
  for face in o.data.polygons:face.material_index=0
image=bpy.data.images.new('City uniform daylight',width=2048,height=2048,alpha=False,float_buffer=True)
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;mat.node_tree.nodes.active=tex
for node in mat.node_tree.nodes:node.select=node==tex
bpy.ops.object.select_all(action='DESELECT');city.select_set(True);bpy.context.view_layer.objects.active=city
scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=True;scene.render.bake.margin=6
start=time.time();bpy.ops.object.bake(type='DIFFUSE')
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='8'
image.save_render(str(out/'city-white.png'),scene=scene)
# Save editable lighting scene and packed source textures, not a replacement of source geometry.
for im in bpy.data.images:
 if im.source=='FILE' and im.packed_file is None:
  try:im.pack()
  except RuntimeError:pass
image.pack();bpy.ops.wm.save_as_mainfile(filepath=str(out/'city-white.blend'))
manifest={'blender':bpy.app.version_string,'engine':'Cycles CPU','samples':2048,'adaptive_sampling':False,'size':[2048,2048],'world':.70,'sun':1.30,'sun_angle_degrees':18,'material_linear_white':.9,'view_transform':'Standard','role':'background_city','city_triangles':len(city.data.polygons),'source_geometry_unchanged':True,'seconds':time.time()-start,'texture_sha256':hashlib.sha256((out/'city-white.png').read_bytes()).hexdigest()}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');print('BAKE_DONE',json.dumps(manifest))
