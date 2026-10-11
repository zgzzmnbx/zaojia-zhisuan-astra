import json
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
import server

BASE = '/api/astra/workspace'

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(server.paths, 'RUNTIME_DIR', tmp_path)
    with TestClient(server.app) as client:
        yield client

def project(client, name='测试项目'):
    response = client.post(BASE+'/projects', json={'name':name, 'background':'共享背景'})
    assert response.status_code == 200
    return response.json()['id']

def conversation(client, project_id=None):
    return client.post(BASE+'/conversations', json={'project_id':project_id}).json()['id']

def save(client, id, state, revision=0, token='first'):
    return client.put(BASE+'/conversations/'+id, json={'state':state, 'revision':revision, 'write_token':token, 'title':'保存的对话'})

def asset(client, id, body=b'source', name='source.md'):
    result=client.post(BASE+'/assets', data={'conversation_id':id}, files={'file':(name, body)})
    assert result.status_code == 200, result.text
    return result.json()

def test_conversation_persists_cards_draft_and_search(client):
    id=conversation(client)
    state={'messages':[{'role':'user','text':'隧道工程问题'}, {'role':'assistant','text':'依据', 'card':{'kind':'source','title':'原文'}}], 'draft':'待发草稿', 'sheets':[{'sheet_name':'表2'}]}
    assert save(client,id,state).status_code==200
    assert client.get(BASE+'/conversations/'+id).json()['state']==state
    assert client.get(BASE+'/conversations/search',params={'q':'隧道'}).json()['items'][0]['id']==id
    assert client.get(BASE+'/conversations/search',params={'q':'不存在'}).json()['items']==[]

def test_revision_conflict_and_idempotent_retry(client):
    id=conversation(client)
    assert save(client,id,{'draft':'first'}).json()['revision']==1
    assert save(client,id,{'draft':'first'}).json()['revision']==1
    assert save(client,id,{'draft':'second'},token='other-tab').status_code==409
    assert client.get(BASE+'/conversations/'+id).json()['state']['draft']=='first'
    assert save(client,id,{'draft':'second'},revision=1,token='next').json()['revision']==2

def test_project_sharing_and_private_scope(client):
    shared=project(client);a=conversation(client,shared);b=conversation(client,shared);c=conversation(client,project(client,'其他项目'));private=conversation(client)
    file=asset(client,a);own=asset(client,private,b'private')
    assert client.get(BASE+'/assets/'+file['id'],params={'conversation_id':b}).content==b'source'
    assert client.get(BASE+'/assets/'+file['id'],params={'conversation_id':c}).status_code==403
    assert save(client,c,{'inputFileId':file['id']}).status_code==403
    assert client.get(BASE+'/assets/'+own['id'],params={'conversation_id':a}).status_code==403
    assert client.post(BASE+'/conversations/'+private+'/project',json={'project_id':shared}).status_code==200
    assert client.get(BASE+'/assets/'+own['id'],params={'conversation_id':b}).content==b'private'
    assert client.post(BASE+'/conversations/'+a+'/project',json={'project_id':project(client,'新项目')}).status_code==409

def test_same_filename_retains_immutable_versions(client):
    id=conversation(client);a=asset(client,id,b'first');b=asset(client,id,b'second')
    assert a['id']!=b['id'] and a['sha256']!=b['sha256']
    assert client.get(BASE+'/assets/'+a['id']).content==b'first'
    assert client.get(BASE+'/assets/'+b['id']).content==b'second'

@pytest.mark.parametrize('name',['../secret.md','evil.exe','.hidden.md','a:b.md'])
def test_invalid_upload_names_are_rejected(client,name):
    id=conversation(client)
    assert client.post(BASE+'/assets',data={'conversation_id':id},files={'file':(name,b'body')}).status_code==400

def test_job_association_and_review_drafts_never_send(client):
    a,b=conversation(client),conversation(client);job=uuid4().hex
    path=server.paths.RUNTIME_DIR/job;path.mkdir();(path/'process-state.json').write_text('{}')
    assert save(client,a,{'job_id':job}).status_code==200
    assert save(client,b,{'job_id':job}).status_code==409
    payload={'conversation_id':a,'job_id':job,'platform':'weact','recipients':'待核验人员','instructions':'复核表2的技术系数'}
    response=client.post(BASE+'/reviews',json=payload)
    assert response.status_code==200 and response.json()['status']=='draft'
    assert client.get(BASE+'/reviews',params={'conversation_id':a}).json()['items'][0]['instructions']==payload['instructions']
    assert client.post(BASE+'/reviews',json={**payload,'conversation_id':b}).status_code==409
    assert client.get('/api/astra/collaboration/status').json()['external_sending'] is False

def test_workspace_save_does_not_wait_for_business_lock(client):
    id=conversation(client)
    # Simulate a long calculation. Conversation writes have an independent SQLite transaction.
    original=server.write_lock
    class Locked:
        def locked(self): return True
    try:
        server.write_lock=Locked()
        assert save(client,id,{'draft':'长任务期间输入'}).status_code==200
    finally: server.write_lock=original

def test_original_articles_and_network_available(client):
    articles=client.get('/api/knowledge-articles').json();graph=client.get('/api/knowledge-articles/graph').json()
    assert articles['article_count']==100 and len(graph['nodes'])==100 and len(graph['edges'])==202
    frozen=json.loads((Path(__file__).resolve().parents[1]/'03-Src/engine/06-知识库问答资料/造价知识文章库/manifest.json').read_text(encoding='utf-8'))
    assert {a['id'] for a in frozen['articles']} <= {a['id'] for a in articles['articles']}
    detail=client.get('/api/knowledge-articles/'+articles['articles'][0]['id']).json()['article']
    assert len(detail['body'])>100

def test_knowledge_adapter_never_invents_model_answer(client,monkeypatch):
    async def search(payload):return {'results':[{'title':'实际规则','snippet':'原文'}], 'evidence_found':True}
    monkeypatch.setattr(server.engine,'knowledge_search',search)
    result=client.post('/api/astra/knowledge/ask',json={'question':'任意专业问题'}).json()
    assert result['generated_by_model'] is False and result['answer_mode']=='evidence_only'
    assert result['sources']==[{'title':'实际规则','snippet':'原文'}]

def test_invalid_message_snapshot_is_not_saved(client):
    id=conversation(client)
    assert save(client,id,{'messages':['invalid']}).status_code==400
    assert client.get(BASE+'/conversations/'+id).json()['revision']==0
