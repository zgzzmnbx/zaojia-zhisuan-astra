"""Independent, versioned Astra preferences for Gork stage output."""
from __future__ import annotations
import json
from pathlib import Path
import re
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'config/astra-gork-notifications.local.json'
router = APIRouter(prefix='/api/astra/gork/notifications')
bridge = None
DEFINITIONS = [
    ('conversion_start', '资料转换', 'working', 'state', '资料转换已开始。', 10000),
    ('match_start', '规则匹配', 'working', 'state', '规则匹配已开始。', 10000),
    ('match_completed', '匹配完成', 'happy', 'notice', '匹配完成，{amount}{review}', 2000),
    ('match_failed', '匹配失败', 'confused', 'notice', '匹配未完成，请查看错误。', 5000),
    ('warning_start', '风险检查', 'working', 'state', '风险检查已开始。', 10000),
    ('warning_completed', '检查完成', 'happy', 'notice', '风险检查完成，{warnings}', 2000),
    ('warning_found', '发现风险', 'confused', 'notice', '风险检查完成，{warnings}', 10000),
    ('warning_failed', '检查失败', 'confused', 'notice', '风险检查未完成，请查看错误。', 5000),
    ('report_start', '报告生成', 'thinking', 'state', '风险报告生成已开始。', 10000),
    ('report_generated', '报告完成', 'happy', 'notice', '最终风险报告已生成。', 2000),
    ('report_failed', '报告失败', 'confused', 'notice', '风险报告未生成，请查看错误。', 5000),
    ('review_requested', '复核发起', 'curious', 'notice', '同事复核已发起，等待投递确认。', 2000),
    ('review_sent', '复核送达', 'happy', 'notice', '复核资料已送达，等待同事反馈。', 2000),
]
TOKENS = {'amount', 'review', 'warnings', 'task'}


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class Stage(Strict):
    enabled: bool = True
    expression: str = Field(pattern=r'^[a-z0-9-]{2,60}$')
    expression_mode: Literal['once', 'loop'] = 'once'
    kind: Literal['state', 'notice'] = 'notice'
    text: str = Field(max_length=300)
    duration_ms: int = Field(ge=500, le=60000)
    speech: bool = True
    speech_text: str = Field(default='', max_length=300)
    display_target: Literal['inherit', 'desktop', 'watch', 'both', 'none'] = 'inherit'
    speech_target: Literal['inherit', 'current', 'pc', 'watch'] = 'inherit'
    ttl_ms: int = Field(default=30000, ge=1000, le=90000)
    priority: int = Field(default=2, ge=0, le=5)
    @model_validator(mode='after')
    def placeholders(self):
        for template in [self.text, self.speech_text]:
            for token in re.findall(r'\{([^{}]*)\}', template):
                if token not in TOKENS:
                    raise ValueError('仅支持 amount、review、warnings、task 变量')
            if any(c in re.sub(r'\{(?:amount|review|warnings|task)\}', '', template) for c in '{}'):
                raise ValueError('模板变量格式无效')
        return self


def default_stages():
    return {key: Stage(expression=expression, kind=kind, expression_mode='loop' if kind == 'state' else 'once',
                       text=text, duration_ms=duration, ttl_ms=90000 if kind == 'notice' and key not in {'review_requested', 'review_sent'} else 30000).model_dump()
            for key, _, expression, kind, text, duration in DEFINITIONS}


class Settings(Strict):
    revision: int = Field(default=0, ge=0)
    enabled: bool = False
    token_file: str = Field(default='config/astra-gork-token.local.json', max_length=512)
    display_target: Literal['desktop', 'watch', 'both', 'none'] = 'both'
    sound: bool = False
    speech_target: Literal['current', 'pc', 'watch'] = 'current'
    speech_mode: Literal['auto', 'cached', 'tts'] = 'auto'
    heartbeat_ms: int = Field(default=10000, ge=1000, le=30000)
    lease_ms: int = Field(default=30000, ge=3000, le=90000)
    stages: dict[str, Stage] = Field(default_factory=lambda: {k: Stage(**v) for k, v in default_stages().items()})
    @model_validator(mode='after')
    def validate_scope(self):
        if set(self.stages) != {x[0] for x in DEFINITIONS}:
            raise ValueError('阶段配置必须完整且不能包含未知阶段')
        if self.heartbeat_ms * 2 >= self.lease_ms:
            raise ValueError('失联复位时长必须大于两次报活间隔')
        if any(c in self.token_file for c in '\r\n\0'):
            raise ValueError('凭据文件路径无效')
        return self


def load():
    if not CONFIG.exists():
        return Settings()
    try:
        if CONFIG.stat().st_size > 100_000:
            raise ValueError('oversized')
        return Settings.model_validate(json.loads(CONFIG.read_text(encoding='utf-8')))
    except (OSError, ValueError):
        raise HTTPException(503, '阶段通知设置无法读取，请保留原文件并核对')


def write(settings):
    CONFIG.parent.mkdir(parents=True, exist_ok=True)
    temporary = CONFIG.with_suffix('.tmp')
    temporary.write_text(json.dumps(settings.model_dump(), ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(CONFIG)


def token(settings):
    path = Path(settings.token_file)
    path = path if path.is_absolute() else ROOT / path
    try:
        if path.stat().st_size > 4096:
            raise ValueError()
        data = json.loads(path.read_text(encoding='utf-8'))
        value = data.get('token')
        if (data.get('source') != 'astra' or data.get('protocol_version') != '1.0'
                or not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{32,150}', value)):
            raise ValueError()
        return value
    except (OSError, ValueError, AttributeError):
        raise HTTPException(409, '请先在 Gork 控制台登记 Astra，并保存独立凭据文件')


def stage_key(event):
    stage = event.get('stage')
    if stage == 'match_result':
        return 'match_failed' if event.get('status') == 'failed' else 'match_completed' if event.get('status') == 'completed' else None
    if stage == 'warning_result':
        if event.get('status') == 'failed':
            return 'warning_failed'
        if event.get('status') != 'completed':
            return None
        warnings = event.get('warning_rows')
        return 'warning_found' if type(warnings) is int and warnings > 0 else 'warning_completed'
    expected = {'conversion_start': 'running', 'match_start': 'running', 'warning_start': 'running',
                'report_start': 'running', 'report_generated': 'completed', 'report_failed': 'failed',
                'review_requested': 'completed', 'review_sent': 'sent'}
    return stage if stage in expected and event.get('status') == expected[stage] else None


def render_text(event, stage):
    from gork_stages import amount_text
    reviews, warnings = event.get('review_rows'), event.get('warning_rows')
    reviews = reviews if type(reviews) is int and reviews >= 0 else None
    warnings = warnings if type(warnings) is int and warnings >= 0 else None
    values = {'amount': amount_text(event) or '请查看结果。',
              'review': f'{reviews}项待复核。' if reviews else '',
              'warnings': '请查看结果。' if warnings is None else f'{warnings}项需复核。' if warnings else '未发现经验偏离。',
              'task': str(event.get('task_name') or '当前任务')[:80]}
    text = re.sub(r'\{(amount|review|warnings|task)\}', lambda m: values[m[1]], stage.text)
    # Keep the complete tax basis / caveat even after a long user-authored template.
    amount = amount_text(event)
    if amount and amount not in text[:300]:
        plain = re.sub(r'\{(amount|review|warnings|task)\}', lambda m: '' if m[1] == 'amount' else values[m[1]], stage.text)
        return plain[:299 - len(amount)].rstrip() + ' ' + amount
    return text[:300]


@router.get('')
async def get_settings():
    settings = load()
    status = await bridge.status(settings) if bridge else {'state': 'disabled', 'message': '阶段通知尚未启用'}
    from gork_link import console_status
    status['legacy'] = await console_status()
    return {'settings': settings.model_dump(), 'defaults': default_stages(),
            'stages': [{'id': x[0], 'label': x[1]} for x in DEFINITIONS],
            'status': status}


@router.put('')
async def save_settings(settings: Settings):
    if bridge:
        await bridge.configure(settings)
    else:
        if settings.revision != load().revision:
            raise HTTPException(409, '设置已在其他窗口修改，请重新载入后保存')
        if settings.enabled:
            raise HTTPException(409, 'Gork 通用接口尚未接入，阶段通知未启用')
        settings.revision += 1
        write(settings)
    return await get_settings()


class Cancel(Strict):
    task_id: str = Field(pattern=r'^(?:debug-)?[a-f0-9]{32}$')
    attempt: str = Field(pattern=r'^[A-Za-z0-9_.:-]{1,100}$')


@router.post('/cancel')
async def cancel_notification(payload: Cancel):
    if not bridge:
        raise HTTPException(409, '阶段通知尚未接入')
    import asyncio
    await asyncio.to_thread(bridge.cancel, payload.task_id, payload.attempt)
    return {'status': 'cancelled', 'source': 'astra', 'task_id': payload.task_id, 'attempt': payload.attempt}


class DebugSend(Strict):
    stage: str
    include_amount: bool = False
    amount: str = Field(default='9447173.00', max_length=24)
    @model_validator(mode='after')
    def known_stage(self):
        if self.stage not in default_stages():
            raise ValueError('未知调试阶段')
        return self


async def debug_call(method, *args):
    if not bridge:
        raise HTTPException(409, '阶段通知尚未接入')
    import asyncio
    try:
        return await asyncio.to_thread(getattr(bridge, method), *args)
    except HTTPException:
        raise
    except Exception as exc:
        from gork_notifications import error_code
        raise HTTPException(409, '调试通知未确认：' + error_code(exc)) from None


@router.post('/debug/send')
async def debug_send(payload: DebugSend):
    return await debug_call('debug_send', payload.stage, payload.include_amount, payload.amount)


@router.get('/debug/{event_id}')
async def debug_receipt(event_id: str):
    return await debug_call('debug_receipt', event_id)


@router.post('/debug/cancel')
async def debug_cancel():
    return await debug_call('debug_cancel')


@router.post('/debug/{event_id}/heartbeat')
async def debug_heartbeat(event_id: str):
    return await debug_call('debug_heartbeat', event_id)
