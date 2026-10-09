"""Resume opted-in Astra receivers without replaying an unfinished old queue."""
from __future__ import annotations
import json
import asyncio
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def unfinished_queue(db_path: Path, profiles: list[str], active_states=()) -> dict[str, int]:
    if not profiles or not db_path.exists():
        return {}
    counts = {}
    with sqlite3.connect(db_path.resolve().as_uri() + '?mode=ro', uri=True) as db:
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        placeholders = ','.join('?' for _ in profiles)
        for table, column, states in [
            ('bot_inbox', 'profile', ('pending', 'processing')),
            ('bot_outbox', 'profile', ('pending', 'processing')),
            ('tasks', 'platform_profile_id', ('queued', 'retryable_failed', *active_states)),
        ]:
            if table not in tables:
                continue
            state_column = 'status' if table == 'tasks' else 'state'
            state_slots = ','.join('?' for _ in states)
            count = db.execute(f'SELECT COUNT(*) FROM {table} WHERE {column} IN ({placeholders}) AND {state_column} IN ({state_slots})', (*profiles, *states)).fetchone()[0]
            if count:
                counts[table] = count
    return counts


def resume_receivers(bot, enabled: bool) -> dict:
    """Called by the HTTP host lifespan only, never by receiver module imports."""
    result = {'status': 'disabled', 'profiles': [], 'unfinished': {}}
    if not enabled:
        return result
    try:
        profiles = [str(p.get('profile_id') or '') for p in bot.credential_profiles()]
        opted_in = [p for p in profiles if p and bot.is_bot_enabled(p)]
        stopped = [p for p in opted_in if not bot.bot_process_running(p)]
        result['profiles'] = stopped
        result['unfinished'] = {} if bot._pid_is_running(bot.RUNTIME_ROOT/'supervisor.pid') else unfinished_queue(bot.DB_PATH, stopped, bot.ACTIVE_STATES)
        if result['unfinished']:
            result['status'] = 'blocked_old_queue'
        elif not opted_in:
            result['status'] = 'disabled'
        else:
            supervised = bot._pid_is_running(bot.RUNTIME_ROOT/'supervisor.pid')
            result['status'] = 'supervised' if supervised or bot.start_local_bot_supervisor() else 'start_failed'
            result['supervisor_restored'] = not supervised and result['status']=='supervised'
    except Exception as exc:
        result.update(status='start_failed', error_type=type(exc).__name__)
    # No credentials, recipients or queue contents in the audit record.
    result['checked_at'] = datetime.now(timezone.utc).isoformat()
    target = bot.RUNTIME_ROOT / 'host-resume.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary=target.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(target)
    return result


async def monitor_receivers(bot, enabled, *, interval=10.0):
    """Host-owned watchdog; independent of open tabs and the receiver supervisor."""
    while True:
        await asyncio.sleep(interval)
        try:
            await asyncio.to_thread(resume_receivers, bot, bool(enabled()))
        except Exception as exc:
            # Keep the watchdog alive even if writing its audit record failed.
            bot.append_runtime_event('process', '接收监护检查异常：'+type(exc).__name__, level='error')
