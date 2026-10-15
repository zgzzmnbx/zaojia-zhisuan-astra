import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
from gork_stages import amount_text, stage_presentation


@pytest.mark.parametrize('stage,status,expression,duration', [
    ('conversion_start', 'running', 'working', 10000),
    ('match_start', 'running', 'working', 10000),
    ('match_result', 'completed', 'happy', 2000),
    ('match_result', 'failed', 'confused', 5000),
    ('warning_start', 'running', 'working', 10000),
    ('warning_result', 'failed', 'confused', 5000),
    ('report_generated', 'completed', 'happy', 2000),
    ('review_requested', 'completed', 'curious', 2000),
    ('review_sent', 'sent', 'happy', 2000),
])
def test_stage_outputs(stage, status, expression, duration):
    value = stage_presentation({'stage': stage, 'status': status})
    assert value['expression'] == expression
    assert value['duration_ms'] == duration


def test_unknown_counts_are_not_zero_and_risk_is_transient():
    assert '未发现' not in stage_presentation({'stage': 'warning_result', 'status': 'completed'})['text']
    assert '未发现' in stage_presentation({'stage': 'warning_result', 'status': 'completed', 'warning_rows': 0})['text']
    value = stage_presentation({'stage': 'warning_result', 'status': 'completed', 'warning_rows': 2})
    assert value['text'] == '风险检查完成，2项需复核。'
    assert value['duration_ms'] == 10000
    assert stage_presentation({'stage': 'restored', 'status': 'completed'}) is None
    assert stage_presentation({'stage': 'report_generated', 'status': 'failed'}) is None
    assert '最终风险报告' not in stage_presentation({'stage': 'match_result', 'status': 'completed'})['text']
    assert '等待投递' in stage_presentation({'stage': 'review_requested', 'status': 'completed'})['text']


def test_amount_and_review_keep_actual_attempt_and_caveat():
    event = {'stage': 'match_result', 'status': 'completed', 'attempt': 'current', 'review_rows': 1,
             'amount_summary': {'attempt': 'current', 'value': '9447173.00', 'unit': 'yuan',
             'currency': 'CNY', 'basis': 'tax_included', 'calculation_status': 'unconfirmed'}}
    result = stage_presentation(event)
    assert result['text'] == '匹配完成，表内含税总额9447173元。公式重算未确认。1项待复核。'
    assert result['expression'] == 'curious'
    event['amount_summary']['attempt'] = 'old'
    assert '9447173' not in stage_presentation(event)['text']
    event['amount_summary']['attempt'] = 'current'
    event['amount_summary']['value'] = 'NaN'
    assert 'NaN' not in stage_presentation(event)['text']
    event['amount_summary']['value'] = '1e-99999999'
    assert '总额' not in stage_presentation(event)['text']


@pytest.mark.parametrize('value,spoken', [
    ('0.00', '0万'), ('0.000001', '不足1万'), ('9999.99', '不足1万'), ('10000.00', '1万'),
    ('26728500.00', '2672万'), ('9447173.00', '944万'), ('19999.99', '1万'),
    ('10000.000001', '1万'), ('1000000000000', '100000000万'),
])
def test_spoken_amount_uses_integer_wan_without_rounding_or_changing_snapshot(value, spoken):
    event = {'status': 'completed', 'attempt': 'current',
             'amount_summary': {'attempt': 'current', 'value': value, 'unit': 'yuan',
             'currency': 'CNY', 'basis': 'tax_excluded', 'calculation_status': 'unconfirmed'}}
    assert amount_text(event, spoken=True) == f'表内不含税金额{spoken}。公式重算未确认。'
    assert event['amount_summary']['value'] == value and event['amount_summary']['unit'] == 'yuan'
    assert '万元' not in amount_text(event)
    event['amount_summary']['attempt'] = 'old'
    assert amount_text(event, spoken=True) is None


@pytest.mark.parametrize('value', ['NaN', '-1', '1e4', '1000000000001'])
def test_spoken_amount_keeps_validation(value):
    event = {'status': 'completed', 'attempt': 'current',
             'amount_summary': {'attempt': 'current', 'value': value, 'unit': 'yuan',
             'currency': 'CNY', 'basis': 'tax_included', 'calculation_status': 'recalculated'}}
    assert amount_text(event, spoken=True) is None
