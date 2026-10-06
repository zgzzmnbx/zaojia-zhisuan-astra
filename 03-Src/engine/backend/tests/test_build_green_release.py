from __future__ import annotations

import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / "tools" / "build_green_release.py"
SPEC = importlib.util.spec_from_file_location("build_green_release", SCRIPT_PATH)
assert SPEC and SPEC.loader
build_green_release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build_green_release)


def test_copy_project_default_settings_uses_project_json(tmp_path):
    project_root = tmp_path / "project"
    release_root = tmp_path / "release"
    settings_path = project_root / build_green_release.PROJECT_DEFAULT_SETTINGS_RELATIVE_PATH
    settings_path.parent.mkdir(parents=True)
    settings_path.write_text(
        json.dumps(
            {
                "version": 1,
                "previewColumns": {
                    "defaultLabels": ["项目", "单位"],
                    "sheetOverrides": {"表2": ["项目"]},
                    "headerRows": {"表2": 3},
                    "maxDisplayChars": 12,
                    "columnWidths": {"表2": {"项目": 180}},
                },
                "zhisuanWindow": {"dockWidth": 400, "welcomeMessage": "项目欢迎语"},
                "inputMapping": {"headerRow": 4, "fieldPreferences": {"要素1": ["项目"]}},
                "workloadCapture": {"selectedFields": ["数量(信息抓取)"]},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    copied = build_green_release.copy_project_default_settings(project_root, release_root)

    assert copied is True
    copied_payload = json.loads((release_root / build_green_release.PROJECT_DEFAULT_SETTINGS_RELATIVE_PATH).read_text(encoding="utf-8"))
    assert copied_payload["previewColumns"]["headerRows"] == {"表2": 3}
    assert copied_payload["previewColumns"]["columnWidths"]["表2"]["项目"] == 180
    assert copied_payload["zhisuanWindow"]["dockWidth"] == 400
    assert copied_payload["zhisuanWindow"]["welcomeMessage"] == "项目欢迎语"
    assert copied_payload["inputMapping"]["headerRow"] == 4


def test_copy_project_default_settings_generates_release_default_when_missing(tmp_path):
    project_root = tmp_path / "project"
    release_root = tmp_path / "release"
    project_root.mkdir()

    copied = build_green_release.copy_project_default_settings(project_root, release_root)

    assert copied is False
    generated_payload = json.loads((release_root / build_green_release.PROJECT_DEFAULT_SETTINGS_RELATIVE_PATH).read_text(encoding="utf-8"))
    assert generated_payload["previewColumns"]["defaultLabels"][0] == "要素1"
    assert generated_payload["previewColumns"]["maxDisplayChars"] == 8
    assert generated_payload["zhisuanWindow"]["dockWidth"] == 400
    assert generated_payload["zhisuanWindow"]["_说明"]
    assert generated_payload["zhisuanWindow"]["quickSettings"]["customPrompts"] == ["#知识库："]
    assert generated_payload["inputMapping"]["headerRow"] == 4
    assert generated_payload["workloadCapture"]["writeMode"] == "conservative"
    assert generated_payload["professionalSkills"]["defaultSkillId"] == "survey-measurement-limit-price"


def test_copy_business_skills_is_shared_by_green_and_tauri_stage(tmp_path):
    project_root = tmp_path / "project"
    release_root = tmp_path / "release"
    manifest_path = project_root / "business-skills" / "survey-measurement-limit-price" / "manifest.json"
    manifest_path.parent.mkdir(parents=True)
    manifest_path.write_text('{"id":"survey-measurement-limit-price"}', encoding="utf-8")

    build_green_release.copy_business_skills(project_root, release_root)

    copied = release_root / "business-skills" / "survey-measurement-limit-price" / "manifest.json"
    assert copied.read_text(encoding="utf-8") == '{"id":"survey-measurement-limit-price"}'


def test_copy_declared_active_skill_assets_includes_files_and_directories(tmp_path):
    project_root = tmp_path / "project"
    release_root = tmp_path / "release"
    skill_root = project_root / "business-skills" / "demo"
    skill_root.mkdir(parents=True)
    (skill_root / "manifest.json").write_text(
        json.dumps(
            {
                "id": "demo",
                "status": "active",
                "assets": {
                    "rule": "assets/rule.xlsx",
                    "sourceDir": "assets/source-docs",
                },
            }
        ),
        encoding="utf-8",
    )
    (project_root / "assets" / "source-docs").mkdir(parents=True)
    (project_root / "assets" / "source-docs" / "guide.md").write_text("guide", encoding="utf-8")
    (project_root / "assets" / "rule.xlsx").write_bytes(b"rule")

    build_green_release.copy_declared_skill_assets(project_root, release_root)

    assert (release_root / "assets" / "rule.xlsx").read_bytes() == b"rule"
    assert (release_root / "assets" / "source-docs" / "guide.md").read_text(encoding="utf-8") == "guide"
