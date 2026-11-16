"""Transfer the deployed V11 city/street bake UVs onto unchanged office triangles.
Private generated maps stay outside Git; immutable source GLB is never rewritten.
Run from the Astra workspace with Python + numpy.
"""
import json,struct,numpy as np
from pathlib import Path
root=Path(__file__).resolve().parents[2]
def load(p):
 b=p.read_bytes()
 if p.suffix=='.glb':
  size=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+size]);bins=[b[28+size:]]
 else:g=json.loads(b);bins=[(p.parent/x['uri']).read_bytes() for x in g['buffers']]
 def attr(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];n={'VEC3':3,'VEC2':2,'VEC4':4,'SCALAR':1}[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',np.dtype(dt).itemsize*n)
  return np.ndarray((a['count'],n),dtype=dt,buffer=bins[v['buffer']],offset=off,strides=(stride,np.dtype(dt).itemsize)).copy()
 return g,attr

import hashlib,shutil
out=root/'public/office-twin/models/astra-context-v1';out.mkdir(exist_ok=True)
source=root/'runtime/astra-service';og,oa=load(root/'public/office-twin/models/H1-baked-v0.6.7.glb');hg,ha=load(source/'public/sandbox-v11/model/model.gltf')
street_uv=json.loads((source/'05-视觉识别/02-3D场景/sandbox-v11/street-white-v1/street-uv.json').read_text('utf-8'))
chunks=[];entries=[];total=0;matched={}
for kind,oname,hrole in [('city','ContextWeb_Buildings','background_city'),('street','ContextWeb_RoadsBases','background_street')]:
 hn=next(n for n in hg['nodes'] if n.get('extras',{}).get('role')==hrole);on=next(n for n in og['nodes'] if n.get('name')==oname)
 htris=[];huvs=[]
 for pr in hg['meshes'][hn['mesh']]['primitives']:
  pos=ha(pr['attributes']['POSITION'])+hn.get('translation',[0,0,0]);ix=ha(pr['indices']).flatten()
  htris.extend(pos[ix].reshape(-1,3,3))
  uv=np.array(street_uv[hg['materials'][pr['material']]['name']]).reshape(-1,2) if kind=='street' else ha(pr['attributes']['TEXCOORD_0'])[ix]
  huvs.extend(uv.reshape(-1,3,2))
 htris=np.array(htris);huvs=np.array(huvs);centers=htris.mean(1);hit=set()
 for pi,pr in enumerate(og['meshes'][on['mesh']]['primitives']):
  pos=oa(pr['attributes']['POSITION'])+on.get('translation',[0,0,0]);pos[:,[0,2]]/=2.2;pos[:,1]=pos[:,1]/4-1.22
  tris=pos[oa(pr['indices']).flatten()].reshape(-1,3,3);result=np.zeros((len(tris),3,3),dtype='<f4');matches=0
  for start in range(0,len(tris),64):
   part=tris[start:start+64];distance=((part.mean(1)[:,None,:]-centers[None,:,:])**2).sum(2);indices=distance.argmin(1)
   for j,index in enumerate(indices):
    t=start+j;dist=((tris[t,:,None,:]-htris[index,None,:,:])**2).sum(2);corner=dist.argmin(1)
    if np.sqrt(dist[np.arange(3),corner]).max()<.0001 and len(set(corner))==3:
     result[t,:,:2]=huvs[index,corner];result[t,:,2]=1 if kind=='city' else 2;matches+=1;hit.add(int(index))
  if kind=='city':assert matches==len(tris),(pi,matches,len(tris))
  entries.append({'node':oname,'primitive':pi,'vertices':len(tris)*3,'sourceVertices':len(pos),'offset':total,'floats':result.size,'matchedTriangles':matches,'retainedOfficeBaseTriangles':len(tris)-matches})
  chunks.append(result.tobytes());total+=result.nbytes
 assert len(hit)==len(htris),(kind,len(hit),len(htris));matched[kind]=len(hit)
(out/'uv.buffer').write_bytes(b''.join(chunks))
textures={}
for name,sub in [('city','city-white-v1/city-white.png'),('street','street-white-v1/street-white.png')]:
 src=source/'05-视觉识别/02-3D场景/sandbox-v11'/sub;dst=out/(name+'.png');shutil.copy2(src,dst);textures[name]=hashlib.sha256(dst.read_bytes()).hexdigest()
manifest={'version':1,'sourceOfficeSHA256':hashlib.sha256((root/'public/office-twin/models/H1-baked-v0.6.7.glb').read_bytes()).hexdigest(),'source':'deployed Astra V11 city-white-v1 and street-white-v1','entries':entries,'matchedTriangles':matched,'textureSHA256':textures,'uvSHA256':hashlib.sha256((out/'uv.buffer').read_bytes()).hexdigest()}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),'utf-8');print(json.dumps(manifest,indent=2))
