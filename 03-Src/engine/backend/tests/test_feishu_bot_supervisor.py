import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / "backend" / "feishu_bot_supervisor.py"


def load_supervisor_module():
    spec = importlib.util.spec_from_file_location("feishu_bot_supervisor", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_reconcile_enabled_profiles_delegates_to_shared_starter(monkeypatch):
    module = load_supervisor_module()
    expected = {"default": True, "weact_cost": False}
    monkeypatch.setattr(module, "credential_profiles", lambda: [])
    monkeypatch.setattr(module, "start_enabled_bot_processes", lambda: expected)

    assert module.reconcile_enabled_profiles() == expected


def test_recovery_covers_missing_health_and_stalled_connect_but_not_network_outage():
    module = load_supervisor_module()
    assert not module.recovery_reason({}, started_at=950, now=1000)
    assert module.recovery_reason({}, started_at=100, now=1000)
    assert module.recovery_reason({"updated_at": 999, "connected": False, "connect_attempt_at": 500}, started_at=100, now=1000)
    assert not module.recovery_reason({"updated_at": 999, "connected": False, "connect_attempt_at": 999}, started_at=100, now=1000)
    assert not module.recovery_reason({"updated_at": 999, "connected": True, "loop_tick": 999, "backend_ok": False}, started_at=100, now=1000)
    assert module.recovery_reason({"updated_at": 999, "connected": True, "loop_tick": 500}, started_at=100, now=1000)


def test_guard_restarts_only_stalled_enabled_profile(tmp_path, monkeypatch):
    module = load_supervisor_module()
    monkeypatch.setattr(module, "credential_profiles", lambda: [{"profile_id": p} for p in ("default", "weact_cost")])
    monkeypatch.setattr(module, "is_bot_enabled", lambda p: p == "default")
    monkeypatch.setattr(module, "bot_process_running", lambda p: True)
    monkeypatch.setattr(module, "read_bot_health", lambda p: {})
    pid = tmp_path / "runner.pid"
    pid.write_text("99999")
    monkeypatch.setattr(module, "bot_pid_path", lambda p: pid)
    monkeypatch.setattr(module.time, "time", lambda: pid.stat().st_mtime + 200)
    calls = []
    monkeypatch.setattr(module, "append_runtime_event", lambda *a, **k: None)
    monkeypatch.setattr(module, "stop_profile_process", lambda p: calls.append(p))
    monkeypatch.setattr(module, "start_enabled_bot_processes", lambda: {})
    module.reconcile_enabled_profiles()
    assert calls == ["default"]
