"""Explicit, version-bound replay of a completed result through the Gork outbox."""
import asyncio
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import Field
import gork_config as config
from gork_project import _read, freeze_project
from gork_stages import amount_text


class ReplayRequest(config.Strict):
    artifact_version: int = Field(ge=1)
    request_id: str = Field(pattern=r'^[a-f0-9]{32}$')


def completed_event(runtime, job_id, version, now):
    if not re.fullmatch(r'[a-f0-9]{32}', job_id):
        raise HTTPException(400, '任务编号无效')
    job = (Path(runtime) / job_id).resolve()
    if not job.is_relative_to(Path(runtime).resolve()) or not (job / 'process-state.json').is_file():
        raise HTTPException(404, '未找到当前项目成果')
    try:
        state = _read(job / 'process-state.json')
        if state.get('summary', {}).get('matching_status') != 'completed':
            raise HTTPException(409, '请先完成智能填价')
        if state.get('artifact_version') != version:
            raise HTTPException(409, '成果版本已更新，请重新打开当前项目后播报')
        edit = job / 'astra-edit-state.json'
        if state.get('needs_recalculate') or (edit.exists() and _read(edit).get('needs_recalculate') is not False):
            raise HTTPException(409, '金额待重算，请重算后再播报')
        event = freeze_project(dict(job_id=job_id, event_id=uuid4().hex, attempt=state.get('batch_attempt'),
            stage='match_result', status='completed', review_rows=state['summary'].get('review_rows'),
            occurred_at=datetime.fromtimestamp(now, timezone.utc).isoformat()), job)
        snapshot = event.get('_project_snapshot', {})
        amount = snapshot.get('amount_summary')
        if not amount_text({**event, 'amount_summary': amount}):
            raise HTTPException(409, '当前成果金额或文件校验未通过，请先重算并刷新成果')
        # Confirmation can only come from a matching committed amount snapshot.
        for path in sorted((job / 'sentinel-events').glob('*.json'), reverse=True)[:100]:
            try:
                old = _read(path)
            except (OSError, ValueError):
                continue
            source = old.get('_project_snapshot') or {}
            if (old.get('stage') == 'match_result' and old.get('status') == 'completed'
                    and old.get('attempt') == state.get('batch_attempt') and amount_text(old)
                    and all(source.get(k) == snapshot.get(k) for k in
                            ('job_id', 'source_batch', 'manual_edit_revision'))
                    and all(old['amount_summary'].get(k) == amount.get(k) for k in ('value', 'currency', 'unit', 'basis'))):
                amount['calculation_status'] = old['amount_summary']['calculation_status']
                break
        event['amount_summary'] = amount
        event['task_name'] = snapshot['card']['project_name']
        # A replay has its own attempt; it cannot cancel or complete a business run.
        event['attempt'] = 'replay:' + uuid4().hex
        amount['attempt'] = event['attempt']
        snapshot.update(event_id=event['event_id'], attempt=event['attempt'])
        return event
    except (OSError, ValueError, TypeError, KeyError):
        raise HTTPException(409, '当前成果暂不可用，请刷新后重试') from None


def receipt(instance, job_id, event_id):
    with instance.lock:
        row = instance.db().execute('SELECT * FROM events WHERE id=? AND manual=1', (event_id,)).fetchone()
        if not row or json.loads(row['payload'])['task_id'] != job_id:
            raise HTTPException(404, '未找到本次播报回执')
        return dict(event_id=row['id'], status=row['status'],
                    delivery=json.loads(row['receipt']).get('delivery', {}), error=row['error'])


def replay(instance, runtime, job_id, request):
    from gork_notifications import read_console_health, error_code
    with instance.lock:
        if instance.active:
            raise HTTPException(409, '当前任务正在处理，请完成后再播报')
        event = completed_event(runtime, job_id, request.artifact_version, instance.clock())
        producer = 'manual-match:' + hashlib.sha256(f'{job_id}:{request.artifact_version}:{request.request_id}'.encode()).hexdigest()
        previous = instance.db().execute('SELECT id FROM events WHERE producer=?', (producer,)).fetchone()
        if previous:
            return receipt(instance, job_id, previous['id'])
        pending = instance.db().execute("SELECT id FROM events WHERE manual=1 AND json_extract(payload,'$.task_id')=? AND status IN ('pending','queued','dispatching','active','partial') AND deadline>?", (job_id, instance.clock())).fetchone()
        if pending:
            return receipt(instance, job_id, pending['id'])
        try:
            health = read_console_health()
            if health.get('app') != 'stopwatch-voice-companion' or not health.get('instance'):
                raise HTTPException(409, 'Gork 控制台身份校验失败')
            if (health.get('robot') or {}).get('connected') is not True:
                raise HTTPException(409, 'Watch 未连接，请连接后再次播报')
            settings = config.load().model_copy(deep=True)
            for key, stage in settings.stages.items():
                stage.enabled = key == 'match_completed'
            stage = settings.stages['match_completed']
            stage.kind, stage.display_target, stage.speech_target, stage.speech = 'notice', 'watch', 'watch', True
            settings.sound = True
            client = instance.client_factory(settings)
            instance.validate_remote(client, settings)
            latest = completed_event(runtime, job_id, request.artifact_version, instance.clock())
            if any(latest['_project_snapshot'].get(k) != event['_project_snapshot'].get(k)
                   for k in ('artifact_sha256', 'source_batch', 'manual_edit_revision', 'card')):
                raise HTTPException(409, '成果已更新，请刷新后再次播报')
            instance.client = client
            event['event_id'] = producer
            event['_project_snapshot']['event_id'] = producer
            rejection = instance.enqueue(event, settings=settings, manual=True)
            if rejection:
                raise HTTPException(409, '播报未提交，请稍后重试：' + rejection)
            row = instance.db().execute('SELECT id FROM events WHERE producer=?', (producer,)).fetchone()
            return receipt(instance, job_id, row['id'])
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(409, 'Watch 播报暂不可用：' + error_code(exc)) from None


def install(app, instance, runtime):
    router = APIRouter(prefix='/api/astra/gork/notifications/match')

    @router.post('/{job_id}/replay')
    async def send(job_id: str, payload: ReplayRequest):
        return await asyncio.to_thread(replay, instance, runtime, job_id, payload)

    @router.get('/{job_id}/replay/{event_id}')
    async def get_receipt(job_id: str, event_id: str):
        return await asyncio.to_thread(receipt, instance, job_id, event_id)

    app.include_router(router)
