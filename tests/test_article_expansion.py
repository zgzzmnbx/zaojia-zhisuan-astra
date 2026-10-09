"""Article publication gates: original preservation, provenance and real APIs."""
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '03-Src'))
import server
from app import knowledge_articles as articles

PACK = ROOT / '03-Src/reference-assets/cost-articles'
FROZEN = ROOT / '03-Src/engine/06-知识库问答资料/造价知识文章库'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def test_original_fifty_and_all_original_relations_preserved():
    old, new = read(FROZEN / 'manifest.json'), read(PACK / 'manifest.json')
    assert new['articles'][:50] == old['articles']
    assert new['relationships'][:74] == old['relationships']
    proof = read(PACK / 'provenance.json')
    assert hashlib.sha256((FROZEN / 'manifest.json').read_bytes()).hexdigest() in proof['original_manifest_sha256_variants']
    assert hashlib.sha256((FROZEN / 'manifest.json').read_bytes().replace(b'\r\n',b'\n')).hexdigest() == proof['original_manifest_normalized_sha256']
    for a in proof['original_articles']:
        assert hashlib.sha256((PACK / a['file']).read_bytes()).hexdigest() == a['sha256']
        assert hashlib.sha256((FROZEN / a['file']).read_bytes()).hexdigest() in a['frozen_sha256_variants']
        assert (PACK / a['file']).read_bytes().replace(b'\r\n',b'\n') == (FROZEN / a['file']).read_bytes().replace(b'\r\n',b'\n')


def test_hundred_complete_distinct_articles_and_non_dangling_relations():
    manifest = articles.load_article_manifest()
    assert articles.ARTICLE_LIBRARY_ROOT == PACK
    assert manifest['article_count'] == 100
    assert set(Counter(a['category'] for a in manifest['articles']).values()) == {10}
    assert len({a['title'] for a in manifest['articles']}) == 100
    evidence = {a['id']: a for a in read(PACK / 'provenance.json')['new_articles']}
    bodies = []
    for a in manifest['articles'][50:]:
        raw = (PACK / a['file']).read_bytes()
        body = raw.decode('utf-8')
        assert len(body) > 350 and '## 来源' in body and '## 核对要点' in body
        assert articles.sanitize_article_markdown(body) == body
        assert hashlib.sha256(raw).hexdigest() == evidence[a['id']]['body_sha256']
        refs = evidence[a['id']]['source_evidence']
        assert refs and all(ref['excerpts'] and len(ref['sha256']) == 64 for ref in refs)
        assert any(a['id'] in (e['source'], e['target']) for e in manifest['relationships'])
        bodies.append(body)
    assert len(set(bodies)) == 50
    assert read(PACK / 'provenance.json')['weknora_source_scope_changed'] is False


def test_list_graph_and_each_detail_use_the_same_published_pack():
    client = TestClient(server.app)
    listing = client.get('/api/knowledge-articles').json()
    graph = client.get('/api/knowledge-articles/graph').json()
    assert listing['article_count'] == len(graph['nodes']) == 100
    assert listing['relationship_count'] == len(graph['edges']) == 202
    for a in listing['articles']:
        response = client.get('/api/knowledge-articles/' + a['id'])
        assert response.status_code == 200
        detail = response.json()['article']
        assert detail['title'] == a['title'] and detail['body']
        node = next(n for n in graph['nodes'] if n['id'] == a['id'])
        assert len(detail['related']) == node['degree']
    assert client.get('/api/knowledge-articles/cost-101').status_code == 404


def test_missing_published_manifest_fails_closed(monkeypatch, tmp_path):
    monkeypatch.setattr(articles, 'MANIFEST_PATH', tmp_path / 'missing.json')
    response = TestClient(server.app).get('/api/knowledge-articles')
    assert response.status_code == 503
