"""Exact V3.1 demonstration replay; all other inputs use the original fill engine."""
from __future__ import annotations

import hashlib
import json
from dataclasses import fields
from contextvars import ContextVar
from functools import wraps
from pathlib import Path

import demo_settings
from app.schemas import FillSummary, ReviewRow

ASSETS = Path(__file__).parent / 'reference-assets/v31-match'
SAMPLE_SHA256 = '81e562f874b16d75024bf7d02055e03f7afd929e3382433c633cf9cf9b1559c7'
MANIFEST_SHA256 = '75e4f7468d34049a5a80558924d7f35a1bc6a35bf2d8d5638153b5d01cd5d4c2'
LABEL = '演示标准答案 · 未查询计价库'
_batch_cache = ContextVar('astra_demo_batch_cache', default=None)


def _verified(path, expected):
    try:
        data = path.read_bytes()
    except OSError as exc:
        raise ValueError('3.1 演示标准答案文件缺失或不可读，请恢复已核验的演示包') from exc
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError('3.1 演示标准答案校验失败，已停止填入并保留原成果')
    return data


def _options_match(options, manifest):
    if options.get('confirmed_candidates'):
        return False
    configs = options.get('sheet_configs')
    if not isinstance(configs, list) or len(configs) != len(manifest['sheet_configs']):
        return False
    expected = {c['sheet_name']: c for c in manifest['sheet_configs']}
    seen = set()
    defaults = manifest['expected_options']
    for config in configs:
        if not isinstance(config, dict):
            return False
        name = config.get('sheet_name')
        if name not in expected or name in seen:
            return False
        seen.add(name)
        mapping = dict(config.get('column_mapping') or {})
        # These two keys are aliases for the same physical price column.
        price = mapping.get('输出-价格列', mapping.get('价格列'))
        if mapping.get('价格列', price) != price:
            return False
        mapping.update({'输出-价格列': price, '价格列': price})
        if mapping != expected[name]['column_mapping']:
            return False
        for key, value in expected[name].items():
            if key in ('sheet_name', 'column_mapping'):
                continue
            default = True if key == 'enabled' else options.get(key, defaults.get(key))
            if config.get(key, default) != value:
                return False
    return True


class DemoSummary(FillSummary):
    def to_dict(self):
        return {**super().to_dict(), 'matching_source': 'demo_standard_answer',
                'matching_source_label': LABEL, 'generated_by_model': False,
                'demo_answer_version': getattr(self, '_demo_answer_version', '1.0.1'), 'demo_input_sha256': SAMPLE_SHA256}


class DemoFillEngine:
    def __init__(self, original_factory, context):
        self.original_factory = original_factory
        self.context = context
        self._normal = None

    def __getattr__(self, name):
        # Existing row assistance also uses this factory's cleaning/candidate methods.
        # Only batch fill is replayed; every other method keeps its original engine.
        if self._normal is None:
            self._normal = self.original_factory(self.context)
        return getattr(self._normal, name)

    def fill_workbook(self, input_path, output_path, **options):
        data = Path(input_path).read_bytes()
        exact = hashlib.sha256(data).hexdigest() == SAMPLE_SHA256
        if exact and demo_settings.enabled('matchPreset'):
            manifest = json.loads(_verified(ASSETS/'manifest.json', MANIFEST_SHA256))
            if manifest['sample_sha256'] != SAMPLE_SHA256:
                raise ValueError('演示答案与输入版本不一致')
            if _options_match(options, manifest):
                answer = _verified(ASSETS/'answer.xlsx', manifest['answer_sha256'])
                saved = json.loads(_verified(ASSETS/'summary.json', manifest['summary_sha256']))
                allowed = {f.name for f in fields(FillSummary)}
                summary = DemoSummary(**{k:v for k,v in saved.items() if k in allowed})
                summary.review_details = [ReviewRow(**row) for row in saved['review_details']]
                summary.output_excel = Path(output_path).name
                summary.output_report = ''
                summary.report_text = f'{LABEL}。' + saved['report_text']
                summary.price_logs = ['[演示标准答案快照] ' + line for line in saved['price_logs']]
                Path(output_path).write_bytes(answer)
                cache = _batch_cache.get()
                if cache is not None:
                    cache[str(Path(output_path).resolve())] = manifest['answer_sha256']
                return summary
        return self.original_factory(self.context).fill_workbook(input_path, output_path, **options)


def install(engine):
    original = engine._build_skill_fill_engine
    if getattr(original, '_astra_demo_match', False):
        return

    def factory(context):
        if context.processor_id == 'survey-measurement-v1' and demo_settings.enabled('matchPreset'):
            engine._require_skill_capability(context, 'pricing')
            return DemoFillEngine(original, context)
        return original(context)

    factory._astra_demo_match = True
    engine._build_skill_fill_engine = factory

    original_batch = engine._execute_batch_match
    @wraps(original_batch)
    def batch(*args, **kwargs):
        token = _batch_cache.set({})
        try:
            return original_batch(*args, **kwargs)
        finally:
            _batch_cache.reset(token)
    engine._execute_batch_match = batch

    original_recalculate = engine.recalculate_workbook
    @wraps(original_recalculate)
    def recalculate(path):
        cache = _batch_cache.get()
        expected = cache.pop(str(Path(path).resolve()), None) if cache is not None else None
        # A one-use grant only inside this exact batch; edits and later requests
        # always use real Excel, even when their workbook happens to look alike.
        if expected and hashlib.sha256(Path(path).read_bytes()).hexdigest() == expected:
            return True
        return original_recalculate(path)
    engine.recalculate_workbook = recalculate

    def known_source(raw):
        known = raw.get('matching_source') == 'demo_standard_answer' and raw.get('demo_input_sha256') == SAMPLE_SHA256
        logs = raw.get('price_logs') or []
        legacy = str(raw.get('report_text') or '').startswith(LABEL + '。') and bool(logs) and all(str(line).startswith('[演示标准答案快照] ') for line in logs)
        return known or legacy

    # Restore provenance lost by the former summary loader without rewriting old files.
    original_state = getattr(engine, '_load_process_state', None)
    if original_state is not None:
        @wraps(original_state)
        def load_state(*args, **kwargs):
            state = original_state(*args, **kwargs)
            raw = state.get('summary') or {}
            if known_source(raw) and not raw.get('matching_source'):
                state = {**state, 'summary': {**raw, 'matching_source': 'demo_standard_answer',
                    'matching_source_label': LABEL, 'generated_by_model': False,
                    'demo_answer_version': '1.0.0', 'demo_input_sha256': SAMPLE_SHA256}}
            return state
        engine._load_process_state = load_state

    original_summary = engine._summary_from_dict
    @wraps(original_summary)
    def restore_summary(raw):
        summary = original_summary(raw)
        if known_source(raw):
            restored = DemoSummary(**{f.name: getattr(summary, f.name) for f in fields(FillSummary)})
            restored._demo_answer_version = raw.get('demo_answer_version') or '1.0.0'
            return restored
        return summary
    engine._summary_from_dict = restore_summary
