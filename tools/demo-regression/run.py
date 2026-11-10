"""One-click, version-bound demo regression. Exit 0=all, 1=failed, 2=incomplete."""
import argparse
import datetime as dt
import html
import json
import os
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import sys
import time
import urllib.request
import uuid
from common import VERSION, sha, write

HERE=Path(__file__).resolve().parent
PROJECT=HERE.parents[1]
FORMAL=PROJECT/'runtime/astra-service'
RUNS=PROJECT/'Codex-Temp/demo-regression'
CASES=json.loads((HERE/'cases.json').read_text('utf-8'))

def ensure_same_version(manifest):
    changed=[p for p,h in manifest['source_hashes'].items() if not (FORMAL/p).is_file() or sha(FORMAL/p)!=h]
    release=PROJECT/'runtime/modules/digital-cost/release-manifest.json'
    if manifest.get('digital_release_sha256') and sha(release)!=manifest['digital_release_sha256']:changed.append('digital-release')
    if changed:raise ValueError('Version changed: run a new regression before adding acceptance: '+', '.join(changed[:3]))

def get(url):
    with urllib.request.urlopen(url,timeout=5) as r:return json.load(r)

def port_free(port):
    with socket.socket() as s:s.bind(('127.0.0.1',port))

def stop_owned(process):
    """Windows venv launchers have a Python child; stop only this owned tree."""
    if process.poll() is not None:return
    if os.name=='nt':
        subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],capture_output=True,timeout=15,creationflags=subprocess.CREATE_NO_WINDOW)
    else:process.terminate()
    try:process.wait(timeout=10)
    except subprocess.TimeoutExpired:process.kill();process.wait()

def command(args,cwd,log,timeout=600,env=None):
    start=time.monotonic()
    flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
    with log.open('w',encoding='utf-8') as stream:
        proc=subprocess.Popen(args,cwd=cwd,stdout=stream,stderr=subprocess.STDOUT,env=env,creationflags=flags)
        try:code=proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            stop_owned(proc);code=124
        except KeyboardInterrupt:
            stop_owned(proc);raise
    return {'exit_code':code,'seconds':round(time.monotonic()-start,2),'log':log.name}

def snapshot(out):
    app=out/'app';app.mkdir()
    excluded={'Codex-Temp','runtime','node_modules','.venv','__pycache__','.git'}
    records={}
    build=json.loads((FORMAL/'04-output/astra-build.json').read_text('utf-8'))
    generations=json.loads((FORMAL/'04-output/astra-asset-generations.json').read_text('utf-8'))['generations']
    current_assets=set(generations[0])
    def files(root):
        for parent, directories, names in os.walk(root):
            directories[:] = [x for x in directories if x not in excluded and not (Path(parent)/x).is_symlink()]
            for name in names:yield Path(parent)/name
    for name in ['03-Src','04-output','public']:
        for src in files(FORMAL/name):
            rel=src.relative_to(FORMAL)
            if not src.is_file() or any(x in excluded for x in rel.parts) or src.name.startswith('.env') or '.local.' in src.name:continue
            if name=='04-output' and rel.parts[1]=='assets' and src.relative_to(FORMAL/name).as_posix() not in current_assets:continue
            dest=app/rel;dest.parent.mkdir(parents=True,exist_ok=True)
            before=sha(src);shutil.copy2(src,dest)
            if sha(dest)!=before or sha(src)!=before:raise RuntimeError(f'Source changed while copying: {rel}')
            records[rel.as_posix()]=before
    shutil.copy2(FORMAL/'package.json',app/'package.json');records['package.json']=sha(FORMAL/'package.json')
    config=app/'config';config.mkdir()
    for name,value in {
        'astra-connections.local.json':{'external_enabled':False,'models':{}},
        'astra-gork-notifications.local.json':{'enabled':False},
        'digital-cost.local.json':{'enabled':True},
        'astra-weknora.local.json':{'enabled':False},
    }.items():write(config/name,value)
    for name in ['gongwen-source.json','gongwen-core-source.json','cost-report-cover-source.json']:
        if (FORMAL/'config'/name).exists():shutil.copy2(FORMAL/'config'/name,config/name)
    # Run existing contract tests against the deployed SOURCE copy, not dirty root.
    shutil.copytree(PROJECT/'tests',app/'tests',ignore=shutil.ignore_patterns('__pycache__'))
    (app/'tools').mkdir(exist_ok=True)
    for name in ['migrate-knowledge-assets.py']:
        shutil.copy2(PROJECT/'tools'/name,app/'tools'/name)
    for rel,digest in build['sources'].items():
        if not (app/rel).exists():
            (app/rel).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(FORMAL/rel,app/rel);records[rel]=sha(FORMAL/rel)
        if sha(app/rel)!=digest:raise RuntimeError(f'Published source/build mismatch: {rel}')
    # Copy only prepared module data/assets; never model configuration or secrets.
    digital=PROJECT/'runtime/modules/digital-cost';target=out/'digital';target.mkdir()
    shutil.copytree(digital/'frontend',target/'frontend');(target/'data').mkdir()
    for name in ['assets','previews']:
        if (digital/'data'/name).exists():shutil.copytree(digital/'data'/name,target/'data'/name)
    source=sqlite3.connect((digital/'data/digital-cost.sqlite3').resolve().as_uri()+'?mode=ro',uri=True)
    dest=sqlite3.connect(target/'data/digital-cost.sqlite3')
    try:source.backup(dest)
    finally:dest.close();source.close()
    manifest={'suite_version':VERSION,'source':str(FORMAL),'ui_version':build['version'],'build_time':build['builtAt'],
              'source_hashes':records,'digital_release':json.loads((digital/'release-manifest.json').read_text('utf-8')),
              'digital_release_sha256':sha(digital/'release-manifest.json'),
              'harness_hashes':{p.name:sha(p) for p in HERE.iterdir() if p.is_file()},
              'prepared_database_sha256':sha(target/'data/digital-cost.sqlite3'),
              'test_context':'fresh host data; digital historical data read-only backup; no production credentials'}
    write(out/'manifest.json',manifest)
    return manifest

def render(out):
    evidence=[]
    for name in ['api-results.json','browser-results.json','manual-results.json']:
        if (out/name).exists():evidence+=json.loads((out/name).read_text('utf-8'))
    rows=[]
    for c in CASES:
        layers=[]
        for layer in c['layers']:
            found=[e for e in evidence if e['id']==c['id'] and e['layer']==layer]
            layers.append(found[-1] if found else {'id':c['id'],'layer':layer,'status':'not_run','detail':'尚未执行/需要人工实收验收'})
        status='failed' if any(e['status']=='failed' for e in layers) else 'passed' if all(e['status']=='passed' for e in layers) else 'not_run'
        rows.append({**c,'status':status,'results':layers})
    gates=json.loads((out/'gates.json').read_text('utf-8')) if (out/'gates.json').exists() else {}
    failed=any(r['status']=='failed' for r in rows) or any(v.get('exit_code',0)!=0 for v in gates.values())
    missing_gates=[k for k in ['harness','api','contracts','browser','formal_preserved','module_isolation'] if k not in gates]
    status='failed' if failed else 'passed' if not missing_gates and all(r['status']=='passed' for r in rows) else 'incomplete'
    report={'suite_version':VERSION,'run':out.name,'status':status,'counts':{s:sum(r['status']==s for r in rows) for s in ['passed','failed','not_run']},'gates':gates,'missing_gates':missing_gates,'cases':rows}
    write(out/'report.json',report)
    manifest=json.loads((out/'manifest.json').read_text('utf-8')) if (out/'manifest.json').exists() else {}
    labels={'passed':'通过','failed':'失败','not_run':'未完成','incomplete':'未全部验收'}
    lines=[f'# 演示回归报告 {out.name}',f'\n测试工具 v{VERSION}；程序 v{manifest.get("ui_version","未知")}；结论：**{labels[status]}**。',
           '\n本报告按41段录音中的实际操作编排。自动通过不代表外部平台实收、实体播报、Office排版或现场7分钟已验收。',
           '\n失败表示该验收断言未满足，须结合错误、截图和日志区分程序缺陷、环境问题与测试脚本不适配；不可直接等同于业务故障。',
           '\n流程门禁：'+json.dumps(gates,ensure_ascii=False),
           '\n| 用例 | 录音段 | 功能 | 结果 |\n|---|---|---|---|']
    lines += [f'| {r["id"]} | {r["segment"]} | {r["name"]} | {labels[r["status"]]} |' for r in rows]
    lines+=['\n## 检查明细']
    for r in rows:
        lines += [f'\n### {r["id"]} {r["name"]}',r['expected']]
        lines += [f'- {e["layer"]}：{labels.get(e["status"],e["status"])}；{json.dumps(e.get("detail"),ensure_ascii=False,default=str)}' for e in r['results']]
    (out/'report.md').write_text('\n'.join(lines),encoding='utf-8')
    cards=''.join(f'<tr><td>{r["id"]}</td><td>{html.escape(r["name"])}</td><td class="{r["status"]}">{labels[r["status"]]}</td><td>{html.escape(r["expected"])}</td></tr>' for r in rows)
    details=''.join(f'<details><summary>{r["id"]} {html.escape(r["name"])} · {labels[r["status"]]}</summary>'+ (f'<a href="browser-{r["id"]}.png">浏览器截图</a>' if (out/f'browser-{r["id"]}.png').exists() else '')+f'<pre>{html.escape(json.dumps(r["results"],ensure_ascii=False,indent=2))}</pre></details>' for r in rows)
    details='<details><summary>执行门禁与中断原因</summary><pre>'+html.escape(json.dumps({'gates':gates,'missing':missing_gates},ensure_ascii=False,indent=2))+'</pre></details>'+details
    (out/'report.html').write_text(f'<!doctype html><meta charset="utf-8"><title>演示回归报告</title><style>body{{font:16px/1.7 system-ui;margin:40px auto;max-width:1100px;padding:0 24px;color:#273444;background:#f7f8fa}}table{{border-collapse:collapse;width:100%;background:white}}td,th{{padding:10px;border-bottom:1px solid #ddd;text-align:left}}.passed{{color:#08795a}}.failed{{color:#b42318}}.not_run{{color:#8a6500}}pre{{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}}details{{padding:12px;background:white;margin:8px 0}}a{{color:#2266aa}}</style><h1>演示回归：{labels[status]}</h1><p>程序 v{manifest.get("ui_version","未知")} · 工具 v{VERSION} · {out.name}</p><p>通过 {report["counts"]["passed"]} / 失败 {report["counts"]["failed"]} / 未完成 {report["counts"]["not_run"]}。外部实收、设备播报、Office及现场排练单独验收。</p><p><a href="report.json">JSON明细</a> · <a href="report.md">文字报告</a> · <a href="manual-checklist.md">人工验收步骤</a> · <a href="manifest.json">版本与来源</a></p><table><tr><th>编号</th><th>演示功能</th><th>结果</th><th>标准</th></tr>{cards}</table><h2>实际证据</h2>{details}',encoding='utf-8')
    return report

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-only',action='store_true',help='Diagnostic partial run, never a full demo pass')
    parser.add_argument('--run-dir',type=Path,help='Render or record an existing immutable run')
    parser.add_argument('--record',choices=[x['id'] for x in CASES if x['layers']==['manual']])
    parser.add_argument('--status',choices=['passed','failed'])
    parser.add_argument('--reviewer');parser.add_argument('--evidence',type=Path);parser.add_argument('--note')
    parser.add_argument('--open',action='store_true',help='Open the HTML report after completion')
    args=parser.parse_args()
    if args.run_dir:
        out=args.run_dir.resolve()
        if out.parent!=RUNS.resolve():raise SystemExit('Run directory must belong to this workspace')
        if args.record:
            if not all([args.status,args.reviewer,args.note,args.evidence]) or not args.evidence.is_file():raise SystemExit('Manual result requires status, reviewer, note and an existing evidence file')
            manifest=json.loads((out/'manifest.json').read_text('utf-8'))
            ensure_same_version(manifest)
            existing=json.loads((out/'manual-results.json').read_text('utf-8')) if (out/'manual-results.json').exists() else []
            target=out/'manual-evidence'/f'{args.record}-{uuid.uuid4().hex[:8]}{args.evidence.suffix}';target.parent.mkdir(exist_ok=True);shutil.copy2(args.evidence,target)
            existing.append({'id':args.record,'layer':'manual','status':args.status,'detail':{'reviewer':args.reviewer,'note':args.note,'evidence':str(target.relative_to(out)),'sha256':sha(target),'at':dt.datetime.now().isoformat()}})
            write(out/'manual-results.json',existing)
        result=render(out)
    else:
        RUNS.mkdir(parents=True,exist_ok=True)
        out=RUNS/(dt.datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:6]);out.mkdir()
        write(RUNS/'latest.json',{'run_dir':str(out)})
        shutil.copy2(HERE/'manual-checklist.md',out/'manual-checklist.md')
        render(out)
        print('REPORT_DIRECTORY='+str(out),flush=True)
        gates={};processes=[];handles=[]
        try:
            for port in [5197,18770]:port_free(port)
            print('Preparing isolated snapshot of the deployed application...',flush=True)
            manifest=snapshot(out)
            shutil.copy2(HERE/'manual-checklist.md',out/'manual-checklist.md')
            python=FORMAL/'.venv/Scripts/python.exe'
            env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','PYTHONIOENCODING':'utf-8'};env.pop('PYTHONPATH',None)
            gates['harness']=command([str(python),'-m','unittest','discover','-s',str(HERE),'-p','test_harness.py'],PROJECT,out/'harness.log',60,env)
            print('Running business chain and independent reference checks...',flush=True)
            gates['api']=command([str(python),str(HERE/'api_checks.py'),str(out)],PROJECT,out/'api.log',900,env)
            # Contract coverage complements browser/real business checks; it does
            # not promote mocked platform transports to real-delivery acceptance.
            tests=['test_demo_settings.py','test_demo_report_baseline.py','test_migration_six.py','test_dashboard.py',
                   'test_collaboration_lifecycle.py','test_gork_review_delivery.py','test_gork_review_approval.py',
                   'test_knowledge_model.py','test_digital_cost_gateway.py','test_excel_recalculation.py']
            gates['contracts']=command([str(python),'-m','pytest','-q',*[f'tests/{t}' for t in tests],f'--basetemp={out}/pytest-temp',f'--junitxml={out}/contracts.xml'],out/'app',out/'contracts.log',600,env)
            if not args.api_only:
                print('Starting isolated browser and digital module checks...',flush=True)
                flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
                digital_python=PROJECT/'runtime/modules/digital-cost/.venv/Scripts/python.exe'
                for name,cmd in [('digital',[str(digital_python),'-I',str(HERE/'digital_serve.py'),'--data-dir',str(out/'digital/data'),'--frontend-dir',str(out/'digital/frontend'),'--port','18770']),
                                 ('host',[str(python),str(HERE/'serve.py'),str(out/'app'),'5197','18770'])]:
                    log=(out/f'{name}-server.log').open('w',encoding='utf-8');handles.append(log)
                    processes.append(subprocess.Popen(cmd,cwd=out,env={**env,'DIGITAL_COST_INSTANCE':'astra-digital-cost'},stdout=log,stderr=subprocess.STDOUT,creationflags=flags))
                for _ in range(60):
                    try:get('http://127.0.0.1:5197/api/health');get('http://127.0.0.1:18770/api/digital-cost/v1/health');break
                    except Exception:time.sleep(.5)
                else:raise RuntimeError('Isolated services did not become ready')
                gates['browser']=command(['node',str(HERE/'browser.mjs'),str(out)],PROJECT,out/'browser.log',1200,env)
                # An unavailable optional module must leave the host usable.
                stop_owned(processes[0])
                health=get('http://127.0.0.1:5197/api/health')
                write(out/'module-isolation-health.json',health)
                module=get('http://127.0.0.1:5197/api/astra/digital/status')
                job=json.loads((out/'api-context.json').read_text('utf-8'))['job_id']
                restored=get(f'http://127.0.0.1:5197/api/astra/runs/{job}')
                gates['module_isolation']={'exit_code':int(bool(module.get('available')) or restored.get('job_id')!=job),'host_health':{k:health.get(k) for k in ['status','version','ui_version','pid']},'restored_job':restored.get('job_id'),'module_status':module}
        except (Exception,KeyboardInterrupt) as exc:
            gates['runner']={'exit_code':1,'error':str(exc)}
            print('Runner error: '+str(exc),flush=True)
        finally:
            for process in reversed(processes):
                stop_owned(process)
            for handle in handles:handle.close()
            if (out/'manifest.json').exists():
                manifest=json.loads((out/'manifest.json').read_text('utf-8'))
                changed=[p for p,h in manifest['source_hashes'].items() if not (FORMAL/p).is_file() or sha(FORMAL/p)!=h]
                gates['formal_preserved']={'exit_code':int(bool(changed)),'changed_files':changed}
            write(out/'gates.json',gates)
        result=render(out)
    print(json.dumps({'status':result['status'],'counts':result['counts'],'report':str(out/'report.html')},ensure_ascii=False),flush=True)
    if args.open and os.name=='nt':os.startfile(out/'report.html')
    return {'passed':0,'failed':1,'incomplete':2}[result['status']]

if __name__=='__main__':sys.exit(main())
