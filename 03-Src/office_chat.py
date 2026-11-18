"""Opt-in, read-only office speech. Only settings persist; each channel shares one reader."""
import json
import time
from pathlib import Path
from threading import Event, Lock, RLock
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError, model_validator

from app.batch_operation import atomic_json

def no_cache(response: Response):
    response.headers['Cache-Control'] = 'no-store'


router = APIRouter(prefix='/api/astra/office-chat', dependencies=[Depends(no_cache)])
SETTINGS_FILE = Path(__file__).resolve().parents[1] / 'config' / 'office-chat.json'
Platform = Literal['weact', 'feishu']
GROUP = Annotated[str, StringConstraints(strip_whitespace=True, max_length=160, pattern=r'^[^\x00-\x1f]*$')]
CHANNELS = {'weact': ('weact_cost', '石萌'), 'feishu': ('default', '大尾巴')}
FRESH_MS = 20000
lock = RLock()
readers = {}


class Preferences(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    revision: int = Field(default=0, ge=0)
    enabled: bool = False
    weact: GROUP = '智算测试'
    feishu: GROUP = ''

    @model_validator(mode='after')
    def require_source(self):
        if self.enabled and not (self.weact or self.feishu):
            raise ValueError('启用时至少填写一个群聊')
        return self


def preferences():
    try:
        return Preferences.model_validate_json(SETTINGS_FILE.read_bytes())
    except FileNotFoundError:
        return Preferences()
    except (OSError, ValidationError):
        raise HTTPException(503, '办公室聊天配置读取失败，请检查文件') from None


class ChannelIssue(Exception):
    pass


def platform_enabled(profile):
    from app import feishu_app_bot
    return feishu_app_bot.is_bot_enabled(profile)


def open_api(profile):
    from app import feishu_app_bot as bot
    credentials = bot.load_credentials(profile)
    if not credentials.get('app_id') or not credentials.get('app_secret') or bot.credential_configuration_issue(profile, credentials):
        raise ChannelIssue('平台凭证未就绪')
    api = bot.FeishuApi(credentials['app_id'], credentials['app_secret'], domain=credentials.get('domain'))
    api.client.timeout = httpx.Timeout(6, connect=3)
    return api


def latest_text(items, group, speaker, after, now):
    latest = None
    for row in items:
        if not isinstance(row, dict):
            continue
        sender = row.get('sender') or {}
        if (not isinstance(sender, dict) or row.get('chat_id') != group or row.get('msg_type') != 'text' or row.get('deleted')
                or sender.get('sender_type') != 'user' or sender.get('id') != speaker):
            continue
        try:
            created = int(row['create_time'])
            content = json.loads(row['body']['content'])['text']
            mid = row['message_id']
        except (TypeError, KeyError, ValueError):
            continue
        if not (after <= created <= now and isinstance(content, str) and content.strip() and isinstance(mid, str) and mid):
            continue
        if latest is None or (created, mid) > (latest['created'], latest['id']):
            text = content.strip()
            latest = {'id': mid, 'created': created, 'text': text if len(text) <= 240 else text[:239] + '…'}
    return latest


class Channel:
    def __init__(self, platform, group, revision):
        self.profile, self.name = CHANNELS[platform]
        self.group, self.revision = group, revision
        self.started = time.time_ns() // 1_000_000
        self.gate, self.stopped = Lock(), Event()
        self.api = self.binding = None
        self.next_read = self.bound_until = 0
        self.state, self.message = '等待沙盘', None
        self.last_key = None

    def close_api(self):
        if self.api:
            self.api.client.close()
        self.api = self.binding = None

    def stop(self):
        self.stopped.set()
        if self.gate.acquire(blocking=False):
            try:
                self.close_api()
            finally:
                self.gate.release()

    def bind(self):
        if self.group.startswith('oc_'):
            group_id = self.group
        else:
            groups = [g['chat_id'] for g in self.api.list_chats() if g['name'] == self.group]
            if len(groups) != 1:
                raise ChannelIssue('找不到指定群聊' if not groups else '存在同名群，请填写群 ID')
            group_id = groups[0]
        if self.stopped.is_set():
            return
        members = self.api.list_chat_members(group_id)['members']
        ids = {m['member_id'] for m in members if m['name'].strip() == self.name and m['member_id'].startswith('ou_')}
        if len(ids) != 1:
            raise ChannelIssue('群中无法唯一识别' + self.name)
        self.binding = group_id, ids.pop()
        self.bound_until = time.monotonic() + 300

    def snapshot(self):
        if self.gate.acquire(blocking=False):
            try:
                clock = time.monotonic()
                if not self.stopped.is_set() and clock >= self.next_read:
                    self.next_read = clock + 5
                    if not platform_enabled(self.profile):
                        raise ChannelIssue('平台连接已关闭')
                    if self.api is None:
                        self.api = open_api(self.profile)
                    if self.binding is None or clock >= self.bound_until:
                        self.bind()
                    if not self.stopped.is_set():
                        group, speaker = self.binding
                        now = time.time_ns() // 1_000_000
                        since = max(self.started, now - FRESH_MS)
                        result = self.api.client.get(self.api.base_url + '/im/v1/messages', headers=self.api._headers(),
                            params={'container_id_type': 'chat', 'container_id': group, 'sort_type': 'ByCreateTimeDesc',
                                    'start_time': str(since // 1000), 'page_size': 50})
                        result.raise_for_status()
                        payload = result.json()
                        if payload.get('code') != 0:
                            raise ChannelIssue('无法读取群消息，请检查群权限')
                        incoming = latest_text(payload['data']['items'], group, speaker, since, time.time_ns() // 1_000_000)
                        key = (incoming['created'], incoming['id']) if incoming else None
                        self.message = incoming if key and (self.last_key is None or key >= self.last_key) else None
                        if self.message:
                            self.last_key = key
                        self.state = '正在监听'
            except (httpx.HTTPError, KeyError, ValueError, TypeError, RuntimeError, ChannelIssue, OSError) as exc:
                self.state = str(exc) if isinstance(exc, ChannelIssue) else '平台读取暂不可用'
                self.message = None
                self.next_read = time.monotonic() + 15
                self.close_api()
            finally:
                if self.stopped.is_set():
                    self.close_api()
                self.gate.release()
        message = self.message
        if message and time.time_ns() // 1_000_000 - message['created'] > FRESH_MS:
            message = None
        return {'state': self.state, 'message': message}


@router.get('/settings')
def settings():
    with lock:
        return preferences()


@router.put('/settings')
def save(value: Preferences):
    with lock:
        previous = preferences()
        if value.revision != previous.revision:
            raise HTTPException(409, '聊天设置已在其他窗口更新，请重新载入')
        if value == previous:
            return previous
        updated = value.model_copy(update={'revision': value.revision + 1})
        try:
            SETTINGS_FILE.parent.mkdir(exist_ok=True, parents=True)
            atomic_json(SETTINGS_FILE, updated.model_dump())
        except OSError:
            raise HTTPException(503, '聊天设置保存失败') from None
        for channel in readers.values():
            channel.stop()
        readers.clear()
        if updated.enabled:
            for platform in CHANNELS:
                if group := getattr(updated, platform):
                    readers[platform] = Channel(platform, group, updated.revision)
        return updated


@router.get('/status')
def status():
    with lock:
        return {p: c.state for p, c in readers.items()}


@router.get('/feed/{platform}')
def feed(platform: Platform, revision: int):
    with lock:
        prefs = preferences()
        group = getattr(prefs, platform)
        if not prefs.enabled or revision != prefs.revision or not group:
            return {'revision': prefs.revision, 'state': '已关闭', 'message': None}
        channel = readers.get(platform)
        if channel is None or channel.revision != revision:
            if channel:
                channel.stop()
            channel = readers[platform] = Channel(platform, group, revision)
    result = channel.snapshot()
    with lock:
        if channel.stopped.is_set() or readers.get(platform) is not channel:
            return {'revision': preferences().revision, 'state': '已关闭', 'message': None}
        return {'revision': revision, **result}
