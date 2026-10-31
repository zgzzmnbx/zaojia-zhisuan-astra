"""Pack the approved local repair textures into the editable cleaned Blender file."""
import bpy,json,hashlib
from pathlib import Path
r=Path.cwd();out=r/'05-视觉识别/02-3D场景/sandbox-v11/site-cleanup-v1'
bpy.ops.wm.open_mainfile(filepath=str(out/'site-cleanup.blend'))
for material,name in [('V10 · Baked unlit zone_price','price'),('V10 · Baked unlit site','site')]:
 m=bpy.data.materials[material];images=[n for n in m.node_tree.nodes if n.type=='TEX_IMAGE'];assert len(images)==1
 im=bpy.data.images.load(str(out/(name+'-clean.png')),check_existing=False);im.pack();images[0].image=im
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(out/'site-cleanup.blend'))
p=out/'blender-manifest.json';d=json.loads(p.read_text(encoding='utf-8'));d['blendSha256']=hashlib.sha256((out/'site-cleanup.blend').read_bytes()).hexdigest();d['localRepairTexturesPacked']=True;p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
