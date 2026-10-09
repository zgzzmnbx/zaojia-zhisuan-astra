"""Freeze a completed attempt's sheet amount for the existing Gork sentinel."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import json
import logging
from pathlib import Path
import re


def amount_summary(state: dict, attempt: str, recalculated: bool = False) -> dict | None:
    if not attempt or state.get('batch_attempt') != attempt:
        return None
    summary = state.get('summary', {})
    if summary.get('matching_status') != 'completed':
        return None
    preview = summary.get('table_preview') or {}
    sheets = [preview, *preview.get('sheets', [])]
    sheet = next((s for s in sheets if '费用汇总' in str(s.get('sheet_name', ''))), None)
    if not sheet:
        return None
    clean = lambda v: re.sub(r'\s+', '', str(v or ''))
    candidates = [sheet.get('headers', []), *sheet.get('rows', [])]
    for index, row in enumerate(candidates):
        headers = [clean(v) for v in row]
        project = next((i for i, h in enumerate(headers) if h in {'项目', '项目名称', '名称'}), None)
        amount = next((i for i, h in enumerate(headers) if re.match(r'^(费用|金额)', h)), None)
        if project is None or amount is None:
            continue
        unit = re.search(r'[（(](元|万元|亿元)[）)]', headers[amount])
        if not unit:
            return None
        multiplier = {'元': 1, '万元': 10_000, '亿元': 100_000_000}[unit[1]]
        for basis, label in [('tax_included', r'^合计[（(]含税[）)]$'), ('tax_excluded', r'^合计[（(]不含税[）)]$')]:
            for data in candidates[index + 1:]:
                if len(data) <= max(project, amount):
                    continue
                name = clean(data[project]) or clean(data[0])
                if not re.match(label, name):
                    continue
                try:
                    raw = data[amount]
                    if isinstance(raw, bool) or raw is None:
                        continue
                    value = Decimal(re.sub(r'[,，\s]', '', str(raw))) * multiplier
                    if not value.is_finite() or value < 0 or value > Decimal('1e12'):
                        continue
                    return {'value': format(value.quantize(Decimal('.01'), rounding=ROUND_HALF_UP), 'f'),
                            'currency': 'CNY', 'unit': 'yuan', 'basis': basis, 'attempt': attempt,
                            'calculation_status': 'recalculated' if recalculated else 'unconfirmed'}
                except (InvalidOperation, ValueError):
                    continue
        return None
    return None


def install(engine):
    """Adapt observer modules only; no changes to the frozen pricing engine."""
    from app import sentinel_events, task_monitoring
    if getattr(sentinel_events, '_astra_amount_installed', False):
        return
    recalculations = {}
    original_recalculate = engine.recalculate_workbook
    def recalculate(path, *args, **kwargs):
        result = original_recalculate(path, *args, **kwargs)
        recalculations[str(Path(path).resolve())] = result is True
        while len(recalculations) > 128:
            recalculations.pop(next(iter(recalculations)))
        return result
    engine.recalculate_workbook = recalculate
    original_write = sentinel_events.atomic_json
    def write(path, event):
        if event.get('stage') == 'match_result' and event.get('status') == 'completed':
            job = Path(path).parent.parent
            try:
                state = json.loads((job / 'process-state.json').read_text(encoding='utf-8'))
                output = str((job / str(state.get('output_excel') or '')).resolve())
                amount = amount_summary(state, event.get('attempt', ''), recalculations.pop(output, False))
                if amount:
                    event = {**event, 'amount_summary': amount}
            except (OSError, ValueError, TypeError, AttributeError):
                logging.getLogger(__name__).exception('Gork amount unavailable for %s', job.name)
        return original_write(path, event)
    sentinel_events.atomic_json = write
    original_events = task_monitoring._events
    def events(row, job_id, runtime_dir, dispatch_db_path=None):
        result = original_events(row, job_id, runtime_dir, dispatch_db_path)
        # Only persisted event snapshots qualify. Never backfill from today's workbook.
        if not task_monitoring.JOB_ID.fullmatch(job_id):
            return result
        stored = {}
        for path in sorted((runtime_dir / job_id / 'sentinel-events').glob('*.json'), reverse=True)[:100]:
            try:
                raw = task_monitoring._read_json(path)
                if raw.get('stage') == 'match_result' and raw.get('status') == 'completed':
                    amount = raw.get('amount_summary')
                    if isinstance(amount, dict) and amount.get('attempt') == raw.get('attempt'):
                        stored[raw.get('event_id')] = amount
            except (OSError, ValueError):
                continue
        return [{**item, 'amount_summary': stored[item['event_id']]} if item['event_id'] in stored else item for item in result]
    task_monitoring._events = events
    sentinel_events._astra_amount_installed = True
