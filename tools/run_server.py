import socket
import sys
import os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'03-Src'))
if __name__=='__main__':
    with socket.socket() as probe:
        try:probe.bind(('127.0.0.1',5189))
        except OSError:raise SystemExit('5189 已被占用。未停止其他进程，请检查当前 Astra 服务。')
    import uvicorn
    (ROOT/'Codex-Temp').mkdir(exist_ok=True)
    (ROOT/'Codex-Temp/server.pid').write_text(str(os.getpid()),encoding='ascii')
    uvicorn.run('server:app',host='127.0.0.1',port=5189,access_log=False)
