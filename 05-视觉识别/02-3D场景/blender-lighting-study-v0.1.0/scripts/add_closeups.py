import bpy
from mathutils import Vector
s=bpy.context.scene
for name,at,target,scale in [('STUDY - tank closeup',(12,-18,12),(-0.5,1,2),11),('STUDY - pipe closeup',(18,-20,12),(5,-4,1),12)]:
 data=bpy.data.cameras.new(name);data.type='ORTHO';data.ortho_scale=scale
 cam=bpy.data.objects.new(name,data);s.collection.objects.link(cam);cam.location=at
 cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
print('CLOSEUP_CAMERAS_SAVED')
