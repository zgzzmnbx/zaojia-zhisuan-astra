"""Conservative projected clearance against the frozen scene's real triangles."""
from pathlib import Path
import json, math, sys, hashlib
import numpy as np
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'Codex-Temp/parcel-conveyor-v1/route-audit';OUT.mkdir(parents=True,exist_ok=True)
STEP=.10; X0=-19;Z0=-17;NX=381;NZ=341
def heightmap():
 p=ROOT/'public/sandbox-v11/model';g=json.loads((p/'model.gltf').read_text(encoding='utf-8'));buffers=[(p/b['uri']).read_bytes() for b in g['buffers']]
 fingerprint=hashlib.sha256((p/'model.gltf').read_bytes()+b''.join(buffers)).hexdigest()
 cache=OUT/'scene-height.npz'
 if cache.exists():
  a=np.load(cache)
  if 'fingerprint' in a and str(a['fingerprint'])==fingerprint:return a['heights'],a['owners'],list(a['names'])
 def attr(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];dim={'VEC3':3,'SCALAR':1}[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0)
  return np.ndarray((a['count'],dim),dtype=dt,buffer=buffers[v['buffer']],offset=off,strides=(v.get('byteStride',np.dtype(dt).itemsize*dim),np.dtype(dt).itemsize))
 h=np.zeros((NZ,NX));owners=np.zeros((NZ,NX),dtype=np.int16);names=['none']
 for node in g['nodes']:
  if 'mesh' not in node:continue
  assert 'rotation' not in node and 'matrix' not in node, 'Update audit transforms for changed source geometry'
  names.append(node['name']);owner=len(names)-1
  for prim in g['meshes'][node['mesh']]['primitives']:
   v=attr(prim['attributes']['POSITION']).astype(float)*node.get('scale',[1,1,1])+node.get('translation',[0,0,0]);ix=attr(prim['indices']).ravel().reshape(-1,3) if 'indices' in prim else np.arange(len(v)).reshape(-1,3)
   for tri in v[ix]:
    if tri[:,1].max()<.85:continue
    a,b,c=tri;den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
    if abs(den)<1e-9:continue
    xlo=max(0,math.floor((tri[:,0].min()-X0)/STEP));xhi=min(NX-1,math.ceil((tri[:,0].max()-X0)/STEP));zlo=max(0,math.floor((tri[:,2].min()-Z0)/STEP));zhi=min(NZ-1,math.ceil((tri[:,2].max()-Z0)/STEP))
    if xlo>xhi or zlo>zhi:continue
    x=X0+np.arange(xlo,xhi+1)[None,:]*STEP;z=Z0+np.arange(zlo,zhi+1)[:,None]*STEP
    u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;w=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;y=u*a[1]+w*b[1]+(1-u-w)*c[1]
    old=h[zlo:zhi+1,xlo:xhi+1];mask=(u>=-1e-5)&(w>=-1e-5)&(u+w<=1.00001)&(y>old);old[mask]=y[mask];owners[zlo:zhi+1,xlo:xhi+1][mask]=owner
 np.savez_compressed(cache,heights=h,owners=owners,names=names,fingerprint=fingerprint);return h,owners,names
def companion(paths,offset_distance=.74):
 points=[];cuts=[0]
 for leg in paths:
  for p in leg:
   if not points or np.linalg.norm(p-points[-1])>1e-5:points.append(p)
  cuts.append(len(points)-1)
 points=np.array(points);offset=[]
 for i,p in enumerate(points):
  a=p-points[max(0,i-1)];b=points[min(len(points)-1,i+1)]-p;a[1]=b[1]=0
  if np.linalg.norm(a)<1e-5:a=b.copy()
  if np.linalg.norm(b)<1e-5:b=a.copy()
  a/=np.linalg.norm(a);b/=np.linalg.norm(b);sa=np.array([a[2],0,-a[0]]);sb=np.array([b[2],0,-b[0]]);s=sa+sb;s/=np.linalg.norm(s);offset.append(p+s*min(1.05,offset_distance/max(.5,s@sa))+[0,.08,0])
 return [np.array(offset[a:b+1]) for a,b in zip(cuts,cuts[1:])]
def check_point(p,radius,h,owners,names):
 ix=round((p[0]-X0)/STEP);iz=round((p[2]-Z0)/STEP);n=math.ceil(radius/STEP)+1;hits=set()
 for z in range(max(0,iz-n),min(NZ,iz+n+1)):
  for x in range(max(0,ix-n),min(NX,ix+n+1)):
   if math.hypot(X0+x*STEP-p[0],Z0+z*STEP-p[2])<=radius+.07 and h[z,x]>p[1]-.12:hits.add(names[owners[z,x]])
 return sorted(hits)
if __name__=='__main__':
 h,owners,names=heightmap();t=json.loads((ROOT/'05-视觉识别/02-3D场景/parcel-conveyor-v1/timeline.json').read_text(encoding='utf-8'));paths=[np.array(p) for p in t['paths']];pipes=companion(paths,t.get("companionOffset",.74));hits=[]
 im=Image.new('RGB',(NX*3,NZ*3),'white');d=ImageDraw.Draw(im)
 for z,x in zip(*np.where(h>.95)):
  color=(160,170,180) if h[z,x]>2 else (220,225,230);d.rectangle((x*3,z*3,x*3+2,z*3+2),fill=color)
 def pixel(p):return ((p[0]-X0)/STEP*3,(p[2]-Z0)/STEP*3)
 for kind,legs,r in [('belt',paths,.47),('pipe',pipes,.20)]:
  for i,leg in enumerate(legs):
   d.line([pixel(p) for p in leg],fill=(0,130,220) if kind=='belt' else (80,205,190),width=3)
   for j,p in enumerate(leg):
    found=check_point(p,r,h,owners,names)
    if found:
     hits.append({'kind':kind,'leg':i,'sample':j,'point':p.tolist(),'objects':found});x,z=pixel(p);d.ellipse((x-3,z-3,x+3,z+3),fill=(240,55,45))
 for i,s in enumerate(t['stations']):
  p=np.array(s['point']);x,z=pixel(p);d.text((x+6,z+5),s['id'],fill='black');d.ellipse((x-5,z-5,x+5,z+5),outline='black',width=2)
  found=check_point(p,.64,h,owners,names)
  if found:hits.append({'kind':'dock','station':i,'point':p.tolist(),'objects':found})
 for i,p in enumerate([leg[0] for leg in pipes]+[pipes[-1][-1]]):
  found=check_point(p-[0,.17,0],.34,h,owners,names)
  if found:hits.append({'kind':'socket','station':i,'point':p.tolist(),'objects':found})
 tag=sys.argv[1] if len(sys.argv)>1 else t['version'];im.save(OUT/(tag+'.png'));(OUT/(tag+'.json')).write_text(json.dumps({'version':t['version'],'hits':hits},indent=2))
 print(json.dumps({'samples':sum(map(len,paths)),'hits':len(hits),'groups':sorted(set((a['kind'],str(a.get('leg',a.get('station'))),','.join(a['objects'])) for a in hits))}))
 if hits:sys.exit(1)
