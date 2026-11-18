"""Office sandbox worklists. The only writable resource is this presentation file."""
from pathlib import Path
from threading import RLock
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError, model_validator

from app.batch_operation import atomic_json

router = APIRouter(prefix='/api/astra/office-task-settings')
SETTINGS_FILE = Path(__file__).resolve().parents[1] / 'config' / 'office-task-settings.json'
_lock = RLock()
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Note = Annotated[str, StringConstraints(max_length=1200)]
PersonKey = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
EntryKey = Annotated[str, StringConstraints(min_length=1, max_length=580, pattern=r'^(review|sample|survey|manual):[^\x00-\x1f]+$')]
Status = Literal['待处理', '待复核', '进行中', '审核中', '已完成', '已通过', '已退回']


class SettingsModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class ManualTask(SettingsModel):
    id: Annotated[str, StringConstraints(pattern=r'^manual:[0-9a-f-]{36}$')]
    title: Title
    status: Status
    description: Note = ''


class Adjustment(SettingsModel):
    title: Title | None = None
    status: Status | None = None
    description: Note | None = None
    hidden: bool = False


class Member(SettingsModel):
    revision: int = Field(ge=0)
    tasks: list[ManualTask] = Field(max_length=3000)
    adjustments: dict[EntryKey, Adjustment] = Field(max_length=20000)

    @model_validator(mode='after')
    def unique_tasks(self):
        if len({task.id for task in self.tasks}) != len(self.tasks):
            raise ValueError('自建任务标识重复')
        return self


class Settings(SettingsModel):
    schemaVersion: Literal[1] = 1
    revision: int = Field(default=0, ge=0)
    members: dict[PersonKey, Member] = Field(default_factory=dict)


class Changes(SettingsModel):
    schemaVersion: Literal[1]
    members: dict[PersonKey, Member] = Field(min_length=1, max_length=500)


def read_settings():
    try:
        return Settings.model_validate_json(SETTINGS_FILE.read_bytes())
    except FileNotFoundError:
        return Settings()
    except (OSError, ValidationError):
        raise HTTPException(503, '沙盘任务设置读取失败，请检查配置文件后重试') from None


@router.get('')
def get_settings():
    with _lock:
        return read_settings().model_dump(exclude_none=True)


@router.put('')
def save_settings(changes: Changes):
    with _lock:
        current = read_settings()
        for person_id, draft in changes.members.items():
            if person_id in {'__proto__', 'constructor', 'prototype'} or any(ord(ch) < 32 for ch in person_id):
                raise HTTPException(422, '人员标识无效')
            saved = current.members.get(person_id)
            if draft.revision != (saved.revision if saved else 0):
                raise HTTPException(409, '同一人的任务已在另一窗口保存，请重新载入后再编辑')
        for person_id, draft in changes.members.items():
            current.members[person_id] = draft.model_copy(update={'revision': draft.revision + 1})
        current.revision += 1
        result = current.model_dump(exclude_none=True)
        try:
            SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
            atomic_json(SETTINGS_FILE, result)
        except OSError:
            raise HTTPException(503, '沙盘任务保存失败，请重试') from None
        return result
