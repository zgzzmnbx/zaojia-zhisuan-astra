"""Read-only Wiki experiment. All reads revalidate the approved source scope.

Never reads WeKnora's database, starts extraction, or edits upstream pages.
Wiki responses in the pinned upstream are bare DTOs, unlike the QA envelope.
"""
from __future__ import annotations

from collections import Counter
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from urllib.parse import quote
import re

import httpx
from fastapi import APIRouter, Query, Request
import weknora as qa

router = APIRouter(prefix='/api/astra/weknora/wiki')
MAX_PAGES = 2000


async def read(client, url, token, params=None):
    try:
        response = await client.get(url, headers=qa._auth_headers(token), params=params)
    except httpx.HTTPError:
        raise qa._failure(503, 'SERVICE_UNAVAILABLE', 'WeKnora 服务暂不可达，请检查本机服务') from None
    if response.status_code in (401, 403):
        raise qa._failure(502, 'AUTH_EXPIRED', 'WeKnora Wiki 权限不足或凭证失效')
    if response.status_code >= 400:
        raise qa._failure(502, 'WIKI_UNAVAILABLE', f'WeKnora Wiki 请求失败（{response.status_code}）')
    try:
        result = response.json()
        if isinstance(result, dict) and 'success' in result:
            if result['success'] is not True:
                raise ValueError()
            return result.get('data')
        return result
    except ValueError:
        raise qa._failure(502, 'CONTRACT_MISMATCH', 'WeKnora Wiki 数据格式不符') from None


def scoped_pages(pages, scope):
    """Keep approved citations and only closed, source-backed navigation nodes."""
    approved = {d['knowledge_id'] for d in scope['documents']}
    by_slug = {}
    for p in pages:
        if not isinstance(p, dict) or not isinstance(p.get('slug'), str) or p['slug'] in by_slug:
            raise qa._failure(502, 'CONTRACT_MISMATCH', 'Wiki 条目标识重复或缺失')
        by_slug[p['slug']] = p
    direct, navigation = set(), set()
    for slug, p in by_slug.items():
        if p.get('knowledge_base_id') != scope['kb_id'] or p.get('status') != 'published':
            continue
        refs = p.get('source_refs') or []
        ids = {r.split('|', 1)[0] for r in refs if isinstance(r, str)}
        if refs and len(ids) and len(refs) == sum(isinstance(r, str) for r in refs) and ids <= approved:
            direct.add(slug)
        elif not refs and p.get('out_links'):
            navigation.add(slug)
    # Empty-source navigation must not reach unknown/unapproved descendants.
    allowed = direct | navigation
    while True:
        bad = {s for s in navigation & allowed if any(t not in allowed for t in by_slug[s].get('out_links', []))}
        if not bad:
            break
        allowed -= bad
    reachable = set(direct)
    while True:
        more = {s for s in navigation & allowed if any(t in reachable for t in by_slug[s].get('out_links', []))}
        if more <= reachable:
            break
        reachable |= more
    allowed &= reachable
    result = {}
    for slug in allowed:
        p = by_slug[slug]
        result[slug] = {k: p.get(k) for k in ('slug', 'title', 'page_type', 'summary', 'version', 'updated_at', 'status', 'category_path', 'parent_slug')}
        result[slug].update(content=p.get('content') or '', source_refs=p.get('source_refs') or [],
                            in_links=[s for s in (p.get('in_links') or []) if s in allowed],
                            out_links=[s for s in (p.get('out_links') or []) if s in allowed])
    return result


@asynccontextmanager
async def snapshot(request):
    qa._local_request(request)
    base, token, scope = qa._settings()
    async with httpx.AsyncClient(timeout=20, trust_env=False) as client:
        try:
            await qa._verify_scope(client, base, token, scope, scope['documents'])
        except httpx.HTTPError:
            raise qa._failure(503, 'SERVICE_UNAVAILABLE', 'WeKnora 服务暂不可达，请检查本机服务') from None
        prefix = f"{base}/api/v1/knowledgebase/{quote(scope['kb_id'], safe='')}/wiki"
        pages = []
        total = None
        for number in range(1, 21):
            data = await read(client, prefix + '/pages', token, {'page': number, 'page_size': 100, 'sort_by': 'slug', 'sort_order': 'asc'})
            if not isinstance(data, dict) or not isinstance(data.get('pages'), list) or not isinstance(data.get('total'), int):
                raise qa._failure(502, 'CONTRACT_MISMATCH', 'Wiki 清单格式不符')
            if total is None:
                total = data['total']
            if total != data['total'] or total > MAX_PAGES:
                raise qa._failure(409, 'WIKI_SNAPSHOT_CHANGED', 'Wiki 清单变化或超出试验区范围，请重试')
            pages.extend(data['pages'])
            if len(pages) >= total:
                break
            if not data['pages']:
                raise qa._failure(502, 'CONTRACT_MISMATCH', 'Wiki 分页不完整')
        if len(pages) != total:
            raise qa._failure(502, 'CONTRACT_MISMATCH', 'Wiki 分页不完整')
        yield client, base, prefix, token, scope, scoped_pages(pages, scope), total


def page_in(pages, slug):
    if slug not in pages:
        raise qa._failure(404, 'PAGE_NOT_IN_SCOPE', '该条目不在已核验的造价资料范围内')
    return pages[slug]


def directory_categories(pages):
    """Derive display filters from real directory-to-document links, not topics."""
    domains = {}
    for slug, p in pages.items():
        if p['source_refs'] or p['page_type'] == 'index':
            continue
        source_ids = {r.split('|', 1)[0] for target in p['out_links'] for r in pages[target]['source_refs']}
        if source_ids:
            domains[slug] = source_ids
    result = {}
    for slug, p in pages.items():
        source_ids = {r.split('|', 1)[0] for r in p['source_refs']}
        result[slug] = sorted({pages[d]['title'] for d, ids in domains.items() if source_ids & ids or d == slug})
    return result


@router.get('/catalog')
async def catalog(request: Request):
    async with snapshot(request) as (client, base, prefix, token, scope, pages, total):
        kb = await read(client, f"{base}/api/v1/knowledge-bases/{scope['kb_id']}", token)
        strategy = kb.get('indexing_strategy') or {} if isinstance(kb, dict) else {}
        # Counts are derived exclusively from scoped live pages, never global stats.
        links = {(s, t) for s, p in pages.items() for t in p['out_links']}
        categories = directory_categories(pages)
        items = [{**{k: v for k, v in p.items() if k != 'content'}, 'display_categories': categories[p['slug']]} for p in pages.values()]
        return {'available': True, 'checked_at': datetime.now(timezone.utc).isoformat(),
                'document_count': len(scope['documents']), 'pages': sorted(items, key=lambda p: (p['title'] or '', p['slug'])),
                'types': dict(Counter(p['page_type'] for p in items)), 'total_pages': len(items), 'total_links': len(links),
                'excluded_pages': total - len(items), 'orphans': [s for s, p in pages.items() if not p['in_links'] and not p['out_links']],
                'recent_updates': [p['slug'] for p in sorted(items, key=lambda p: p['updated_at'] or '', reverse=True)[:12]],
                'wiki_enabled': strategy.get('wiki_enabled') is True,
                'graph_rag': {'knowledge_base_enabled': strategy.get('graph_enabled') is True, 'runtime_verified': False},
                'documents': [{'id': d['knowledge_id'], 'name': d['name'], 'version': d['content_sha256']} for d in scope['documents']]}


@router.get('/graph')
async def graph(request: Request, center: str = '', depth: int = Query(1, ge=1, le=3), page_type: str = '', limit: int = Query(500, ge=1, le=500)):
    async with snapshot(request) as (client, base, prefix, token, scope, pages, total):
        if center:
            page_in(pages, center)
        data = await read(client, prefix + '/graph', token, {'mode': 'ego' if center else 'overview', 'center': center, 'depth': depth, 'types': page_type, 'limit': limit})
        # Go's nil slices encode as null when a type has no internal links.
        if isinstance(data, dict):
            for field in ('nodes', 'edges'):
                if field in data and data[field] is None:
                    data[field] = []
        if not isinstance(data, dict) or not isinstance(data.get('nodes'), list) or not isinstance(data.get('edges'), list):
            raise qa._failure(502, 'CONTRACT_MISMATCH', 'Wiki 图谱格式不符')
        nodes = [n for n in data['nodes'] if n.get('slug') in pages and (not page_type or pages[n['slug']]['page_type'] == page_type)]
        ids = {n['slug'] for n in nodes}
        edges = [{'source': e['source'], 'target': e['target'], 'type': 'wiki_link', 'weight': 1, 'reason': 'Wiki 条目链接'} for e in data['edges'] if e.get('source') in ids and e.get('target') in ids]
        return {'library_id': 'weknora-wiki', 'nodes': [{'id': n['slug'], 'title': pages[n['slug']]['title'], 'category': pages[n['slug']]['page_type'], 'tags': [], 'summary': pages[n['slug']]['summary'] or '', 'status': 'published', 'source_basis': pages[n['slug']]['source_refs'], 'degree': sum(e['source'] == n['slug'] or e['target'] == n['slug'] for e in edges)} for n in nodes],
                'edges': edges, 'meta': {**(data.get('meta') or {}), 'returned': len(nodes), 'scoped_total': len(pages)}}


@router.get('/page')
async def detail(request: Request, slug: str):
    async with snapshot(request) as (_, base, prefix, token, scope, pages, total):
        p = page_in(pages, slug)
        docs = {d['knowledge_id']: d for d in scope['documents']}
        # Wiki links are rendered as local controls, never upstream URLs.
        content = re.sub(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', lambda m: m[2] or pages.get(m[1], {}).get('title') or m[1], p['content'])
        return {**p, 'content': content, 'sources': [{'id': ref.split('|', 1)[0], 'name': docs[ref.split('|', 1)[0]]['name'], 'version': docs[ref.split('|', 1)[0]]['content_sha256']} for ref in p['source_refs']]}


@router.get('/revisions')
async def revisions(request: Request, slug: str, offset: int = Query(0, ge=0)):
    async with snapshot(request) as (client, base, prefix, token, scope, pages, total):
        page_in(pages, slug)
        encoded = '/'.join(quote(s, safe='') for s in slug.split('/'))
        data = await read(client, prefix + '/revisions/' + encoded, token, {'limit': 20, 'offset': offset})
        if not isinstance(data, dict) or not isinstance(data.get('revisions'), list):
            raise qa._failure(502, 'CONTRACT_MISMATCH', 'Wiki 版本记录格式不符')
        # This upstream's revision DTO does not preserve source_refs. Expose only
        # history metadata; do not leak an unprovable historic source scope.
        return {'current_version': data.get('current_version'), 'total': data.get('total'), 'offset': offset,
                'revisions': [{k: r.get(k) for k in ('version', 'edit_source', 'edited_at', 'created_at')} for r in data['revisions'] if r.get('slug') == slug],
                'content_available': False, 'reason': '上游历史快照未保留来源范围，暂仅展示版本记录'}


@router.get('/issues')
async def issues(request: Request):
    async with snapshot(request) as (client, base, prefix, token, scope, pages, total):
        data = await read(client, prefix + '/issues', token, {'status': 'pending'})
        if data is None:
            data = []
        if not isinstance(data, list):
            raise qa._failure(502, 'CONTRACT_MISMATCH', 'Wiki 待核查清单格式不符')
        approved = {d['knowledge_id'] for d in scope['documents']}
        return {'issues': [{k: i.get(k) for k in ('id', 'slug', 'issue_type', 'description', 'status', 'created_at')} for i in data if i.get('slug') in pages and set(i.get('suspected_knowledge_ids') or []) <= approved]}


@router.get('/source')
async def source(request: Request, knowledge_id: str, page: int = Query(1, ge=1)):
    async with snapshot(request) as (client, base, prefix, token, scope, pages, total):
        doc = next((d for d in scope['documents'] if d['knowledge_id'] == knowledge_id), None)
        if doc is None:
            raise qa._failure(403, 'SOURCE_NOT_IN_SCOPE', '原文不在获准资料范围内')
        try:
            response = await client.get(f'{base}/api/v1/chunks/{quote(knowledge_id, safe="")}', headers=qa._auth_headers(token), params={'page': page, 'page_size': 10})
        except httpx.HTTPError:
            raise qa._failure(503, 'SOURCE_UNAVAILABLE', 'WeKnora 原文服务暂不可达') from None
        if response.status_code in (401, 403):
            raise qa._failure(502, 'AUTH_EXPIRED', 'WeKnora 原文读取权限不足')
        if response.status_code >= 400:
            raise qa._failure(502, 'SOURCE_UNAVAILABLE', 'WeKnora 原文分块暂不可读')
        try:
            data = response.json()
        except ValueError:
            raise qa._failure(502, 'CONTRACT_MISMATCH', '原文分块格式不符') from None
        if not isinstance(data, dict) or data.get('success') is not True or not isinstance(data.get('data'), list) or not isinstance(data.get('total'), int):
            raise qa._failure(502, 'CONTRACT_MISMATCH', '原文分块格式不符')
        chunks = data['data']
        if any(c.get('knowledge_id') != knowledge_id for c in chunks):
            raise qa._failure(409, 'SOURCE_SCOPE_CHANGED', '原文分块归属不符')
        return {'name': doc['name'], 'version': doc['content_sha256'], 'page': page, 'total': data.get('total'), 'page_size': 10,
                'chunks': [{'id': c.get('id'), 'content': c.get('content') or '', 'start_at': c.get('start_at'), 'end_at': c.get('end_at')} for c in chunks]}
