"""Relocate saved render output only; preserve scene content and keep originals."""
import bpy
import json
import zipfile
from pathlib import Path

catalog = Path(__file__).resolve().parent.parent
files = [
    '02-三维模型/logo-3d-v1/Blender/造价智算-阶梯Z-v1.0.0.blend',
    '02-三维模型/logo-3d-v1.1/Blender/造价智算-阶梯Z-原位翻转-v1.1.0.blend',
    '02-三维模型/logo-3d-v1.2/Blender-modular/造价智算-精细模型-组装-v1.2.0.blend',
]
backup = catalog / '90-迁移记录/迁移前Blender路径.zip'
assert not backup.exists(), 'Backup already exists; inspect before rerunning.'
with zipfile.ZipFile(backup, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in files:
        z.write(catalog / name, name)
results = []
for name in files:
    file = catalog / name
    bpy.ops.wm.open_mainfile(filepath=str(file))
    assert not bpy.data.libraries
    assert not any(i.filepath and not i.packed_file for i in bpy.data.images)
    original = bpy.context.scene.render.filepath
    bpy.context.scene.render.filepath = '//renders/ZSuan-'
    # Original files have already been preserved in the ZIP above.
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(file), relative_remap=True)
    results.append({'file':name,'previousRenderOutput':original,'currentRenderOutput':'//renders/ZSuan-','externalLibraries':0,'externalImages':0})
(catalog / '90-迁移记录/Blender路径修正.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print('PORTABLE_BLENDER_PATHS_VERIFIED')
