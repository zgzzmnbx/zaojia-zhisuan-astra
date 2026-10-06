"""Astra-only launcher; invoked only by explicit platform enablement."""
from pathlib import Path
import sys,runpy
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'03-Src'))
import server
if not server.professional_host.config().get('external_enabled'):
    raise SystemExit('Astra external collaboration is disabled')
runpy.run_path(str(ROOT/'03-Src/professional-assets/feishu_bot_runner.py'),run_name='__main__')
