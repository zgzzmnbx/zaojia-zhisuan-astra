from __future__ import annotations

import importlib.util
import json
import shutil
import tarfile
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / "tools" / "build_cloud_release.py"
SPEC = importlib.util.spec_from_file_location("build_cloud_release", SCRIPT_PATH)
assert SPEC and SPEC.loader
build_cloud_release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build_cloud_release)


def create_project(tmp_path: Path) -> Path:
    project_root = tmp_path / "project"
    files = {
        "backend/app/main.py": 'APP_VERSION = "v1.2.3"',
        "backend/requirements-runtime.txt": "fastapi\n",
        "backend/feishu_bot_runner.py": "print('runner')\n",
        "backend/feishu_bot_supervisor.py": "print('supervisor')\n",
        "frontend/dist/index.html": (
            '<script src="/assets/app.js"></script>'
            '<link href="/assets/app.css" rel="stylesheet">'
        ),
        "frontend/dist/assets/app.js": 'const version = "v1.2.3";',
        "frontend/dist/assets/app.css": "body{}",
        "config/project-default-settings.json": "{}",
        "config/knowledge-qa-libraries.json": json.dumps(
            {
                "libraries": [
                    {
                        "kind": "static",
                        "paths": ["06-知识库问答资料/造价资料"],
                    }
                ]
            },
            ensure_ascii=False,
        ),
        "deploy/install_cloud_runtime_guard.sh": "#!/bin/sh\n",
        "tools/check_feishu_deployment.py": "print('ok')\n",
        "tools/deploy_cloud_release.py": "print('deploy')\n",
        "README.md": "# README\n",
        "AGENTS.md": "# AGENTS\n",
        "CHANGELOG.md": "# CHANGELOG\n",
        ".env.local.example": "DEEPSEEK_API_KEY=\n",
        "assets/知识库.xlsx": "xlsx",
        "06-知识库问答资料/造价资料/资料.md": "# 资料\n",
        "06-知识库问答资料/造价知识文章库/manifest.json": json.dumps(
            {"article_count": 0, "articles": [], "relationships": []}, ensure_ascii=False
        ),
        "05-经验池-预警数据/【经验池】【模板勿动】-管勘智算.xlsx": "xlsx",
        "05-经验池-预警数据/experience-field-preferences-【codex】.json": "{}",
        "03-【匹配规则】-勘察测绘知识库-匹配规则提炼/【术语归并】术语归并与匹配放宽规则表.xlsx": "xlsx",
    }
    for relative, content in files.items():
        path = project_root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    shutil.copy2(
        ROOT / "tools/check_cloud_release.py",
        project_root / "tools/check_cloud_release.py",
    )
    manifest_path = (
        project_root
        / "business-skills/survey-measurement-limit-price/manifest.json"
    )
    manifest_path.parent.mkdir(parents=True)
    manifest_path.write_text(
        json.dumps(
            {
                "id": "survey-measurement-limit-price",
                "status": "active",
                "assets": {"knowledgeBase": "assets/知识库.xlsx"},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return project_root


def test_assemble_release_preserves_frontend_assets_and_copies_declared_sources(
    tmp_path: Path,
) -> None:
    project_root = create_project(tmp_path)
    release_root = tmp_path / "output/release"

    build_cloud_release.assemble_release(project_root, release_root)

    assert (release_root / "frontend/dist/assets/app.js").is_file()
    assert (release_root / "assets/知识库.xlsx").is_file()
    assert (release_root / "06-知识库问答资料/造价资料/资料.md").is_file()
    assert (release_root / "tools/check_cloud_release.py").is_file()
    assert (release_root / "tools/deploy_cloud_release.py").is_file()
    assert not (release_root / ".env.local").exists()


def test_validate_frontend_assets_reports_flattened_asset_directory(
    tmp_path: Path,
) -> None:
    release_root = tmp_path / "release"
    (release_root / "frontend/dist").mkdir(parents=True)
    (release_root / "frontend/dist/index.html").write_text(
        '<script src="/assets/app.js"></script>',
        encoding="utf-8",
    )
    (release_root / "frontend/dist/app.js").write_text("broken", encoding="utf-8")

    assert build_cloud_release.validate_frontend_assets(release_root) == [
        "首页引用资源不存在：/assets/app.js"
    ]


def test_forbidden_release_paths_detects_secrets_runtime_and_logs(tmp_path: Path) -> None:
    release_root = tmp_path / "release"
    forbidden = (
        release_root / ".env.local",
        release_root / ".env.production",
        release_root / "Codex-Temp/runtime/knowledge-memory.sqlite3",
        release_root / "backend/service.log",
    )
    for path in forbidden:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("secret", encoding="utf-8")

    assert build_cloud_release.forbidden_release_paths(release_root) == [
        ".env.local",
        ".env.production",
        "Codex-Temp/runtime/knowledge-memory.sqlite3",
        "backend/service.log",
    ]


def test_create_utf8_archive_keeps_chinese_paths_and_returns_sha256(
    tmp_path: Path,
) -> None:
    release_root = tmp_path / "release"
    source = release_root / "资料/规则说明.md"
    source.parent.mkdir(parents=True)
    source.write_text("规则", encoding="utf-8")
    archive_path = tmp_path / "release.tar.gz"

    sha256 = build_cloud_release.create_utf8_archive(release_root, archive_path)

    assert len(sha256) == 64
    with tarfile.open(archive_path, "r:gz") as archive:
        assert "资料/规则说明.md" in archive.getnames()


def test_assemble_release_refuses_existing_output(tmp_path: Path) -> None:
    project_root = create_project(tmp_path)
    release_root = tmp_path / "output/release"
    release_root.mkdir(parents=True)

    with pytest.raises(FileExistsError, match="拒绝覆盖"):
        build_cloud_release.assemble_release(project_root, release_root)
