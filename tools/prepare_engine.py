"""Copy the approved source and manifest assets once; never import the source project."""
from pathlib import Path
import argparse
import ast
import hashlib
import json
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / '03-Src' / 'engine'
DOC = ROOT / '00-docs' / '00-PRD'

def run(source: Path):
    source = source.resolve(strict=True)
    if DEST.exists():
        raise SystemExit('Engine already exists. Do not overwrite a running independent copy.')
    selected = set()
    def add(relative):
        path = source / relative
        if not path.exists():
            raise FileNotFoundError(path)
        path.resolve().relative_to(source)
        for file in ([path] if path.is_file() else path.rglob('*')):
            if not file.is_file() or any(p in ('__pycache__', 'node_modules', '.git', 'archive', '.pytest_cache') for p in file.parts):
                continue
            if file.name.startswith('.env') or file.suffix in ('.pyc', '.log', '.sqlite3', '.sqlite'):
                continue
            file.resolve().relative_to(source)
            selected.add(file.relative_to(source))
    for path in ['backend/app','backend/tests','backend/requirements.txt','backend/requirements-runtime.txt',
                 'business-skills','config','README.md','AGENTS.md','CHANGELOG.md','00-PRD',
                 '06-知识库问答资料/造价知识文章库','08-测试与演示/测试-V3.1-260802',
                 'tools/verify_v31_task_acceptance.py','tools/verify_v31_ai_mode.py',
                 '05-经验池-预警数据','03-【匹配规则】-勘察测绘知识库-匹配规则提炼']:
        add(path)
    for manifest in (source/'business-skills').glob('*/manifest.json'):
        data=json.loads(manifest.read_text(encoding='utf-8'))
        for value in data.get('assets',{}).values():
            for path in value if isinstance(value,list) else [value]:
                if isinstance(path,str): add(path)
    evidence=[]
    for rel in sorted(selected):
        original=source/rel; target=DEST/rel
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(original,target)
        evidence.append({'path':rel.as_posix(),'sha256':hashlib.sha256(original.read_bytes()).hexdigest(),'bytes':original.stat().st_size})
    (DOC/'07-业务资产来源.json').write_text(json.dumps({'source':str(source),'files':evidence},ensure_ascii=False,indent=2),encoding='utf-8')
    endpoints=[]
    for py in (source/'backend/app').glob('*.py'):
        tree=ast.parse(py.read_text(encoding='utf-8-sig'))
        for fn in ast.walk(tree):
            if not isinstance(fn,(ast.FunctionDef,ast.AsyncFunctionDef)):continue
            for deco in fn.decorator_list:
                if isinstance(deco,ast.Call) and isinstance(deco.func,ast.Attribute) and deco.func.attr in ('get','post','patch','put','delete') and deco.args and isinstance(deco.args[0],ast.Constant):
                    endpoints.append({'method':deco.func.attr.upper(),'path':deco.args[0].value,'handler':fn.name,'source':py.relative_to(source).as_posix(),'line':fn.lineno,'astra':'待接入'})
    requirements=[]
    for prd in (source/'00-PRD/01-模块PRD').glob('*/PRD.md'):
        for line_no,line in enumerate(prd.read_text(encoding='utf-8-sig').splitlines(),1):
            if re.search(r'\[(已完成|进行中|待开发|暂缓|不做)\]',line):requirements.append({'module':prd.parent.name,'source':prd.relative_to(source).as_posix(),'line':line_no,'requirement':line,'astra':'待核销'})
    app=(source/'frontend/src/App.tsx').read_text(encoding='utf-8-sig')
    actions=[{'line':i,'source':line.strip()[:400]} for i,line in enumerate(app.splitlines(),1) if re.search(r'(async )?function (handle|run|open|save|load|confirm|cancel|submit)|onClick=|onChange=',line)]
    (DOC/'08-原功能与接口盘点.json').write_text(json.dumps({'endpoints':endpoints,'requirements':requirements,'frontend_operations':actions,'note':'源代码盘点，不等同于每项迁移完成。'},ensure_ascii=False,indent=2),encoding='utf-8')
    proof=ROOT/'Codex-Temp/acceptance/v0.2.0';proof.mkdir(parents=True,exist_ok=True)
    (proof/'source-git-before.txt').write_bytes(subprocess.check_output(['git','status','--short'],cwd=source))
    print(json.dumps({'files':len(evidence),'size_mb':round(sum(x['bytes'] for x in evidence)/1024**2,2),'endpoints':len(endpoints),'requirements':len(requirements),'frontend_operations':len(actions)},ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);run(parser.parse_args().source)
