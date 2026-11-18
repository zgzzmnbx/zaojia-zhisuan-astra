"""Collect world-space shading probes, then bake against two separate BVHs."""
import json
import subprocess
from pathlib import Path

import numpy as np

from geometry import Source, matrix


def bake(out, directory, blender):
    path=directory/'unlit.glb'
    out.write(path)
    geo=Source(path)
    fields={s:{k:[] for k in ('points','faces','probes','normals','bindings')} for s in ('site','rooms')}
    offsets={'site':0,'rooms':0}

    def visit(idx, transform, scope='site'):
        n=out.doc['nodes'][idx]
        if n.get('extras',{}).get('trafficVehicle'):
            return  # Road traffic receives its live contact shadow in the viewer.
        name=n['name']
        if name=='H1_F09_Office' or name=='H1_F09_floor_slab':
            scope='rooms'
            transform=np.eye(4)
        if scope=='rooms' and ((name.startswith('CORE_') and not name.endswith('_cut')) or n.get('extras',{}).get('furniture_asset_id')=='tower'):
            return
        tf=transform@matrix(n)
        if 'mesh' in n:
            parts=out.doc['meshes'][n['mesh']]['primitives']
            for j,p in enumerate(parts):
                a=p['attributes']
                pos=geo.array(a['POSITION'])@tf[:3,:3].T+tf[:3,3]
                norm=geo.array(a['NORMAL'])@np.linalg.inv(tf[:3,:3])
                norm/=np.maximum(np.linalg.norm(norm,axis=1,keepdims=True),1e-8)
                field=fields[scope]
                field['faces'].append(geo.array(p['indices']).reshape(-1,3).astype(np.int32)+offsets[scope])
                field['points'].append(pos)
                offsets[scope]+=len(pos)
                # A planar texture already integrates over the whole surface.
                # The receiver still participates in occluding nearby solids.
                # Solids with a day-only equipment shadow or brand artwork
                # still carry the baked night colour on the underlying board.
                if 'TEXCOORD_0' in a:
                    props=out.doc['materials'][p['material']]['extras']
                    if n.get('extras',{}).get('night_role')!='brand_sign' and not props.get('porcelainDayMap'):
                        continue
                field['probes'].append(pos)
                field['normals'].append(norm)
                field['bindings'].append((idx,j))
        for child in n.get('children',[]): visit(child,tf,scope)

    for root in out.doc['scenes'][0]['nodes']:visit(root,np.eye(4))
    payload={}; maps={}
    for scope,field in fields.items():
        buf=np.column_stack((np.concatenate(field['probes']),np.concatenate(field['normals'])))
        probes,inverse=np.unique(np.round(buf,4),axis=0,return_inverse=True)
        payload[scope+'_verts']=np.concatenate(field['points']).astype('f')
        payload[scope+'_tris']=np.concatenate(field['faces'])
        payload[scope+'_probes']=probes.astype('f')
        maps[scope]=inverse.ravel()
    np.savez(directory/'scene.npz',**payload)
    subprocess.run([str(blender),'--background','--factory-startup','--python-exit-code','1','--python',
                    str(Path(__file__).with_name('trace_blender.py')),'--',str(directory)],check=True)
    results=np.load(directory/'visibility.npz')
    modified={};new_meshes={}
    for scope,field in fields.items():
        stream=results[scope][maps[scope]]
        at=0
        for (idx,j),points in zip(field['bindings'],field['probes'],strict=True):
            node=out.doc['nodes'][idx]
            if idx not in modified:
                modified[idx]=[{**p,'attributes':dict(p['attributes'])} for p in out.doc['meshes'][node['mesh']]['primitives']]
            attrs=modified[idx][j]['attributes']
            colors=geo.array(attrs['_NIGHTCOLOR']).copy()
            occlusion=stream[at:at+len(points),None]
            # A little cool sky survives in recesses even where the large key
            # is fully blocked. The GLB stores scene-linear vertex colors.
            colors[:,:3]=np.rint(colors[:,:3]*(1-occlusion*np.array([.89,.83,.70])))
            attrs['_NIGHTCOLOR']=out.attr(colors,5121,normalized=True)
            at+=len(points)
    for i,parts in modified.items():
        key=json.dumps(parts,sort_keys=True)
        if key not in new_meshes:
            new_meshes[key]=out.append('meshes',{'primitives':parts})
        out.doc['nodes'][i]['mesh']=new_meshes[key]
