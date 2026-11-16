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
HEADING = re.compile(r'^## ([a-z][a-z0-9-]*) · ([^\n]+)\n', re.M)
_lock = RLock()


def parse(raw):
    if len(raw.encode('utf-8')) > 128 * 1024:
        raise ValueError('提词文档不能超过 128 KB')
    headings = list(HEADING.finditer(raw))
    entries = []
    for index, match in enumerate(headings):
        end = headings[index + 1].start() if index + 1 < len(headings) else len(raw)
        text = raw[match.end():end].strip()
        if not text or len(text) > 4000 or '\n## ' in '\n' + text:
            raise ValueError('每段须有正文，最多 4000 字；请保留段落标题格式')
        entries.append({'id': match[1], 'title': match[2], 'text': text})
    if not entries or len(entries) > 100 or len({e['id'] for e in entries}) != len(entries):
        raise ValueError('提词标题缺失、重复或过多')
    return entries


def snapshot():
    try:
        raw = (DOCUMENT if DOCUMENT.exists() else TEMPLATE).read_text(encoding='utf-8-sig')
        return raw, {'revision': hashlib.sha256(raw.encode('utf-8')).hexdigest(),
                     'path': str(DOCUMENT), 'entries': parse(raw)}
    except (OSError, UnicodeError, ValueError) as error:
        raise HTTPException(503, f'提词读取失败：{error}') from None


@router.get('')
def read():
    return snapshot()[1]


@router.put('')
def save(payload: dict = Body(...)):
    with _lock:
        raw, current = snapshot()
        if payload.get('revision') != current['revision']:
            raise HTTPException(409, '提词文档已更新，请重新读取后保存')
        text = payload.get('text')
        if set(payload) != {'revision', 'id', 'text'} or not isinstance(text, str) or not text.strip() or len(text) > 4000 or re.search(r'^## ', text, re.M):
            raise HTTPException(400, '正文须为 1–4000 字，不能包含段落标题')
        headings = list(HEADING.finditer(raw))
        index = next((i for i, m in enumerate(headings) if m[1] == payload.get('id')), None)
        if index is None:
            raise HTTPException(400, '未找到指定提词段落')
        end = headings[index + 1].start() if index + 1 < len(headings) else len(raw)
        updated = raw[:headings[index].end()] + '\n' + text.strip() + '\n\n' + raw[end:]
        parse(updated)
        temporary = None
        try:
            DOCUMENT.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=DOCUMENT.parent, delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(updated)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, DOCUMENT)
        except OSError:
            raise HTTPException(503, '提词未保存，请检查文档权限') from None
        finally:
            if temporary and temporary.exists():
                temporary.unlink()
        return snapshot()[1]
