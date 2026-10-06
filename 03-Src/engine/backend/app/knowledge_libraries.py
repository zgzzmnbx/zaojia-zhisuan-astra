from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from .knowledge_qa import _discover_sources
from .paths import DEFAULT_KNOWLEDGE_QA_INDEX_PATH, PROJECT_ROOT


DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "knowledge-qa-libraries.json"
PROFESSIONAL_KNOWLEDGE_LIBRARY_ID = "project-core"
DEFAULT_LIBRARY_CONFIG: dict[str, Any] = {
    "schemaVersion": 1,
    "libraries": [
        {
            "id": "project-core",
            "name": "项目正式知识库",
            "description": "当前专业能力绑定的标准资料、项目规则、规则卡片和结构化计价依据。",
            "level": "第一层 · 项目正式依据",
            "kind": "static",
            "sourceMode": "professional-skill",
            "defaultSelected": True,
        },
        {
            "id": "cost-aiw",
            "name": "造价通用知识库",
            "description": "普通依据问答可选的造价资料问答资产；行级勘察测量复核不纳入。",
            "level": "第二层 · 造价通用资料",
            "kind": "static",
            "paths": ["06-知识库问答资料/造价AIW资料库"],
            "manifestFile": "manifest.json",
            "recursive": True,
            "extensions": [".md"],
            "excludeNames": ["知识资产清单.md"],
            "defaultSelected": False,
        },
        {
            "id": "knowledge-memory",
            "name": "已确认知识记忆",
            "description": "仅检索已确认且未失效的知识记忆。",
            "level": "第三层 · 已确认知识记忆",
            "kind": "memory",
            "defaultSelected": True,
        },
    ],
}


@dataclass(frozen=True)
class KnowledgeLibrary:
    id: str
    name: str
    description: str
    level: str
    kind: str
    default_selected: bool
    source_mode: str
    paths: tuple[str, ...]
    manifest_file: str
    recursive: bool
    extensions: tuple[str, ...]
    exclude_names: tuple[str, ...]


@dataclass(frozen=True)
class KnowledgeLibrarySelection:
    selected_ids: tuple[str, ...]
    static_library_ids: tuple[str, ...]
    memory_enabled: bool
    project_root: Path
    sources: tuple[Path, ...]
    index_path: Path | None
    source_library_ids: dict[str, str]
    libraries: tuple[KnowledgeLibrary, ...]

    def library_for_source(self, source_file: str) -> KnowledgeLibrary | None:
        normalized = source_file.replace("\\", "/").casefold()
        library_id = self.source_library_ids.get(normalized)
        if not library_id:
            return None
        return next((library for library in self.libraries if library.id == library_id), None)


def _string_list(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(str(item).strip() for item in value if str(item).strip())


def _parse_library(value: Any) -> KnowledgeLibrary | None:
    if not isinstance(value, dict):
        return None
    library_id = str(value.get("id") or "").strip()
    name = str(value.get("name") or "").strip()
    kind = str(value.get("kind") or "static").strip().lower()
    if not library_id or not name or kind not in {"static", "memory"}:
        return None
    extensions = tuple(
        extension.lower() if extension.startswith(".") else f".{extension.lower()}"
        for extension in _string_list(value.get("extensions"))
    )
    return KnowledgeLibrary(
        id=library_id,
        name=name,
        description=str(value.get("description") or "").strip(),
        level=str(value.get("level") or "").strip(),
        kind=kind,
        default_selected=bool(value.get("defaultSelected", False)),
        source_mode=str(value.get("sourceMode") or "").strip(),
        paths=_string_list(value.get("paths")),
        manifest_file=str(value.get("manifestFile") or "").strip(),
        recursive=bool(value.get("recursive", False)),
        extensions=extensions or (".md", ".xlsx", ".csv"),
        exclude_names=_string_list(value.get("excludeNames")),
    )


def load_knowledge_libraries(config_path: Path = DEFAULT_CONFIG_PATH) -> tuple[KnowledgeLibrary, ...]:
    payload: dict[str, Any] = DEFAULT_LIBRARY_CONFIG
    try:
        loaded = json.loads(config_path.read_text(encoding="utf-8"))
        if isinstance(loaded, dict) and isinstance(loaded.get("libraries"), list):
            payload = loaded
    except (OSError, TypeError, ValueError):
        pass
    libraries = tuple(
        library
        for item in payload.get("libraries", [])
        if (library := _parse_library(item)) is not None
    )
    return libraries or tuple(
        library
        for item in DEFAULT_LIBRARY_CONFIG["libraries"]
        if (library := _parse_library(item)) is not None
    )


def parse_requested_library_ids(value: Any) -> tuple[str, ...] | None:
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValueError("library_ids 必须是知识库 id 数组")
    seen: set[str] = set()
    parsed: list[str] = []
    for item in value:
        library_id = str(item or "").strip()
        if library_id and library_id not in seen:
            parsed.append(library_id)
            seen.add(library_id)
    return tuple(parsed)


def _safe_project_path(project_root: Path, relative_path: str) -> Path | None:
    candidate = Path(relative_path)
    if candidate.is_absolute():
        return None
    resolved_root = project_root.resolve()
    resolved = (resolved_root / candidate).resolve()
    try:
        resolved.relative_to(resolved_root)
    except ValueError:
        return None
    return resolved


def _configured_sources(library: KnowledgeLibrary, project_root: Path) -> list[Path]:
    sources: list[Path] = []
    excluded = {name.casefold() for name in library.exclude_names}
    for relative_path in library.paths:
        target = _safe_project_path(project_root, relative_path)
        if target is None or not target.exists():
            continue
        candidates: Iterable[Path]
        if target.is_file():
            candidates = (target,)
        elif library.manifest_file:
            candidates = _manifest_sources(target, library.manifest_file)
        elif library.recursive:
            candidates = target.rglob("*")
        else:
            candidates = target.glob("*")
        for candidate in candidates:
            if (
                candidate.is_file()
                and candidate.suffix.lower() in library.extensions
                and candidate.name.casefold() not in excluded
                and not candidate.name.startswith("~$")
            ):
                sources.append(candidate)
    return sources


def _manifest_sources(target: Path, manifest_file: str) -> tuple[Path, ...]:
    manifest_path = target / manifest_file
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, TypeError, ValueError):
        return ()
    assets = payload.get("assets") if isinstance(payload, dict) else None
    if not isinstance(assets, list):
        return ()
    resolved_target = target.resolve()
    sources: list[Path] = []
    for item in assets:
        if not isinstance(item, dict) or item.get("status") != "ready":
            continue
        output_name = str(item.get("output_name") or "").strip()
        if not output_name:
            continue
        candidate = (resolved_target / output_name).resolve()
        try:
            candidate.relative_to(resolved_target)
        except ValueError:
            continue
        if candidate.is_file():
            sources.append(candidate)
    return tuple(sources)


def _relative_key(path: Path, project_root: Path) -> str:
    try:
        relative = path.resolve().relative_to(project_root.resolve())
        return relative.as_posix().casefold()
    except ValueError:
        return str(path.resolve()).replace("\\", "/").casefold()


def _deduplicate_paths(paths: Iterable[Path]) -> tuple[Path, ...]:
    seen: set[Path] = set()
    unique: list[Path] = []
    for path in paths:
        resolved = path.resolve()
        if resolved not in seen and resolved.exists():
            unique.append(path)
            seen.add(resolved)
    return tuple(unique)


def _selection_index_path(base_index_path: Path | None, static_ids: tuple[str, ...]) -> Path | None:
    if not static_ids:
        return None
    base = base_index_path or DEFAULT_KNOWLEDGE_QA_INDEX_PATH
    signature = hashlib.sha256("|".join(static_ids).encode("utf-8")).hexdigest()[:12]
    return base.with_name(f"{base.stem}-{signature}{base.suffix}")


def resolve_knowledge_library_selection(
    requested_ids: tuple[str, ...] | None,
    *,
    project_root: Path = PROJECT_ROOT,
    base_sources: Iterable[Path] | None = None,
    base_index_path: Path | None = DEFAULT_KNOWLEDGE_QA_INDEX_PATH,
    config_path: Path = DEFAULT_CONFIG_PATH,
) -> KnowledgeLibrarySelection:
    libraries = load_knowledge_libraries(config_path)
    known_ids = {library.id for library in libraries}
    selected_ids = (
        tuple(library.id for library in libraries if library.default_selected)
        if requested_ids is None
        else tuple(library_id for library_id in requested_ids if library_id in known_ids)
    )
    selected_set = set(selected_ids)
    static_library_ids = tuple(
        library.id
        for library in libraries
        if library.id in selected_set and library.kind == "static"
    )
    source_library_ids: dict[str, str] = {}
    collected_sources: list[Path] = []
    for library in libraries:
        if library.id not in selected_set or library.kind != "static":
            continue
        if library.source_mode == "professional-skill":
            library_sources = list(base_sources) if base_sources is not None else _discover_sources(project_root)
        else:
            library_sources = _configured_sources(library, project_root)
        for source in library_sources:
            key = _relative_key(source, project_root)
            source_library_ids.setdefault(key, library.id)
            collected_sources.append(source)
    sources = _deduplicate_paths(collected_sources)
    return KnowledgeLibrarySelection(
        selected_ids=selected_ids,
        static_library_ids=static_library_ids,
        memory_enabled=any(
            library.id in selected_set and library.kind == "memory"
            for library in libraries
        ),
        project_root=project_root,
        sources=sources,
        index_path=_selection_index_path(base_index_path, static_library_ids),
        source_library_ids=source_library_ids,
        libraries=libraries,
    )


def knowledge_library_catalog(
    *,
    project_root: Path = PROJECT_ROOT,
    base_sources: Iterable[Path] | None = None,
    config_path: Path = DEFAULT_CONFIG_PATH,
) -> dict[str, object]:
    libraries = load_knowledge_libraries(config_path)
    items: list[dict[str, object]] = []
    for library in libraries:
        if library.kind == "memory":
            source_count = None
            available = True
        elif library.source_mode == "professional-skill":
            sources = list(base_sources) if base_sources is not None else _discover_sources(project_root)
            source_count = len(_deduplicate_paths(sources))
            available = source_count > 0
        else:
            sources = _configured_sources(library, project_root)
            source_count = len(_deduplicate_paths(sources))
            available = source_count > 0
        items.append(
            {
                "id": library.id,
                "name": library.name,
                "description": library.description,
                "level": library.level,
                "kind": library.kind,
                "default_selected": library.default_selected,
                "available": available,
                "source_count": source_count,
            }
        )
    return {
        "schema_version": 1,
        "libraries": items,
        "default_library_ids": [
            library.id for library in libraries if library.default_selected
        ],
    }
