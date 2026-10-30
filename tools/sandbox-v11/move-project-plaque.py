import bpy,sys,math,json,hashlib,time,bmesh
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=root/'05-视觉识别/02-3D场景/sandbox-v11/project-plaque-v2';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'05-视觉识别/02-3D场景/sandbox-v11/street-white-v1/street-ground-white.blend'))
bpy.context.preferences.filepaths.save_version=0;scene=bpy.context.scene
# Front strip in Web Y-up coordinates. The marked forecourt is cleared for the stone and its reading sightline.
cx=7.2;cz=16.5;width=19.4;depth=2.65;bottom=-1.215;front=-1.10;back=front+depth*math.tan(math.radians(20));cy=(front+back)/2
city=next(o for o in scene.objects if o.get('role')=='background_city');vs=[city.matrix_world@v.co for v in city.data.vertices];parent=list(range(len(vs)));keys={}
def find(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return i
def union(a,b):parent[find(a)]=find(b)
for i,v in enumerate(vs):
 k=tuple(round(float(n),4) for n in v)
 if k in keys:union(i,keys[k])
 else:keys[k]=i
for p in city.data.polygons:
 for i in p.vertices:union(p.vertices[0],i)
groups={}
for i,v in enumerate(vs):groups.setdefault(find(i),[]).append(v)
removed=[];removeRoots=set()
for k,verts in groups.items():
 lo=[min(v[i] for v in verts) for i in range(3)];hi=[max(v[i] for v in verts) for i in range(3)]
 box={'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]]}
 if box['max'][0]>cx-width/2 and box['min'][0]<cx+width/2 and box['max'][2]>cz-depth/2 and box['min'][2]<21.1:removed.append(box);removeRoots.add(k)
bm=bmesh.new();bm.from_mesh(city.data);bm.verts.ensure_lookup_table();bmesh.ops.delete(bm,geom=[v for v in bm.verts if find(v.index) in removeRoots],context='VERTS');bm.to_mesh(city.data);bm.free()

import shutil
source=root/'05-视觉识别/02-3D场景/sandbox-v11/project-plaque-v1'
with bpy.data.libraries.load(str(source/'project-plaque.blend'),link=False) as (data_from,data_to):
 data_to.objects=[n for n in data_from.objects if n=='Project information stone · baked']
body=data_to.objects[0];assert body;scene.collection.objects.link(body);body.location.x+=9.5
# Reuse the original material bake and exact UVs; the sunlight is directional.
light=bpy.data.images.load(str(source/'plaque-light.png'),check_existing=False);light.pack()
ground=next(o for o in scene.objects if o.get('role')=='background_ground')
m=bpy.data.materials.new('Relocated plaque ground');m.use_nodes=True
bsdf=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bsdf.inputs['Base Color'].default_value=(.9,.9,.9,1);bsdf.inputs['Roughness'].default_value=.85
ground.data.materials.clear();ground.data.materials.append(m)
image=bpy.data.images.new('Relocated plaque ground daylight',width=1024,height=1024,alpha=False,float_buffer=True)
n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=image;m.node_tree.nodes.active=n
scene.cycles.samples=128;scene.cycles.use_adaptive_sampling=False;scene.render.threads_mode='FIXED';scene.render.threads=12
scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=True;scene.render.bake.margin=8
bpy.ops.object.select_all(action='DESELECT');ground.select_set(True);bpy.context.view_layer.objects.active=ground
bpy.ops.object.bake(type='DIFFUSE');scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';image.save_render(str(out/'plaque-ground.png'),scene=scene);image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'project-plaque.blend'))
m=bpy.data.materials.new('Plaque authored daylight');m.use_nodes=True;nodes=m.node_tree.nodes;nodes.clear();tex=nodes.new('ShaderNodeTexImage');tex.image=light;emit=nodes.new('ShaderNodeEmission');output=nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(tex.outputs['Color'],emit.inputs['Color']);m.node_tree.links.new(emit.outputs[0],output.inputs['Surface']);body.data.materials.clear();body.data.materials.append(m)
for poly in body.data.polygons:poly.material_index=0
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.export_scene.gltf(filepath=str(out/'project-plaque.glb'),export_format='GLB',use_selection=True,export_yup=True)
shutil.copy2(source/'plaque-light.png',out/'plaque-light.png')
manifest=json.loads((source/'manifest.json').read_text(encoding='utf-8'));manifest.update(center=[cx,cy,cz],removedCityBounds=removed,translation=[9.5,0,0],sourceVersion='project-plaque-v1',blender=bpy.app.version_string)
manifest['hashes']={n:hashlib.sha256((out/n).read_bytes()).hexdigest() for n in ['project-plaque.glb','plaque-light.png','plaque-ground.png']}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');print('PLAQUE_MOVED',json.dumps(manifest))
