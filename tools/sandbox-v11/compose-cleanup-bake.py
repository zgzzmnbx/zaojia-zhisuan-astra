"""Place Blender's cleaned lighting only in the old object contact footprints.
Rasterize original UV triangles, preserving original atlas bytes outside repair masks.
"""
from pathlib import Path
import json,struct,hashlib
import numpy as np
from PIL import Image
r=Path.cwd();base=r/'public/sandbox-v11/model';out=r/'05-视觉识别/02-3D场景/sandbox-v11/site-cleanup-v1';tmp=r/'Codex-Temp/sandbox-cleanup-v01321'
g=json.loads((base/'model.gltf').read_text(encoding='utf-8'));buffers=[(base/b['uri']).read_bytes() for b in g['buffers']]
def attr(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC3':3,'VEC2':2}[a['type']];fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']];stride=v.get('byteStride',struct.calcsize('<'+fmt*n));off=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.array([struct.unpack_from('<'+fmt*n,buffers[v['buffer']],off+j*stride) for j in range(a['count'])])
def rect_weight(x,z,bounds,fade=.12):
 x0,x1,z0,z1=bounds;d=np.minimum.reduce([x-x0,x1-x,z-z0,z1-z]);t=np.clip(d/fade,0,1);return t*t*(3-2*t)
records=[]
for ni,name,imnum in [(2,'price',2),(7,'site',7)]:
 n=g['nodes'][ni];p=g['meshes'][n['mesh']]['primitives'][0];pos=attr(p['attributes']['POSITION'])+n.get('translation',[0,0,0]);uv=attr(p['attributes']['TEXCOORD_0']);idx=attr(p['indices']).ravel()
 old=np.array(Image.open(base/f'texture-{imnum:02}.png').convert('RGB'));clean=np.array(Image.open(tmp/(name+'-clean-bake.png')).convert('RGB'));h,w=old.shape[:2];mask=np.zeros((h,w),np.float32);calibrate=np.zeros((h,w),bool)
 for t in idx.reshape(-1,3):
  pts=pos[t];height=pts[:,1]
  if np.ptp(height)>1e-5:continue
  level=float(height.mean())
  if name=='site' and abs(level-.13)>.0001:continue
  if name=='price' and min(abs(level-2),abs(level-.5))>.0001:continue
  # glTF V increases downward. Pixel centers; Blender's bake export is top-down too.
  tri=uv[t]*[w,h];low=np.maximum(0,np.floor(tri.min(axis=0)).astype(int));high=np.minimum([w-1,h-1],np.ceil(tri.max(axis=0)).astype(int))
  if np.any(high<low):continue
  xx,yy=np.meshgrid(np.arange(low[0],high[0]+1),np.arange(low[1],high[1]+1));q=np.stack([xx+.5,yy+.5],-1);a,b,c=tri;matrix=np.stack([b-a,c-a],axis=1)
  if abs(np.linalg.det(matrix))<1e-9:continue
  bc=(q-a)@np.linalg.inv(matrix).T;bary=np.stack([1-bc[...,0]-bc[...,1],bc[...,0],bc[...,1]],-1);inside=(bary>=-1e-6).all(axis=-1);world=bary@pts;x,z=world[...,0],world[...,2]
  if name=='site':
   bounds=[(-14.25,14.25,-7.03,-5.0),(-5.85,-4.15,-5.6,5.25),(3.2,4.8,-5.6,3.1)]
  elif abs(level-2)<.0001:bounds=[(-3.55,-2.18,-3.99,-2.32),(.35,1.85,-3.99,-2.32)]
  else:bounds=[(-4.35,-3.4,.60,1.55),(2.0,2.95,.60,1.55)]
  weight=np.maximum.reduce([rect_weight(x,z,b) for b in bounds])*inside
  view=mask[low[1]:high[1]+1,low[0]:high[0]+1];np.maximum(view,weight,out=view)
  # Calibration uses nearby undamaged, bright receiver texels only.
  cv=calibrate[low[1]:high[1]+1,low[0]:high[0]+1];cv|=inside&(weight==0)
 good=calibrate&(old.min(axis=2)>155)&(clean.min(axis=2)>100)&(clean.max(axis=2)<254)
 ratios=old.astype(float)/np.maximum(clean,1)
 ratio=np.median(ratios[good],axis=0) if good.any() else np.ones(3)
 replacement=np.clip(clean.astype(float)*ratio,0,255)
 final=np.rint(old*(1-mask[...,None])+replacement*mask[...,None]).astype(np.uint8)
 assert np.array_equal(final[mask==0],old[mask==0])
 Image.fromarray(final).save(out/(name+'-clean.png'));Image.fromarray((mask*255).astype(np.uint8)).save(tmp/(name+'-repair-mask.png'))
 records.append(dict(name=name,patchedPixels=int((mask>0).sum()),unchangedOutsideMask=True,calibration=ratio.tolist(),sha256=hashlib.sha256((out/(name+'-clean.png')).read_bytes()).hexdigest()))
(out/'bake-manifest.json').write_text(json.dumps({'method':'Blender Cycles diffuse, 64 samples; original UV atlas with local contact-footprint masks','textures':records},indent=2),encoding='utf-8');print(records)
