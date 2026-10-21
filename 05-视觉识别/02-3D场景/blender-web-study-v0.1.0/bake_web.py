"""Export the approved study into an isolated, static web lighting sample."""
from pathlib import Path
import bpy, math, json, time, hashlib, sys
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent))
OUT=Path(__file__).resolve().parent/'public/assets'
OUT.mkdir(parents=True,exist_ok=True)
SOURCE=OUT.parents[2]/'blender-lighting-study-v0.1.0/astra-lighting-study.blend'
start=time.time()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
s=bpy.context.scene
s.render.engine='CYCLES';s.cycles.samples=96;s.cycles.max_bounces=6;s.cycles.diffuse_bounces=4
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='ONEAPI';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='ONEAPI'
s.cycles.device='GPU'
s.render.threads_mode='FIXED';s.render.threads=8
s.render.bake.margin=16;s.render.bake.margin_type='EXTEND';s.render.bake.use_clear=True
s.render.bake.use_pass_direct=True;s.render.bake.use_pass_indirect=True;s.render.bake.use_pass_color=True
s.render.bake.target='IMAGE_TEXTURES'
# Preserve evaluated geometry, including all original bevels, curves and lettering.
groups={}
for ob in list(s.objects):
 if ob.type not in {'MESH','CURVE','FONT'}:continue
 metal=any(sl.material and sl.material.name.startswith(('STUDY - satin','STUDY - pearl')) for sl in ob.material_slots)
 zone='metal' if metal else (ob.users_collection[0].name if ob.users_collection else 'land')
 groups.setdefault(zone,[]).append(ob)
records=[];baked=[]
for zone,objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for ob in objects:ob.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 bpy.ops.object.convert(target='MESH')
 bpy.ops.object.join()
 ob=bpy.context.object;ob.name='web_'+zone
 # The backdrop stays much larger than the diorama, without spending atlas pixels on a 250m plane.
 if zone=='studio':
  for v in ob.data.vertices:
   v.co.x*=0.5;v.co.y*=0.5
 if zone=='metal':continue
 for uv in list(ob.data.uv_layers):ob.data.uv_layers.remove(uv)
 ob.data.uv_layers.new(name='WebBake')
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
 bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=0.008,area_weight=0.7)
 bpy.ops.object.mode_set(mode='OBJECT')
 size=2048
 image=bpy.data.images.new('WebBake_'+zone,width=size,height=size,alpha=False,float_buffer=True)
 image.colorspace_settings.name='Linear Rec.709'
 for slot in ob.material_slots:
  if not slot.material:continue
  m=slot.material.copy();slot.material=m
  n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=image;m.node_tree.nodes.active=n
 ob['bakedTexture']=zone+'.png'
 baked.append(ob);records.append({'zone':zone,'object':ob.name,'image':image,'size':size})
bpy.ops.object.select_all(action='DESELECT')
for ob in baked:ob.select_set(True)
bpy.context.view_layer.objects.active=baked[0]
print('BAKE_START',[(r['zone'],r['size']) for r in records],flush=True)
bpy.ops.object.bake(type='DIFFUSE',uv_layer='WebBake')
# Store linear radiance scaled into PNG range; runtime restores the scale before tone mapping.
s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=0;s.view_settings.gamma=1
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.render.image_settings.color_depth='8'
for r in records:
 im=r.pop('image');pixels=np.empty(len(im.pixels),dtype=np.float32);im.pixels.foreach_get(pixels)
 rgba=pixels.reshape(-1,4);rgb=rgba[:,:3]
 r['maxRadiance']=float(rgb.max());r['litFraction']=float(np.mean(np.max(rgb,axis=1)>0.01))
 assert r['maxRadiance']>0.05 and r['litFraction']>0.03,r
 cache=Path(__file__).resolve().parents[3]/'Codex-Temp/blender-mcp-setup/bake-cache';cache.mkdir(parents=True,exist_ok=True)
 np.save(cache/(r['zone']+'.npy'),rgb)
 scale=max(1.0,float(np.max(rgb)))
 rgb/=scale;im.pixels.foreach_set(pixels);im.update();r['scale']=scale
 im.save_render(str(OUT/(r['zone']+'.png')),scene=s)
 print('BAKED',r['zone'],r['maxRadiance'],flush=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in s.objects:
 if ob.type=='MESH':ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'sandbox.glb'),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
manifest={'version':'0.1.0','sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'bake':'Cycles diffuse direct + indirect + albedo; static geometry','samples':96,'textures':records,'seconds':round(time.time()-start,1)}
(OUT/'bake-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('COMPLETE',manifest['seconds'],flush=True)
