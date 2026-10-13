import bpy,json,shutil
from pathlib import Path
root=Path(__file__).resolve().parent
scene=root.parent/'white-sandbox-v0.1.0'
backup=root/'Blender路径修正前'
backup.mkdir(exist_ok=True)
records=[]
for name in ('white-sandbox.blend','white-sandbox-flow.blend'):
    file=scene/name
    if not (backup/name).exists():shutil.copy2(file,backup/name)
    bpy.ops.wm.open_mainfile(filepath=str(file))
    before=bpy.context.scene.render.filepath
    bpy.context.scene.render.filepath='//renders/'+file.stem+'-'
    bpy.ops.wm.save_as_mainfile(filepath=str(file))
    records.append({'file':str(file),'previousOutput':before,'output':bpy.context.scene.render.filepath,'missingImages':[i.filepath for i in bpy.data.images if i.source=='FILE' and not i.packed_file and not Path(bpy.path.abspath(i.filepath)).exists()]})
(root/'Blender路径修正.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print('BLENDER_PATHS_VERIFIED',len(records))
