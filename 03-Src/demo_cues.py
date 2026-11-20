"""Editable presentation script, isolated from business actions and device delivery."""
import hashlib
import os
import re
import tempfile
from pathlib import Path
from threading import RLock

from fastapi import APIRouter, Body, HTTPException

router = APIRouter(prefix='/api/astra/demo-cues')
ROOT = Path(__file__).resolve().parents[1]
DOCUMENT = ROOT / 'config' / 'astra-demo-cues.md'
TEMPLATE = ROOT / '03-Src' / 'reference-assets' / 'demo-cues.md'
HEADING = re.compile(r'^(?:\ufeff)?##[ \t]+([^\r\n]+)(?:\r?\n|$)', re.M)
NAMED_HEADING = re.compile(r'([a-z][a-z0-9-]*)[ \t]+·[ \t]+(.+)')
_lock = RLock()


def sections(raw):
    """Keep named route IDs; ordinary Markdown titles get stable internal IDs."""
    result, occurrences = [], {}
    for match in HEADING.finditer(raw):
        title = match[1].strip()
        named = NAMED_HEADING.fullmatch(title)
        if named:
            identifier, title = named.groups()
        else:
            base = 'section-' + hashlib.sha256(title.encode('utf-8')).hexdigest()[:16]
            occurrences[base] = occurrences.get(base, 0) + 1
            identifier = base + (f'-{occurrences[base]}' if occurrences[base] > 1 else '')
        result.append((match, identifier, title))
    return result


def parse(raw):
    if len(raw.encode('utf-8')) > 128 * 1024:
        raise ValueError('提词文档不能超过 128 KB')
    headings = sections(raw)
    entries = []
    for index, (match, identifier, title) in enumerate(headings):
        end = headings[index + 1][0].start() if index + 1 < len(headings) else len(raw)
        text = raw[match.end():end].strip().replace('\r\n', '\n')
        if not text or len(text) > 4000 or '\n## ' in '\n' + text:
            raise ValueError('每段须有正文，最多 4000 字；请保留段落标题格式')
        entries.append({'id': identifier, 'title': title, 'text': text})
    if not entries or len(entries) > 100 or len({e['id'] for e in entries}) != len(entries):
        raise ValueError('提词标题缺失、重复或过多')
    return entries


def read_raw(path):
    # Preserve BOM and line endings; reading/previewing never rewrites the manuscript.
    with path.open(encoding='utf-8', newline='') as stream:
        return stream.read()


def document_data(raw):
    return {'revision': hashlib.sha256(raw.encode('utf-8')).hexdigest(),
            'path': str(DOCUMENT), 'entries': parse(raw)}


def last_valid_path():
    return DOCUMENT.with_suffix('.last-valid.md')


def snapshot():
    try:
        source = DOCUMENT if DOCUMENT.exists() or last_valid_path().exists() else TEMPLATE
        raw = read_raw(source)
        return raw, document_data(raw), source == DOCUMENT
    except (OSError, UnicodeError, ValueError) as error:
        raise HTTPException(503, f'提词读取失败：{error}') from None


def write_raw(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='wb', dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass


def remember_valid(raw):
    cache = last_valid_path()
    content = raw.encode('utf-8')
    try:
        if not cache.exists() or cache.read_bytes() != content:
            write_raw(cache, content)
    except OSError:
        pass  # A cache failure must not suppress a valid document.


@router.get('')
def read():
    # Shared last-good copy works for a fresh browser and across host restarts.
    # It is separate from the editable manuscript and is never used for PUT.
    with _lock:
        try:
            raw, data, from_document = snapshot()
        except HTTPException as error:
            try:
                data = document_data(read_raw(last_valid_path()))
            except (OSError, UnicodeError, ValueError):
                raise error from None
            return {**data, 'stale': True, 'warning': f'{error.detail}；暂时显示上次可用提词'}
        if from_document:
            remember_valid(raw)
        return data


@router.put('')
def save(payload: dict = Body(...)):
    with _lock:
        raw, current, _ = snapshot()
        if payload.get('revision') != current['revision']:
            raise HTTPException(409, '提词文档已更新，请重新读取后保存')
        text = payload.get('text')
        if (set(payload) != {'revision', 'id', 'text'} or not isinstance(text, str)
                or not text.strip() or len(text) > 4000 or HEADING.search(text.strip())):
            raise HTTPException(400, '正文须为 1–4000 字，不能包含段落标题')
        headings = sections(raw)
        index = next((i for i, (_, identifier, _) in enumerate(headings) if identifier == payload.get('id')), None)
        if index is None:
            raise HTTPException(400, '未找到指定提词段落')
        heading = headings[index][0]
        end = headings[index + 1][0].start() if index + 1 < len(headings) else len(raw)
        newline = '\r\n' if heading[0].endswith('\r\n') else '\n'
        updated = raw[:heading.end()] + newline + text.strip().replace('\r\n', '\n').replace('\n', newline) + newline * 2 + raw[end:]
        try:
            data = document_data(updated)
        except ValueError as error:
            raise HTTPException(400, str(error)) from None
        try:
            write_raw(DOCUMENT, updated.encode('utf-8'))
        except OSError:
            raise HTTPException(503, '提词未保存，请检查文档权限') from None
        remember_valid(updated)
        return data
