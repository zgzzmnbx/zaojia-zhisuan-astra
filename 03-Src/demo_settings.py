"""Workspace-wide switches for existing demonstration presets, never for writes."""
import json
from functools import wraps
from threading import RLock

from fastapi import APIRouter, Body, HTTPException

router = APIRouter(prefix='/api/astra/demo-settings')
DEFAULT = {'revision': 0, 'enabled': True, 'rowPreset': True, 'reportPreset': True, 'knowledgePreset': True}
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
        if any(type(value.get(key)) is not bool for key in DEFAULT if key != 'revision'):
            raise ValueError('invalid switch')
        return {key: value[key] for key in DEFAULT}
    except FileNotFoundError:
        return dict(DEFAULT)
    except (OSError, ValueError):
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
        if set(payload) != set(DEFAULT) or any(type(payload.get(key)) is not bool for key in DEFAULT if key != 'revision'):
            raise HTTPException(400, '演示设置必须包含有效的布尔开关')
        value = {**payload, 'revision': current['revision'] + 1}
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
