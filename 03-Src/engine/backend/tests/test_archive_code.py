import importlib.util
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / "tools" / "archive_code.py"


def load_archive_module():
    spec = importlib.util.spec_from_file_location("archive_code", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_archive_code_excludes_project_materials(tmp_path):
    project = tmp_path / "project"
    project.mkdir()
    for rel in [
        "backend/app/main.py",
        "frontend/src/App.tsx",
        "docs/superpowers/plans/plan.md",
        "docs/归档/Tauri-20260926/src-tauri/src/main.rs",
        "docs/归档/Tauri-20260926/src-tauri/target/release/desktop.exe",
        "deploy/systemd/feishu-api-base.conf",
        "00-比赛要求与目标/raw.docx",
        "01-weagent部分成果/old.zip",
        "03-知识库-二维数据库制作/db.xlsx",
        "03-【匹配规则】-勘察测绘知识库-匹配规则提炼/【重要匹配规则】项目以及总体匹配规则介绍.md",
        "07-汇报PPT 和 演示素材/demo.pptx",
        "frontend/node_modules/pkg/index.js",
        "frontend/dist/index.html",
        "frontend/tsconfig.tsbuildinfo",
        "frontend/vite.config.js",
        "frontend/vite.config.d.ts",
        "Codex-Temp/runtime/output.xlsx",
        ".env.local",
    ]:
        path = project / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("x", encoding="utf-8")
    for rel in [".gitignore", "AGENTS.md", "CHANGELOG.md", "README.md", "TASKS.md", "启动管勘智算-【codex】.bat"]:
        (project / rel).write_text("当前版本：`v9.99`", encoding="utf-8")

    module = load_archive_module()
    archive = module.create_archive(
        project_root=project,
        archive_dir=project / "04-输出版本存档",
        version="v9.99",
        date_text="2026-06-12",
        overwrite=True,
    )

    assert archive.name == "造价智算-2026-06-12-v9.99.zip"
    with zipfile.ZipFile(archive) as zf:
        names = set(zf.namelist())

    assert "backend/app/main.py" in names
    assert "frontend/src/App.tsx" in names
    assert "docs/superpowers/plans/plan.md" in names
    assert not any(name.startswith("docs/归档/Tauri-20260926/") for name in names)
    assert "deploy/systemd/feishu-api-base.conf" in names
    assert "TASKS.md" in names
    assert "03-【匹配规则】-勘察测绘知识库-匹配规则提炼/【重要匹配规则】项目以及总体匹配规则介绍.md" in names
    assert "ARCHIVE_MANIFEST.json" in names
    assert not any(name.startswith("00-比赛要求与目标/") for name in names)
    assert not any(name.startswith("01-weagent部分成果/") for name in names)
    assert not any(name.startswith("03-知识库-二维数据库制作/") for name in names)
    assert not any(name.startswith("07-汇报PPT 和 演示素材/") for name in names)
    assert not any(name.startswith("frontend/node_modules/") for name in names)
    assert not any(name.startswith("frontend/dist/") for name in names)
    assert "frontend/tsconfig.tsbuildinfo" not in names
    assert "frontend/vite.config.js" not in names
    assert "frontend/vite.config.d.ts" not in names
    assert not any(name.startswith("Codex-Temp/") for name in names)
    assert ".env.local" not in names
