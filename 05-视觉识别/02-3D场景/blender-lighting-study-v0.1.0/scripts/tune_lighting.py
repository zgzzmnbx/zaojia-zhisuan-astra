import bpy
from mathutils import Vector
s=bpy.context.scene
assert 'blender-lighting-study-v0.1.0' in bpy.data.filepath
s['study_version']='0.1.0'
s['study_scope']='Lighting/material study; original geometry and camera preserved. Not deployed to web.'
for light in [o for o in s.objects if o.type=='LIGHT']:
 light.hide_render=True
 light.hide_viewport=True
rig=bpy.data.collections.new('STUDY - softbox lighting')
s.collection.children.link(rig)
def area(name,location,power,size,size_y,color):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='RECTANGLE';data.size=size;data.size_y=size_y;data.color=color
 ob=bpy.data.objects.new(name,data);rig.objects.link(ob);ob.location=location
 ob.rotation_euler=(Vector((0,0,1.2))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Key - large left softbox',(-12,-10,22),22000,9,12,(1,0.97,0.93))
area('Fill - cool right softbox',(14,-2,16),2800,13,16,(0.88,0.94,1))
area('Rim - rear strip',(-3,12,19),7500,5,13,(0.93,0.97,1))
for n in s.world.node_tree.nodes:
 if n.type=='BACKGROUND':
  n.inputs['Color'].default_value=(0.78,0.85,0.95,1)
  n.inputs['Strength'].default_value=0.22
s.view_settings.view_transform='AgX'
s.view_settings.look='AgX - Medium High Contrast'
s.view_settings.exposure=0.35
def material(name,color,metal,rough):
 m=bpy.data.materials.new(name);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 m.diffuse_color=(*color,1)
 return m
silver=material('STUDY - satin silver vessels',(0.81,0.84,0.88),0.62,0.28)
pipe=material('STUDY - pearl coated pipe',(0.87,0.89,0.92),0.32,0.24)
for ob in s.objects:
 if ob.name.startswith(('White pressure vessel','Vessel dome','Vessel seam')):
  ob.data.materials.clear();ob.data.materials.append(silver)
 elif ob.name.startswith(('Cross-river pipeline','Plant connection','Pipe collar')):
  ob.data.materials.clear();ob.data.materials.append(pipe)
for name,color,rough in [('Studio backdrop',(0.88,0.91,0.95),0.88),('Porcelain white',(0.83,0.86,0.9),0.38),('Limestone foundation',(0.73,0.77,0.82),0.76),('Frosted blue glazing',(0.12,0.38,0.61),0.22),('Blue river',(0.045,0.39,0.68),0.3)]:
 m=bpy.data.materials.get(name)
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;m.diffuse_color=(*color,1)
s.render.resolution_x=1440;s.render.resolution_y=1000;s.render.resolution_percentage=100
for a in bpy.context.screen.areas:
 if a.type=='VIEW_3D':
  a.spaces.active.region_3d.view_perspective='CAMERA'
  a.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
print('STUDY_SAVED',bpy.data.filepath)
print('GEOMETRY_COUNT',sum(o.type=='MESH' for o in s.objects))
print('CAMERA',list(s.camera.location),list(s.camera.rotation_euler),s.camera.data.ortho_scale)
