"""Conversation-scoped immutable official-document copies, using a pinned SDK."""
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import FileResponse
from workspace import Workspace, identifier

ROOT = Path(__file__).resolve().parents[1]
MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
DEFAULT_OPTIONS = dict(interpret_bold_markers=False, flatten_numbering=False,
                       clean_extra_spaces=False, convert_chinese_punctuation=False,
                       use_times_new_roman=False, auto_letter_layout=True,
                       split_numbered_paragraphs=True, split_decimal_numbered_paragraphs=True,
                       add_page_numbers=True)


def configuration():
    try:
        config = json.loads((ROOT / 'config/gongwen-source.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        raise HTTPException(503, '公文核心配置未就绪，请核对独立安装') from None
    core = ROOT / config['core_path']
    python = Path(sys.executable)
    if not python.is_file() or not (core / 'gongwen_core/api.py').is_file():
        raise HTTPException(503, '公文核心未就绪，请核对造价智算独立依赖')
    return config, core, python


def validate_options(raw):
    if not isinstance(raw, dict) or set(raw) - {*DEFAULT_OPTIONS, 'confirmed_title', 'title'}:
        raise HTTPException(400, '格式选项无效')
    if any(type(raw[key]) is not bool for key in raw if key in DEFAULT_OPTIONS):
        raise HTTPException(400, '格式开关须为布尔值')
    if 'confirmed_title' in raw and (not isinstance(raw['confirmed_title'], str) or len(raw['confirmed_title']) > 100):
        raise HTTPException(400, '标题选择无效')
    if 'title' in raw and (not isinstance(raw['title'], str) or len(raw['title']) > 100):
        raise HTTPException(400, '手动标题须为1至100字')
    return {**DEFAULT_OPTIONS, **raw}


def documents_router(root_getter, report_path):
    router = APIRouter(prefix='/api/astra/documents')

    def workspace():
        return Workspace(root_getter() / 'astra-workspace')

    def directory():
        path = root_getter() / 'astra-documents'
        path.mkdir(parents=True, exist_ok=True)
        return path

    def run_worker(folder, config, core, python):
        try:
            run = subprocess.run([str(python), str(ROOT / '03-Src/gongwen_worker.py'), str(core), str(folder)],
                                 cwd=folder, env=dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONDONTWRITEBYTECODE='1'),
                                 capture_output=True, text=True, encoding='utf-8', timeout=180,
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except subprocess.TimeoutExpired:
            raise HTTPException(504, '公文转换超时，原文保留，请重试') from None
        if run.returncode:
            raise HTTPException(422, (run.stderr.strip() or '公文转换未完成，原文保留')[-700:])

    @router.get('/status')
    def status():
        config, core, python = configuration()
        # Import the actual SDK and required packages; a path alone is not readiness.
        probe = subprocess.run([str(python), '-c',
            'import sys; sys.path.insert(0,sys.argv[1]); from gongwen_core.api import VERSION; '
            'from gongwen_core.profiles import get_profile; import PIL,olefile,fontTools,markdown_it,yaml; '
            'assert VERSION==sys.argv[2]; assert get_profile("official_body",sys.argv[3]); print(VERSION)',
            str(core), config['core_version'], config['profile_version']], capture_output=True, text=True,
            encoding='utf-8', timeout=20, env=dict(os.environ, PYTHONDONTWRITEBYTECODE='1'),
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if probe.returncode or any(not (core / 'gongwen_core/fonts' / filename).is_file() for filename in
                ('fzxiaobiaosong.ttf', 'fzfangsong.ttf', 'fzhei.ttf', 'fzkai.ttf', 'simsun.ttf', 'times-new-roman.ttf')):
            raise HTTPException(503, '公文依赖或本机字体资源未就绪，请核对独立安装')
        return {'available': True, 'engine': 'gongwen-core', 'version': probe.stdout.strip(), 'profile_version': config['profile_version']}

    def source(kind, source_id, conversation):
        identifier(source_id); identifier(conversation)
        store = workspace()
        with store.connect() as db:
            conv = store.require(db, 'conversations', conversation)
            if kind == 'asset':
                asset = store.require(db, 'assets', source_id)
                if not store.accessible(asset, conv):
                    raise HTTPException(403, '文稿不属于当前对话或项目')
                path, name = store.root / 'files' / source_id, asset['name']
            elif kind in {'report', 'risk-markdown'}:
                owner = db.execute('SELECT conversation_id FROM conversation_jobs WHERE job_id=?', (source_id,)).fetchone()
                if not owner or owner[0] != conversation:
                    raise HTTPException(403, '请在报告所属对话中操作')
                path = report_path(source_id)
                if kind == 'risk-markdown':
                    try:
                        receipt = json.loads((path.parent / 'risk-report-source.json').read_text(encoding='utf-8'))
                    except (OSError, ValueError):
                        raise HTTPException(409, '风险报告来源记录缺失，请重新生成报告') from None
                    if receipt.get('source_word_sha256') != hashlib.sha256(path.read_bytes()).hexdigest():
                        raise HTTPException(409, '报告已更新，请重新生成风险报告')
                    path = path.parent / 'risk-report.md'
                    if not path.is_file() or receipt.get('markdown_sha256') != hashlib.sha256(path.read_bytes()).hexdigest():
                        raise HTTPException(409, '风险正文版本不一致，请重新生成报告')
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

    @router.get('/source/download')
    def download_source(kind: str, source_id: str, conversation_id: str):
        path, name = source(kind, source_id, conversation_id)
        return FileResponse(path, filename=name, media_type='text/markdown; charset=utf-8' if Path(name).suffix.lower() in {'.md', '.markdown'} else MIME)

    def snapshot(payload, action):
        kind, source_id, conversation = [str(payload.get(k, '')) for k in ('kind', 'source_id', 'conversation_id')]
        path, name = source(kind, source_id, conversation)
        data = path.read_bytes()
        sha = hashlib.sha256(data).hexdigest()
        if payload.get('sha256') and sha != payload['sha256']:
            raise HTTPException(409, '原文已更新，请重新打开文稿后转换')
        if action == 'format' and not payload.get('sha256'):
            raise HTTPException(409, '请先核对原文版本')
        options = validate_options(payload.get('options', {}))
        prepared_id = payload.get('prepared_id')
        if prepared_id:
            try:
                previous = json.loads((directory() / identifier(prepared_id) / 'request.json').read_text(encoding='utf-8'))
            except FileNotFoundError:
                raise HTTPException(409, '标题确认已失效，请重新载入') from None
            if any(previous.get(key) != value for key, value in
                   {'kind': kind, 'source_id': source_id, 'conversation_id': conversation, 'source_sha256': sha, 'action': 'prepare'}.items()):
                raise HTTPException(409, '文稿或对话已变化，请重新确认标题')
        config, core, python = configuration()
        id = uuid4().hex
        folder = directory() / id
        folder.mkdir()
        request = dict(name=name, kind=kind, source_id=source_id, source_sha256=sha,
                       conversation_id=conversation, core_version=config['core_version'],
                       profile_version=config['profile_version'], options=options, action=action)
        (folder / 'source').write_bytes(data)
        cover_data = report_path(source_id).read_bytes() if kind == 'risk-markdown' else data if Path(name).suffix.lower() == '.docx' else None
        if cover_data:
            from report_cover import eligible
            if eligible(cover_data):
                (folder / 'cover-source.docx').write_bytes(cover_data)
                request['preserve_cost_cover'] = True
        (folder / 'request.json').write_text(json.dumps(request, ensure_ascii=False), encoding='utf-8')
        run_worker(folder, config, core, python)
        # A report may be regenerated while the worker runs; never publish the old version.
        current, _ = source(kind, source_id, conversation)
        if hashlib.sha256(current.read_bytes()).hexdigest() != sha:
            raise HTTPException(409, '原文在转换期间已更新，请重新确认')
        return id, folder, request

    @router.post('/prepare')
    def prepare(payload: dict = Body(...)):
        id, folder, request = snapshot(payload, 'prepare')
        return {**json.loads((folder / 'prepared.json').read_text(encoding='utf-8')),
                'id': id, 'sha256': request['source_sha256'], 'name': request['name']}

    @router.post('/format')
    def convert(payload: dict = Body(...)):
        id, folder, request = snapshot(payload, 'format')
        checks = json.loads((folder / 'checks.json').read_text(encoding='utf-8'))
        if not (folder / 'formatted.docx').is_file() or any(c['status'] == 'fail' for c in checks['checks']):
            raise HTTPException(422, '文档保护检查未通过，未发布成果')
        sys.path.insert(0, str(ROOT / '03-Src/vendor/gongwen-core'))
        from artifact_names import document_export_stem
        result = {**request, 'id': id,
                  'name': document_export_stem(checks['manifest'].get('document_title'), request['name']) + '-【调整格式】.docx',
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

    @router.get('/{id}/checks')
    def checks(id: str, conversation_id: str):
        folder, _ = artifact(id, conversation_id)
        return json.loads((folder / 'checks.json').read_text(encoding='utf-8'))

    @router.get('/{id}/download')
    def download(id: str, conversation_id: str, kind: str = 'word'):
        folder, result = artifact(id, conversation_id)
        if kind == 'checks':
            return FileResponse(folder / 'checks.json', filename=Path(result['name']).stem + '-检查.json', media_type='application/json')
        if kind != 'word':
            raise HTTPException(400, '成果类型无效')
        return FileResponse(folder / 'formatted.docx', filename=result['name'], media_type=MIME)
    return router
