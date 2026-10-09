import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
import server
from gork_amount import amount_summary
from app import sentinel_events, task_monitoring


def state(value='944.7173', unit='万元', attempt='new'):
    return {'batch_attempt': attempt, 'output_excel': 'output.xlsx', 'summary': {
        'matching_status': 'completed', 'table_preview': {'sheet_name': '费用汇总',
        'headers': ['序号', '项目', f'费用（{unit}）'],
        'rows': [['合计（含税）', '', value]]}}}


def test_exact_units_and_attempt_scope():
    assert amount_summary(state(), 'new', True) == {
        'value': '9447173.00', 'currency': 'CNY', 'unit': 'yuan',
        'basis': 'tax_included', 'attempt': 'new', 'calculation_status': 'recalculated'}
    assert amount_summary(state('1.234567', '亿元'), 'new')['value'] == '123456700.00'
    assert amount_summary(state('0', '元'), 'new')['value'] == '0.00'
    assert amount_summary(state(), 'old') is None
    assert amount_summary(state(attempt=''), '') is None


@pytest.mark.parametrize('value', [None, '', True, 'NaN', 'Infinity', '-1', '=SUM(A1:A2)', '1e20'])
def test_invalid_amount_never_becomes_zero(value):
    assert amount_summary(state(value), 'new') is None


def test_header_in_rows_and_explicit_tax_excluded():
    s = state()
    s['summary']['table_preview'] = {'sheet_name': '费用汇总', 'headers': ['标题'],
        'rows': [['项目', '金额(万元)'], ['合计(不含税)', '1,234.56']]}
    assert amount_summary(s, 'new')['basis'] == 'tax_excluded'
    assert amount_summary(s, 'new')['value'] == '12345600.00'
    assert amount_summary(state(unit=''), 'new') is None


def test_event_freezes_amount_without_backfilling_history(tmp_path):
    job = tmp_path / 'job'
    job.mkdir()
    s = state()
    (job / 'process-state.json').write_text(json.dumps(s), encoding='utf-8')
    sentinel_events.publish(job, 'match_result', attempt='new')
    row = {'task_id': 'task', 'task_name': 'test'}
    event = task_monitoring._events(row, 'job', tmp_path)[0]
    assert event['amount_summary']['value'] == '9447173.00'
    assert event['amount_summary']['calculation_status'] == 'unconfirmed'
    (job / 'process-state.json').write_text(json.dumps(state('999')), encoding='utf-8')
    assert task_monitoring._events(row, 'job', tmp_path)[0]['amount_summary'] == event['amount_summary']
    sentinel_events.publish(job, 'match_result', attempt='old')
    sentinel_events.publish(job, 'match_result', attempt='new', status='failed')
    events = task_monitoring._events(row, 'job', tmp_path)
    assert len([e for e in events if 'amount_summary' in e]) == 1
    assert amount_summary(s, 'new')['value'] == '9447173.00'
