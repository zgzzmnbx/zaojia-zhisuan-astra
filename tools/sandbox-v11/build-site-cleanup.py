"""Create an editable private Blender copy from the audited frozen-triangle selection.
Run from the project root with Blender --background --python this-file.
The original glTF, .blend files and conveyor assets remain read-only.
"""
import bpy,bmesh,json,struct,hashlib
from mathutils import Vector
from mathutils.kdtree import KDTree
from pathlib import Path
r=Path.cwd();base=r/'public/sandbox-v11/model';out=r/'05-视觉识别/02-3D场景/sandbox-v11/site-cleanup-v1'
spec=json.loads((out/'cleanup.json').read_text(encoding='utf-8'))
assert hashlib.sha256((base/'model.gltf').read_bytes()).hexdigest()==spec['sourceSha256']
g=json.loads((base/'model.gltf').read_text(encoding='utf-8'));buffers=[(base/b['uri']).read_bytes() for b in g['buffers']]
def attr(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC3':3}[a['type']];fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']];stride=v.get('byteStride',struct.calcsize('<'+fmt*n));offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*n,buffers[v['buffer']],offset+j*stride) for j in range(a['count'])]
def key(points):return tuple(sorted(tuple(round(v,4) for v in p) for p in points))
remove={}
for n in g['nodes']:
 for p in g['meshes'][n['mesh']]['primitives']:
  name=g['materials'][p['material']]['name']
  if name not in spec['meshes']:continue
  pos=attr(p['attributes']['POSITION']);idx=[x[0] for x in attr(p['indices'])];t=n.get('translation',[0,0,0])
  keys=set()
  for start,end in spec['meshes'][name]['remove']:
   for f in range(start,end):keys.add(key([[pos[v][j]+t[j] for j in range(3)] for v in idx[f*3:f*3+3]]))
  remove[name]=keys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(base/'model.gltf'))
counts={k:0 for k in remove}
trees={}
for name,keys in remove.items():
 keys=list(keys);tree=KDTree(len(keys))
 for i,k in enumerate(keys):tree.insert(Vector(tuple(sum(p[j] for p in k)/3 for j in range(3))),i)
 tree.balance();trees[name]=(tree,keys)
for ob in bpy.context.scene.objects:
 if ob.type!='MESH':continue
 bm=bmesh.new();bm.from_mesh(ob.data);selected=[]
 for f in bm.faces:
  name=ob.data.materials[f.material_index].name
  if name not in remove:continue
  points=[ob.matrix_world@v.co for v in f.verts]
  xyz=[Vector((p.x,p.z,-p.y)) for p in points];center=sum(xyz,Vector())/3
  tree,keys=trees[name]
  for co,i,d in tree.find_range(center,.0003):
   if all(min((p-Vector(q)).length for q in keys[i])<.0003 for p in xyz):selected.append(f);counts[name]+=1;break
 if selected:
  bmesh.ops.delete(bm,geom=selected,context='FACES');bm.to_mesh(ob.data);ob.data.update()
 bm.free()
assert all(counts[k]==sum(b-a for a,b in spec['meshes'][k]['remove']) for k in counts),counts
for im in bpy.data.images:
 if im.source=='FILE' and not im.packed_file:im.pack()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'site-cleanup.blend'))
(out/'blender-manifest.json').write_text(json.dumps({'blender':bpy.app.version_string,'removedTriangles':counts,'sourceSha256':spec['sourceSha256'],'blendSha256':hashlib.sha256((out/'site-cleanup.blend').read_bytes()).hexdigest()},ensure_ascii=False,indent=2),encoding='utf-8')
print('CLEANUP_DONE',counts)
