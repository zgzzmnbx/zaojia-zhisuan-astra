"""Initialize Excel COM on the calling thread without changing engine calculations."""
from functools import wraps


def install(engine):
    original = engine.recalculate_workbook

    @wraps(original)
    def recalculate(path):
        try:
            import pythoncom
            pythoncom.CoInitialize()
        except (ImportError, OSError):
            return False
        try:
            return original(path)
        finally:
            pythoncom.CoUninitialize()

    engine.recalculate_workbook = recalculate
