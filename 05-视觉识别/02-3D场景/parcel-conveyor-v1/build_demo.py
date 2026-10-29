"""Independent Blender-authored conveyor and parcel study. Never writes frozen assets."""
import bpy, math, json, pathlib, bisect, sys
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[3]
OUT=pathlib.Path(__file__).resolve().parent
FORMAL='--formal-asset' in sys.argv
TEMP=ROOT/'Codex-Temp'/'parcel-conveyor-v1'; TEMP.mkdir(parents=True,exist_ok=True)
route=json.loads((ROOT/'03-Src/studio/project-sandbox/pipeline-route.json').read_text(encoding='utf-8'))
# User-approved order; routes are private to this demo.
source_stops={s['id']:s for s in route['stops']}
route['stops']=[source_stops[k] for k in ['import','price','risk','report','review','table','knowledge']]
layout=json.loads((OUT/'conveyor-route.json').read_text(encoding='utf-8'))
route['legs']=layout['legs']
for stop,point in zip(route['stops'],layout['stops']):stop['point']=point
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
def material(name,color,metal=0,rough=.45,emit=0):
 m=bpy.data.materials.new(name);m.use_nodes=True
 p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
 return m
white=material('Porcelain | soft white',(.81,.85,.88),.12,.36)
blue=material('Astra | blue enamel',(.018,.37,.64),.25,.3)
belt=material('Belt | pale glass',(.65,.73,.77),0,.18)
belt_bsdf=next(n for n in belt.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
belt_bsdf.inputs['Transmission Weight'].default_value=.65
belt_bsdf.inputs['IOR'].default_value=1.45
silver=material('Pearl silver',(.66,.71,.74),.22,.43)
ink=material('Label | ink',(.035,.095,.15),0,.6)
light=material('Scanner | cyan',(.035,.55,.8),.1,.3,.65)
paper=material('Label | paper',(.94,.96,.97),0,.65)
def box(name,pos,size,mat,bevel=.025,parent=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 if bevel:
  b=o.modifiers.new('Soft manufactured edges','BEVEL');b.width=bevel;b.segments=3
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
 if parent:o.parent=parent
 return o
def cyl(name,pos,r,depth,mat,axis='Z'):
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=depth,location=pos);o=bpy.context.object;o.name=name;o.data.materials.append(mat)
 if axis=='X':o.rotation_euler[1]=math.pi/2
 for p in o.data.polygons:p.use_smooth=True
 return o
def world(p):return Vector((p[0],-p[2],p[1]+.42))
def rounded(points):
 vs=[world(p) for p in points];out=[vs[0]]
 def line(a,b):
  for k in range(1,max(2,math.ceil((b-a).length/.14))+1):out.append(a.lerp(b,k/max(2,math.ceil((b-a).length/.14))))
 prev=vs[0]
 for i in range(1,len(vs)-1):
  p=vs[i];u=(vs[i-1]-p).normalized();v=(vs[i+1]-p).normalized();theta=u.angle(v)
  r=min(.85,(p-vs[i-1]).length*.48,(p-vs[i+1]).length*.48)
  a=p+u*r;b=p+v*r;line(prev,a)
  radius=r*math.tan(theta/2);center=p+(u+v).normalized()*radius/math.sin(theta/2)
  va=a-center;vb=b-center;axis=va.cross(vb).normalized();arc=va.angle(vb)
  for k in range(1,13):
   t=k/12;angle=arc*t;out.append(center+va*math.cos(angle)+axis.cross(va)*math.sin(angle))
  prev=b
 line(prev,vs[-1]);clean=[out[0]]
 for p in out[1:]:
  if (p-clean[-1]).length>1e-5:clean.append(p)
 return clean
paths=[rounded(p) for p in route['legs']]
def lengths(points):
 ds=[0.]
 for a,b in zip(points,points[1:]):ds.append(ds[-1]+(b-a).length)
 return ds
distances=[lengths(p) for p in paths]
def sample(points,ds,d):
 i=max(1,min(len(ds)-1,bisect.bisect_left(ds,d)));a,b=points[i-1:i+1]
 return a.lerp(b,(d-ds[i-1])/max(1e-8,ds[i]-ds[i-1])),(b-a).normalized()
def ribbon(name,points,width,offset,z,mat):
 verts=[]
 for i,p in enumerate(points):
  tangent=points[min(len(points)-1,i+1)]-points[max(0,i-1)];side=Vector((-tangent.y,tangent.x,0)).normalized()
  for w in [-width/2,width/2]:verts.append(tuple(p+side*(w+offset)+Vector((0,0,z))))
 faces=[(i*2+2,i*2+3,i*2+1,i*2) for i in range(len(points)-1)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(mat);o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o)
 solid=o.modifiers.new('Edge thickness','SOLIDIFY');solid.thickness=.045;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name)
 return o
for n,(points,ds) in enumerate(zip(paths,distances)):
 ribbon(f'Conveyor {n+1} deck',points,.65,0,-.045,belt)
 for k in range(math.ceil(ds[-1]/.36)):
  p,t=sample(points,ds,min(k*.36,ds[-1]));o=box('Belt slat',p,(.59,.009,.009),silver,0);o.rotation_euler[2]=math.atan2(t.y,t.x)-math.pi/2
 support_spacing=6.5 if FORMAL else 2.3
 for k in range(math.ceil(ds[-1]/support_spacing)):
  p,t=sample(points,ds,min(k*support_spacing+.45,ds[-1]));base=.2
  cyl('Conveyor support',(*p[:2],(p.z-.12+base)/2),.045,p.z-.12-base,silver)
  box('Support foot',(*p[:2],base),(.27,.27,.065),white,.018)
# A small scan portal serves as the building receiving dock.
stations=[]
for i,stop in enumerate(route['stops']):
 p=world(stop['point']);t=(paths[i][1]-paths[i][0]).normalized() if i<len(paths) else (paths[-1][-1]-paths[-1][-2]).normalized()
 root=bpy.data.objects.new('Dock_%02d'%(i+1),None);scene.collection.objects.link(root);root.location=p;root.rotation_euler[2]=math.atan2(t.y,t.x)-math.pi/2
 for x in [-.45,.45]:box('Dock pillar',(x,0,.42),(.10,.18,.88),white,.035,root)
 box('Dock crown',(0,0,.86),(1.0,.20,.12),white,.035,root)
 box('Scanner light',(0,-.105,.82),(.78,.018,.035),light,.008,root)
 box('Receiver plinth',(0,0,-.12),(1.02,.7,.10),white,.03,root)
 # Small progress indicator above each scan portal.
 box('Dock status',(0,-.12,.91),(.24,.025,.05),blue,.008,root)
 stations.append({'id':stop['id'],'title':stop['title'],'point':[p.x,p.z,-p.y]})
# Hero parcel: porcelain data crate, blue straps, inset label and barcode.
parcel=bpy.data.objects.new('DATA_PARCEL',None);scene.collection.objects.link(parcel)
box('Parcel body',(0,0,.27),(.58,.64,.48),white,.065,parcel)
box('Parcel lid',(0,0,.52),(.59,.65,.07),paper,.025,parcel)
box('Blue strap length',(0,0,.555),(.085,.65,.018),blue,.008,parcel)
box('Blue strap cross',(0,0,.567),(.59,.085,.018),blue,.008,parcel)
for y in [-.327,.327]:box('Strap down face',(0,y,.28),(.085,.016,.48),blue,.006,parcel)
for x in [-.297,.297]:box('Strap down side',(x,0,.28),(.016,.085,.48),blue,.006,parcel)
box('Shipping label',(.145,-.17,.563),(.18,.22,.008),paper,.008,parcel)
for k in range(7):box('Label barcode',(.08+k*.018,-.19,.569),(.007 if k%3 else .012,.095,.004),ink,0,parcel)
box('Document seal',(-.155,-.17,.564),(.12,.15,.009),blue,.008,parcel)
for k in range(3):box('Document lines',(-.155,-.21+k*.03,.571),(.075,.009,.003),paper,0,parcel)
# One shared timeline exported as real Blender object animation and manifest.
fps=30;dwell=1.4;speed=2.45;timeline=[];clock=0
for i,(points,ds) in enumerate(zip(paths,distances)):
 timeline.append({'kind':'dwell','station':i,'start':clock,'end':clock+dwell});clock+=dwell
 duration=ds[-1]/speed;timeline.append({'kind':'travel','leg':i,'start':clock,'end':clock+duration});clock+=duration
timeline.append({'kind':'dwell','station':6,'start':clock,'end':clock+dwell});clock+=dwell
def pose(time):
 seg=next((s for s in timeline if time<=s['end']),timeline[-1])
 if seg['kind']=='travel':
  i=seg['leg'];u=(time-seg['start'])/(seg['end']-seg['start']);return sample(paths[i],distances[i],max(0,min(1,u))*distances[i][-1])
 i=seg['station'];return (paths[i][0],(paths[i][1]-paths[i][0]).normalized()) if i<6 else (paths[-1][-1],(paths[-1][-1]-paths[-1][-2]).normalized())
scene.render.fps=fps;scene.frame_start=1;scene.frame_end=math.ceil(clock*fps)+1
prev_angle=None
for frame in sorted(set(list(range(1,scene.frame_end+1,3))+[scene.frame_end]+[round(s['start']*fps)+1 for s in timeline]+[round(s['end']*fps)+1 for s in timeline])):
 p,t=pose((frame-1)/fps);angle=math.atan2(t.y,t.x)-math.pi/2
 if prev_angle is not None:
  while angle-prev_angle>math.pi:angle-=2*math.pi
  while angle-prev_angle< -math.pi:angle+=2*math.pi
 prev_angle=angle;parcel.location=p;parcel.rotation_euler=(math.atan2(t.z,math.hypot(t.x,t.y)),0,angle)
 parcel.keyframe_insert(data_path='location',frame=frame);parcel.keyframe_insert(data_path='rotation_euler',frame=frame)
if parcel.animation_data:parcel.animation_data.action.name='Parcel delivery | seven receiving docks'
# Merge static manufacturing parts into one mesh per material to keep draw calls low.
for mat in [white,blue,belt,silver,ink,light,paper]:
 group=[o for o in scene.objects if o.type=='MESH' and o.parent is None and o.data.materials[0]==mat]
 if not group:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name='Conveyor_'+mat.name.split(' |')[0]
scene.frame_set(1)
manifest={'version':'1.0.4','companionOffset':layout['companionOffset'],'fps':fps,'duration':clock,'stations':stations,'paths':[[[p.x,p.z,-p.y] for p in points] for points in paths],'timeline':timeline,'asset':'conveyor-parcel.glb','meaning':'Illustrative demonstration only; not real business progress'}
if not FORMAL:(OUT/'timeline.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
bpy.ops.export_scene.gltf(filepath=str(OUT/('conveyor-parcel-formal.glb' if FORMAL else 'conveyor-parcel.glb')),export_format='GLB',export_animations=True,export_force_sampling=True,export_frame_range=True)
if FORMAL:
 print('PARCEL_FORMAL_COMPLETE',json.dumps({'support_spacing':6.5,'meshes':len([o for o in scene.objects if o.type=='MESH'])}));sys.exit(0)
# Editable animation project and studio render. Only this new file is written.
world_bg=bpy.data.worlds.new('Soft white studio');scene.world=world_bg;world_bg.use_nodes=True
bg=next(n for n in world_bg.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.8,.87,1,1);bg.inputs['Strength'].default_value=.55
def area(name,pos,power,size,target):
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Large softbox',(-6,-5,12),1900,8,(-5,-7,1));area('Fill',(3,-10,7),1100,6,(-5,-7,1))
box('Studio floor',(0,0,-.05),(70,70,.1),material('Floor',(.86,.89,.92)),.02)
bpy.ops.object.camera_add(location=(-3,-12,5.5));camera=bpy.context.object;camera.name='Detail camera';camera.rotation_euler=(Vector((-6.7,-6.4,1.2))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=6.0;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.frame_set(round(2.3*fps)+1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'parcel-conveyor.blend'))
scene.render.filepath=str(OUT/'blender-detail.png')
if '--skip-render' not in sys.argv:bpy.ops.render.render(write_still=True)
print('PARCEL_DEMO_COMPLETE',json.dumps({'duration':clock,'frames':scene.frame_end,'meshes':len([o for o in scene.objects if o.type=='MESH'])}))
