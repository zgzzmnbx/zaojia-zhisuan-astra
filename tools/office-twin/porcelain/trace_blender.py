"""Blender background entry point; metre-scale diffuse visibility at mesh vertices."""
import math
import sys
from pathlib import Path

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

folder=Path(sys.argv[sys.argv.index('--')+1])
scene=np.load(folder/'scene.npz')
key=Vector((-.46,.73,.55)).normalized()
area=[(key+Vector(d)).normalized() for d in [(-.20,.05,.12),(.22,.05,-.08),(.12,-.09,.20),(-.16,.10,-.19)]]
samples=[]
for i in range(12):
    r=math.sqrt((i+.5)/12)
    phi=i*math.pi*(3-math.sqrt(5))
    samples.append((r*math.cos(phi),r*math.sin(phi),math.sqrt(1-r*r)))
output={}
for scope in ('site','rooms'):
    verts=scene[scope+'_verts']; faces=scene[scope+'_tris']
    tree=BVHTree.FromPolygons(verts.tolist(),faces.tolist(),all_triangles=True)
    interior=scope=='rooms'
    radius=1.95 if interior else 8.5
    bias=.012 if interior else .045
    probes=scene[scope+'_probes']; darkness=np.empty(len(probes),dtype=np.float32)
    for i,probe in enumerate(probes):
        n=Vector(probe[3:]).normalized()
        origin=Vector(probe[:3])+n*bias
        u=n.cross(Vector((1,0,0)) if abs(n.x)<.8 else Vector((0,0,1))).normalized()
        v=n.cross(u)
        amt=0
        for x,y,z in samples:
            dist=tree.ray_cast(origin,x*u+y*v+z*n,radius)[3]
            if dist is not None:amt+=1-.75*dist/radius
        sky=amt/len(samples)
        direct=0
        for ray in area:
            dot=n.dot(ray)
            if dot>0 and tree.ray_cast(origin,ray,6.0 if interior else 100.0)[3] is not None:
                direct+=dot/len(area)
        darkness[i]=min(.72,sky*.49+direct*.35)
    output[scope]=darkness
    print(f'{scope}: {len(probes)} surface probes, {len(faces)} casting triangles',flush=True)
np.savez(folder/'visibility.npz',**output)
