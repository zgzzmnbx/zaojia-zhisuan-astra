import bpy,sys,math,json,hashlib,time,bmesh
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=root/'05-视觉识别/02-3D场景/sandbox-v11/project-plaque-v1';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'05-视觉识别/02-3D场景/sandbox-v11/street-white-v1/street-ground-white.blend'))
bpy.context.preferences.filepaths.save_version=0;scene=bpy.context.scene
# Front strip in Web Y-up coordinates. The marked forecourt is cleared for the stone and its reading sightline.
cx=-2.3;cz=16.5;width=19.4;depth=2.65;bottom=-1.215;front=-1.10;back=front+depth*math.tan(math.radians(20));cy=(front+back)/2
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
new=[]
def material(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=.85;return m
stone=material('Plaque · soft white stone',(.9,.9,.9));blue=material('Plaque · pale blue enamel',(.16,.51,.69))
def mesh(name,verts,faces,mat,bevel=0):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.data.materials.append(mat);new.append(o)
 if bevel:
  bpy.context.view_layer.objects.active=o;o.select_set(True);m=o.modifiers.new('Fine softened stone edges','BEVEL');m.width=bevel;m.segments=3;bpy.ops.object.modifier_apply(modifier=m.name);o.select_set(False)
 return o
def web(x,y,z):return (x,-z,y)
verts=[web(cx+x,bottom,cz+z) for x,z in [(-width/2,-depth/2),(width/2,-depth/2),(width/2,depth/2),(-width/2,depth/2)]]+[web(cx+x,y,cz+z) for x,y,z in [(-width/2,back,-depth/2),(width/2,back,-depth/2),(width/2,front,depth/2),(-width/2,front,depth/2)]]
body=mesh('Project information · inclined stone',verts,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],stone,.045)
a=math.radians(20)
def surface(x,y,n=0):return Vector(web(cx+x,cy+y*math.sin(a)+n*math.cos(a),cz-y*math.cos(a)+n*math.sin(a)))
# A small enamel insert holds the exact white PipeChina outline.
v=[surface(x,y,n) for n in [.012,.045] for x,y in [(-9.25,-1.05),(-7.15,-1.05),(-7.15,1.05),(-9.25,1.05)]]
badge=mesh('PipeChina · blue enamel inset',v,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],blue,.035)
logo=json.loads((root/'05-视觉识别/03-Logo-管网logo/contours.json').read_text(encoding='utf-8'))
for i,poly in enumerate(logo['polygons']):
 c=bpy.data.curves.new('PipeChina original contour','CURVE');c.dimensions='2D';c.resolution_u=1;c.fill_mode='BOTH';c.extrude=.018;c.bevel_depth=.004;c.bevel_resolution=2
 for points in [poly['outer']]+poly['holes']:
  sp=c.splines.new('POLY');sp.points.add(len(points)-1)
  for q,(x,y) in zip(sp.points,points):q.co=((x-(logo['width']-1)/2)/logo['height']*1.65,((logo['height']-1)/2-y)/logo['height']*1.65,0,1)
  sp.use_cyclic_u=True
 o=bpy.data.objects.new('PipeChina original region '+str(i),c);scene.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object
 for v in o.data.vertices:v.co=surface(-8.2+v.co.x,v.co.y,.07+v.co.z)
 o.data.materials.append(stone);new.append(o);o.select_set(False)
# Bake authored geometry under exactly the existing city world/sun. Shared atlas.
image=bpy.data.images.new('Project plaque · Cycles daylight',width=2048,height=512,alpha=False,float_buffer=True)
bpy.ops.object.select_all(action='DESELECT')
for o in new:o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body=bpy.context.object;body.name='Project information stone · baked'
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False) if hasattr(bpy.ops.mesh,'normals_make_consistent') else None
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.012);bpy.ops.object.mode_set(mode='OBJECT')
for m in body.data.materials:
 n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=image;m.node_tree.nodes.active=n
 for k in m.node_tree.nodes:k.select=k==n
scene.cycles.samples=128;scene.cycles.use_adaptive_sampling=False;scene.render.threads_mode='FIXED';scene.render.threads=12
scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=True;scene.render.bake.margin=8
bpy.ops.object.bake(type='DIFFUSE');scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';image.save_render(str(out/'plaque-light.png'),scene=scene);image.pack()
# Re-bake ground after removing the five blocks: their old black contact shadows
# must disappear together with their geometry, while the new stone casts its own shadow.
ground=next(o for o in scene.objects if o.get('role')=='background_ground')
groundmat=material('Plaque context ground',(.9,.9,.9));ground.data.materials.clear();ground.data.materials.append(groundmat)
groundimage=bpy.data.images.new('Plaque context ground daylight',width=1024,height=1024,alpha=False,float_buffer=True)
n=groundmat.node_tree.nodes.new('ShaderNodeTexImage');n.image=groundimage;groundmat.node_tree.nodes.active=n
bpy.ops.object.select_all(action='DESELECT');ground.select_set(True);bpy.context.view_layer.objects.active=ground
bpy.ops.object.bake(type='DIFFUSE');groundimage.save_render(str(out/'plaque-ground.png'),scene=scene);groundimage.pack()
# Save physical materials and full lighting context for editing/rerendering.
camdata=bpy.data.cameras.new('Plaque detail camera');cam=bpy.data.objects.new('Plaque detail camera',camdata);scene.collection.objects.link(cam);cam.location=web(13,17,37);target=Vector(web(cx,cy,cz));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=26;scene.camera=cam;scene.render.resolution_x=1400;scene.render.resolution_y=700;scene.render.resolution_percentage=100;scene.cycles.samples=48;scene.cycles.use_denoising=True
bpy.ops.wm.save_as_mainfile(filepath=str(out/'project-plaque.blend'))
scene.render.filepath=str(out/'blender-render.png');bpy.ops.render.render(write_still=True)
# Web export uses baked emission, with no second lighting pass.
m=bpy.data.materials.new('Plaque authored daylight');m.use_nodes=True;nodes=m.node_tree.nodes;nodes.clear();tex=nodes.new('ShaderNodeTexImage');tex.image=image;emit=nodes.new('ShaderNodeEmission');output=nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(tex.outputs['Color'],emit.inputs['Color']);m.node_tree.links.new(emit.outputs[0],output.inputs['Surface']);body.data.materials.clear();body.data.materials.append(m)
for p in body.data.polygons:p.material_index=0
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=str(out/'project-plaque.glb'),export_format='GLB',use_selection=True,export_yup=True)
manifest={'angleDegrees':20,'center':[cx,cy,cz],'width':width,'depth':depth,'bottom':bottom,'top':back,'removedCityBounds':removed,'logoSourceSHA256':logo['sha256'],'world':.7,'sun':1.3,'sunAngle':18,'samples':128,'textureSize':[2048,512],'blender':bpy.app.version_string}
manifest['hashes']={n:hashlib.sha256((out/n).read_bytes()).hexdigest() for n in ['project-plaque.glb','plaque-light.png','plaque-ground.png']}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');print('PLAQUE_DONE',json.dumps(manifest))
