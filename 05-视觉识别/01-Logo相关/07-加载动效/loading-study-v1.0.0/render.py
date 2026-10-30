import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
task=Path(__file__).resolve().parent;data=json.loads((task/'frames.json').read_text(encoding='utf-8'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=420;scene.render.resolution_y=330;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
shade=scene.display.shading;shade.light='STUDIO';shade.studiolight_rotate_z=.4;shade.color_type='MATERIAL';shade.show_shadows=True;shade.show_cavity=False;shade.show_specular_highlight=True;shade.background_type='WORLD';scene.world.color=(1,1,1)
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
bpy.ops.object.camera_add(location=(4,-13,3.7));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=6.7;scene.camera=camera
def srgb(v):return v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4
def color(value):return tuple(int(value[i:i+2],16)/255 for i in (1,3,5))
cubes=[]
for i,part in enumerate(data['parts']):
 bpy.ops.mesh.primitive_cube_add(size=1);obj=bpy.context.object;obj.name=part['name'];obj.dimensions=part['size'];bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 bevel=obj.modifiers.new('Micro bevel','BEVEL');bevel.width=part['bevel'];bevel.segments=3
 material=bpy.data.materials.new(part['name']);material.diffuse_color=(*color(part['color']),1);obj.data.materials.append(material);cubes.append(obj)
accent=color('#b8ebff')
limit=('--one' in sys.argv)
for case in data['cases']:
 out=task/case['kind'];out.mkdir(exist_ok=True)
 for f in case['frames']:
  for i,obj in enumerate(cubes):
   x,y,z=f['parts'][i]['position'];scale=f['scale'];obj.location=(x*scale,-z*scale,y*scale);obj.scale=(scale,)*3
   base=color(data['parts'][i]['color']);power=f['parts'][i]['power']*.80;obj.active_material.diffuse_color=(*(a+(b-a)*power for a,b in zip(base,accent)),1)
  scene.render.filepath=str(out/f"{f['frame']:04d}.png");bpy.ops.render.render(write_still=True)
  if limit:break
 if limit:break
print('LOADING_STUDY_RENDER_FINISHED')
