"""Scheme A: seven new architectural bodies. Existing roof symbols are grafted at runtime.
Coordinates below are the original Three.js world coordinates, not a new layout.
Run with Blender --background --python build_model.py. Frozen sources stay read-only.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.85
 return m
white=mat('Campus porcelain',(.64,.66,.67));blue=mat('Campus blue glazing',(.025,.23,.40));shade=mat('Recess shadow',(.19,.25,.30))
groups={};zone=None
def W(p):return Vector((p[0],-p[2],p[1]))
def group(name):
 global zone
 zone=name;o=bpy.data.objects.new('body_'+name,None);scene.collection.objects.link(o);o['zone']=name;groups[name]=o
def box(name,p,size,material=white,bevel=.045):
 bpy.ops.mesh.primitive_cube_add(size=1,location=W(p));o=bpy.context.object;o.name=zone+' | '+name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(material);o.parent=groups[zone]
 if bevel:
  m=o.modifiers.new('Porcelain radius','BEVEL');m.width=min(bevel,min(size)/3);m.segments=3;bpy.ops.object.modifier_apply(modifier=m.name)
 return o
def cylinder(name,p,r,height,material=white,axis='y'):
 bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=r,depth=height,location=W(p));o=bpy.context.object;o.name=zone+' | '+name;o.data.materials.append(material);o.parent=groups[zone]
 if axis=='z':o.rotation_euler[0]=math.pi/2
 if axis=='x':o.rotation_euler[1]=math.pi/2
 m=o.modifiers.new('Rolled rim','BEVEL');m.width=.035;m.segments=3;bpy.ops.object.modifier_apply(modifier=m.name)
 return o
def plinth(x,z,w,d):
 box('single lower plinth',(x,.17,z),(w,.40,d),bevel=.06)
 box('upper landing',(x,.45,z),(w-.30,.16,d-.30),bevel=.05)
def facade(x,z,w,d,bottom,top,bays=5):
 h=top-bottom;y=(top+bottom)/2
 box('recessed blue volume',(x,y,z),(w-.2,h,d-.2),blue,.065)
 # Four crisp corners and generous, evenly spaced front and side bays.
 for s in [-1,1]:
  for t in [-1,1]:box('corner pier',(x+s*(w/2-.12),y,z+t*(d/2-.12)),(.24,h,.24),bevel=.04)
 for i in range(1,bays):box('front mullion',(x-w/2+w*i/bays,y,z+d/2-.025),(.10,h,.15),bevel=.018)
 for i in range(1,3):box('side mullion',(x+w/2-.025,y,z-d/2+d*i/3),(.15,h,.10),bevel=.018)

group('import');plinth(-10,8.3,5.5,5.0)
facade(-10,8.3,4.55,3.25,.52,1.57,5)
box('deep floating roof',(-10,1.70,8.3),(4.95,.26,3.65),bevel=.10)
box('symbol pedestal',(-10,1.865,8.2),(2.55,.07,1.40),bevel=.03)
# Recessed wide entrance; no repeated tiny stairs or roof machinery.
box('entrance shadow',(-9.95,.95,9.94),(1.20,.87,.035),shade,.005)
box('entrance glass',(-9.95,.96,9.965),(1.03,.80,.018),blue,.003)

group('knowledge');plinth(-10.2,-4.1,5.9,5.5)
for level in range(5):
 bottom=.58+level*.81
 facade(-10.2,-4.1,4.55,3.8,bottom,bottom+.61,5)
 box('continuous floor ledge',(-10.2,bottom+.69,-4.1),(4.95,.16,4.16),bevel=.07)
box('book roof',(-10.2,4.76,-4.1),(5.05,.20,4.26),bevel=.085)

group('price');plinth(-.7,-1.5,8.35,6.6)
box('control house',(-.8,1.40,-3.25),(4.4,1.78,1.85),bevel=.12)
box('control window',(-.8,1.62,-2.311),(3.7,.67,.045),blue,.02)
for x in [-2.15,-.8,.55]:box('control mullion',(x,1.62,-2.28),(.11,.74,.12),bevel=.02)
box('calculator roof',(-.8,2.37,-3.25),(4.65,.16,2.05),bevel=.07)
for x in [-2.6,-.7,1.2]:
 cylinder('tank foot',(x,.68,-.3),.66,.30)
 cylinder('main vessel',(x,2.10,-.3),.58,2.60)
 cylinder('single blue collar',(x,1.02,-.3),.588,.15,blue)
 cylinder('upper rim',(x,3.37,-.3),.61,.11)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=12,radius=1,location=W((x,3.42,-.3)));o=bpy.context.object;o.name='price | vessel dome';o.scale=(.58,.58,.23);o.data.materials.append(white);o.parent=groups[zone]
 cylinder('vessel cap',(x,3.70,-.3),.13,.18)
 cylinder('outlet',(x,1.1,.54),.13,.75,axis='z')
cylinder('single collector',(-.7,1.1,.94),.17,4.2,axis='x')
for x in [-2.6,1.2]:box('collector saddle',(x,.78,.94),(.35,.56,.38),bevel=.05)

group('report');plinth(9.7,-2.5,5.9,5.5)
facade(9.7,-2.5,4.65,4.1,.58,2.86,6)
box('lower fascia',(9.7,.66,-2.5),(4.88,.20,4.35),bevel=.075)
box('continuous cornice',(9.7,2.99,-2.5),(5.12,.25,4.55),bevel=.09)
box('recessed roof plate',(9.7,3.19,-2.5),(4.70,.15,4.10),bevel=.07)
box('document pedestal',(9.7,3.295,-2.5),(2.35,.06,1.2),bevel=.02)

group('review');plinth(2.3,-9.25,7.2,3.7)
facade(2.3,-9.25,6.35,2.9,.53,1.12,5)
box('unified collaboration roof',(2.3,1.20,-9.25),(6.65,.16,3.2),bevel=.10)
# Small side wings form one coherent low pavilion instead of separate scattered boxes.
for x in [-.1,4.7]:box('service end',(x,.84,-9.3),(.8,.61,2.5),bevel=.12)

group('risk');plinth(6.5,6.6,3.25,7.5)
box('service gallery',(6.5,.85,6.6),(2.85,.65,7.1),bevel=.11)
box('front control cabin',(6.5,1.48,9.15),(2.50,1.22,1.55),bevel=.13)
box('control blue aperture',(6.5,1.51,9.94),(1.60,.65,.035),blue,.025)
box('shield roof',(6.5,2.18,9.0),(2.90,.18,1.95),bevel=.085)
for x in [5.70,6.5,7.3]:
 cylinder('long inspection pipeline',(x,1.65,5.4),.27,5.9,axis='z')
 for z in [3.1,5.4,7.7]:cylinder('single pipe coupling',(x,1.65,z),.31,.12,axis='z')
for z in [3.2,7.4]:box('common pipe saddle',(6.5,1.13,z),(2.55,.40,.30),bevel=.035)

group('table');plinth(-7.7,-9.3,9.25,2.5)
box('monolithic spreadsheet back',(-7.7,4.65,-9.36),(8.85,8.45,1.22),bevel=.11)
box('top frame',(-7.7,8.84,-9.15),(9.0,.22,1.65),bevel=.07)
for x in [-12.06,-3.34]:box('vertical frame',(x,4.65,-8.73),(.23,8.5,.25),bevel=.04)
box('screen foot',(-7.7,.79,-9.15),(9.02,.42,1.90),bevel=.08)

# Combine pieces per zone/material. This preserves zone ownership and keeps draw
# calls/assembly components bounded; six-direction lighting and local AO are baked
# into vertex colors, without adding texture requests or runtime lights.
for z,parent in groups.items():
 for material in [white,blue,shade]:
  objects=[o for o in list(parent.children) if o.type=='MESH' and o.data.materials[0]==material]
  if not objects:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=objects[0];o.name=z+'_'+material.name.replace(' ','_');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
scene.view_layers[0].update()
allverts=[];allfaces=[]
for o in scene.objects:
 if o.type!='MESH':continue
 start=len(allverts);allverts.extend([o.matrix_world@v.co for v in o.data.vertices]);allfaces.extend([tuple(start+i for i in f.vertices) for f in o.data.polygons])
bvh=BVHTree.FromPolygons(allverts,allfaces)
key=Vector((-.45,-.6,1)).normalized()
for o in scene.objects:
 if o.type!='MESH':continue
 attr=o.data.color_attributes.new(name='BakedArchitecturalLight',type='FLOAT_COLOR',domain='CORNER');o.data.color_attributes.active_color=attr
 for f in o.data.polygons:
  normal=f.normal.normalized();base=.64+.32*max(0,normal.dot(key));base=.58 if normal.z<-.5 else base
  for i in f.loop_indices:
   v=o.data.vertices[o.data.loops[i].vertex_index].co;origin=v+normal*.012;occlusion=0
   for direction in [Vector((1,0,1)),Vector((-1,0,1)),Vector((0,1,1)),Vector((0,-1,1)),key]:
    direction.normalize()
    if normal.dot(direction)<.05:continue
    hit=bvh.ray_cast(origin,direction,1.25)
    if hit[0] is not None:occlusion+=.055*(1-hit[3]/1.25)
   value=max(.43,base-occlusion);attr.data[i].color=(value,value,value,1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'campus-integrated.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'campus-integrated.glb'),export_format='GLB',export_animations=False,export_vertex_color='ACTIVE', export_all_vertex_colors=False,export_extras=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest={'version':'1.1.0','zones':list(groups),'asset_sha256':sha(OUT/'campus-integrated.glb'),'source_hashes':{p.relative_to(ROOT).as_posix():sha(p) for p in sorted((ROOT/'public/sandbox-v11/model').glob('*')) if p.is_file()},'symbols':'Original indexed triangles, UVs and materials retained at original world positions by architectural-campus.mjs','body_design':'Seven rebuilt bodies; continuous rounded cornices, recessed blue glazing, two-level podiums, consolidated equipment; source routes unchanged'}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('CAMPUS_COMPLETE',json.dumps({'zones':list(groups),'mesh_count':sum(o.type=='MESH' for o in scene.objects)}))
