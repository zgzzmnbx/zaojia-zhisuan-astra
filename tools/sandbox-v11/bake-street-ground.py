"""Companion ground bake: remove the old hard street-shadow atlas."""
import bpy,json,sys,time,hashlib
from pathlib import Path
root=Path(sys.argv[sys.argv.index('--')+1]).resolve()
out=root/'05-视觉识别/02-3D场景/sandbox-v11/street-white-v1'
bpy.ops.wm.open_mainfile(filepath=str(out/'street-white.blend'))
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;ground=next(o for o in scene.objects if o.get('role')=='background_ground')
scene.cycles.samples=256;scene.cycles.use_adaptive_sampling=False
mat=bpy.data.materials.new('Soft white ground');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.9,.9,.9,1);bsdf.inputs['Roughness'].default_value=.9
ground.data.materials.clear();ground.data.materials.append(mat)
for p in ground.data.polygons:p.material_index=0
image=bpy.data.images.new('Ground soft daylight',width=1024,height=1024,alpha=False,float_buffer=True)
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;mat.node_tree.nodes.active=tex
for n in mat.node_tree.nodes:n.select=n==tex
bpy.ops.object.select_all(action='DESELECT');ground.select_set(True);bpy.context.view_layer.objects.active=ground
start=time.time();bpy.ops.object.bake(type='DIFFUSE')
image.save_render(str(out/'ground-white.png'),scene=scene);image.pack();bpy.ops.wm.save_as_mainfile(filepath=str(out/'street-ground-white.blend'))
p=out/'manifest.json';manifest=json.loads(p.read_text());manifest['ground']={'role':'background_ground','samples':scene.cycles.samples,'adaptive_sampling':False,'size':[1024,1024],'material_linear_white':.9,'seconds':time.time()-start,'texture_sha256':hashlib.sha256((out/'ground-white.png').read_bytes()).hexdigest()};p.write_text(json.dumps(manifest,indent=2),encoding='utf-8');print('GROUND_DONE',manifest['ground'])
