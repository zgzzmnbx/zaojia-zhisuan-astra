import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / "tools" / "check_feishu_deployment.py"


def load_check_module():
    spec = importlib.util.spec_from_file_location("check_feishu_deployment", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_local_accepts_shared_default_without_override():
    module = load_check_module()

    assert module.validate_local(module.LOCAL_API_BASE_URL, "") == []


def test_local_rejects_cloud_override_leak():
    module = load_check_module()

    errors = module.validate_local(module.LOCAL_API_BASE_URL, module.CLOUD_API_BASE_URL)

    assert errors
    assert "不得指向云端端口" in errors[0]


def test_cloud_requires_both_service_overrides():
    module = load_check_module()
    service_values = {
        "zaojiazhisuan.service": module.CLOUD_API_BASE_URL,
        "zaojiazhisuan-feishu-bot.service": "",
    }

    errors = module.validate_cloud(module.LOCAL_API_BASE_URL, service_values)

    assert len(errors) == 1
    assert "zaojiazhisuan-feishu-bot.service" in errors[0]


def test_cloud_accepts_shared_default_and_two_explicit_overrides():
    module = load_check_module()
    service_values = {service: module.CLOUD_API_BASE_URL for service in module.CLOUD_SERVICES}

    assert module.validate_cloud(module.LOCAL_API_BASE_URL, service_values) == []


def test_parse_systemd_environment_value():
    module = load_check_module()

    value = module.parse_environment_value(
        "PYTHONUTF8=1 FEISHU_APP_BOT_API_BASE_URL=http://127.0.0.1:1285"
    )

    assert value == module.CLOUD_API_BASE_URL


def test_cloud_runtime_requires_running_bot_when_enabled():
    module = load_check_module()
    states = {service: "active" for service in module.CLOUD_SERVICES}

    errors = module.validate_cloud_runtime(states, {
        "profiles": [{
            "profile_id": "default",
            "label": "普通飞书",
            "enabled": True,
            "configured": True,
            "profile_consistent": True,
            "running": False,
        }],
        "running_profile_count": 0,
    })

    assert errors == ["普通飞书已启用，但等待 30 秒后仍未进入 running 状态"]


def test_cloud_runtime_allows_intentionally_disabled_bot():
    module = load_check_module()
    states = {
        "zaojiazhisuan.service": "active",
        "zaojiazhisuan-feishu-bot.service": "active",
    }

    errors = module.validate_cloud_runtime(states, {
        "profiles": [{
            "profile_id": "default",
            "label": "普通飞书",
            "enabled": False,
            "configured": True,
            "profile_consistent": True,
            "running": False,
        }],
        "running_profile_count": 0,
    })

    assert errors == []


def test_cloud_runtime_rejects_disabled_profile_that_is_still_running():
    module = load_check_module()
    states = {service: "active" for service in module.CLOUD_SERVICES}

    errors = module.validate_cloud_runtime(states, {
        "profiles": [{
            "profile_id": "weact_cost",
            "label": "企业 WeAct",
            "enabled": False,
            "configured": True,
            "profile_consistent": True,
            "running": True,
        }],
        "running_profile_count": 1,
    })

    assert errors == ["企业 WeAct已关闭，但运行器仍未退出"]


def test_cloud_runtime_requires_supervisor_even_when_both_profiles_are_disabled():
    module = load_check_module()
    states = {
        "zaojiazhisuan.service": "active",
        "zaojiazhisuan-feishu-bot.service": "inactive",
    }

    errors = module.validate_cloud_runtime(states, {
        "profiles": [
            {"profile_id": "default", "label": "普通飞书", "enabled": False, "running": False},
            {"profile_id": "weact_cost", "label": "企业 WeAct", "enabled": False, "running": False},
        ],
        "running_profile_count": 0,
    })

    assert errors == [
        "zaojiazhisuan-feishu-bot.service 双平台监督器当前状态不是 active：inactive"
    ]
