import sys
from types import SimpleNamespace

import pytest

from excel_recalculation import install


@pytest.mark.parametrize('outcome', [True, False, RuntimeError('failed')])
def test_com_is_balanced_on_success_failure_and_exception(monkeypatch, outcome):
    calls = []
    monkeypatch.setitem(sys.modules, 'pythoncom', SimpleNamespace(
        CoInitialize=lambda: calls.append('initialize'),
        CoUninitialize=lambda: calls.append('release')))

    def original(path):
        calls.append(path)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    engine = SimpleNamespace(recalculate_workbook=original)
    install(engine)
    if isinstance(outcome, Exception):
        with pytest.raises(RuntimeError):
            engine.recalculate_workbook('copy.xlsx')
    else:
        assert engine.recalculate_workbook('copy.xlsx') is outcome
    assert calls == ['initialize', 'copy.xlsx', 'release']


def test_unavailable_com_never_calls_engine(monkeypatch):
    monkeypatch.setitem(sys.modules, 'pythoncom', None)
    engine = SimpleNamespace(recalculate_workbook=lambda _: pytest.fail('COM unavailable'))
    install(engine)
    assert engine.recalculate_workbook('copy.xlsx') is False
