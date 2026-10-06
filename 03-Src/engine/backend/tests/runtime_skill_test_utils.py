from __future__ import annotations

import json
import shutil
from pathlib import Path

from app.paths import PROJECT_ROOT
from app.professional_skills import ProfessionalSkillRegistry


ACTIVE_SKILL_ID = "survey-measurement-limit-price"


def make_runtime_registry(
    tmp_path: Path,
    knowledge_base_path: Path,
    *,
    experience_pool_path: Path | None = None,
    warning_settings_path: Path | None = None,
) -> ProfessionalSkillRegistry:
    project_root = tmp_path / "skill-runtime-project"
    asset_dir = project_root / "assets"
    asset_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(knowledge_base_path, asset_dir / "kb.xlsx")
    shutil.copy2(
        experience_pool_path or PROJECT_ROOT / "05-经验池-预警数据/【经验池】-管勘智算-【codex】.xlsx",
        asset_dir / "pool.xlsx",
    )
    if warning_settings_path:
        shutil.copy2(warning_settings_path, asset_dir / "warning-settings.json")
    else:
        (asset_dir / "warning-settings.json").write_text("{}", encoding="utf-8")
    shutil.copy2(PROJECT_ROOT / "backend/app/rules/technical_fee_rules.xlsx", asset_dir / "technical.xlsx")
    shutil.copy2(PROJECT_ROOT / "backend/app/rules/physical_factor_rules.xlsx", asset_dir / "physical.xlsx")
    shutil.copy2(PROJECT_ROOT / "backend/app/rules/physical_factor_overrides.xlsx", asset_dir / "overrides.xlsx")
    shutil.copy2(
        PROJECT_ROOT / "03-知识库-二维数据库制作/01-报告模板-招标控制价报告模板/【模板勿动】控制价报告模板-yyyy-mm-dd.docx",
        asset_dir / "template.docx",
    )
    shutil.copy2(knowledge_base_path, asset_dir / "sample.xlsx")
    (asset_dir / "knowledge.md").write_text("# 测试专业知识\n\n测试运行时依据。\n", encoding="utf-8")

    manifest = {
        "id": ACTIVE_SKILL_ID,
        "displayName": "勘察测量最高投标限价编制",
        "version": "1.0.0",
        "status": "active",
        "domain": "测试",
        "description": "测试运行时专业能力",
        "inputProfile": {"extensions": [".xlsx"], "templateHints": []},
        "capabilities": {
            "pricing": True,
            "workloadCapture": True,
            "experienceWarning": True,
            "knowledgeQa": True,
            "wordReport": True,
        },
        "assets": {
            "knowledgeBase": "assets/kb.xlsx",
            "reportTemplate": "assets/template.docx",
            "technicalRules": "assets/technical.xlsx",
            "physicalRules": "assets/physical.xlsx",
            "physicalOverrides": "assets/overrides.xlsx",
            "experiencePool": "assets/pool.xlsx",
            "experienceWarningSettings": "assets/warning-settings.json",
            "knowledgeSources": "assets/knowledge.md",
            "validationSample": "assets/sample.xlsx",
        },
        "runtime": {
            "processorId": "survey-measurement-v1",
            "knowledgeBaseAsset": "knowledgeBase",
            "ruleAssets": {
                "technicalRules": "technicalRules",
                "physicalRules": "physicalRules",
                "physicalOverrides": "physicalOverrides",
            },
            "riskProfile": {
                "experiencePool": "experiencePool",
                "warningSettings": "experienceWarningSettings",
            },
            "knowledgeSourceAssets": ["knowledgeSources"],
            "reportTemplateAsset": "reportTemplate",
            "validationAsset": "validationSample",
        },
        "validation": {"status": "verified", "sample": "test", "updatedAt": "2026-07-22"},
    }
    manifest_path = project_root / "business-skills" / ACTIVE_SKILL_ID / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    settings_path = project_root / "config" / "project-default-settings.json"
    settings_path.parent.mkdir(parents=True, exist_ok=True)
    settings_path.write_text(
        json.dumps({"professionalSkills": {"defaultSkillId": ACTIVE_SKILL_ID}}, ensure_ascii=False),
        encoding="utf-8",
    )
    return ProfessionalSkillRegistry(project_root, project_root / "business-skills", settings_path)
