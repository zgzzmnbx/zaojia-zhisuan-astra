import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=root/'Codex-Temp/office-night-bake'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
scene.render.resolution_x=2048;scene.render.resolution_y=2048;scene.render.resolution_percentage=100
camera=bpy.data.objects.new('Temporary_camera',bpy.data.cameras.new('Temporary_camera'));scene.collection.objects.link(camera);scene.camera=camera
tree=bpy.data.node_groups.new('Night_atlas_denoise','CompositorNodeTree');scene.compositing_node_group=tree
tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
source=tree.nodes.new('CompositorNodeImage');source.image=bpy.data.images.load(str(out/'floor-night.png'))
denoise=tree.nodes.new('CompositorNodeDenoise');output=tree.nodes.new('NodeGroupOutput')
tree.links.new(source.outputs['Image'],denoise.inputs['Image']);tree.links.new(denoise.outputs['Image'],output.inputs['Image'])
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='16'
scene.render.filepath=str(root/'public/office-twin/models/floor-night-v0320.png')
bpy.ops.render.render(write_still=True)
print('DENOISED_NIGHT_ATLAS_SAVED',flush=True)
