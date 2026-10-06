import sys
from pathlib import Path

import pytest


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture(autouse=True)
def isolate_process_runtime(tmp_path, monkeypatch):
    """Keep API-generated process artifacts out of the real local runtime."""
    from app import main as main_module

    monkeypatch.setattr(main_module, "RUNTIME_DIR", tmp_path / "runtime")
