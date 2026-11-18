"""Local preview. Only mounts this worktree's assets and workstation settings."""
import argparse
import errno
import json
import socket
import sys
import threading
import urllib.request
import webbrowser
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

ROOT=Path(__file__).resolve().parents[3]
OFFICE=ROOT/'public/office-twin'
ENTRY='/office-twin/viewer/index.html?view=building&preview=porcelain'
sys.path.insert(0,str(ROOT/'03-Src'))
from office_workstations import router

app=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
app.include_router(router)


@app.get('/')
def index():
    return RedirectResponse(ENTRY)


@app.get('/preview-id')
def identity():
    return {'preview':'porcelain-0.4.0','root':str(ROOT)}


app.mount('/office-twin',StaticFiles(directory=OFFICE),name='office-twin')
app.mount('/assets',StaticFiles(directory=ROOT/'public/assets'),name='viewer-fonts')


def same_preview(port):
    url = f'http://127.0.0.1:{port}/preview-id'
    try:
        with urllib.request.urlopen(url, timeout=1) as response:
            service = json.loads(response.read(8192))
            return (isinstance(service, dict) and str(service.get('preview', '')).startswith('porcelain-')
                    and isinstance(service.get('root'), str) and bool(service['root'])
                    and Path(service['root']).resolve() == ROOT)
    except (OSError, ValueError):
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, help='Use this fixed loopback port')
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    for resource in ('models/H1-porcelain-v0.4.0.glb', 'data/office_layout.json'):
        if not (OFFICE / resource).is_file():
            sys.exit('Missing local asset: ' + resource)
    port = args.port if args.port is not None else 5278
    with socket.socket() as listener:
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            listener.bind(('127.0.0.1', port))
        except OSError as exc:
            if exc.errno not in (errno.EADDRINUSE, errno.EACCES):
                raise
            if same_preview(port):
                if not args.no_browser:
                    webbrowser.open(f'http://127.0.0.1:{port}')
                return
            if args.port is not None:
                sys.exit(f'Port {port} is already in use. Choose another with --port.')
            listener.bind(('127.0.0.1', 0))
        address = f'http://127.0.0.1:{listener.getsockname()[1]}'
        print('H1 office preview  ' + address, flush=True)
        if not args.no_browser:
            threading.Timer(.8, lambda: webbrowser.open(address)).start()
        config = uvicorn.Config(app, host='127.0.0.1', port=listener.getsockname()[1], access_log=False)
        uvicorn.Server(config).run(sockets=[listener])


if __name__ == '__main__':
    main()
