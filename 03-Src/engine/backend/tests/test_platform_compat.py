import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / "tools" / "check_platform_compat.py"


def load_platform_module():
    spec = importlib.util.spec_from_file_location("check_platform_compat", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_platform_check_env_local_archive_rule():
    module = load_platform_module()
    findings = module.check_env_excluded(ROOT)
    assert not [item for item in findings if item.level == "FAIL"]


def test_platform_check_required_paths_reports_missing(tmp_path):
    module = load_platform_module()
    findings = module.check_required_paths(tmp_path)
    codes = {item.code for item in findings}
    assert "MISSING_REQUIRED_PATH" in codes
