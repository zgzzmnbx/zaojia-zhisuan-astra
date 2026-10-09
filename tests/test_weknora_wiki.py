"""Synthetic upstream contract tests; no secrets, model calls or Wiki writes."""
from pathlib import Path
import sys
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
import server
import weknora as qa
import weknora_wiki as wiki

SCOPE={'kb_id':'kb-test','documents':[{'knowledge_id':'doc-test','name':'合成资料.md','content_md5':'hash-test','content_sha256':'sha-test'}]}
def page(slug, refs=(), links=(), **extra):
    return {'slug':slug,'title':slug,'knowledge_base_id':'kb-test','page_type':'concept','status':'published','source_refs':list(refs),'out_links':list(links),'in_links':[], 'content':f'正文 [[{slug}|自身]]','version':1,'updated_at':'2026-10-09T00:00:00Z',**extra}

def test_source_scope_closure_excludes_foreign_aggregates_and_unbacked_cycles():
    rows=[page('approved',['doc-test|合成资料'],['foreign']),page('foreign',['other-doc|不在范围']),page('good-directory',links=['approved']),page('mixed-directory',links=['approved','foreign']),page('root',links=['good-directory']),page('bad-root',links=['mixed-directory']),page('cycle-a',links=['cycle-b']),page('cycle-b',links=['cycle-a']),page('draft',['doc-test'],status='draft'),page('wrong-kb',['doc-test'],knowledge_base_id='other-kb')]
    scoped=wiki.scoped_pages(rows,SCOPE)
    assert set(scoped)=={'approved','good-directory','root'}
    assert scoped['approved']['out_links']==[]

def test_duplicate_slugs_fail_closed():
    with pytest.raises(HTTPException) as e:wiki.scoped_pages([page('a',['doc-test']),page('a',['doc-test'])],SCOPE)
    assert e.value.status_code==502

def test_directory_filter_uses_document_membership_without_cross_topic_leak():
    rows=[page('group',links=['document']),page('document',['doc-test'],['topic']),page('topic',['doc-test'],['cross']),page('cross',['other'])]
    scoped=wiki.scoped_pages(rows,SCOPE)
    categories=wiki.directory_categories(scoped)
    assert categories=={'group':['group'],'document':['group'],'topic':['group']}

@pytest.fixture
def connected(monkeypatch):
    state={'calls':[],'drift':False,'unavailable':False,'foreign_chunk':False,'total':3}
    monkeypatch.setattr(qa,'_settings',lambda:('http://127.0.0.1:18091','api-key:synthetic-only',SCOPE))
    async def upstream(request):
        assert request.method=='GET'
        assert request.headers['X-API-Key']=='synthetic-only'
        state['calls'].append((request.url.path,dict(request.url.params)))
        if state['unavailable']:raise httpx.ConnectError('synthetic offline')
        path=request.url.path
        if path.endswith('/knowledge'):
            data=[{'id':'doc-test','knowledge_base_id':'kb-test','parse_status':'completed','file_name':'合成资料.md','file_hash':'changed' if state['drift'] else 'hash-test'}]
            return httpx.Response(200,json={'success':True,'data':data})
        if path.endswith('/wiki/pages'):
            return httpx.Response(200,json={'pages':[page('topic/a',['doc-test|来源'],['index']),page('index',links=['topic/a']),page('foreign',['other'])], 'total':state['total']})
        if path.endswith('/wiki/graph'):
            if state.get('no_edges'):
                return httpx.Response(200,json={'nodes':[{'slug':'topic/a'}],'edges':None,'meta':{'truncated':False,'total':1}})
            return httpx.Response(200,json={'nodes':[{'slug':'topic/a'},{'slug':'index'},{'slug':'foreign'}],'edges':[{'source':'topic/a','target':'index'},{'source':'topic/a','target':'foreign'}], 'meta':{'truncated':False,'total':3}})
        if path.endswith('/wiki/revisions/topic/a'):
            return httpx.Response(200,json={'current_version':2,'total':1,'revisions':[{'slug':'topic/a','version':1,'edit_source':'user','content':'unscoped historic content','edited_at':'2026-10-08T00:00:00Z'}]})
        if path.endswith('/wiki/issues'):
            return httpx.Response(200,json=[{'slug':'topic/a','id':'allowed','suspected_knowledge_ids':['doc-test']},{'slug':'foreign','id':'outside'},{'slug':'topic/a','id':'outside-source','suspected_knowledge_ids':['other']}])
        if path.endswith('/chunks/doc-test'):
            return httpx.Response(200,json={'success':True,'data':[{'id':'chunk-1','knowledge_id':'other' if state['foreign_chunk'] else 'doc-test','content':'原始合成资料正文'}], 'total':1})
        if path.endswith('/knowledge-bases/kb-test'):
            return httpx.Response(200,json={'success':True,'data':{'indexing_strategy':{'wiki_enabled':True,'graph_enabled':False}}})
        raise AssertionError(path)
    original=httpx.AsyncClient
    monkeypatch.setattr(wiki.httpx,'AsyncClient',lambda **kw:original(**kw,transport=httpx.MockTransport(upstream)))
    with TestClient(server.app,base_url='http://127.0.0.1:5189',client=('127.0.0.1',1234)) as client:yield client,state

def test_live_scoped_catalog_does_not_claim_neo4j_verified(connected):
    client,state=connected
    r=client.get('/api/astra/weknora/wiki/catalog')
    assert r.status_code==200,r.text
    d=r.json();assert d['total_pages']==2 and d['total_links']==2 and d['excluded_pages']==1
    assert d['document_count']==1 and d['graph_rag']['runtime_verified'] is False
    assert 'synthetic-only' not in r.text

def test_graph_neighborhood_and_scope_filter(connected):
    client,state=connected
    r=client.get('/api/astra/weknora/wiki/graph',params={'center':'topic/a','depth':2})
    assert r.status_code==200
    assert {n['id'] for n in r.json()['nodes']}=={'index','topic/a'}
    assert len(r.json()['edges'])==1
    assert state['calls'][-1][1]['mode']=='ego' and state['calls'][-1][1]['depth']=='2'
    assert client.get('/api/astra/weknora/wiki/graph',params={'center':'foreign'}).status_code==404

def test_isolated_nodes_accept_upstream_nil_edge_slice(connected):
    client,state=connected
    state['no_edges']=True
    r=client.get('/api/astra/weknora/wiki/graph')
    assert r.status_code==200 and len(r.json()['nodes'])==1 and r.json()['edges']==[]

def test_page_reads_real_body_and_source_version(connected):
    client,state=connected
    d=client.get('/api/astra/weknora/wiki/page',params={'slug':'topic/a'}).json()
    assert d['content']=='正文 自身'
    assert d['sources'][0]['version']=='sha-test'
    assert client.get('/api/astra/weknora/wiki/page',params={'slug':'foreign'}).status_code==404

def test_revisions_are_read_only_metadata_without_unverifiable_body(connected):
    client,state=connected
    r=client.get('/api/astra/weknora/wiki/revisions',params={'slug':'topic/a'})
    assert r.status_code==200 and r.json()['revisions'][0]['version']==1
    assert 'unscoped historic content' not in r.text and r.json()['content_available'] is False
    assert client.post('/api/astra/weknora/wiki/revert',json={'slug':'topic/a','version':1}).status_code in (404,405)
    assert client.put('/api/astra/weknora/wiki/page?slug=topic/a',json={'content':'edit'}).status_code==405

def test_issues_and_source_chunks_are_scoped(connected):
    client,state=connected
    d=client.get('/api/astra/weknora/wiki/issues').json();assert [i['id'] for i in d['issues']]==['allowed']
    assert client.get('/api/astra/weknora/wiki/source',params={'knowledge_id':'other'}).status_code==403
    r=client.get('/api/astra/weknora/wiki/source',params={'knowledge_id':'doc-test'})
    assert r.status_code==200 and r.json()['chunks'][0]['content']=='原始合成资料正文'
    state['foreign_chunk']=True
    assert client.get('/api/astra/weknora/wiki/source',params={'knowledge_id':'doc-test'}).status_code==409

def test_refresh_revalidates_drift_and_unavailable_is_not_connected(connected):
    client,state=connected
    assert client.get('/api/astra/weknora/wiki/catalog').status_code==200
    state['drift']=True
    assert client.get('/api/astra/weknora/wiki/catalog').status_code==409
    state['unavailable']=True
    assert client.get('/api/astra/weknora/wiki/catalog').status_code==503

def test_foreign_origin_and_oversize_snapshot_fail_closed(connected):
    client,state=connected
    assert client.get('/api/astra/weknora/wiki/catalog',headers={'Origin':'https://foreign.example'}).status_code==403
    state['total']=2001
    assert client.get('/api/astra/weknora/wiki/catalog').status_code==409

