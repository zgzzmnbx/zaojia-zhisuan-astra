"""Install a NEW independent local release. Never update or erase an existing runtime."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import venv

p=argparse.ArgumentParser()
p.add_argument('--source',type=Path,required=True)
p.add_argument('--target',type=Path,required=True)
a=p.parse_args()
source=a.source.resolve(); target=a.target.resolve()
if target.exists():
    raise SystemExit('Target already exists; preserve it and choose a new release directory.')
wheel=source/'Codex-Temp/astra-v085-wheel/digital_cost_assistant-0.8.5-py3-none-any.whl'
assert wheel.is_file() and (source/'03-Src/frontend/dist/index.html').is_file()
target.mkdir(parents=True)
venv.create(target/'.venv',with_pip=True)
# Frozen independent copies of already tested dependencies, not editable links to the source tree.
site=source/'.venv/Lib/site-packages'; dest=target/'.venv/Lib/site-packages'
for item in site.iterdir():
    if item.name.startswith(('pip','__editable__','digital_cost')) or item.suffix=='.pth' or item.name=='__pycache__':
        continue
    out=dest/item.name
    if item.is_dir():shutil.copytree(item,out,ignore=shutil.ignore_patterns('__pycache__'))
    else:shutil.copy2(item,out)
(target/'release').mkdir()
shutil.copy2(wheel,target/'release'/wheel.name)
subprocess.run([str(target/'.venv/Scripts/python.exe'),'-m','pip','install','--no-deps',str(target/'release'/wheel.name)],check=True)
shutil.copytree(source/'03-Src/frontend/dist',target/'frontend')
(target/'data').mkdir();(target/'logs').mkdir()
files={}
for directory in ['frontend','release','.venv/Lib/site-packages']:
    for file in (target/directory).rglob('*'):
        if file.is_file() and '__pycache__' not in file.parts:
            files[str(file.relative_to(target))]=hashlib.sha256(file.read_bytes()).hexdigest()
(target/'release-manifest.json').write_text(json.dumps({'module':'digital-cost','version':'0.8.5','source':str(source),'files':files},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'target':str(target),'version':'0.8.5','verified_files':len(files)},ensure_ascii=False))
