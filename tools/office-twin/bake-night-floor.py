import bpy,bmesh,json,time,hashlib,subprocess
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'Codex-Temp/office-night-bake';start=time.time()
OUT.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256((ROOT/'public/office-twin/models/H1-baked-v0.6.7.glb').read_bytes()).hexdigest()=='c805ae3f8074f3c9cba9c36249401c97bd4a9b13c5d57ce236fc66a5032a2545', 'Audit a changed upstream model before baking'
subprocess.run(['node',str(ROOT/'tools/office-twin/export-night-lights.mjs')],cwd=str(ROOT),check=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/office-twin/models/H1-baked-v0.6.7.glb'))
office=bpy.data.objects['H1_F09_Office'];floor=bpy.data.objects['Floor_09'];floor_matrix=floor.matrix_world.copy()
def ancestor(o,root):
 while o:
  if o==root:return True
  o=o.parent
 return False
keep=[o for o in bpy.context.scene.objects if o.type=='MESH' and ancestor(o,office) and not any(n in o.name for n in ['Core_floor','CORE_'])]
targets=[]
for o in keep:
 slots=[i for i,m in enumerate(o.data.materials) if m and 'V065_NATIVE_FLOOR_LIGHTING_UNLIT' in m.name]
 if slots:
  bm=bmesh.new();bm.from_mesh(o.data)
  bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index not in slots or f.normal.z<.8],context='FACES')
  bm.to_mesh(o.data);bm.free()
  if len(o.data.polygons):targets.append(o)
assert len(targets)>=20,len(targets)
for o in keep:
 matrix=o.matrix_world.copy();o.parent=None;o.matrix_world=matrix
for o in list(bpy.context.scene.objects):
 if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
mat=bpy.data.materials.new('Night_white_surface');mat.use_nodes=True
bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bsdf.inputs['Base Color'].default_value=(.72,.72,.72,1);bsdf.inputs['Roughness'].default_value=.7
targetmat=mat.copy();targetmat.name='Night_floor_receiver'
image=bpy.data.images.new('Night_floor_diffuse',width=2048,height=2048,float_buffer=True,alpha=False)
node=targetmat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;targetmat.node_tree.nodes.active=node
for o in keep:
 o.data.materials.clear();o.data.materials.append(targetmat if o in targets else mat)
 for p in o.data.polygons:p.material_index=0
 # Shadow-only full-height room partitions; the displayed cutaway is unchanged.
 if o.name.startswith('W_') and '_cut' in o.name:
  zs=[v.co.z for v in o.data.vertices]
  if zs and max(zs)-min(zs)>.5:
   low=min(zs);scale=2.8/(max(zs)-low)
   for v in o.data.vertices:v.co.z=low+(v.co.z-low)*scale
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.max_bounces=4;scene.cycles.diffuse_bounces=3
scene.render.threads_mode='FIXED';scene.render.threads=12
scene.world=bpy.data.worlds.new('Night_black_world');scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Strength'].default_value=0
lights=json.loads((OUT/'lights.json').read_text('utf-8'))
for i,light in enumerate(lights):
 data=bpy.data.lights.new('Office_ceiling_'+str(i),'AREA');data.shape='DISK';data.size=1.5
 peak=max(light['color']);data.color=[c/peak for c in light['color']];data.energy=peak*145
 o=bpy.data.objects.new(data.name,data);scene.collection.objects.link(o)
 x,y,z=light['position'];o.location=floor_matrix@Vector((x,-z,y))
 # Blender area lights point along local -Z: default rotation illuminates down.
scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=True;scene.render.bake.margin=8;scene.render.bake.use_clear=True
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='16'
bpy.ops.object.select_all(action='DESELECT')
for o in targets:o.select_set(True)
bpy.context.view_layer.objects.active=targets[0]
print('NIGHT_BAKE_START',len(keep),len(targets),len(lights),flush=True)
bpy.ops.object.bake(type='DIFFUSE')
image.save_render(str(OUT/'floor-night.png'),scene=scene)
(OUT/'floor-bake-report.json').write_text(json.dumps({'seconds':time.time()-start,'objects':len(keep),'receivers':[o.name for o in targets],'lights':len(lights),'samples':64,'resolution':2048,'view':'Standard sRGB; decode once to linear','scope':'physical direct/indirect floor irradiance, original UVs; static furniture shadows, full-height shadow-only partitions'},indent=2),'utf-8')
print('NIGHT_BAKE_DONE',time.time()-start,flush=True)
