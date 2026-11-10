"""Workspace-wide switches for demonstration presets; writes remain behind the original explicit actions."""
import json
from functools import wraps
from threading import RLock

from fastapi import APIRouter, Body, HTTPException

router = APIRouter(prefix='/api/astra/demo-settings')
DEFAULT = {'revision': 0, 'enabled': True, 'rowPreset': True, 'matchPreset': True, 'reportPreset': True, 'knowledgePreset': True,
           'parkedProject': True, 'parkedName': '德化-永安支线', 'parkedStation': 'report'}
LEGACY = {'revision', 'enabled', 'rowPreset', 'reportPreset', 'knowledgePreset'}
STATIONS = {'import', 'price', 'risk', 'report', 'review', 'table', 'knowledge'}

def validate(value):
    if any(type(value.get(key)) is not bool for key in ['enabled', 'rowPreset', 'reportPreset', 'knowledgePreset', 'parkedProject', 'matchPreset']):
        raise ValueError('invalid switch')
    name = value.get('parkedName')
    if not isinstance(name, str) or not name.strip() or len(name) > 12 or any(ord(c) < 32 for c in name):
        raise ValueError('项目简称须为 1–12 个字符')
    if value.get('parkedStation') not in STATIONS:
        raise ValueError('无效的停靠站点')
    return {**value, 'parkedName': name.strip()}
_lock = RLock()


def filename():
    from app import paths
    return paths.RUNTIME_DIR / 'astra-working-assets' / 'demo-settings.json'


@router.get('')
def read():
    try:
        value = json.loads(filename().read_text(encoding='utf-8'))
        if not isinstance(value, dict) or type(value.get('revision')) is not int or value['revision'] < 0:
            raise ValueError('invalid revision')
        if not LEGACY <= set(value):
            raise ValueError('missing switches')
        return validate({key: value.get(key, default) for key, default in DEFAULT.items()})
    except FileNotFoundError:
        return dict(DEFAULT)
    except (OSError, ValueError, TypeError):
        raise HTTPException(503, '演示设置读取失败，预设已停用；请检查配置文件后重新读取') from None


def enabled(option):
    try:
        value = read()
        return value['enabled'] and value[option]
    except HTTPException:
        return False


@router.put('')
def save(payload: dict = Body(...)):
    with _lock:
        current = read()
        if type(payload.get('revision')) is not int or payload['revision'] != current['revision']:
            raise HTTPException(409, '演示设置已被其他窗口修改，请重新读取后保存')
        if not LEGACY <= set(payload) or not set(payload) <= set(DEFAULT):
            raise HTTPException(400, '演示设置字段不完整或无效')
        try:
            value = validate({**current, **payload, 'revision': current['revision'] + 1})
        except (ValueError, TypeError) as error:
            raise HTTPException(400, str(error)) from None
        from app import main as engine
        try:
            filename().parent.mkdir(parents=True, exist_ok=True)
            engine.atomic_json(filename(), value)
        except OSError:
            raise HTTPException(503, '演示设置未保存，请检查目录权限后重试') from None
        return value


def install(engine):
    """Gate all host/legacy entry points while preserving the frozen preset rules."""
    for name, option, fallback in [('get_row_demo_answer', 'rowPreset', None),
                                   ('get_demo_answer', 'knowledgePreset', None),
                                   ('_is_demo_report_task', 'reportPreset', False)]:
        original = getattr(engine, name)
        if getattr(original, '_astra_demo_gate', False):
            continue

        def gate(original=original, option=option, fallback=fallback):
            @wraps(original)
            def wrapped(*args, **kwargs):
                return original(*args, **kwargs) if enabled(option) else fallback
            wrapped._astra_demo_gate = True
            return wrapped

        setattr(engine, name, gate())
