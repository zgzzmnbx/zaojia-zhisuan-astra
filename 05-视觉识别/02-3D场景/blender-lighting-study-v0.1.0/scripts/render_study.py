import bpy,sys
from pathlib import Path
s=bpy.context.scene
args=sys.argv[sys.argv.index('--')+1:]
out=Path(args[0]).resolve()
if len(args)>1:s.camera=bpy.data.objects[args[1]]
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
 prefs.compute_device_type='ONEAPI';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='ONEAPI'
 s.cycles.device='GPU'
except Exception:s.cycles.device='CPU'
s.render.engine='CYCLES';s.cycles.samples=64;s.cycles.use_denoising=True
s.render.threads_mode='FIXED';s.render.threads=8
s.render.resolution_x=1440;s.render.resolution_y=1000;s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG';s.render.filepath=str(out)
s.render.film_transparent=False
bpy.ops.render.render(write_still=True)
print('RENDER_COMPLETE',out)
