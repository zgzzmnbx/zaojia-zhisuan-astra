"""Append an editable static pipeline to a copy of the white-model Blender scene."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'white-sandbox.blend'))
route=json.loads((ROOT/'pipeline-route.json').read_text(encoding='utf-8'))
collection=bpy.data.collections.new('Information transfer - illustrative');bpy.context.scene.collection.children.link(collection)
def convert(p):return Vector((p[0],-p[2],p[1]))
points=[]
for leg in route['legs']:
    v=[convert(p) for p in leg]
    if not points:points.append(v[0])
    for i in range(1,len(v)-1):
        p=v[i];r=min(.42,(p-v[i-1]).length*.32,(p-v[i+1]).length*.32)
        a=p+(v[i-1]-p).normalized()*r;b=p+(v[i+1]-p).normalized()*r
        points.append(a)
        for j in range(1,13):
            t=j/12;points.append((1-t)**2*a+2*(1-t)*t*p+t*t*b)
    points.append(v[-1])
material=bpy.data.materials.new('Information pipeline - pale blue');material.diffuse_color=(.30,.65,.90,1);material.use_nodes=True
shader=material.node_tree.nodes['Principled BSDF'];shader.inputs['Base Color'].default_value=(.30,.65,.90,1);shader.inputs['Roughness'].default_value=.26
curve=bpy.data.curves.new('Sequential rounded pipeline','CURVE');curve.dimensions='3D';curve.bevel_depth=.135;curve.bevel_resolution=4
spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
for p,v in zip(spline.points,points):p.co=(*v,1)
o=bpy.data.objects.new('01 to 07 information route',curve);collection.objects.link(o);o.data.materials.append(material)
for i,stop in enumerate(route['stops']):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,radius=.21,location=convert(stop['point']))
    o=bpy.context.object;o.name=f"{i+1:02d} port - {stop['id']}"
    for c in list(o.users_collection):c.objects.unlink(o)
    collection.objects.link(o);o.data.materials.append(material)
bpy.context.scene['information_flow_note']='Static editable pipe geometry. Animated blue signal is implemented in the independent HTML preview; not real task progress.'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'white-sandbox-flow.blend'))
print('EDITABLE_PIPELINE_SAVED')
