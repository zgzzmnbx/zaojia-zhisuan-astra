import bpy,sys,math,json,hashlib
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]).resolve()
out=root/'05-视觉识别/03-Logo-管网logo/soft-white-v1';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'05-视觉识别/02-3D场景/sandbox-v11/street-white-v1/street-ground-white.blend'))
bpy.context.preferences.filepaths.save_version=0;scene=bpy.context.scene
# Bake the exact runtime geometry under the same city lighting and surrounding occlusion.
objects=[]
for item in json.loads((root/'Codex-Temp/logo-bake/source.json').read_text()):
 d=bpy.data.meshes.new(item['name']);d.from_pydata(item['vertices'],[],item['faces']);d.update()
 o=bpy.data.objects.new(item['name'],d);scene.collection.objects.link(o);o['logoRole']=item['role'];objects.append(o)
 m=bpy.data.materials.new(item['name']+' soft white');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.9,.9,.9,1);p.inputs['Roughness'].default_value=.85;o.data.materials.append(m)
 # Weld the source's non-indexed triangles to make continuous normals along bevels.
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000001);bpy.ops.mesh.set_normals_from_faces();bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.016);bpy.ops.object.mode_set(mode='OBJECT')
image=bpy.data.images.new('Group logo soft white daylight',width=1024,height=1024,alpha=False,float_buffer=True)
for o in objects:
 for m in o.data.materials:
  n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=image;m.node_tree.nodes.active=n
  for k in m.node_tree.nodes:k.select=k==n
scene.cycles.samples=128;scene.cycles.use_adaptive_sampling=False;scene.render.threads_mode='FIXED';scene.render.threads=12
scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=True;scene.render.bake.margin=8
bpy.ops.object.bake(type='DIFFUSE');scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';image.save_render(str(out/'logo-light.png'),scene=scene);image.pack()
camdata=bpy.data.cameras.new('Logo detail');cam=bpy.data.objects.new('Logo detail',camdata);scene.collection.objects.link(cam)
cam.location=(.2,-11,5.5);target=Vector((-4.3,-4.05,1.2));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=5.5;scene.camera=cam
scene.render.resolution_x=1100;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.cycles.samples=48;scene.cycles.use_denoising=True
bpy.ops.wm.save_as_mainfile(filepath=str(out/'group-logo-soft-white.blend'));scene.render.filepath=str(out/'blender-render.png');bpy.ops.render.render(write_still=True)
m=bpy.data.materials.new('Group logo baked daylight');m.use_nodes=True;n=m.node_tree.nodes;n.clear();t=n.new('ShaderNodeTexImage');t.image=image;e=n.new('ShaderNodeEmission');output=n.new('ShaderNodeOutputMaterial');m.node_tree.links.new(t.outputs['Color'],e.inputs['Color']);m.node_tree.links.new(e.outputs[0],output.inputs['Surface'])
for o in objects:
 o.data.materials.clear();o.data.materials.append(m)
 for p in o.data.polygons:p.material_index=0
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(out/'group-logo.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
manifest={'blender':bpy.app.version_string,'world':.7,'sun':1.3,'sunAngle':18,'samples':128,'textureSize':[1024,1024],'logoRegions':5,'location':[-4.3,.13,4.05],'logoHeight':1.48,'plinthHeight':.34,'sourceSHA256':hashlib.sha256((root/'05-视觉识别/03-Logo-管网logo/contours.json').read_bytes()).hexdigest(),'hashes':{name:hashlib.sha256((out/name).read_bytes()).hexdigest() for name in ['group-logo.glb','logo-light.png']}}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');print('LOGO_BAKE_DONE',json.dumps(manifest))
