import hashlib,json,zipfile
from pathlib import Path
assets=Path(__file__).resolve().parent
for folder,extension,count in [('GLB','.glb',24),('Blender','.blend',8)]:
    assert len(list((assets/folder).rglob('*'+extension)))==count
names=sorted(str(p.relative_to(assets)).replace('\\','/') for p in assets.rglob('*') if p.is_file() and p.suffix in {'.md','.json','.html','.mjs','.js','.py','.txt','.glb','.blend'} and p.name!='delivery-verification.json')
files=[{'file':n,'bytes':(assets/n).stat().st_size,'sha256':hashlib.sha256((assets/n).read_bytes()).hexdigest()} for n in names]
report={'version':'1.2.2','palettes':8,'animatedGLBs':24,'editableBlends':8,'clipsPerGLB':20,'newPoses':4,'files':files}
(assets/'delivery-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
catalog=assets.parent.parent
out=catalog/'05-交付包' if (catalog/'logo-catalog.json').exists() else assets.parent
out.mkdir(exist_ok=True);target=out/'造价智算-四姿态与八套配色-v1.2.2.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for n in names+['delivery-verification.json']:z.write(assets/n,'造价智算-四姿态-v1.2.2/'+n)
with zipfile.ZipFile(target) as z:assert z.testzip() is None
print(json.dumps({'file':str(target),'bytes':target.stat().st_size,'files':len(names)+1},ensure_ascii=True))
