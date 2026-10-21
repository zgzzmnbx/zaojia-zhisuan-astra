import bpy
s=bpy.context.scene
bpy.data.lights['Key - large left softbox'].energy=12000
bpy.data.lights['Fill - cool right softbox'].energy=1200
bpy.data.lights['Rim - rear strip'].energy=3000
s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.12
s.view_settings.exposure=0.05
for name,color in [('Frosted blue glazing',(0.035,0.16,0.32)),('Blue river',(0.012,0.25,0.5)),('Astra blue',(0.005,0.12,0.5)),('Information pipeline - pale blue',(0.045,0.32,0.6))]:
 m=bpy.data.materials[name];m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);m.diffuse_color=(*color,1)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
print('REFINEMENT_SAVED')
