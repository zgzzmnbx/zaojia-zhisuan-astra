"""Create eight color variants from the verified 13-cube studio, with animation intact."""
import bpy
import hashlib
import json
from pathlib import Path

assets=Path(__file__).resolve().parent
source=assets.parent/'logo-3d-v1.2/Blender-modular/造价智算-精细模型-组装-v1.2.0.blend'
palettes=json.loads((assets/'palettes.json').read_text(encoding='utf-8'))
out=assets/'Blender';out.mkdir(exist_ok=True)
images=assets/'PNG';images.mkdir(exist_ok=True)
names=[*[f'Lower_Cube_{i}' for i in range(1,6)],'Step_Lower','Step_Center','Step_Upper',*[f'Upper_Cube_{i}' for i in range(1,6)]]

def fingerprint(scene):
    result=[]
    for frame in [0,27,120,231,285,325,359]:
        scene.frame_set(frame)
        result.append([[round(v,6) for row in scene.objects[n].matrix_world for v in row] for n in names])
    scene.frame_set(0)
    return hashlib.sha256(json.dumps(result).encode()).hexdigest()

reference=None
checks=[]
for p in palettes:
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene=bpy.context.scene
    before=fingerprint(scene)
    reference=reference or before
    for name in names:
        band=0 if name.startswith('Lower_') else 1 if name=='Step_Lower' else 2 if name=='Step_Center' else 3 if name=='Step_Upper' else 4
        mat=scene.objects[name].active_material
        color=(*p['linearColors'][band],1)
        mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color
        mat.diffuse_color=color
    for i in range(4):
        mat=scene.objects[f'Wordmark_{i}'].active_material
        color=(*p['linearInk'],1)
        mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color
        mat.diffuse_color=color
    # Neutral studio lighting makes the color variants easier to compare.
    for light in bpy.data.lights: light.color=(1,1,1)
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.9,.9,.9,1)
    paper=scene.objects['Studio_Backdrop'].active_material.node_tree.nodes['Principled BSDF']
    paper.inputs['Base Color'].default_value=(.93,.93,.93,1)
    paper.inputs['Emission Color'].default_value=(.93,.93,.93,1)
    scene['ZSuan_version']='1.2.1';scene['ZSuan_palette']=p['id'];scene['ZSuan_palette_name']=p['name']
    scene.render.filepath='//renders/ZSuan-'
    scene.render.resolution_x,scene.render.resolution_y=1600,900
    scene.cycles.samples=64
    bpy.context.preferences.filepaths.save_version=0
    assert fingerprint(scene)==reference
    blend=out/f"造价智算-{p['name']}-v1.2.1.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    # Reopen the saved variant, then verify its materials and real animated poses.
    bpy.ops.wm.open_mainfile(filepath=str(blend));scene=bpy.context.scene
    assert fingerprint(scene)==reference
    for name in names: assert len(scene.objects[name].animation_data.nla_tracks)==16
    seed=scene.objects['Step_Center'].active_material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value
    assert max(abs(seed[i]-p['linearColors'][2][i]) for i in range(3))<1e-6
    cycles=bpy.context.preferences.addons['cycles'].preferences
    cycles.compute_device_type='ONEAPI';cycles.refresh_devices()
    for device in cycles.devices: device.use=device.type=='ONEAPI'
    scene.cycles.device='GPU' if any(d.type=='ONEAPI' and d.use for d in cycles.devices) else 'CPU'
    scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.resolution_x,scene.render.resolution_y=1280,720
    image=images/f"造价智算-{p['name']}.png"
    scene.render.filepath=str(image)
    bpy.ops.render.render(write_still=True)
    checks.append({'palette':p['id'],'name':p['name'],'blend':str(blend.relative_to(assets)),'png':str(image.relative_to(assets)),'reopened':True,'animatedPoseFingerprint':reference,'cubes':13,'tracksPerCube':16})
    (assets/'blender-palettes-verification.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
    print('PALETTE_READY '+p['id'],flush=True)
print('ALL_PALETTES_COMPLETE',flush=True)
