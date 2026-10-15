"""Pure milestone presentation and attempt-bound amount wording."""
from decimal import Decimal, InvalidOperation
import re


STAGES = {'conversion_start', 'match_start', 'match_result', 'warning_start',
          'warning_result', 'report_generated', 'review_requested', 'review_sent'}


def _count(event, key):
    value = event.get(key)
    return value if type(value) is int and value >= 0 else None


def amount_text(event, *, spoken=False):
    amount = event.get('amount_summary')
    if (event.get('status') != 'completed' or not isinstance(amount, dict)
            or not event.get('attempt') or amount.get('attempt') != event['attempt']
            or amount.get('currency') != 'CNY' or amount.get('unit') != 'yuan'
            or amount.get('basis') not in {'tax_included', 'tax_excluded'}
            or amount.get('calculation_status') not in {'recalculated', 'unconfirmed'}):
        return None
    try:
        raw = amount.get('value')
        if not isinstance(raw, str) or not re.fullmatch(r'\d{1,13}(?:\.\d{1,6})?', raw):
            return None
        value = Decimal(raw)
        if not value.is_finite() or not Decimal(0) <= value <= Decimal('1e12'):
            return None
    except InvalidOperation:
        return None
    unit = '元'
    below_wan = spoken and Decimal(0) < value < Decimal('10000')
    if spoken:
        value //= Decimal('10000')
        unit = '万'
    number = '不足1' if below_wan else format(value, 'f')
    if '.' in number:
        number = number.rstrip('0').rstrip('.')
    basis = '含税总额' if amount['basis'] == 'tax_included' else '不含税金额'
    unconfirmed = amount['calculation_status'] == 'unconfirmed'
    return f'{"表内" if unconfirmed else ""}{basis}{number}{unit}。' + ('公式重算未确认。' if unconfirmed else '')


def stage_presentation(event):
    stage, status = event.get('stage'), event.get('status')
    if stage not in STAGES:
        return None
    if stage in {'match_result', 'warning_result'} and status == 'failed':
        name = '匹配' if stage == 'match_result' else '风险检查'
        return {'expression': 'confused', 'text': f'{name}未完成，请查看错误。', 'duration_ms': 5000}
    if stage in {'match_result', 'warning_result', 'report_generated'} and status != 'completed':
        return None
    if stage in {'conversion_start', 'match_start', 'warning_start'}:
        if status != 'running':
            return None
        text = {'conversion_start': '资料转换已开始。', 'match_start': '规则匹配已开始。',
                'warning_start': '风险检查已开始。'}[stage]
        return {'expression': 'working', 'text': text, 'duration_ms': 10000}
    if stage == 'match_result':
        reviews = _count(event, 'review_rows')
        text = '匹配完成，' + (amount_text(event) or '请查看结果。')
        if reviews is not None and reviews > 0:
            text += f'{reviews}项待复核。'
        return {'expression': 'curious' if reviews else 'happy', 'text': text, 'duration_ms': 2000}
    if stage == 'warning_result':
        warnings = _count(event, 'warning_rows')
        text = f'风险检查完成，{warnings}项需复核。' if warnings else ('风险检查完成，未发现经验偏离。' if warnings == 0 else '风险检查完成，请查看结果。')
        return {'expression': 'confused' if warnings else 'happy', 'text': text,
                'duration_ms': 10000 if warnings else 2000}
    if stage == 'report_generated':
        return {'expression': 'happy', 'text': '最终风险报告已生成。', 'duration_ms': 2000}
    if stage == 'review_requested' and status == 'completed':
        return {'expression': 'curious', 'text': '同事复核已发起，等待投递确认。', 'duration_ms': 2000}
    if stage == 'review_sent' and status == 'sent':
        return {'expression': 'happy', 'text': '复核资料已送达，等待同事反馈。', 'duration_ms': 2000}
    return None
