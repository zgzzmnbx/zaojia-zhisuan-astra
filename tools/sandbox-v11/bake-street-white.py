"""Rebake roads/curbs in the city's Blender lighting; export UVs without moving vertices."""
import bpy,json,math,struct,sys,time,hashlib
from pathlib import Path
root=Path(sys.argv[sys.argv.index('--')+1]).resolve()
out=root/'05-视觉识别/02-3D场景/sandbox-v11/street-white-v1';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'05-视觉识别/02-3D场景/sandbox-v11/city-white-v1/city-white.blend'))
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
street=next(o for o in scene.objects if o.get('role')=='background_street')
mat=bpy.data.materials.new('Soft white miniature roads and curbs');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.82,.82,.82,1);bsdf.inputs['Roughness'].default_value=.9
street.data.materials.clear();street.data.materials.append(mat)
for p in street.data.polygons:p.material_index=0
# Old tiny islands were replaced with vertex lighting in V11. Reunwrap the full
# street/curb mesh together to avoid inheriting those dark vertex colors or UVs.
bpy.ops.object.select_all(action='DESELECT');street.select_set(True);bpy.context.view_layer.objects.active=street
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.004)
bpy.ops.object.mode_set(mode='OBJECT')
def key(p):return tuple(round(float(x),5) for x in p)
lookup={}
for poly in street.data.polygons:
 corners=[]
 for li in poly.loop_indices:
  v=street.matrix_world@street.data.vertices[street.data.loops[li].vertex_index].co
  uv=street.data.uv_layers.active.data[li].uv
  corners.append((key((v.x,v.z,-v.y)),(float(uv.x),1-float(uv.y))))
 assert len(corners)==3
 lookup[tuple(sorted(p for p,uv in corners))]=dict(corners)
base=root/'public/sandbox-v11/model';g=json.loads((base/'model.gltf').read_text())
def attr(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];b=(base/g['buffers'][v['buffer']]['uri']).read_bytes()
 count={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']];fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']]
 stride=v.get('byteStride',struct.calcsize('<'+fmt)*count);offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*count,b,offset+i*stride) for i in range(a['count'])]
node=next(n for n in g['nodes'] if n.get('extras',{}).get('role')=='background_street')
payload={}
for primitive in g['meshes'][node['mesh']]['primitives']:
 positions=attr(primitive['attributes']['POSITION']);indices=[x[0] for x in attr(primitive['indices'])];uvs=[]
 for i in range(0,len(indices),3):
  points=[key(positions[j]) for j in indices[i:i+3]];corners=lookup[tuple(sorted(points))]
  for p in points:uvs.extend(corners[p])
 payload[g['materials'][primitive['material']]['name']]=uvs
(out/'street-uv.json').write_text(json.dumps(payload,separators=(',',':')),encoding='utf-8')
image=bpy.data.images.new('Street soft daylight',width=2048,height=2048,alpha=False,float_buffer=True)
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;mat.node_tree.nodes.active=tex
for n in mat.node_tree.nodes:n.select=n==tex
scene.cycles.samples=2048;scene.cycles.use_adaptive_sampling=False
scene.render.bake.use_pass_direct=True;scene.render.bake.use_pass_indirect=True;scene.render.bake.use_pass_color=True;scene.render.bake.margin=6
start=time.time();bpy.ops.object.bake(type='DIFFUSE')
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='8'
image.save_render(str(out/'street-white.png'),scene=scene);image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'street-white.blend'))
manifest={'blender':bpy.app.version_string,'engine':'Cycles CPU','samples':2048,'adaptive_sampling':False,'size':[2048,2048],'world':.7,'sun':1.3,'sun_angle_degrees':18,'material_linear_white':.82,'role':'background_street','geometry_positions_unchanged':True,'triangles':len(street.data.polygons),'seconds':time.time()-start,'texture_sha256':hashlib.sha256((out/'street-white.png').read_bytes()).hexdigest(),'uv_sha256':hashlib.sha256((out/'street-uv.json').read_bytes()).hexdigest()}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');print('BAKE_DONE',json.dumps(manifest))
