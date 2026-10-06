from pathlib import Path
import importlib.util
import json
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'03-Src'))
import server
spec=importlib.util.spec_from_file_location('legacy_acceptance',server.ENGINE/'tools/verify_v31_task_acceptance.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
module.EVIDENCE_DIR=server.ENGINE/'Codex-Temp/acceptance/astra-v31'
module.RUNTIME_DIR=module.EVIDENCE_DIR/'runtime'
server.paths.RUNTIME_DIR=module.RUNTIME_DIR
server.engine.app=server.app
result=module.run_acceptance(defer_matching=True)
print(json.dumps({'status':result['status'],'excel':result['excel_comparison'],'word':result['word_comparison'],'outputs':result['outputs']},ensure_ascii=False))
raise SystemExit(result['status']!='passed')
