import hashlib
import json
import zipfile
from pathlib import Path
assets=Path(__file__).resolve().parent
names=[str(p.relative_to(assets)).replace('\\','/') for p in assets.rglob('*') if p.is_file() and p.suffix in {'.md','.json','.html','.mjs','.js','.py','.txt','.png','.glb','.blend'} and p.name!='delivery-verification.json']
for folder,count in [('GLB',24),('PNG',8),('Blender',8)]:
    assert len([p for p in (assets/folder).rglob('*') if p.is_file()])==count
manifest=[{'file':n,'bytes':(assets/n).stat().st_size,'sha256':hashlib.sha256((assets/n).read_bytes()).hexdigest()} for n in sorted(names)]
report={'version':'1.2.1','palettes':8,'animatedGLBs':24,'editableBlends':8,'renderedPNGs':8,'files':manifest}
(assets/'delivery-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
catalog=assets.parent.parent
out=catalog/'05-交付包' if (catalog/'logo-catalog.json').is_file() else assets.parent
out.mkdir(exist_ok=True)
package=out/'造价智算-八套配色与组装动效-v1.2.1.zip'
with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for n in names+['delivery-verification.json']:z.write(assets/n,'造价智算-八套配色-v1.2.1/'+n)
with zipfile.ZipFile(package) as z: assert z.testzip() is None
print(json.dumps({'package':str(package),'bytes':package.stat().st_size,'files':len(names)+1},ensure_ascii=True))
