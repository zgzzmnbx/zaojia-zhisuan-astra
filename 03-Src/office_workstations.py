"""Project-local office presentation settings; never changes review recipients or rights."""
import json
import os
import re
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path
from threading import RLock

from fastapi import APIRouter, Body, HTTPException

ROOT = Path(__file__).resolve().parents[1]
router = APIRouter(prefix='/api/astra/office-workstations')
_lock = RLock()
APPEARANCES = {'inherit', 'blue-shirt', 'headphones', 'glasses', 'cap', 'beanie',
               'ponytail', 'bun', 'bob', 'curly', 'spiky', 'suit', 'red-shirt',
               'long-black', 'long-black-lilac', 'long-wavy', 'long-wavy-rose',
               'wing-dawn', 'wing-herald', 'wing-tide', 'wing-frost', 'wing-ember'}


def filename():
    return ROOT / 'config' / 'office-workstations.json'


def pending_review_rows(database):
    """Read each outstanding personal receipt, including those outside recent results."""
    if not database.exists():
        return []
    try:
        with closing(sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True, timeout=2)) as db:
            db.row_factory = sqlite3.Row
            if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='dispatch_reviewers'").fetchone():
                return []
            rows = db.execute("""
                SELECT t.task_id AS taskId, t.platform_profile_id AS platform,
                       r.mapping_id AS reviewerRef, r.display_name AS reviewerName,
                       t.review_round AS reviewRound, CAST(t.created_at AS TEXT) AS createdAt,
                       t.project_name AS projectName, t.task_name AS taskName,
                       COALESCE(NULLIF(t.submission_file_name, ''), t.file_name, '') AS artifactName
                  FROM tasks t JOIN dispatch_reviewers r ON r.task_id = t.task_id
                       AND r.review_round = t.review_round
                 WHERE t.task_kind = 'external_dispatch' AND t.status = 'pending_review' AND r.status = 'pending'
                 ORDER BY t.created_at DESC, t.task_id, r.mapping_id
            """)
            return [dict(row) for row in rows]
    except (OSError, sqlite3.Error):
        raise HTTPException(503, '人员待办暂时无法读取') from None


@router.get('/pending-reviews')
def pending_reviews():
    from app.feishu_app_bot import DB_PATH
    return {'items': pending_review_rows(DB_PATH)}


def seats():
    try:
        layout = json.loads((ROOT / 'public/office-twin/data/office_layout.json').read_text('utf-8'))
        rooms = {r['id']: r['label'] for r in layout['rooms']}
        preferred = ['SEAT_NW_01', 'SEAT_NW_03', 'SEAT_E_01', 'SEAT_SE_01', 'SEAT_SW_01']
        items = [{'id': s['seat_id'], 'label': f"{rooms.get(s['room_id'], s['room_id'])} · {s['seat_id'].removeprefix('SEAT_')}",
                  'room': s['room_id']} for s in layout['workstations'] if s.get('assignable') is not False]
        return sorted(items, key=lambda s: preferred.index(s['id']) if s['id'] in preferred else 999)
    except (OSError, ValueError, KeyError, TypeError):
        raise HTTPException(503, '工位布局读取失败，请检查办公室项目文件') from None


def validate(value, available):
    if not isinstance(value, dict) or set(value) != {'schemaVersion', 'revision', 'people'}:
        raise ValueError('工位设置字段无效')
    if type(value['schemaVersion']) is not int or value['schemaVersion'] != 1 or type(value['revision']) is not int or value['revision'] < 0:
        raise ValueError('工位设置版本无效')
    people = value['people']
    if not isinstance(people, list) or len(people) > len(available):
        raise ValueError('人员数量超过可用工位')
    ids, occupied, result = set(), set(), []
    for person in people:
        required = {'id', 'name', 'gender', 'trade', 'expertise', 'seatId'}
        if not isinstance(person, dict) or not required <= set(person) or set(person) - required - {'appearance', 'colors'}:
            raise ValueError('人员字段无效')
        clean = {}
        for key, limit in [('id', 240), ('name', 40), ('trade', 80), ('expertise', 240), ('seatId', 80), ('gender', 16)]:
            text = person[key]
            if not isinstance(text, str) or len(text) > limit or any(ord(c) < 32 for c in text):
                raise ValueError('人员信息过长或含无效字符')
            clean[key] = text.strip()
        if not clean['name'] or not clean['id'] or clean['id'] in ids:
            raise ValueError('姓名不能为空，人员标识不能重复')
        if clean['gender'] not in {'unspecified', 'male', 'female'}:
            raise ValueError('请选择有效性别')
        appearance = person.get('appearance', 'inherit')
        if not isinstance(appearance, str) or appearance not in APPEARANCES:
            raise ValueError('请选择有效人物扮相')
        clean['appearance'] = appearance
        colors = person.get('colors', {})
        if not isinstance(colors, dict) or set(colors) - {'hair', 'shirt', 'skin'}:
            raise ValueError('人物颜色字段无效')
        if any(not isinstance(c, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', c) for c in colors.values()):
            raise ValueError('人物颜色须为六位十六进制颜色，例如 #A8D2EB')
        clean['colors'] = {key: color.upper() for key, color in colors.items()}
        if clean['seatId'] not in available:
            raise ValueError(f"{clean['name']}：请选择有效工位")
        if clean['seatId'] in occupied:
            raise ValueError('一个工位只能分配给一人，请调整重复工位')
        ids.add(clean['id']); occupied.add(clean['seatId']); result.append(clean)
    return {**value, 'people': result}


def read_config(available):
    try:
        return validate(json.loads(filename().read_text('utf-8')), available)
    except FileNotFoundError:
        return {'schemaVersion': 1, 'revision': 0, 'people': []}
    except (OSError, ValueError, TypeError):
        raise HTTPException(503, '工位设置读取失败，未覆盖原文件；请检查 config/office-workstations.json') from None


@router.get('')
def read():
    with _lock:
        options = seats()
        return {**read_config({s['id'] for s in options}), 'seats': options}


@router.put('')
def save(payload: dict = Body(...)):
    with _lock:
        options = seats()
        available = {s['id'] for s in options}
        current = read_config(available)
        if type(payload.get('revision')) is not int or payload['revision'] != current['revision']:
            raise HTTPException(409, '设置已被其他窗口修改，请关闭后重新打开工位设置')
        try:
            value = validate(payload, available)
            # An older open page does not know this optional display field.
            previous = {p['id']: p for p in current['people']}
            for incoming, person in zip(payload['people'], value['people']):
                if 'appearance' not in incoming:
                    person['appearance'] = previous.get(person['id'], {}).get('appearance', 'inherit')
                if 'colors' not in incoming:
                    person['colors'] = previous.get(person['id'], {}).get('colors', {})
        except (ValueError, TypeError) as error:
            raise HTTPException(400, str(error)) from None
        value['revision'] += 1
        temporary = None
        try:
            target = filename()
            target.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=target.parent, prefix='.office-workstations-', suffix='.tmp', delete=False) as stream:
                temporary = Path(stream.name)
                json.dump(value, stream, ensure_ascii=False, indent=2)
                stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
            os.replace(temporary, target)
        except OSError:
            raise HTTPException(503, '工位设置未保存，请检查项目目录权限后重试') from None
        finally:
            if temporary is not None and temporary.exists():
                temporary.unlink(missing_ok=True)
        return {**value, 'seats': options}
