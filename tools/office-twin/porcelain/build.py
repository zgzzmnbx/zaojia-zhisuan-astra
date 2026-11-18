"""Build a private, distributable GLB against the locally supplied office model."""
import argparse
import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path

import numpy as np

from architecture import campus, rooftop, storey
from geometry import BLUE_INK, Glb, Source, matrix, studio_color
from light_transport import bake
from receivers import Receiver
from streetscape import LAMPS, PARKING

ROOT=Path(__file__).resolve().parents[3]
PACKAGE=ROOT/'public/office-twin'
MODEL='H1-porcelain-v0.4.0.glb'
BASELINE='H1-baked-v0.6.7.glb'
BASELINE_HASH='c805ae3f8074f3c9cba9c36249401c97bd4a9b13c5d57ce236fc66a5032a2545'
LAYOUT_HASH='ca0621dd6d14a578ef01b49757341a955b0e06dc83139d655b6763f8e1e61e3a'
OFFICE='H1_F09_Office'
SLAB='H1_F09_floor_slab'


def finish(name, material):
    n=name.lower()
    if 'screenblue' in material.lower(): return 'glass','screen'
    if 'chair' in n:
        if 'leg' in n or 'stem' in n or 'pedestal' in n: return 'metal','interior'
        if 'back' in n or 'seat' in n: return 'fabric','interior'
        return 'linen','interior'
    if 'sofa' in material.lower() or 'cushion' in n:
        return ('fabric' if 'cushion' in n else 'linen'),'interior'
    if 'keyboard' in n or 'mouse' in n or 'monitor' in n:
        return ('reveal' if 'gray' in material.lower() else 'linen'),'interior'
    if 'desk' in n or 'table' in n: return ('metal' if 'leg' in n else 'porcelain'),'interior'
    if 'door' in n and 'lift' in n: return 'metal','interior'
    if 'handle' in n or 'pull' in n or 'frame' in n: return 'metal','interior'
    if 'window' in n: return 'ice','interior'
    if 'column' in n or n.startswith('col_'): return 'chalk','interior'
    if 'restrainedblue' in material.lower(): return 'cobalt','interior'
    return 'porcelain','interior'


def floor_surface(node):
    return node['name']==SLAB or node['name'].endswith('_floor') or node.get('extras',{}).get('entity_type')=='floor_slab'


def primitives(source,node):
    if 'mesh' in node:
        yield from source.doc['meshes'][node['mesh']]['primitives']


def plan_receiver(source,layout,metadata):
    atlas=Receiver(22.5,1024,'interior')
    def visit(index, transform):
        node=source.doc['nodes'][index]
        name=node['name']
        # Omit the same retired schematic elements and workstation towers the
        # host removes, so they cannot leave phantom shadows in the cutaway.
        if (name.startswith('CORE_') and not name.endswith('_cut')) or node.get('extras',{}).get('furniture_asset_id')=='tower':
            return
        tf=transform@matrix(node)
        if not floor_surface(node):
            for p in primitives(source,node):
                pos=source.array(p['attributes']['POSITION'])
                atlas.caster(pos@tf[:3,:3].T+tf[:3,3])
        for child in node.get('children',[]): visit(child,tf)
    visit(source.named[OFFICE],np.eye(4))
    image=atlas.image(layout,np.array(metadata['source_pixel_origin']),metadata['px_per_m'])
    return atlas,image


def copy_office(out,source,node_id,parent,tf,atlas,day_texture,mesh_cache):
    node=source.doc['nodes'][node_id]
    props={k:v for k,v in node.items() if k not in ('mesh','children','name')}
    target=out.node(node['name'],parent,**props)
    tf=tf@matrix(node)
    parts=[]
    for prim in primitives(source,node):
        attrs=prim['attributes']
        pos=source.array(attrs['POSITION']); normal=source.array(attrs['NORMAL'])
        indices=source.array(prim['indices'])
        world=pos@tf[:3,:3].T+tf[:3,3]
        directions=normal @ np.linalg.inv(tf[:3,:3])
        directions/=np.maximum(np.linalg.norm(directions,axis=1,keepdims=True),1e-8)
        old=source.doc['materials'][prim['material']]['name']
        uv=night_uv=None
        pigment='chalk'
        if floor_surface(node):
            mat=out.material('Porcelain / room floor',day_texture,{'porcelainNightUV':True}) if old=='V065_NATIVE_FLOOR_LIGHTING_UNLIT' else out.material('Porcelain / slab',day_texture)
            uv=atlas.uv(world)
            if old=='V065_NATIVE_FLOOR_LIGHTING_UNLIT':
                night_uv=source.array(attrs['TEXCOORD_0'])
            color=studio_color(directions,'chalk')
            color[directions[:,1]>.86]=1
        else:
            pigment,role=finish(node['name'],old)
            mat=out.material('Porcelain Device ScreenBlue' if role=='screen' else 'Porcelain / interior')
            # Keep edges and silhouettes intact and give sheet metal, fabric,
            # stone and white paint visibly different responses to this rig.
            height=world[:,1]
            footing=1-.15*np.exp(-np.maximum(height,0)/.23)
            color=studio_color(directions,pigment,footing)
            if role=='screen':
                t=(height-height.min())/max(float(np.ptp(height)),.01)
                color*=.66+.34*t[:,None]
        parts.append(out.primitive(pos,normal,indices,color,mat,uv,night_uv,BLUE_INK.get(pigment,0)))
    if parts:
        key=json.dumps(parts,sort_keys=True)
        if key not in mesh_cache:
            mesh_cache[key]=out.append('meshes',{'primitives':parts})
        out.doc['nodes'][target]['mesh']=mesh_cache[key]
    for child in node.get('children',[]):
        copy_office(out,source,child,target,tf,atlas,day_texture,mesh_cache)
    return target


def native_sign(out,source,node_id,parent):
    node=source.doc['nodes'][node_id]
    mat=out.material('Porcelain / enamel lettering')
    prims=[]
    for p in primitives(source,node):
        a=p['attributes'];pos=source.array(a['POSITION']);norm=source.array(a['NORMAL'])
        prims.append(out.primitive(pos,norm,source.array(p['indices']),studio_color(norm,'cobalt'),mat,
                                   blue_ink=BLUE_INK['cobalt']))
    if prims:
        out.node(node['name'],parent,mesh=out.append('meshes',{'primitives':prims}),
                 extras={'night_role':'sign','source_object':node['name']})


def verify(source,generated):
    locked_nodes=0; triangles=0
    for root in [OFFICE,SLAB]:
        old=list(source.walk(source.named[root]))
        new=list(generated.walk(generated.named[root]))
        assert len(old)==len(new),root
        for (s,st),(g,gt) in zip(old,new,strict=True):
            assert s['name']==g['name'] and s.get('extras')==g.get('extras'),s['name']
            assert np.array_equal(matrix(s),matrix(g)) and np.array_equal(st,gt),s['name']
            locked_nodes+=1
            for p,q in zip(primitives(source,s),primitives(generated,g),strict=True):
                for a in ('POSITION','NORMAL'):
                    assert np.array_equal(source.array(p['attributes'][a]),generated.array(q['attributes'][a])),s['name']
                si=source.array(p['indices'])
                assert np.array_equal(si,generated.array(q['indices'])),s['name']
                triangles+=len(si)//3
    for n in range(1,21):
        key=f'Floor_{n:02}'
        assert np.array_equal(matrix(source.doc['nodes'][source.named[key]]),
                              matrix(generated.doc['nodes'][generated.named[key]])),key
    ink_values=set()
    for mesh in generated.doc['meshes']:
        for primitive in mesh['primitives']:
            attrs=primitive['attributes']
            ink=generated.array(attrs['_BLUEINK'])
            assert len(ink)==len(generated.array(attrs['POSITION']))
            ink_values.update(np.unique(ink).tolist())
    assert ink_values=={0,1,2,3},'Missing or unknown porcelain pigment band'
    trees=generated.doc['nodes'][generated.named['Porcelain_Campus_vegetation']]
    assert trees['extras']['night_role']=='vegetation'
    tree_primitive,=generated.doc['meshes'][trees['mesh']]['primitives']
    assert set(np.unique(generated.array(tree_primitive['attributes']['_BLUEINK'])))=={0,2}
    campus = generated.doc['nodes'][generated.named['ContextBuildings']]
    for role in ('street_surface', 'street_lens'):
        index = generated.named['Porcelain_Campus_'+role]
        node = generated.doc['nodes'][index]
        assert index in campus['children'] and node['extras']['night_role'] == role
        prim, = generated.doc['meshes'][node['mesh']]['primitives']
        assert generated.doc['accessors'][prim['indices']]['count'] > 0
    for name, count in [('streetLightPools', len(LAMPS)), ('parkedCarFootprints', len(PARKING))]:
        areas = np.asarray(campus['extras'][name])
        assert areas.shape == (count, 4) and np.isfinite(areas).all() and (areas[:,2:] > 0).all()
    return {'lockedNodes':locked_nodes,'lockedTriangles':triangles,'storeys':20}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--package',type=Path,default=PACKAGE)
    parser.add_argument('--verify-only',action='store_true')
    parser.add_argument('--blender',type=Path,help='Blender executable used for the offline BVH light bake')
    args=parser.parse_args()
    models=args.package/'models'
    baseline=models/BASELINE
    if hashlib.sha256(baseline.read_bytes()).hexdigest()!=BASELINE_HASH:
        parser.error('Original office mesh differs from the locked v0.6.7 reference.')
    source=Source(baseline)
    target=models/MODEL
    layout_file=args.package/'data/office_layout.json'
    layout_bytes=layout_file.read_bytes()
    layout_hash=hashlib.sha256(layout_bytes).hexdigest()
    if layout_hash!=LAYOUT_HASH:
        parser.error('The office plan differs from the locked drawing.')
    layout=json.loads(layout_bytes)
    if not args.verify_only:
        out=Glb()
        building=out.node('H1_Building',extras={'entity_type':'building'})
        grounds=out.node('ContextBuildings',extras={'entity_type':'context_buildings'})
        meta=json.loads((args.package/'data/model_metadata.json').read_bytes())
        atlas,image=plan_receiver(source,layout,meta)
        day_texture=out.texture('Office / contact and directional daylight',image)
        mesh_cache={}
        for n in range(1,21):
            name=f'Floor_{n:02}'
            original=source.doc['nodes'][source.named[name]]
            floor=out.node(name,building,**{k:v for k,v in original.items() if k not in ('children','mesh','name')})
            facade=out.node(f'Facade_{n:02}',floor,extras={'floor_number':n,'entity_type':'facade'})
            h=4.8 if n==1 else 4.2 if n==2 else 3.6
            storey(out,facade,n,h)
            if n==9:
                for root in (SLAB,OFFICE):
                    copy_office(out,source,source.named[root],floor,np.eye(4),atlas,day_texture,mesh_cache)
            if n==20:
                rooftop(out,facade,h)
                for child in original['children']:
                    if source.doc['nodes'][child]['name'].startswith('V064_Brand_Roof_PipeChina_'):
                        native_sign(out,source,child,facade)
        campus(out,grounds)
        program_files=Path(os.environ.get('ProgramFiles','C:/Program Files'))
        available=sorted((program_files/'Blender Foundation').glob('Blender */blender.exe'),reverse=True)
        blender=args.blender or shutil.which('blender') or next(iter(available),None)
        if not blender: parser.error('Supply --blender to build the static lighting.')
        staging=ROOT/'Codex-Temp'
        staging.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='porcelain-bake-',dir=staging) as tmp:
            tmp=Path(tmp)
            bake(out,tmp,blender)
            out.compact()
            candidate=tmp/MODEL
            out.write(candidate)
            verify(source,Source(candidate))
            os.replace(candidate,target)
    report=verify(source,Source(target))
    report.update(rooms=len(layout['rooms']),walls=len(layout['walls']),doors=len(layout['doors']),
                  columns=len(layout['columns']),workstationAnchors=len(layout['workstations']),
                  layoutSHA256=layout_hash,
                  bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest())
    print(json.dumps(report,indent=2))


if __name__=='__main__':
    main()
