"""Update only the river material in both editable Blender deliveries."""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parent
for name in ('white-sandbox.blend','white-sandbox-flow.blend'):
    bpy.ops.wm.open_mainfile(filepath=str(root/name))
    material=bpy.data.materials['Blue river']
    material.diffuse_color=(.12,.42,.72,1)
    shader=material.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value=(.12,.42,.72,1)
    shader.inputs['Roughness'].default_value=.68
    shader.inputs['Metallic'].default_value=0
    bpy.ops.wm.save_as_mainfile(filepath=str(root/name))
print('RIVER_MATERIAL_UPDATED')
