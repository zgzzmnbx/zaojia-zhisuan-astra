"""Read-only service for the isolated cost article library.

This module deliberately does not import the existing RAG index, structured price
database, memory store, or any article body during application startup.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import APIRouter, HTTPException


ARTICLE_LIBRARY_ROOT = Path(__file__).resolve().parents[2] / "06-知识库问答资料" / "造价知识文章库"
MANIFEST_PATH = ARTICLE_LIBRARY_ROOT / "manifest.json"
ARTICLE_ID_PATTERN = re.compile(r"^cost-\d{3}$")
DANGEROUS_MARKUP_PATTERN = re.compile(
    r"<\s*(?:script|style|iframe|object|embed|svg|img|video|audio|form)\b|\bon\w+\s*=|\b(?:javascript|data|vbscript):",
    re.IGNORECASE,
)
RAW_HTML_PATTERN = re.compile(r"<[^>]*>")
_CACHE_LOCK = Lock()
_MANIFEST_CACHE: tuple[str, dict[str, Any]] | None = None

router = APIRouter(prefix="/api/knowledge-articles", tags=["knowledge-articles"])


class KnowledgeArticleLibraryError(RuntimeError):
    """Raised when only the article library is unavailable or invalid."""


def _safe_relative_path(value: object) -> bool:
    if not isinstance(value, str) or not value or "\\" in value:
        return False
    path = Path(value)
    return not path.is_absolute() and ".." not in path.parts


def _resolve_article_path(file_value: str) -> Path:
    if not _safe_relative_path(file_value):
        raise KnowledgeArticleLibraryError("文章文件路径不安全")
    root = ARTICLE_LIBRARY_ROOT.resolve()
    candidate = (ARTICLE_LIBRARY_ROOT / file_value).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise KnowledgeArticleLibraryError("文章文件越出文章库目录") from exc
    if not candidate.is_file():
        raise KnowledgeArticleLibraryError("文章正文文件不存在")
    return candidate


def _manifest_signature() -> tuple[str, bytes]:
    if not MANIFEST_PATH.is_file():
        raise KnowledgeArticleLibraryError("文章库清单不存在")
    try:
        raw = MANIFEST_PATH.read_bytes()
    except OSError as exc:
        raise KnowledgeArticleLibraryError("文章库清单无法读取") from exc
    return hashlib.sha256(raw).hexdigest(), raw


def _validate_manifest(manifest: object) -> dict[str, Any]:
    if not isinstance(manifest, dict):
        raise KnowledgeArticleLibraryError("文章库清单格式无效")
    articles = manifest.get("articles")
    if not isinstance(articles, list) or not articles:
        raise KnowledgeArticleLibraryError("文章库清单缺少文章列表")
    if manifest.get("article_count") != len(articles):
        raise KnowledgeArticleLibraryError("文章数量与清单不一致")
    ids: set[str] = set()
    for article in articles:
        if not isinstance(article, dict):
            raise KnowledgeArticleLibraryError("文章元数据格式无效")
        article_id = article.get("id")
        if not isinstance(article_id, str) or not ARTICLE_ID_PATTERN.fullmatch(article_id) or article_id in ids:
            raise KnowledgeArticleLibraryError("文章 ID 无效或重复")
        ids.add(article_id)
        required_text_fields = ("title", "category", "summary", "status")
        if any(not isinstance(article.get(field), str) or not article[field].strip() for field in required_text_fields):
            raise KnowledgeArticleLibraryError(f"文章 {article_id} 元数据不完整")
        if article.get("status") != "published":
            raise KnowledgeArticleLibraryError(f"文章 {article_id} 状态不可发布")
        tags = article.get("tags")
        if not isinstance(tags, list) or not tags or any(not isinstance(tag, str) or not tag.strip() for tag in tags):
            raise KnowledgeArticleLibraryError(f"文章 {article_id} 标签无效")
        source_basis = article.get("source_basis")
        if not isinstance(source_basis, list) or not source_basis or any(not isinstance(item, str) for item in source_basis):
            raise KnowledgeArticleLibraryError(f"文章 {article_id} 来源依据无效")
        if not _safe_relative_path(article.get("file")):
            raise KnowledgeArticleLibraryError(f"文章 {article_id} 文件路径不安全")
        _resolve_article_path(str(article["file"]))

    relationships = manifest.get("relationships")
    if not isinstance(relationships, list):
        raise KnowledgeArticleLibraryError("文章库关系清单格式无效")
    seen_edges: set[tuple[str, str]] = set()
    for relationship in relationships:
        if not isinstance(relationship, dict):
            raise KnowledgeArticleLibraryError("关系清单格式无效")
        source, target = relationship.get("source"), relationship.get("target")
        if not isinstance(source, str) or not isinstance(target, str) or source >= target or source == target:
            raise KnowledgeArticleLibraryError("关系方向或自环无效")
        if source not in ids or target not in ids:
            raise KnowledgeArticleLibraryError("关系引用了不存在的文章")
        key = (source, target)
        if key in seen_edges:
            raise KnowledgeArticleLibraryError("关系边重复")
        seen_edges.add(key)
        if relationship.get("type") not in {"manual", "shared_topic"} or not str(relationship.get("reason") or "").strip():
            raise KnowledgeArticleLibraryError("关系类型或理由无效")
    return manifest


def load_article_manifest() -> dict[str, Any]:
    """Load and validate metadata lazily, refreshing when the manifest changes."""

    global _MANIFEST_CACHE
    signature, raw = _manifest_signature()
    with _CACHE_LOCK:
        if _MANIFEST_CACHE and _MANIFEST_CACHE[0] == signature:
            return _MANIFEST_CACHE[1]
        try:
            manifest = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise KnowledgeArticleLibraryError("文章库清单不是有效 UTF-8 JSON") from exc
        validated = _validate_manifest(manifest)
        _MANIFEST_CACHE = (signature, validated)
        return validated


def reset_article_manifest_cache() -> None:
    """Test helper and operational hook for a controlled cache reset."""

    global _MANIFEST_CACHE
    with _CACHE_LOCK:
        _MANIFEST_CACHE = None


def sanitize_article_markdown(markdown: str) -> str:
    """Keep the small Markdown subset used by the reader and remove raw HTML."""

    if DANGEROUS_MARKUP_PATTERN.search(markdown):
        raise KnowledgeArticleLibraryError("文章正文含危险 HTML 或 URL")
    return RAW_HTML_PATTERN.sub("", markdown).replace("javascript:", "", 1)


def _article_metadata(article: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": article["id"],
        "title": article["title"],
        "category": article["category"],
        "tags": list(article["tags"]),
        "summary": article["summary"],
        "source_basis": list(article["source_basis"]),
        "status": article["status"],
    }


def _module_http_error(exc: Exception) -> HTTPException:
    return HTTPException(status_code=503, detail=f"造价知识文章库暂不可用：{exc}")


def _get_article(manifest: dict[str, Any], article_id: str) -> dict[str, Any]:
    if not ARTICLE_ID_PATTERN.fullmatch(article_id):
        raise HTTPException(status_code=404, detail="未找到该造价知识文章")
    for article in manifest["articles"]:
        if article["id"] == article_id:
            return article
    raise HTTPException(status_code=404, detail="未找到该造价知识文章")


def _relationships_for(manifest: dict[str, Any], article_id: str) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for relationship in manifest["relationships"]:
        if relationship["source"] == article_id:
            result.append({**relationship, "related_id": relationship["target"]})
        elif relationship["target"] == article_id:
            result.append({**relationship, "related_id": relationship["source"]})
    return result


@router.get("")
async def list_knowledge_articles() -> dict[str, Any]:
    try:
        manifest = load_article_manifest()
    except KnowledgeArticleLibraryError as exc:
        raise _module_http_error(exc) from exc
    return {
        "library_id": manifest.get("library_id"),
        "title": manifest.get("title"),
        "schema_version": manifest.get("schema_version"),
        "article_count": manifest["article_count"],
        "relationship_count": len(manifest["relationships"]),
        "articles": [_article_metadata(article) for article in manifest["articles"]],
    }


@router.get("/graph")
async def get_knowledge_article_graph() -> dict[str, Any]:
    try:
        manifest = load_article_manifest()
        degree: dict[str, int] = {article["id"]: 0 for article in manifest["articles"]}
        neighbor_ids: dict[str, list[str]] = {article["id"]: [] for article in manifest["articles"]}
        for relationship in manifest["relationships"]:
            source, target = relationship["source"], relationship["target"]
            degree[source] += 1
            degree[target] += 1
            neighbor_ids[source].append(target)
            neighbor_ids[target].append(source)
        nodes = [
            {
                **_article_metadata(article),
                "degree": degree[article["id"]],
                "neighbor_ids": sorted(neighbor_ids[article["id"]]),
            }
            for article in manifest["articles"]
        ]
        return {"library_id": manifest.get("library_id"), "nodes": nodes, "edges": manifest["relationships"]}
    except KnowledgeArticleLibraryError as exc:
        raise _module_http_error(exc) from exc


@router.get("/{article_id}")
async def get_knowledge_article(article_id: str) -> dict[str, Any]:
    try:
        manifest = load_article_manifest()
        article = _get_article(manifest, article_id)
        file_path = _resolve_article_path(str(article["file"]))
        markdown = file_path.read_text(encoding="utf-8")
        body = sanitize_article_markdown(markdown)
    except HTTPException:
        raise
    except (KnowledgeArticleLibraryError, OSError, UnicodeError) as exc:
        raise _module_http_error(exc) from exc
    return {
        "article": {
            **_article_metadata(article),
            "body": body,
            "related": _relationships_for(manifest, article_id),
        }
    }
