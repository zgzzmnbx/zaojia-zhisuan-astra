"""Astra-owned immutable documents; the Gongwen project remains read-only."""
import hashlib
import json
import os
import subprocess
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import FileResponse
from workspace import Workspace, identifier

ROOT = Path(__file__).resolve().parents[1]
MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

def configuration():
    config = json.loads((ROOT / 'config/gongwen-source.json').read_text(encoding='utf-8'))
    project = Path(os.environ.get('ASTRA_GONGWEN_ROOT', config['project_root']))
    python = Path(os.environ.get('ASTRA_GONGWEN_PYTHON', str(Path(os.environ.get('LOCALAPPDATA', '')) / 'GongwenAgent/dev-venv/Scripts/python.exe')))
    core = project / '03-Src/packages/gongwen-core/src'
    if not python.is_file() or not (core / 'gongwen_core/api.py').is_file():
        raise HTTPException(503, '公文引擎尚未就绪，请核对本地公文项目和 Python 配置')
    return config, core, python

def documents_router(root_getter, report_path):
    router = APIRouter(prefix='/api/astra/documents')
    def workspace():
        return Workspace(root_getter() / 'astra-workspace')
    def directory():
        path = root_getter() / 'astra-documents'
        path.mkdir(parents=True, exist_ok=True)
        return path

    @router.get('/status')
    def status():
        config, _, _ = configuration()
        return {'available': True, 'engine': 'gongwen-core', 'version': config['core_version']}

    def source(kind, source_id, conversation):
        identifier(source_id); identifier(conversation)
        store = workspace()
        with store.connect() as db:
            conv = store.require(db, 'conversations', conversation)
            if kind == 'asset':
                asset = store.require(db, 'assets', source_id)
                if not store.accessible(asset, conv):
                    raise HTTPException(403, '文稿不属于当前对话或项目')
                path = store.root / 'files' / source_id
                name = asset['name']
            elif kind == 'report':
                owner = db.execute('SELECT conversation_id FROM conversation_jobs WHERE job_id=?', (source_id,)).fetchone()
                if not owner or owner[0] != conversation:
                    raise HTTPException(403, '请在报告所属对话中操作')
                path = report_path(source_id)
                name = path.name
            else:
                raise HTTPException(400, '文稿来源无效')
        if Path(name).suffix.lower() not in {'.docx', '.doc', '.md', '.markdown'}:
            raise HTTPException(400, '请选择 Word 或 Markdown 文稿')
        if not path.is_file():
            raise HTTPException(404, '文稿不存在')
        return path, name

    @router.get('/source')
    def describe(kind: str, source_id: str, conversation_id: str):
        path, name = source(kind, source_id, conversation_id)
        return {'name': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}

    @router.post('/format')
    def convert(payload: dict = Body(...)):
        kind, source_id, conversation = [str(payload.get(k, '')) for k in ('kind', 'source_id', 'conversation_id')]
        path, name = source(kind, source_id, conversation)
        data = path.read_bytes()
        sha = hashlib.sha256(data).hexdigest()
        if sha != payload.get('sha256'):
            raise HTTPException(409, '原文已更新，请重新打开文稿后转换')
        config, core, python = configuration()
        id = uuid4().hex
        folder = directory() / id
        folder.mkdir()
        request = {'name': name, 'kind': kind, 'source_id': source_id, 'source_sha256': sha,
                   'conversation_id': conversation, 'core_version': config['core_version']}
        (folder / 'source').write_bytes(data)
        (folder / 'request.json').write_text(json.dumps(request, ensure_ascii=False), encoding='utf-8')
        env = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONDONTWRITEBYTECODE='1')
        try:
            run = subprocess.run([str(python), str(ROOT / '03-Src/gongwen_worker.py'), str(core), str(folder)],
                                 cwd=folder, env=env, capture_output=True, text=True, encoding='utf-8', timeout=180,
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except subprocess.TimeoutExpired:
            raise HTTPException(504, '公文转换超时，原文保留，请重试') from None
        if run.returncode or not (folder / 'formatted.docx').is_file():
            raise HTTPException(422, (run.stderr.strip() or '公文转换未完成，原文保留')[-700:])
        checks = json.loads((folder / 'checks.json').read_text(encoding='utf-8'))
        result = {**request, 'id': id, 'name': Path(name).stem + '-公文版.docx',
                  'sha256': hashlib.sha256((folder / 'formatted.docx').read_bytes()).hexdigest(),
                  'status': checks['status'], 'warnings': [c['message'] for c in checks['checks'] if c['status'] == 'needs_review']}
        (folder / 'result.json').write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
        return result

    def artifact(id, conversation):
        folder = directory() / identifier(id)
        try:
            result = json.loads((folder / 'result.json').read_text(encoding='utf-8'))
        except FileNotFoundError:
            raise HTTPException(404, '转换成果尚未生成或不存在') from None
        if result['conversation_id'] != identifier(conversation):
            raise HTTPException(403, '该公文成果属于另一段对话')
        with workspace().connect() as db:
            workspace().require(db, 'conversations', conversation)
        return folder, result

    @router.get('/{id}')
    def metadata(id: str, conversation_id: str):
        return artifact(id, conversation_id)[1]

    @router.get('/{id}/download')
    def download(id: str, conversation_id: str, kind: str = 'word'):
        folder, result = artifact(id, conversation_id)
        if kind == 'checks':
            return FileResponse(folder / 'checks.json', filename=Path(result['name']).stem + '-检查.json', media_type='application/json')
        if kind != 'word':
            raise HTTPException(400, '成果类型无效')
        return FileResponse(folder / 'formatted.docx', filename=result['name'], media_type=MIME)
    return router
