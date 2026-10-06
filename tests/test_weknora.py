"""Contract tests use synthetic upstream responses, never production credentials."""
import asyncio
import json
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
import server
import weknora as qa

def payload(id='request-1', **extra):
    return {'question':'合成资料的适用范围是什么？', 'request_id':id, 'engine_mode':'enhanced', 'library_ids':['cost-aiw'], 'context_type':'general', 'row_context':None, **extra}

@pytest.fixture
def connected(tmp_path, monkeypatch):
    scope={'library_id':'cost-aiw','kb_id':'kb-test','documents':[{'asset_id':'asset-test','name':'合成测试.md','knowledge_id':'doc-test','content_md5':'md5-test','content_sha256':'sha-test'}]}
    scope_file=tmp_path/'scope.json';scope_file.write_text(json.dumps(scope),encoding='utf-8')
    key=tmp_path/'chat.key';key.write_text('synthetic-credential',encoding='ascii')
    config=tmp_path/'settings.json';config.write_text(json.dumps({'enabled':True,'api_key_file':str(key)}),encoding='utf-8')
    for name in ('ENABLED','BASE_URL','API_KEY_FILE','API_KEY','BEARER_TOKEN'):
        monkeypatch.delenv('ASTRA_WEKNORA_'+name,raising=False)
    monkeypatch.setattr(qa,'CONFIG_FILE',config);monkeypatch.setattr(qa,'SCOPE_FILE',scope_file)
    monkeypatch.setattr(qa,'CITATION_DB',tmp_path/'citations.sqlite3');monkeypatch.setattr(qa,'REQUESTS',{})
    monkeypatch.setattr(qa,'CONVERSATIONS',{});monkeypatch.setattr(qa,'BUSY',asyncio.Lock())
    monkeypatch.setattr(server.paths,'RUNTIME_DIR',tmp_path/'workspace')
    state={'calls':[],'complete':True,'foreign':False,'fallback':False,'scope_drift':False,'stall':False,'answer':'合成资料说明。','entered':threading.Event()}
    async def handler(request):
        assert request.headers['X-API-Key']=='synthetic-credential'
        state['calls'].append((request.method,request.url.path,json.loads(request.content) if request.content else None))
        if state.get('unreachable'):
            raise httpx.ConnectError('synthetic unavailable')
        if state.get('auth_expired'):
            return httpx.Response(401,json={'message':'synthetic expired'})
        if request.url.path.endswith('/knowledge'):
            return httpx.Response(200,json={'success':True,'data':[{'id':'doc-test','parse_status':'completed','knowledge_base_id':'kb-test','file_name':'合成测试.md','file_hash':'changed' if state['scope_drift'] else 'md5-test'}]})
        if request.url.path.endswith('/sessions'):
            return httpx.Response(200,json={'success':True,'data':{'id':'session-test'}})
        if request.url.path.endswith('/stop'):
            return httpx.Response(200,json={'success':True})
        assert '/knowledge-chat/' in request.url.path
        state['entered'].set()
        if state['stall']:
            class Waiting(httpx.AsyncByteStream):
                async def __aiter__(self):
                    for _ in range(100):
                        await asyncio.sleep(.02)
                        yield b': heartbeat\n\n'
            return httpx.Response(200,stream=Waiting())
        events=[{'response_type':'references','knowledge_references':[{'id':'chunk-test','knowledge_id':'outside' if state['foreign'] else 'doc-test','content':'合成资料原文'}]}, {'response_type':'answer','content':state['answer'],'data':{'is_fallback':state['fallback']}}]
        if state['complete']:events.append({'response_type':'complete'})
        return httpx.Response(200,text=''.join('data: '+json.dumps(e,ensure_ascii=False)+'\n\n' for e in events))
    original=httpx.AsyncClient
    monkeypatch.setattr(qa.httpx,'AsyncClient',lambda **kwargs:original(**kwargs,transport=httpx.MockTransport(handler)))
    with TestClient(server.app,base_url='http://127.0.0.1:5189',client=('127.0.0.1',12345)) as client:
        yield client,state

def test_real_capability_check_verifies_documents_and_hides_credentials(connected):
    client,state=connected
    response=client.get('/api/astra/weknora/capabilities')
    assert response.json()['available'] is True
    assert response.json()['documents']==[{'id':'asset-test','name':'合成测试.md'}]
    assert 'synthetic-credential' not in response.text
    state['scope_drift']=True
    assert client.get('/api/astra/weknora/capabilities').json()['reason']['code']=='SCOPE_DRIFTED'

def test_verified_answer_citation_and_precise_upstream_scope(connected):
    client,state=connected
    response=client.post('/api/astra/weknora/ask-stream',json=payload())
    assert 'event: done' in response.text and 'event: delta' in response.text
    body=next(c[2] for c in state['calls'] if '/knowledge-chat/' in c[1])
    assert body['knowledge_ids']==['doc-test'] and body['knowledge_base_ids']==[]
    assert body['agent_enabled'] is False and body['web_search_enabled'] is False
    citation=json.loads(response.text.split('event: sources\ndata: ')[1].split('\n')[0])['citations'][0]
    result=client.get(citation['preview_path']).json()
    assert result['excerpt']=='合成资料原文' and result['source_version']=='sha-test'
    assert result['source_url'].startswith('http://127.0.0.1:18090/')
    assert 'synthetic-credential' not in response.text
    assert client.post('/api/astra/weknora/ask-stream',json=payload()).status_code==409

@pytest.mark.parametrize('change',[{'library_ids':['private']},{'context_type':'row'},{'job_id':'f'*32},{'document_ids':[]},{'document_ids':[{}]},{'model':'override'},{'request_id':'../bad'}])
def test_rejects_scope_or_context_override_without_upstream(connected,change):
    client,state=connected
    assert client.post('/api/astra/weknora/ask-stream',json=payload(**change)).status_code==400
    assert not state['calls']

@pytest.mark.parametrize('change',[{'complete':False},{'foreign':True},{'answer':''},{'scope_drift':True}])
def test_partial_or_unverified_results_never_emit_answer(connected,change):
    client,state=connected;state.update(change)
    response=client.post('/api/astra/weknora/ask-stream',json=payload())
    assert 'event: error' in response.text
    assert 'event: delta' not in response.text and 'event: done' not in response.text
    assert qa.BUSY.locked() is False

def test_no_evidence_is_explicit_and_not_model_fallback(connected):
    client,state=connected;state['fallback']=True
    response=client.post('/api/astra/weknora/ask-stream',json=payload())
    assert '"evidence_status": "insufficient"' in response.text
    assert '合成资料说明。' not in response.text

def test_cancel_remains_callable_while_stream_waits_and_discards_late_answer(connected):
    client,state=connected;state['stall']=True
    with ThreadPoolExecutor() as pool:
        pending=pool.submit(client.post,'/api/astra/weknora/ask-stream',json=payload())
        assert state['entered'].wait(3)
        result=client.post('/api/astra/weknora/requests/request-1/cancel',json={})
        assert result.json()=={'state':'cancelled','upstream_stop_confirmed':True}
        response=pending.result(timeout=5)
    assert 'CANCELLED' in response.text and 'event: delta' not in response.text
    assert any(c[1].endswith('/stop') for c in state['calls'])
    assert not qa.CONVERSATIONS and not qa.BUSY.locked()

def test_disabled_unreachable_and_foreign_origin_are_explicit(connected,monkeypatch):
    client,state=connected
    assert client.get('/api/astra/weknora/capabilities',headers={'Origin':'https://foreign.example'}).status_code==403
    monkeypatch.setenv('ASTRA_WEKNORA_ENABLED','0')
    assert client.get('/api/astra/weknora/capabilities').json()['reason']['code']=='MODULE_DISABLED'
    assert client.post('/api/astra/weknora/ask-stream',json=payload()).status_code==503
    monkeypatch.setenv('ASTRA_WEKNORA_ENABLED','1');monkeypatch.setenv('ASTRA_WEKNORA_BASE_URL','https://foreign.example')
    assert client.get('/api/astra/weknora/capabilities').json()['reason']['code']=='CONFIG_INCOMPLETE'
    assert not state['calls']

@pytest.mark.parametrize('failure,code',[('unreachable','SERVICE_UNAVAILABLE'),('auth_expired','AUTH_EXPIRED')])
def test_live_status_does_not_treat_configured_credentials_as_a_connection(connected,failure,code):
    client,state=connected;state[failure]=True
    result=client.get('/api/astra/weknora/capabilities').json()
    assert result['available'] is False and result['reason']['code']==code
    stream=client.post('/api/astra/weknora/ask-stream',json=payload()).text
    assert 'event: error' in stream and 'event: delta' not in stream

def test_saved_citation_survives_request_cache_but_not_scope_revision(connected):
    client,_=connected
    reply=client.post('/api/astra/weknora/ask-stream',json=payload()).text
    citation=json.loads(reply.split('event: sources\ndata: ')[1].split('\n')[0])['citations'][0]
    qa.REQUESTS.clear();qa.CONVERSATIONS.clear()
    assert client.get(citation['preview_path']).json()['excerpt']=='合成资料原文'
    scope=json.loads(qa.SCOPE_FILE.read_text(encoding='utf-8'));scope['documents'][0]['content_sha256']='new-version'
    qa.SCOPE_FILE.write_text(json.dumps(scope),encoding='utf-8')
    assert client.get(citation['preview_path']).status_code==410
