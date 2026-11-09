"""Local rehearsal data; all writes stay inside the supplied candidate directory."""
from datetime import datetime, timezone
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '03-Src/engine/backend'))
from app.external_task_dispatch import ExternalDispatchStore

JOB = 'ad' * 16
PROJECT = '铜梁天然气管道勘察测量项目'
TEXT = f'同事已通过“{PROJECT}”复核。'


def seed(database, runtime, *, reviewers=('石萌',), review_round=1, created_at=None):
    store = ExternalDispatchStore(database)
    (Path(runtime) / JOB).mkdir(parents=True, exist_ok=True)
    stamp = created_at or datetime.now(timezone.utc).isoformat(timespec='seconds')
    with store._connect() as db:
        db.execute('''INSERT OR IGNORE INTO tasks
            (task_id,event_id,message_id,chat_id,file_key,file_name,status,stage,created_at,updated_at,
             task_kind,source_system,source_task_id,project_name,submission_hash,submission_received_at,
             review_round,platform_profile_id,submission_delivery_status,review_card_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            ('preset-review', 'preset-event', 'preset-message', 'preset-only', 'preset-file', '预设成果.xlsx',
             'pending_review', 'pending_review', stamp, stamp, 'external_dispatch', '造价智算网页', JOB,
             PROJECT, 'b' * 64, stamp, review_round, 'preset', 'sent', 'sent'))
        db.execute("UPDATE tasks SET review_round=?,status='pending_review',stage='pending_review',submission_received_at=? WHERE task_id='preset-review'",
                   (review_round, stamp))
        for index, name in enumerate(reviewers):
            db.execute('''INSERT INTO dispatch_reviewers
                (task_id,mapping_id,platform_user_id,display_name,status,review_round,updated_at)
                VALUES (?,?,?,?,?,?,?) ON CONFLICT(task_id,mapping_id) DO UPDATE SET
                status='pending',review_round=excluded.review_round,decided_at='',updated_at=excluded.updated_at''',
                ('preset-review', f'person-{index}', f'user-{index}', name, 'pending', review_round, stamp))
    return store


def approve(store, index=0, **kwargs):
    return store.review_task('preset-review', operator_open_id=f'user-{index}',
                             platform_profile_id='preset', decision='approve', **kwargs)
