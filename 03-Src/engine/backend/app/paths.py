from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
TAURI_DIR = PROJECT_ROOT / "src-tauri"
KNOWLEDGE_BASE_DIR = PROJECT_ROOT / "03-知识库-二维数据库制作"
MATCHING_RULES_DIR = PROJECT_ROOT / "03-【匹配规则】-勘察测绘知识库-匹配规则提炼"
EXPERIENCE_POOL_DIR = PROJECT_ROOT / "05-经验池-预警数据"
TEMPLATE_DIR = KNOWLEDGE_BASE_DIR / "01-报告模板-招标控制价报告模板"
RUNTIME_DIR = PROJECT_ROOT / "Codex-Temp" / "runtime"
TEMP_DIR = PROJECT_ROOT / "Codex-Temp"
CONFIG_DIR = PROJECT_ROOT / "config"
BUSINESS_SKILLS_DIR = PROJECT_ROOT / "business-skills"

DEFAULT_KB_PATH = KNOWLEDGE_BASE_DIR / "【数据库】【导入】.xlsx"
LEGACY_EXPERIENCE_POOL_PATH = KNOWLEDGE_BASE_DIR / "【数据库】【经验池】-管勘智算-【codex】.xlsx"
DEFAULT_EXPERIENCE_POOL_PATH = EXPERIENCE_POOL_DIR / "【经验池】-管勘智算-【codex】.xlsx"
DEFAULT_EXPERIENCE_POOL_TEMPLATE_PATH = EXPERIENCE_POOL_DIR / "【经验池】【模板勿动】-管勘智算.xlsx"
DEFAULT_INPUT_FIELD_PREFERENCES_PATH = KNOWLEDGE_BASE_DIR / "input-field-preferences-【codex】.json"
DEFAULT_EXPERIENCE_FIELD_PREFERENCES_PATH = EXPERIENCE_POOL_DIR / "experience-field-preferences-【codex】.json"
DEFAULT_EXPERIENCE_WARNING_SETTINGS_PATH = EXPERIENCE_POOL_DIR / "experience-warning-settings-【codex】.json"
DEFAULT_WORKLOAD_FIELD_PREFERENCES_PATH = EXPERIENCE_POOL_DIR / "workload-field-preferences-【codex】.json"
DEFAULT_WORKLOAD_TARGET_FIELD_PREFERENCES_PATH = EXPERIENCE_POOL_DIR / "workload-target-field-preferences-【codex】.json"
DEFAULT_UI_PREFERENCES_PATH = RUNTIME_DIR / "ui-preferences-【codex】.json"
DEFAULT_PREVIEW_COLUMN_PREFERENCES_PATH = RUNTIME_DIR / "preview-column-preferences.json"
PROJECT_DEFAULT_SETTINGS_PATH = CONFIG_DIR / "project-default-settings.json"
DEFAULT_KNOWLEDGE_QA_INDEX_PATH = RUNTIME_DIR / "knowledge-qa-index-【codex】.json"
DEFAULT_KNOWLEDGE_HYBRID_INDEX_PATH = RUNTIME_DIR / "knowledge-qa-index-hybrid-【codex】.json"
DEFAULT_KNOWLEDGE_MEMORY_DB_PATH = RUNTIME_DIR / "knowledge-memory.sqlite3"
DEFAULT_PROJECT_LEDGER_DB_PATH = RUNTIME_DIR / "project-ledger.sqlite3"
DEFAULT_BUSINESS_TASK_DB_PATH = RUNTIME_DIR / "business-tasks.sqlite3"
DEFAULT_LLM_USAGE_DB_PATH = RUNTIME_DIR / "llm-usage-ledger.sqlite3"
DEFAULT_REPORT_TEMPLATE_PATH = TEMPLATE_DIR / "【模板勿动】控制价报告模板-yyyy-mm-dd.docx"
DEFAULT_WORKLOAD_TERM_RULES_PATH = MATCHING_RULES_DIR / "【术语归并】术语归并与匹配放宽规则表.xlsx"
ENV_LOCAL_PATH = PROJECT_ROOT / ".env.local"


def resolve_project_path(*parts: str | Path) -> Path:
    return PROJECT_ROOT.joinpath(*parts)
