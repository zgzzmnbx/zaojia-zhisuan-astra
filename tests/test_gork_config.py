import asyncio
import json
from pathlib import Path
import sys

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
import gork_config as c


def test_defaults_are_off_and_event_variants_are_real():
    s = c.Settings()
    assert not s.enabled and not s.sound and s.speech_target == 'current'
    assert c.stage_key({'stage': 'warning_result', 'status': 'completed'}) == 'warning_completed'
    assert c.stage_key({'stage': 'warning_result', 'status': 'completed', 'warning_rows': 2}) == 'warning_found'
    assert c.stage_key({'stage': 'match_result', 'status': 'failed'}) == 'match_failed'
    assert c.stage_key({'stage': 'restored'}) is None
    assert s.heartbeat_ms == 10000 and s.lease_ms == 30000


def test_revision_protects_settings_and_corrupt_file_fails_closed(tmp_path, monkeypatch):
    monkeypatch.setattr(c, 'CONFIG', tmp_path / 'settings.json')
    monkeypatch.setattr(c, 'bridge', None)
    async def exercise():
        original = c.Settings()
        response = await c.save_settings(original)
        assert response['settings']['revision'] == 1
        with pytest.raises(HTTPException) as error:
            await c.save_settings(c.Settings())
        assert error.value.status_code == 409
        with pytest.raises(HTTPException):
            await c.save_settings(c.Settings(revision=1, enabled=True))
        assert not c.load().enabled
    asyncio.run(exercise())
    c.CONFIG.write_text('{broken', encoding='utf-8')
    with pytest.raises(HTTPException):
        c.load()


@pytest.mark.parametrize('patch', [{'heartbeat_ms': 20000}, {'enabled': 'true'}, {'stages': {}}, {'token_file': 'bad\npath'}])
def test_invalid_preferences_rejected(patch):
    with pytest.raises(ValidationError):
        c.Settings(**patch)


def test_templates_cannot_evaluate_objects_or_drop_amount_caveat():
    with pytest.raises(ValidationError):
        c.Stage(expression='happy', text='{task.__class__}', duration_ms=2000)
    stage = c.Stage(expression='happy', text='说明' * 145 + '{amount}', duration_ms=2000)
    event = {'stage': 'match_result', 'status': 'completed', 'attempt': 'new',
             'amount_summary': {'attempt': 'new', 'value': '9447173.00', 'currency': 'CNY',
             'unit': 'yuan', 'basis': 'tax_included', 'calculation_status': 'unconfirmed'}}
    text = c.render_text(event, stage)
    assert len(text) <= 300 and text.endswith('表内含税总额9447173元。公式重算未确认。')
    speech = c.render_text(event, stage, spoken=True)
    assert len(speech) <= 300 and speech.endswith('表内含税总额944.7173万元。公式重算未确认。')
    stage.text = '匹配完成。'
    assert '公式重算未确认' in c.render_text(event, stage)
    assert c.render_text(event, stage, spoken=True) == '匹配完成。 表内含税总额944.7173万元。公式重算未确认。'
    stage.text = '{warnings}'
    assert c.render_text({}, stage) == '请查看结果。'


def test_token_is_source_scoped_and_never_returned(tmp_path):
    p = tmp_path / 'private.json'
    p.write_text(json.dumps({'source': 'astra', 'protocol_version': '1.0', 'token': 'x' * 43}), encoding='utf-8')
    assert c.token(c.Settings(token_file=str(p))) == 'x' * 43
    p.write_text(json.dumps({'source': 'other', 'protocol_version': '1.0', 'token': 'x' * 43}), encoding='utf-8')
    with pytest.raises(HTTPException) as error:
        c.token(c.Settings(token_file=str(p)))
    assert 'xxxxx' not in str(error.value.detail)
