"""Bake office structural whites with the deployed V11 uniform daylight rig.
Run Blender --background --factory-startup --python this-file -- exterior|interior|entry.
Writes private companion maps/UVs only; source GLB and business metadata stay intact.
"""
import bpy, json, math, struct, hashlib, time, sys, re
import numpy as np
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/office-twin/models/astra-structure-v1';OUT.mkdir(exist_ok=True)
kind=sys.argv[sys.argv.index('--')+1];assert kind in ['exterior','interior','entry'];started=time.time()
source=ROOT/'public/office-twin/models/H1-baked-v0.6.7.glb';raw=source.read_bytes();size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size]);binary=raw[28+size:]
assert hashlib.sha256(raw).hexdigest()=='c805ae3f8074f3c9cba9c36249401c97bd4a9b13c5d57ce236fc66a5032a2545'
def attr(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];n={'VEC3':3,'VEC2':2,'VEC4':4,'SCALAR':1}[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',np.dtype(dt).itemsize*n)
 return np.ndarray((a['count'],n),dtype=dt,buffer=binary,offset=off,strides=(stride,np.dtype(dt).itemsize)).copy()
parents={c:i for i,n in enumerate(g['nodes']) for c in n.get('children',[])};matrices={}
def ancestry(i):
 result=[]
 while True:
  result.append(g['nodes'][i])
  if i not in parents:return result
  i=parents[i]
def world(i):
 if i in matrices:return matrices[i]
 n=g['nodes'][i];r=n.get('rotation',[0,0,0,1]);m=Matrix(np.array(n['matrix']).reshape(4,4).T) if 'matrix' in n else Matrix.LocRotScale(Vector(n.get('translation',[0,0,0])),Quaternion((r[3],*r[:3])),Vector(n.get('scale',[1,1,1])))
 matrices[i]=world(parents[i])@m if i in parents else m;return matrices[i]
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;bpy.context.preferences.filepaths.save_version=0
points=[];faces=[];occpoints=[];occfaces=[];entries=[]
for i,n in enumerate(g['nodes']):
 if 'mesh' not in n:continue
 ancestors=ancestry(i);names=[x.get('name','') for x in ancestors];name=n.get('name','');office='H1_F09_Office' in names
 if any(x.get('extras',{}).get('furniture_asset_id')=='tower' for x in ancestors):continue
 # Same removed elevator/stair core as the web board; do not bake obsolete black footprints.
 if office and (name=='Core_floor' or name.startswith('CORE_') and not re.match(r'^CORE_(?:N_cut|S_cut|W_|E_)',name)):continue
 if kind=='interior' and not office:continue
 for pi,p in enumerate(g['meshes'][n['mesh']]['primitives']):
  material=g['materials'][p['material']]['name'];role=n.get('extras',{}).get('night_role','')
  floor=office and (n.get('extras',{}).get('entity_type')=='floor_slab' or name.endswith('_floor'))
  wall=office and (name.startswith(('W_','COL_','CORE_N_cut','CORE_S_cut','CORE_W_','CORE_E_')))
  outside=not office and material.startswith(('V065_NativeLight_frames','V065_NativeLight_plates','V067_NativeLight_facade','V067_NativeLight_entry','V067_NativeLight_roof')) and role not in ['window','accent','sign'] and not re.search('Glass|Glazing|PipeChina|Logo|Sign',name)
  target=(name=='V064_Integrated_Podium_Plinth' or bool(re.match(r'^V067_Entry_Step_\d{2}$',name))) if kind=='entry' else outside if kind=='exterior' else floor or wall
  pos=attr(p['attributes']['POSITION']);ix=attr(p['indices']).astype(np.int64).flatten().reshape(-1,3);w=np.array(world(i));pos=(np.c_[pos,np.ones(len(pos))]@w.T)[:,:3];pos=pos[:,[0,2,1]]*np.array([1,-1,1])
  if kind=='entry' and re.match(r'^V067_Entry_Step_\d{2}$',name):
   # The authored steps interpenetrate: their buried bevels become visible
   # during shell fading. Separate them only in the bake scene so each keeps
   # its directional relief/self-shadow without a neighbour's solid-black mask.
   pos[:,0]+=100*int(name.rsplit('_',1)[1])
  if target:
   start=len(faces);offset=len(points);points.extend(pos.tolist());faces.extend((ix+offset).tolist());entries.append({'node':name,'primitive':pi,'sourceVertices':len(pos),'vertices':ix.size,'triangleStart':start,'triangles':len(ix),'kind':'floor' if floor else 'wall' if wall else 'shell'})
  else:
   offset=len(occpoints);occpoints.extend(pos.tolist());occfaces.extend((ix+offset).tolist())
def mesh(name,vertices,polygons):
 data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],polygons);data.update();o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);return o
receiver=mesh('Office '+kind+' diffuse receiver',points,faces);occluder=mesh('Unchanged scene occluders',occpoints,occfaces)
if kind=='entry':
 # These surfaces overlap the assembled shell, which moves/fades in cutaway
 # views. Bake their own relief and self-occlusion independently;
 # the unchanged ground atlas retains the building's real contact shadow.
 occluder.hide_render=True
def material(name,white):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(white,white,white,1);p.inputs['Roughness'].default_value=.85;return m
receiver.data.materials.append(material('Astra same white matte',.9));occluder.data.materials.append(material('Neutral bake occluders',.8))
# Only atlas coordinates are authored; positions, winding and triangle order stay unchanged.
bpy.ops.object.select_all(action='DESELECT');receiver.select_set(True);bpy.context.view_layer.objects.active=receiver
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.01 if kind=='entry' else .003);bpy.ops.object.mode_set(mode='OBJECT')
uv=receiver.data.uv_layers.active;chunks=[];offset=0
if kind=='entry':
 # Smart projection gives millimetre bevels subpixel islands even in their own
 # atlas. Allocate each triangle a padded patch with 8px minimum patch dimensions;
 # UV stretching changes sampling density only, never geometry or illumination.
 resolution=2048;pad=8;density=1024.
 while True:
  rectangles=[]
  for face in receiver.data.polygons:
   vertices=[receiver.data.vertices[i].co for i in face.vertices]
   longest=max((vertices[1]-vertices[0]).length,(vertices[2]-vertices[0]).length,(vertices[2]-vertices[1]).length)
   aspect=min(16.,max(1.,longest*longest/max(1e-9,2*face.area)))
   area=max(64.,2*face.area*density)
   height=max(8,math.ceil(math.sqrt(area/aspect)));width=max(8,math.ceil(math.sqrt(area*aspect)))
   rectangles.append((face.index,width,height))
  x=y=row=0;placements={};fits=True
  for index,width,height in sorted(rectangles,key=lambda r:-r[2]):
   if width+2*pad>resolution:fits=False;break
   if x+width+2*pad>resolution:x=0;y+=row;row=0
   if y+height+2*pad>resolution:fits=False;break
   placements[index]=(x+pad,y+pad,width,height);x+=width+2*pad;row=max(row,height+2*pad)
  if fits:break
  density*=.85
 for face in receiver.data.polygons:
  x,y,width,height=placements[face.index]
  for li,point in zip(face.loop_indices,[(x,y),(x+width,y),(x,y+height)]):uv.data[li].uv=(point[0]/resolution,point[1]/resolution)
 print('ENTRY_UV_PACKED',len(placements),'density',density,'minPatchDimension',8,flush=True)
for e in entries:
 values=[]
 for face in receiver.data.polygons[e['triangleStart']:e['triangleStart']+e['triangles']]:
  assert len(face.loop_indices)==3
  for li in face.loop_indices:values.extend([uv.data[li].uv.x,1-uv.data[li].uv.y])
 e['offset']=offset;e['floats']=len(values);data=np.array(values,dtype='<f4').tobytes();chunks.append(data);offset+=len(data)
(OUT/(kind+'-uv.buffer')).write_bytes(b''.join(chunks))
worlddata=bpy.data.worlds.new('Astra uniform soft daylight');worlddata.use_nodes=True;bg=worlddata.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(1,1,1,1);bg.inputs['Strength'].default_value=.7;scene.world=worlddata
sun=bpy.data.lights.new('Astra distant soft key','SUN');sun.energy=1.3;sun.angle=math.radians(18);lamp=bpy.data.objects.new(sun.name,sun);scene.collection.objects.link(lamp);lamp.rotation_euler=Vector((.45,.35,-.82)).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=128 if kind=='entry' else 512;scene.cycles.use_adaptive_sampling=False;scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=4;scene.render.threads_mode='FIXED';scene.render.threads=12
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
resolution=4096 if kind=='exterior' else 2048
image=bpy.data.images.new('Astra '+kind+' daylight',width=resolution,height=resolution,alpha=False,float_buffer=True);m=receiver.data.materials[0];node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;m.node_tree.nodes.active=node
scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=True;scene.render.bake.margin=16 if kind=='entry' else 8
print('BAKE_START',kind,len(entries),len(faces),len(occfaces),flush=True);bpy.ops.object.bake(type='DIFFUSE')
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='16';image.save_render(str(OUT/(kind+'.png')),scene=scene)
image.pack();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Codex-Temp/office-structure-match'/(kind+'.blend')))
report={'kind':kind,'entries':entries,'sourceOfficeSHA256':hashlib.sha256(raw).hexdigest(),'textureSHA256':hashlib.sha256((OUT/(kind+'.png')).read_bytes()).hexdigest(),'uvSHA256':hashlib.sha256((OUT/(kind+'-uv.buffer')).read_bytes()).hexdigest(),'samples':scene.cycles.samples,'resolution':resolution,'lighting':{'world':.7,'sun':1.3,'angle':18,'white':.9,'roughness':.85,'transform':'Standard sRGB'},'seconds':time.time()-started}
if kind=='entry':report['cutaway']={'externalOccluders':False,'selfOcclusion':True,'stepsSeparatedForBakeOnly':True,'uvPacking':'padded per-triangle patches','minimumPatchDimension':8,'padding':8,'groundShadow':'unchanged original ground atlas'}
(OUT/(kind+'.json')).write_text(json.dumps(report,indent=2),'utf-8');print('BAKE_COMPLETE',kind,report['seconds'],flush=True)

