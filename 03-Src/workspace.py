"""Local conversation/project storage. No engine assets or source inputs are mutated."""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Body, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

ID = re.compile(r'^[a-f0-9]{32}$')
FILE_TYPES = {'.xlsx', '.docx', '.pdf', '.txt', '.md', '.csv'}

class ClosingConnection(sqlite3.Connection):
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()


def now():
    return datetime.now(timezone.utc).isoformat()


def identifier(value):
    if not ID.fullmatch(str(value or '')):
        raise HTTPException(400, '记录编号无效')
    return value


def text(value, limit, default=''):
    if not isinstance(value, str):
        raise HTTPException(400, '文字字段格式无效')
    value = value.strip()
    if len(value) > limit:
        raise HTTPException(400, f'文字不能超过 {limit} 字')
    return value or default


class Workspace:
    def __init__(self, root):
        self.root = root

    def connect(self):
        self.root.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(self.root / 'workspace.sqlite3', timeout=10, factory=ClosingConnection)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        db.executescript('''
          CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, background TEXT NOT NULL,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, project_id TEXT REFERENCES projects(id),
            state TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0,
            write_token TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, size INTEGER NOT NULL, sha256 TEXT NOT NULL,
            project_id TEXT REFERENCES projects(id), conversation_id TEXT REFERENCES conversations(id),
            public INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS conversation_jobs (
            job_id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id));
          CREATE TABLE IF NOT EXISTS review_drafts (
            id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id),
            job_id TEXT NOT NULL, platform TEXT NOT NULL, recipients TEXT NOT NULL,
            instructions TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL);
        ''')
        return db

    def require(self, db, table, id):
        # table is selected by application code only.
        row = db.execute(f'SELECT * FROM {table} WHERE id=?', (identifier(id),)).fetchone()
        if not row:
            raise HTTPException(404, '记录不存在')
        return dict(row)

    def summary(self, row):
        state = json.loads(row['state'])
        return {k: row[k] for k in ('id', 'title', 'project_id', 'revision', 'updated_at')} | {
            'preview': next((str(m.get('text', ''))[:100] for m in reversed(state.get('messages', [])) if m.get('role') == 'user'), ''),
            'job_id': state.get('job_id')}

    def accessible(self, asset, conversation):
        return bool(asset['public'] or asset['conversation_id'] == conversation['id'] or
                    (asset['project_id'] and asset['project_id'] == conversation['project_id']))


def workspace_router(root_getter, checked_job):
    router = APIRouter(prefix='/api/astra/workspace')

    def store():
        return Workspace(root_getter() / 'astra-workspace')

    @router.get('')
    def index():
        with store().connect() as db:
            projects = [dict(r) for r in db.execute('SELECT * FROM projects ORDER BY updated_at DESC')]
            conversations = [store().summary(r) for r in db.execute('SELECT * FROM conversations ORDER BY updated_at DESC')]
            jobs = {r['job_id']: r['conversation_id'] for r in db.execute('SELECT * FROM conversation_jobs')}
        return {'projects': projects, 'conversations': conversations, 'jobs': jobs}

    @router.post('/projects')
    def create_project(payload: dict = Body(...)):
        id, date = uuid4().hex, now()
        name = text(payload.get('name', ''), 80)
        if not name:
            raise HTTPException(400, '请填写项目名称')
        with store().connect() as db:
            db.execute('INSERT INTO projects VALUES (?,?,?,?,?)', (id, name, text(payload.get('background', ''), 10000), date, date))
            return store().require(db, 'projects', id)

    @router.put('/projects/{id}')
    def update_project(id: str, payload: dict = Body(...)):
        with store().connect() as db:
            old = store().require(db, 'projects', id)
            name = text(payload.get('name', old['name']), 80, old['name'])
            db.execute('UPDATE projects SET name=?, background=?, updated_at=? WHERE id=?',
                       (name, text(payload.get('background', old['background']), 10000), now(), id))
            return store().require(db, 'projects', id)

    @router.post('/conversations')
    def create_conversation(payload: dict = Body(...)):
        id, date = uuid4().hex, now()
        project = payload.get('project_id') or None
        with store().connect() as db:
            if project:
                store().require(db, 'projects', project)
            db.execute('INSERT INTO conversations(id,title,project_id,created_at,updated_at) VALUES (?,?,?,?,?)',
                       (id, text(payload.get('title', ''), 120, '新对话'), project, date, date))
            return store().require(db, 'conversations', id) | {'state': {}}

    @router.get('/conversations/search')
    def search(q: str = '', project_id: str = ''):
        query = q.strip().casefold()
        with store().connect() as db:
            rows = db.execute('SELECT * FROM conversations ORDER BY updated_at DESC').fetchall()
        items = []
        for row in rows:
            if project_id and row['project_id'] != project_id:
                continue
            messages = json.loads(row['state']).get('messages', [])
            if query and query not in (row['title'] + '\n' + '\n'.join(str(m.get('text', '')) for m in messages)).casefold():
                continue
            items.append(store().summary(row))
        return {'items': items}

    @router.get('/conversations/{id}')
    def read_conversation(id: str):
        with store().connect() as db:
            row = store().require(db, 'conversations', id)
        row['state'] = json.loads(row['state'])
        return row

    @router.put('/conversations/{id}')
    def save_conversation(id: str, payload: dict = Body(...)):
        state = payload.get('state')
        if not isinstance(state, dict) or len(json.dumps(state, ensure_ascii=False)) > 2_000_000:
            raise HTTPException(400, '会话内容无效或过大')
        messages = state.get('messages', [])
        if not isinstance(messages, list) or len(messages) > 2000 or any(not isinstance(m, dict) or m.get('role') not in ('user', 'assistant') or not isinstance(m.get('text'), str) for m in messages):
            raise HTTPException(400, '消息格式无效')
        token = text(payload.get('write_token', ''), 100)
        if not token:
            raise HTTPException(400, '缺少保存标识')
        with store().connect() as db:
            db.execute('BEGIN IMMEDIATE')
            old = store().require(db, 'conversations', id)
            if token == old['write_token']:
                return {'revision': old['revision'], 'updated_at': old['updated_at']}
            if payload.get('revision') != old['revision']:
                raise HTTPException(409, '另一窗口已更新这段对话。未覆盖任何内容，请保留当前草稿后重新打开。')
            file_id = state.get('inputFileId')
            if file_id and not store().accessible(store().require(db, 'assets', file_id), old):
                raise HTTPException(403, '该资料不属于当前对话或项目')
            job = state.get('job_id')
            if job:
                checked_job(job)
                owner = db.execute('SELECT conversation_id FROM conversation_jobs WHERE job_id=?', (job,)).fetchone()
                if owner and owner[0] != id:
                    raise HTTPException(409, '该成果已属于另一段对话，请打开所属对话')
                db.execute('INSERT OR IGNORE INTO conversation_jobs VALUES (?,?)', (job, id))
            title = text(payload.get('title', old['title']), 120, '新对话')
            date = now()
            db.execute('UPDATE conversations SET title=?,state=?,revision=revision+1,write_token=?,updated_at=? WHERE id=?',
                       (title, json.dumps(state, ensure_ascii=False), token, date, id))
            return {'revision': old['revision'] + 1, 'updated_at': date}

    @router.post('/conversations/{id}/project')
    def assign_project(id: str, payload: dict = Body(...)):
        with store().connect() as db:
            db.execute('BEGIN IMMEDIATE')
            conv = store().require(db, 'conversations', id)
            project = store().require(db, 'projects', payload.get('project_id'))
            if conv['project_id'] == project['id']:
                return {'project_id': project['id']}
            if conv['project_id']:
                raise HTTPException(409, '已有项目的对话保持原归属，请在目标项目新建对话')
            # Standalone attachments become shared, with immutable content and IDs intact.
            db.execute('UPDATE conversations SET project_id=?,revision=revision+1,updated_at=? WHERE id=?', (project['id'], now(), id))
            db.execute('UPDATE assets SET project_id=? WHERE conversation_id=? AND public=0', (project['id'], id))
            return {'project_id': project['id']}

    @router.get('/assets')
    def list_assets(scope: str = 'public', project_id: str = '', conversation_id: str = ''):
        with store().connect() as db:
            if scope == 'public':
                rows = db.execute('SELECT * FROM assets WHERE public=1 ORDER BY created_at DESC').fetchall()
            elif scope == 'project':
                store().require(db, 'projects', project_id)
                rows = db.execute('SELECT * FROM assets WHERE project_id=? ORDER BY created_at DESC', (project_id,)).fetchall()
            elif scope == 'conversation':
                conv = store().require(db, 'conversations', conversation_id)
                rows = [r for r in db.execute('SELECT * FROM assets ORDER BY created_at DESC') if store().accessible(r, conv)]
            else:
                raise HTTPException(400, '资料范围无效')
        return {'items': [dict(r) for r in rows]}

    @router.post('/assets')
    async def upload_asset(file: UploadFile = File(...), scope: str = Form('conversation'), project_id: str = Form(''), conversation_id: str = Form('')):
        name = file.filename or ''
        if len(name) > 240 or any(c in name for c in '/\\:') or name.startswith('.') or Path(name).suffix.lower() not in FILE_TYPES:
            raise HTTPException(400, '请选择 XLSX、DOCX、PDF、TXT、MD 或 CSV 文件，文件名不能包含路径')
        data = await file.read()
        if not data or len(data) > 29 * 1024 * 1024:
            raise HTTPException(400, '资料为空或超过 29 MB 上限')
        with store().connect() as db:
            owner, project, public = None, None, 0
            if scope == 'conversation':
                conv = store().require(db, 'conversations', conversation_id)
                owner, project = conv['id'], conv['project_id']
            elif scope == 'project':
                project = store().require(db, 'projects', project_id)['id']
            elif scope == 'public':
                public = 1
            else:
                raise HTTPException(400, '资料范围无效')
            id = uuid4().hex
            directory = store().root / 'files'; directory.mkdir(exist_ok=True)
            target = directory / id
            try:
                target.write_bytes(data)
                db.execute('INSERT INTO assets VALUES (?,?,?,?,?,?,?,?)', (id, name, len(data), hashlib.sha256(data).hexdigest(), project, owner, public, now()))
                db.commit()
            except Exception:
                target.unlink(missing_ok=True)
                raise
            return store().require(db, 'assets', id)

    @router.get('/assets/{id}')
    def download_asset(id: str, conversation_id: str = ''):
        with store().connect() as db:
            asset = store().require(db, 'assets', id)
            if conversation_id:
                conv = store().require(db, 'conversations', conversation_id)
                if not store().accessible(asset, conv):
                    raise HTTPException(403, '不能在当前对话使用其他项目的资料')
        path = store().root / 'files' / asset['id']
        if not path.is_file():
            raise HTTPException(404, '资料文件缺失，未改变已有成果')
        return FileResponse(path, filename=asset['name'], media_type='application/octet-stream')

    @router.get('/reviews')
    def reviews(conversation_id: str):
        with store().connect() as db:
            store().require(db, 'conversations', conversation_id)
            rows = db.execute('SELECT * FROM review_drafts WHERE conversation_id=? ORDER BY created_at DESC', (conversation_id,)).fetchall()
        return {'items': [dict(r) for r in rows]}

    @router.post('/reviews')
    def prepare_review(payload: dict = Body(...)):
        job = payload.get('job_id'); checked_job(job)
        platform = payload.get('platform')
        if platform not in ('feishu', 'weact'):
            raise HTTPException(400, '请选择飞书或 WeAct')
        recipients = text(payload.get('recipients', ''), 1000)
        instructions = text(payload.get('instructions', ''), 10000)
        if not recipients or not instructions:
            raise HTTPException(400, '请填写待核验的接收人及复核要求')
        with store().connect() as db:
            conv = store().require(db, 'conversations', payload.get('conversation_id'))
            owner = db.execute('SELECT conversation_id FROM conversation_jobs WHERE job_id=?', (job,)).fetchone()
            if not owner or owner[0] != conv['id']:
                raise HTTPException(409, '请先保存当前对话与成果关联')
            id = uuid4().hex
            db.execute('INSERT INTO review_drafts VALUES (?,?,?,?,?,?,?,?)',
                       (id, conv['id'], job, platform, recipients, instructions, 'draft', now()))
            return store().require(db, 'review_drafts', id)

    return router
