from __future__ import annotations

import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / "tools" / "check_cloud_release.py"
SPEC = importlib.util.spec_from_file_location("check_cloud_release", SCRIPT_PATH)
assert SPEC and SPEC.loader
check_cloud_release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(check_cloud_release)


def _create_release_root(tmp_path: Path, asset_path: str = "assets/knowledge.xlsx") -> Path:
    release_root = tmp_path / "release"
    for required_path in check_cloud_release.REQUIRED_CLOUD_PATHS:
        target = release_root / required_path
        if required_path.suffix:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("release fixture", encoding="utf-8")
        else:
            target.mkdir(parents=True, exist_ok=True)

    manifest_path = release_root / "business-skills" / "survey-measurement-limit-price" / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(
            {
                "id": "survey-measurement-limit-price",
                "status": "active",
                "assets": {
                    "knowledgeBase": asset_path,
                    "knowledgeSources": ["assets/source-notes"],
                },
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (release_root / "assets").mkdir(exist_ok=True)
    (release_root / "assets" / "knowledge.xlsx").write_bytes(b"xlsx")
    (release_root / "assets" / "source-notes").mkdir()
    (release_root / "assets" / "source-notes" / "rule.md").write_text("rule", encoding="utf-8")
    return release_root


def test_collect_release_errors_accepts_complete_skill_assets(tmp_path: Path) -> None:
    release_root = _create_release_root(tmp_path)

    assert check_cloud_release.collect_release_errors(release_root) == []


def test_collect_release_errors_reports_missing_skill_asset(tmp_path: Path) -> None:
    release_root = _create_release_root(tmp_path, asset_path="assets/missing.xlsx")

    errors = check_cloud_release.collect_release_errors(release_root)

    assert errors == [
        "专业能力资产未随云端包发布："
        "business-skills/survey-measurement-limit-price/manifest.json"
        " -> knowledgeBase -> assets/missing.xlsx"
    ]


def test_collect_release_errors_rejects_asset_outside_release_root(tmp_path: Path) -> None:
    release_root = _create_release_root(tmp_path, asset_path="../secret.xlsx")

    errors = check_cloud_release.collect_release_errors(release_root)

    assert errors == [
        "专业能力资产引用超出发布根目录："
        "business-skills/survey-measurement-limit-price/manifest.json"
        " -> knowledgeBase -> ../secret.xlsx"
    ]
