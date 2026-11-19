"""Optional notifications for a saved office task, independent of review dispatch."""
from contextlib import closing, contextmanager
from html import escape
from pathlib import Path
import sqlite3
from typing import Literal
from uuid import NAMESPACE_URL, uuid5

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

import office_task_settings as plans
import professional_host
from weact_read_only import is_read_only_chat

router = APIRouter(prefix='/api/astra/office-task-settings')
RECEIPTS = Path(__file__).resolve().parents[1] / 'config' / 'office-task-notifications.sqlite3'
PROFILES = {'default': ('飞书', '大尾巴'), 'weact_cost': ('WeAct', '石萌')}


class Notification(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    personId: plans.PersonKey
    taskId: str = Field(pattern=r'^manual:[0-9a-f-]{36}$')
    profile: Literal['default', 'weact_cost']
    destination: str = Field(min_length=1, max_length=180)
    revision: int = Field(ge=1)


def service_for(profile):
    from app.main import PROFESSIONAL_SKILL_REGISTRY
    from app.external_task_dispatch import build_service
    if not professional_host.config().get('external_enabled'):
        raise HTTPException(409, '请先启用外部协同')
    professional_host.require_review_connection(profile)
    return build_service(registry=PROFESSIONAL_SKILL_REGISTRY, profile_id=profile)


@contextmanager
def platform_service(profile):
    try:
        service = service_for(profile)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, '平台连接暂不可用') from None
    with closing(service.feishu.client):
        yield service


def recipient(service, person_id):
    profile = service.profile_id
    directory = service.directory()
    matches = [p for p in directory['people'] if
               (person_id == 'owner' and p['display_name'] == PROFILES[profile][1]) or
               (person_id != 'owner' and person_id == profile + ':' + p['person_ref'])]
    if len(matches) != 1:
        return None, []
    person = matches[0]
    if service.direct_delivery_verified:
        return person, [{'id': 'direct', 'label': '私聊 · ' + person['display_name']}]
    destinations = []
    for g in directory['groups']:
        if not (g['authorized'] and g['members_available'] and 0 < g['member_count'] <= 10
                and any(p['person_ref'] == person['person_ref'] for p in g['people'])):
            continue
        chat_id, _ = service.resolve_selected_group(g['group_ref'])
        if not is_read_only_chat(chat_id):
            destinations.append({'id': g['group_ref'], 'label': '工作群 · ' + g['name']})
    return person, destinations


@router.get('/notification-options')
def options(personId: plans.PersonKey):
    result = []
    for profile, (label, _) in PROFILES.items():
        try:
            with platform_service(profile) as service:
                _, targets = recipient(service, personId)
        except Exception:
            targets = []
        result.append({'profile': profile, 'label': label, 'targets': targets})
    return {'platforms': result}


def connection():
    RECEIPTS.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(RECEIPTS, timeout=5)
    db.execute('CREATE TABLE IF NOT EXISTS notices (id TEXT PRIMARY KEY, destination TEXT NOT NULL, state TEXT NOT NULL)')
    return db


@router.post('/notify')
def notify(value: Notification):
    with plans._lock:
        member = plans.read_settings().members.get(value.personId)
        task = next((t for t in member.tasks if t.id == value.taskId), None) if member else None
        if not task or member.revision != value.revision or (task.id in member.adjustments and member.adjustments[task.id].hidden):
            raise HTTPException(409, '任务已变更，请核对人员和任务后再通知')
    with platform_service(value.profile) as service:
        return deliver(value, task, service)


def deliver(value, task, service):
    from app.external_task_dispatch import DispatchValidationError, enforce_outbound_audience_safety
    key = str(uuid5(NAMESPACE_URL, '|'.join([value.personId, task.id, value.profile])))
    try:
        person, targets = recipient(service, value.personId)
        if not person or value.destination not in {t['id'] for t in targets}:
            raise HTTPException(409, '人员或目标已不在当前可用通讯录中')
        mapping = service.store.get_person(person['person_ref'], value.profile)
        if not mapping or mapping['display_name'] != person['display_name'] or not mapping['platform_user_id']:
            raise HTTPException(409, '人员身份已变化，请重新选择')
        user = mapping['platform_user_id']
        if value.destination == 'direct':
            dest, kind = user, 'open_id'
        else:
            expected, _ = service.resolve_selected_group(value.destination)
            dest, _ = service.resolve_group_target(value.destination)
            if dest != expected or is_read_only_chat(dest):
                raise HTTPException(409, '工作群不可投递')
            kind = 'chat_id'
            members = service.feishu.list_chat_members(dest).get('members', [])
            if user not in {m.get('member_id') or m.get('open_id') or m.get('user_id') for m in members}:
                raise HTTPException(409, '人员已不在所选群内')
        enforce_outbound_audience_safety(service.feishu, [(dest, kind)], explicit_named_recipients={user: person['display_name']})
    except HTTPException:
        raise
    except DispatchValidationError as exc:
        raise HTTPException(exc.status_code, str(exc)) from None
    except Exception:
        raise HTTPException(503, '通知目标暂时无法核验，请重试') from None
    # Reserve before delivery. A timeout or a crash must not trigger another message.
    with closing(connection()) as db, db:
        inserted = db.execute("INSERT OR IGNORE INTO notices VALUES (?, ?, 'pending')", (key, value.destination)).rowcount
        if not inserted:
            destination, state = db.execute('SELECT destination, state FROM notices WHERE id=?', (key,)).fetchone()
            if destination != value.destination:
                raise HTTPException(409, '这项任务已提交过其他通知目标，请查看平台消息')
            if state == 'sent':
                return {'status': 'sent'}
            raise HTTPException(409, '通知送达情况待核对，请查看平台消息')
    text = '办公室任务 · ' + escape(task.title) + '\n负责人：' + escape(person['display_name'])
    if task.description.startswith('所属项目：'):
        text += '\n' + escape(task.description.splitlines()[0])
    try:
        message = service.feishu._send_message(dest, 'text', {'text': text}, receive_id_type=kind, uuid=key)
        if not message:
            raise ValueError
    except Exception:
        raise HTTPException(502, '任务已保存，通知送达情况待核对') from None
    with closing(connection()) as db, db:
        db.execute("UPDATE notices SET state='sent' WHERE id=?", (key,))
    return {'status': 'sent'}
