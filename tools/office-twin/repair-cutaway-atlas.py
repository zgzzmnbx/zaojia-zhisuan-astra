"""Repair only upper cabinet/column UV islands; retain every healthy texel.

The original private GLB is read-only. Face-local colour reconstruction removes
obsolete enclosed-wall occlusion, not contact shadows on floors/undersides.
"""
import struct,json,io,re,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path.cwd();OUT=ROOT/'Codex-Temp/office-edge-audit'
OUT.mkdir(parents=True,exist_ok=True)
b=(ROOT/'public/office-twin/models/H1-baked-v0.6.7.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);blob=b[28+n:]
assert hashlib.sha256(b).hexdigest()=='c805ae3f8074f3c9cba9c36249401c97bd4a9b13c5d57ce236fc66a5032a2545', 'Unexpected source model: audit face masks before rebuilding'
def acc(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']]
 return np.frombuffer(blob,dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']],count=a['count']*{'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']],offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],-1)
report=[]
for kind,image_id,pattern in [('cabinet',2,r'CAB_\d{3}\.001'),('column',7,r'COL_\d{2}_cut'),('wall',5,r'W_E_MS_S_cut')]:
 v=g['bufferViews'][g['images'][image_id]['bufferView']];im=Image.open(io.BytesIO(blob[v['byteOffset']:v['byteOffset']+v['byteLength']])).convert('RGB')
 original=np.array(im);result=original.copy();h,w=original.shape[:2];lum=original.mean(2)
 for node in g['nodes']:
  if not re.fullmatch(pattern,node.get('name','')) or 'mesh' not in node:continue
  for p in g['meshes'][node['mesh']]['primitives']:
   m=g['materials'][p['material']];t=m.get('pbrMetallicRoughness',{}).get('baseColorTexture')
   if not t or g['textures'][t['index']]['source']!=image_id:continue
   uv=acc(p['attributes']['TEXCOORD_0']);pos=acc(p['attributes']['POSITION']);norm=acc(p['attributes']['NORMAL']);ids=acc(p['indices']).ravel().reshape(-1,3)
   groups={}
   for tri in ids:
    normal=norm[tri[0]]
    if normal[1]<-.05:continue # floor contact and undersides are never repaired
    groups.setdefault(tuple(np.round(normal,3)),[]).append(tri)
   for normal,tris in groups.items():
    mask=Image.new('L',(w,h));draw=ImageDraw.Draw(mask)
    for tri in tris:
     polygon=[np.array([*uv[i],pos[i,1]]) for i in tri]
     if normal[1]<.6:
      height=pos[:,1].min()+(np.ptp(pos[:,1])*.55 if kind=='wall' else .06);clipped=[]
      for a,c in zip(polygon,polygon[1:]+polygon[:1]):
       if a[2]>=height:clipped.append(a)
       if (a[2]>=height)!=(c[2]>=height):clipped.append(a+(c-a)*(height-a[2])/(c[2]-a[2]))
      polygon=clipped
     if len(polygon)>=3:draw.polygon([(float(v[0]*w),float(v[1]*h)) for v in polygon],fill=255)
    inside=np.array(mask)>0
    bad=inside&(lum<75)
    if bad.sum()<8:continue
    healthy=inside&(lum>165)&(lum<245)
    # A planar face retains its authored gentle gradient. A fully occluded
    # cabinet face uses the neighbouring white-furniture orientation palette.
    ys,xs=np.where(healthy)
    by,bx=np.where(inside)
    if len(xs)>20:
     stride=max(1,len(xs)//4000);xs=xs[::stride];ys=ys[::stride]
     A=np.stack([np.ones(len(xs)),xs/w,ys/h],1)
     coeff=np.linalg.lstsq(A,original[ys,xs].astype(float),rcond=None)[0]
     prediction=np.stack([np.ones(len(bx)),bx/w,by/h],1)@coeff
     med=np.median(original[ys,xs],axis=0);prediction=np.clip(prediction,med-12,med+12)
    else:
     base=222 if normal[1]>.6 else (209 if abs(normal[2])>.6 else 201)
     prediction=np.tile([base,base,base-2],(len(bx),1)).astype(float)
     prediction+=((by-by.min())/max(1,np.ptp(by))-.5)[:,None]*3
    # Smooth only anomalously dark portions of this identified face island.
    alpha=np.clip((155-lum[by,bx])/65,0,1)[:,None]
    result[by,bx]=np.round(original[by,bx]*(1-alpha)+prediction*alpha).astype('uint8')
    report.append({'node':node['name'],'normal':list(map(float,normal)),'blackTexels':int(bad.sum()),'repairedTexels':int((alpha>0).sum())})
 out=Image.fromarray(result)
 # Cabinets occupy tiny screen areas; 2K retains their bevel detail at audit zoom.
 if w>2048:out=out.resize((2048,2048),Image.Resampling.LANCZOS)
 out.save(ROOT/f'public/office-twin/models/{kind}-cutaway-v0314.png')
 print(kind,'changed source texels',int(np.any(result!=original,axis=2).sum()),'of',w*h)
(OUT/'repair-report.json').write_text(json.dumps(report,indent=2),'utf-8')
print('face islands',len(report))
