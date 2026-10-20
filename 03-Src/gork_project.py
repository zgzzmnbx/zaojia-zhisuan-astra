"""Freeze project output at committed milestones; never derive facts from speech."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re

from gork_amount import amount_summary
from gork_stages import amount_text

DEBUG_CARD_STAGES = {'match_completed', 'warning_completed', 'warning_found'}


def supports_project_card(capabilities):
    versions, offer = capabilities.get('protocol_versions'), capabilities.get('project_card')
    return isinstance(versions, list) and '1.1' in versions and isinstance(offer, dict) and offer.get('template') == 'cost_result'


def debug_project(event, include_amount, amount):
    """The screen's confirmed amount is explicitly synthetic; speech stays unchanged."""
    card = dict(template='cost_result', project_id=event['job_id'], project_name='调试示例 · 独立任务',
                result_status='completed', risk_status='not_checked', risk_count=None)
    if event['stage'] == 'warning_result':
        card.update(risk_status='checked', risk_count=event['warning_rows'])
    summary = None
    if include_amount:
        summary = dict(value=amount, currency='CNY', unit='yuan', basis='tax_included',
                       attempt=event['attempt'], calculation_status='recalculated')
        if not amount_text({**event, 'amount_summary': summary}):
            raise ValueError('invalid simulated amount')
    return {**event, '_project_snapshot': {'job_id': event['job_id'], 'event_id': event['event_id'],
            'attempt': event['attempt'], 'card': card, 'amount_summary': summary, 'display_debug': True}}


def _read(path):
    if path.stat().st_size > 5_000_000:
        raise ValueError('snapshot too large')
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict):
        raise ValueError('snapshot must be an object')
    return value


def _valid_card(card):
    if not isinstance(card, dict) or card.get('template') != 'cost_result' or card.get('result_status') != 'completed':
        return False
    for key, limit in [('project_id', 100), ('project_name', 120)]:
        text = card.get(key)
        if not isinstance(text, str) or not text.strip() or len(text) > limit or any(ord(c) < 32 for c in text):
            return False
    status, count = card.get('risk_status'), card.get('risk_count')
    return (status == 'checked' and type(count) is int and 0 <= count <= 9999
            or status in {'not_checked', 'unavailable'} and count is None)


def freeze_project(event, job: Path, round_id=''):
    """Runs only at the publisher's first write, before the existing amount hook."""
    if event.get('stage') not in {'match_result', 'warning_result'} or event.get('status') != 'completed':
        return event
    try:
        pattern = r'debug-[a-f0-9]{32}' if event.get('_debug') is True else r'[a-f0-9]{32}'
        if not re.fullmatch(pattern, job.name):
            return event
        state_file = job / 'process-state.json'
        if state_file.stat().st_size > 5_000_000:
            return event
        before = state_file.read_bytes()
        state = _read(state_file)
        batch = state.get('batch_attempt')
        if not isinstance(batch, str) or not batch or state.get('summary', {}).get('matching_status') != 'completed':
            return event
        if event['stage'] == 'match_result' and event.get('attempt') != batch:
            return event
        output = (job / state['output_excel']).resolve()
        if not output.is_relative_to(job.resolve()) or not output.is_file():
            return event
        digest = state.get('artifact_sha256')
        with output.open('rb') as stream:
            actual = hashlib.file_digest(stream, 'sha256').hexdigest()
        if not isinstance(digest, str) or not re.fullmatch(r'[a-f0-9]{64}', digest) or actual != digest:
            return event
        version = state.get('artifact_version')
        if type(version) is not int or version < 1:
            return event
        relation = state.get('project_relation') or {}
        card = dict(template='cost_result', project_id=state.get('project_id') or relation.get('project_id') or 'job:' + job.name,
                    project_name=state.get('project_name') or relation.get('project_name') or state.get('input_filename'),
                    result_status='completed', risk_status='not_checked', risk_count=None)
        attempt = event.get('attempt') or ('request:' + round_id if round_id else 'event:' + str(event.get('event_id', '')))
        amount = amount_summary(state, batch)
        if event['stage'] == 'warning_result':
            warning = state['summary'].get('warning_summary') or {}
            count = event.get('warning_rows')
            checked = (warning.get('executed') is True and type(warning.get('warning_rows')) is int
                       and type(count) is int and 0 <= count <= 9999
                       and warning.get('warning_rows') == count)
            card.update(risk_status='checked' if checked else 'unavailable', risk_count=count if checked else None)
            pending = job / 'astra-edit-state.json'
            dirty = pending.exists() and _read(pending).get('needs_recalculate') is not False
            if amount and not dirty:
                for path in sorted((job / 'sentinel-events').glob('*.json'), reverse=True)[:100]:
                    try:
                        previous = _read(path)
                    except (OSError, ValueError):
                        continue
                    if previous.get('stage') != 'match_result' or previous.get('status') != 'completed' or previous.get('attempt') != batch:
                        continue
                    old, source = previous.get('amount_summary'), previous.get('_project_snapshot') or {}
                    same = (source.get('job_id') == job.name and source.get('event_id') == previous.get('event_id')
                            and source.get('source_batch') == batch and source.get('manual_edit_revision') == state.get('manual_edit_revision', 0)
                            and source.get('card', {}).get('project_id') == card['project_id']
                            and type(source.get('artifact_version')) is int and 1 <= source['artifact_version'] <= version)
                    # Before project cards existed, the attempt-bound amount was already
                    # frozen. Only never-edited results can bridge that older snapshot.
                    if '_project_snapshot' not in previous and type(state.get('manual_edit_revision')) is int and state['manual_edit_revision'] == 0:
                        same = True
                    if same and amount_text(previous) and all(old.get(k) == amount[k] for k in ('value', 'currency', 'unit', 'basis')):
                        amount['calculation_status'] = old['calculation_status']
                    break
        if not _valid_card(card) or state_file.read_bytes() != before:
            return event
        if amount:
            amount = {**amount, 'attempt': attempt}
        return {**event, 'attempt': attempt, '_project_snapshot': {
            'job_id': job.name, 'event_id': event['event_id'], 'attempt': attempt,
            'source_batch': batch, 'artifact_sha256': digest, 'artifact_version': version,
            'manual_edit_revision': state.get('manual_edit_revision', 0), 'card': card, 'amount_summary': amount}}
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        return event  # Optional output must never alter the business operation.


def project_output(event, capabilities):
    """Only frozen facts for this exact producer identity can enter protocol 1.1."""
    if (event.get('status') != 'completed' or event.get('stage') not in {'match_result', 'warning_result'}
            or not supports_project_card(capabilities)):
        return {}
    snapshot = event.get('_project_snapshot')
    if not isinstance(snapshot, dict) or any(snapshot.get(k) != event.get(k) for k in ('job_id', 'event_id', 'attempt')):
        return {}
    card = snapshot.get('card')
    if not _valid_card(card):
        return {}
    result = {'protocol_version': '1.1', 'project_card': dict(card)}
    amount = (snapshot.get('amount_summary') if event.get('_debug') is True and snapshot.get('display_debug') is True
              else event.get('amount_summary') or snapshot.get('amount_summary'))
    if amount_text({**event, 'amount_summary': amount}):
        result['amount_summary'] = dict(amount)
    return result
