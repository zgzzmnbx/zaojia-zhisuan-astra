from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app import knowledge_articles
from backend.app.main import app


def _write_fixture(root: Path) -> Path:
    (root / "articles").mkdir(parents=True)
    (root / "articles" / "cost-001-第一篇.md").write_text("# 第一篇\n\n第一篇正文。", encoding="utf-8")
    (root / "articles" / "cost-002-第二篇.md").write_text("# 第二篇\n\n第二篇正文。", encoding="utf-8")
    manifest = {
        "schema_version": 1,
        "library_id": "test-library",
        "title": "测试文章库",
        "article_count": 2,
        "articles": [
            {
                "id": "cost-001",
                "title": "第一篇",
                "category": "测试",
                "tags": ["甲", "乙", "丙"],
                "summary": "第一篇摘要",
                "file": "articles/cost-001-第一篇.md",
                "source_basis": ["asset_id=ready; output=source.md; title_path=总说明"],
                "status": "published",
            },
            {
                "id": "cost-002",
                "title": "第二篇",
                "category": "测试",
                "tags": ["甲", "乙", "丁"],
                "summary": "第二篇摘要",
                "file": "articles/cost-002-第二篇.md",
                "source_basis": ["asset_id=ready; output=source.md; title_path=第二章"],
                "status": "published",
            },
        ],
        "relationships": [
            {"source": "cost-001", "target": "cost-002", "type": "manual", "weight": 1, "reason": "测试关系"}
        ],
    }
    manifest_path = root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    return manifest_path


@pytest.fixture()
def article_fixture(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "造价知识文章库"
    manifest_path = _write_fixture(root)
    monkeypatch.setattr(knowledge_articles, "ARTICLE_LIBRARY_ROOT", root)
    monkeypatch.setattr(knowledge_articles, "MANIFEST_PATH", manifest_path)
    knowledge_articles.reset_article_manifest_cache()
    yield root
    knowledge_articles.reset_article_manifest_cache()


def test_list_returns_metadata_only_and_detail_reads_one(article_fixture: Path) -> None:
    client = TestClient(app)
    response = client.get("/api/knowledge-articles")
    assert response.status_code == 200
    payload = response.json()
    assert payload["article_count"] == 2
    assert "body" not in payload["articles"][0]

    detail = client.get("/api/knowledge-articles/cost-001")
    assert detail.status_code == 200
    assert detail.json()["article"]["body"].startswith("# 第一篇")
    assert detail.json()["article"]["related"][0]["related_id"] == "cost-002"


def test_graph_uses_the_same_frozen_manifest(article_fixture: Path) -> None:
    payload = TestClient(app).get("/api/knowledge-articles/graph").json()
    assert {node["id"] for node in payload["nodes"]} == {"cost-001", "cost-002"}
    assert payload["edges"][0]["source"] == "cost-001"
    assert payload["nodes"][0]["degree"] == 1


def test_manifest_cache_refreshes_after_content_changes(article_fixture: Path) -> None:
    client = TestClient(app)
    assert client.get("/api/knowledge-articles").json()["title"] == "测试文章库"
    manifest_path = article_fixture / "manifest.json"
    changed = json.loads(manifest_path.read_text(encoding="utf-8"))
    changed["title"] = "更新后的文章库"
    manifest_path.write_text(json.dumps(changed, ensure_ascii=False), encoding="utf-8")
    assert client.get("/api/knowledge-articles").json()["title"] == "更新后的文章库"


@pytest.mark.parametrize("manifest_content", ["{", "{\"articles\": []}"])
def test_corrupt_or_invalid_manifest_isolated(article_fixture: Path, manifest_content: str) -> None:
    (article_fixture / "manifest.json").write_text(manifest_content, encoding="utf-8")
    client = TestClient(app)
    assert client.get("/api/knowledge-articles").status_code == 503
    assert client.get("/api/health").status_code == 200


def test_missing_manifest_isolated(article_fixture: Path) -> None:
    (article_fixture / "manifest.json").unlink()
    client = TestClient(app)
    assert client.get("/api/knowledge-articles").status_code == 503
    assert client.get("/api/health").status_code == 200


def test_unknown_id_and_path_traversal_do_not_read_outside(article_fixture: Path) -> None:
    client = TestClient(app)
    assert client.get("/api/knowledge-articles/not-safe").status_code == 404
    assert client.get("/api/knowledge-articles/%2E%2E%2Fsecret").status_code in {404, 400}


def test_sanitize_rejects_dangerous_markup() -> None:
    with pytest.raises(knowledge_articles.KnowledgeArticleLibraryError):
        knowledge_articles.sanitize_article_markdown("# 标题\n\n<img src=javascript:alert(1)>")
    assert knowledge_articles.sanitize_article_markdown("# 标题\n\n普通正文") == "# 标题\n\n普通正文"
