"""Export unchanged Blender geometry grouped by function and lighting role."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SYMBOL_PREFIXES=('Table sculpture','Abstract table block','Table header','Table horizontal','Table vertical','Table selected','Abacus','Blue abacus','Shield statue','White risk shield','Blue shield','Warning stem','Warning dot','Book sculpture','Open book','Book engraved','Book spine','Report page','Folded page','Collaboration sculpture','Sculpture connection','Collaborator')
WINDOW_PREFIXES=('Intake facade glazing','Hall vertical glazing','Archive glass core','Report hall blue curtain','Review blue skylight','Recessed window')
SCREEN_PREFIXES=('Workbook inset','Workbook blue title','Screen toolbar','White toolbar','Workbook column','Table column','Table horizontal','Selected table','Abstract cell','Workbook sheet')

def role_for(name,zone):
    if zone=='table' and name.startswith(SCREEN_PREFIXES):return 'screen'
    if name.startswith(SYMBOL_PREFIXES):return 'symbol'
    if name.startswith(WINDOW_PREFIXES):return 'window'
    return 'body'

def export_scene(output):
    groups={};records=[]
    for zone in ('land','import','price','risk','knowledge','report','review','table'):
        collection=bpy.data.collections.get(zone)
        if not collection:raise RuntimeError('Missing zone: '+zone)
        for obj in list(collection.objects):
            if obj.type not in {'MESH','CURVE','FONT'}:continue
            role=role_for(obj.name,zone)
            groups.setdefault((zone,role),[]).append(obj)
    exported=[]
    for (zone,role),items in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in items:obj.select_set(True)
        bpy.context.view_layer.objects.active=items[0]
        bpy.ops.object.convert(target='MESH');bpy.ops.object.join()
        obj=bpy.context.object;obj.name=f'zone_{zone}_{role}';obj['visualRole']=role
        if zone!='land':obj['zone']=zone
        exported.append(obj);records.append({'zone':zone,'role':role,'sourceObjects':len(items)})
    bpy.ops.object.select_all(action='DESELECT')
    for obj in exported:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(output/'white-sandbox.glb'),export_format='GLB',use_selection=True,export_extras=True,export_materials='EXPORT')
    (output/'visual-roles.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'white-sandbox.blend'))
    export_scene(ROOT)
    print('SEMANTIC_ROLES_EXPORTED')
