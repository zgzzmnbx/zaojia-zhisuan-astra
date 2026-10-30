import bpy,json,pathlib
from mathutils import Vector
out=pathlib.Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32
w=bpy.data.worlds.new('Soft assembly fill');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.9,.95,1,1);w.node_tree.nodes['Background'].inputs[1].default_value=.8
for pos,power,size in [((-4,-5,8),700,7),((5,4,4),450,6)]:
 bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=1);p=bpy.context.object
m=bpy.data.materials.new('Soft white');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.8,.8,.8,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85;p.data.materials.append(m)
colors=[]
for i,v in enumerate([(1,0,0),(-1,0,0),(0,0,1),(0,0,-1),(0,-1,0),(0,1,0)]):
 p.rotation_euler=Vector(v).to_track_quat('Z','Y').to_euler();im=bpy.data.images.new('direction-'+str(i),32,32,float_buffer=True);n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=im;m.node_tree.nodes.active=n
 bpy.context.view_layer.objects.active=p;p.select_set(True);s.render.bake.use_pass_direct=True;s.render.bake.use_pass_indirect=True;s.render.bake.use_pass_color=True;bpy.ops.object.bake(type='DIFFUSE')
 pixels=list(im.pixels);rgb=[sum(pixels[(y*32+x)*4+c] for y in range(8,24) for x in range(8,24))/256 for c in range(3)];colors.append(rgb);im.filepath_raw=str(out/('direction-'+str(i)+'.png'));im.file_format='PNG';im.save();m.node_tree.nodes.remove(n)
(out/'lighting.json').write_text(json.dumps({'source':'Blender Cycles diffuse bake','axes':['+x','-x','+y','-y','+z','-z'],'colors':colors},indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(out/'assembly-fill.blend'));print(colors)
