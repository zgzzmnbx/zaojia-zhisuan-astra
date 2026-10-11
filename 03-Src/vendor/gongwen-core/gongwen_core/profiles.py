import json
from importlib.resources import files
from .models import FormatError
from .specifications import describe_profile


CURRENT_PROFILE_VERSIONS = {"official_body": "1.4.0", "zaojia_report": "1.1.0"}


def get_profile(profile_id="official_body", version=None):
    if profile_id not in CURRENT_PROFILE_VERSIONS:
        raise FormatError("UNKNOWN_PROFILE", "所选模板或版本不存在。")
    version = version or CURRENT_PROFILE_VERSIONS[profile_id]
    if version not in {"1.0.0", "1.1.0", "1.2.0", "1.3.0", CURRENT_PROFILE_VERSIONS[profile_id]}:
        raise FormatError("UNKNOWN_PROFILE", "所选模板或版本不存在。")
    if version == CURRENT_PROFILE_VERSIONS[profile_id]:
        resource = files("gongwen_core").joinpath("profiles", profile_id + ".json")
    else:
        resource = files("gongwen_core").joinpath(
            "profiles", "archive", profile_id + "-" + version + ".json"
        )
    if not resource.is_file():
        raise FormatError("UNKNOWN_PROFILE", "所选模板尚未开放。")
    return json.loads(resource.read_text(encoding="utf-8"))


def list_profiles():
    profiles = [
        json.loads(p.read_text(encoding="utf-8"))
        for p in files("gongwen_core").joinpath("profiles").iterdir()
        if p.name.endswith(".json")
    ]
    return [{**p, "rule_groups": describe_profile(p)} for p in profiles]
