"""Validate source-backed article publication without changing any data."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import urllib.request


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def validate(root, sources=None, live_url=None):
    pack = root / '03-Src/reference-assets/cost-articles'
    frozen = root / '03-Src/engine/06-知识库问答资料/造价知识文章库'
    manifest, old, proof = read(pack / 'manifest.json'), read(frozen / 'manifest.json'), read(pack / 'provenance.json')
    assert manifest['article_count'] == len(manifest['articles']) == 100
    assert manifest['articles'][:50] == old['articles']
    assert manifest['relationships'][:74] == old['relationships']
    assert digest(frozen / 'manifest.json') in proof['original_manifest_sha256_variants']
    assert hashlib.sha256((frozen / 'manifest.json').read_bytes().replace(b'\r\n',b'\n')).hexdigest() == proof['original_manifest_normalized_sha256']
    for a in proof['original_articles']:
        assert digest(pack / a['file']) == a['sha256']
        assert digest(frozen / a['file']) in a['frozen_sha256_variants']
        assert hashlib.sha256((frozen / a['file']).read_bytes().replace(b'\r\n',b'\n')).hexdigest() == a['normalized_sha256']
    ids = {a['id'] for a in manifest['articles']}
    assert len(ids) == len({a['title'] for a in manifest['articles']}) == 100
    edges = set()
    for edge in manifest['relationships']:
        pair = edge['source'], edge['target']
        assert pair[0] < pair[1] and set(pair) <= ids and pair not in edges and edge['reason']
        edges.add(pair)
    verified_sources = set()
    assets = {a['asset_id']: a for a in read(sources / 'manifest.json')['assets']} if sources else {}
    for a in proof['new_articles']:
        meta = next(x for x in manifest['articles'] if x['id'] == a['id'])
        assert digest(pack / meta['file']) == a['body_sha256']
        assert any(a['id'] in pair for pair in edges)
        for ref in a['source_evidence']:
            if sources:
                assert assets[ref['asset_id']]['output_name'] == ref['file']
                assert digest(sources / ref['file']) == ref['sha256']
                lines = (sources / ref['file']).read_text(encoding='utf-8-sig').splitlines()
                assert ref['excerpts'] == ['\n'.join(lines[s-1:e]) for s, e in ref['ranges']]
                verified_sources.add(ref['asset_id'])
    live_details = 0
    if live_url:
        def get(path):
            return json.load(urllib.request.urlopen(live_url.rstrip('/') + path, timeout=10))
        listing = get('/api/knowledge-articles')
        graph = get('/api/knowledge-articles/graph')
        assert listing['article_count'] == len(graph['nodes']) == 100
        assert graph['edges'] == manifest['relationships']
        for meta in manifest['articles']:
            detail = get('/api/knowledge-articles/' + meta['id'])['article']
            assert detail['title'] == meta['title']
            assert detail['body'] == (pack / meta['file']).read_text(encoding='utf-8')
            assert {e['related_id'] for e in detail['related']} == set(next(n for n in graph['nodes'] if n['id'] == meta['id'])['neighbor_ids'])
            live_details += 1
    return {'article_count': 100, 'relationship_count': len(edges), 'categories': dict(Counter(a['category'] for a in manifest['articles'])), 'original_articles_unchanged': 50, 'original_relations_unchanged': 74, 'source_files_verified': len(verified_sources), 'live_details_verified': live_details, 'manifest_sha256': digest(pack / 'manifest.json')}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', type=Path, help='Imported AIW source directory; read-only')
    parser.add_argument('--live-url', help='Local Astra service URL')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = validate(Path(__file__).resolve().parents[1], args.sources, args.live_url)
    value = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(value, encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'categories'}))
