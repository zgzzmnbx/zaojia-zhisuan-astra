import sys
from pathlib import Path
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'03-Src'))
import demo_cues

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(demo_cues,'DOCUMENT',tmp_path/'config'/'astra-demo-cues.md')
    app=FastAPI();app.include_router(demo_cues.router)
    return TestClient(app)

def test_initial_original_speech_and_read_only_fallback(client):
    snapshot=client.get('/api/astra/demo-cues').json()
    assert len(snapshot['entries'])==34
    assert snapshot['entries'][0]['id']=='intro'
    assert snapshot['entries'][0]['text']=='下面给各位领导直接演示真实的系统。'
    assert not demo_cues.DOCUMENT.exists()
    assert all('听不清' not in e['text'] for e in snapshot['entries'])

def test_edit_persists_only_target_and_rejects_stale_document(client):
    old=client.get('/api/astra/demo-cues').json()
    payload={'revision':old['revision'],'id':'intro','text':'新的讲解\n第二行。'}
    response=client.put('/api/astra/demo-cues',json=payload)
    assert response.status_code==200
    new=response.json()
    assert new['entries'][0]['text']==payload['text']
    assert new['entries'][1:]==old['entries'][1:]
    assert demo_cues.DOCUMENT.exists()
    assert client.put('/api/astra/demo-cues',json=payload).status_code==409
    assert client.get('/api/astra/demo-cues').json()==new

@pytest.mark.parametrize('text',['','   ','## inject · 标题\n正文','字'*4001,None])
def test_invalid_edits_never_create_file(client,text):
    old=client.get('/api/astra/demo-cues').json()
    assert client.put('/api/astra/demo-cues',json={'revision':old['revision'],'id':'intro','text':text}).status_code==400
    assert not demo_cues.DOCUMENT.exists()

def test_external_edit_reloaded_and_malformed_document_fails_closed(client):
    demo_cues.DOCUMENT.parent.mkdir(parents=True)
    demo_cues.DOCUMENT.write_text('## intro · 开场\n\n外部编辑。\n','utf-8')
    assert client.get('/api/astra/demo-cues').json()['entries'][0]['text']=='外部编辑。'
    demo_cues.DOCUMENT.write_text('invalid','utf-8')
    assert client.get('/api/astra/demo-cues').status_code==503
