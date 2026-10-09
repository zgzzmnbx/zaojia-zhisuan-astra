"""Run the retained 2.0 supervisor with Astra's isolated runtime and adapter."""
from pathlib import Path
import runpy
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'03-Src'))
import server

if not server.professional_host.config().get('external_enabled'):
    raise SystemExit('Astra external collaboration is disabled')
runpy.run_path(str(ROOT/'03-Src/professional-assets/feishu_bot_supervisor.py'),run_name='__main__')
