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
    assert not demo_cues.last_valid_path().exists()
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

@pytest.mark.parametrize('text',['','   ','## inject · 标题\n正文','##\t【P4】\n正文','字'*4001,None])
def test_invalid_edits_never_create_file(client,text):
    old=client.get('/api/astra/demo-cues').json()
    assert client.put('/api/astra/demo-cues',json={'revision':old['revision'],'id':'intro','text':text}).status_code==400
    assert not demo_cues.DOCUMENT.exists()

def test_external_edit_reloaded_and_invalid_read_preserves_last_good(client):
    demo_cues.DOCUMENT.parent.mkdir(parents=True)
    demo_cues.DOCUMENT.write_text('## intro · 开场\n\n外部编辑。\n','utf-8')
    assert client.get('/api/astra/demo-cues').json()['entries'][0]['text']=='外部编辑。'
    demo_cues.DOCUMENT.write_text('invalid','utf-8')
    fallback=client.get('/api/astra/demo-cues').json()
    assert fallback['stale'] is True
    assert fallback['entries'][0]['text']=='外部编辑。'
    assert demo_cues.DOCUMENT.read_text('utf-8')=='invalid'
    assert client.put('/api/astra/demo-cues',json={'revision':fallback['revision'],'id':'intro','text':'禁止覆盖坏文件'}).status_code==503

def test_plain_markdown_headings_are_read_without_rewriting_manuscript(client):
    raw='\ufeff# 演讲稿\r\n\r\n## 【P1】\r\n\r\n开场原话。\r\n\r\n## intro · 系统演示\r\n\r\n原话不改。\r\n\r\n## 【P4】\r\n\r\n总结原话。\r\n'
    demo_cues.DOCUMENT.parent.mkdir(parents=True)
    demo_cues.DOCUMENT.write_bytes(raw.encode('utf-8'))
    data=client.get('/api/astra/demo-cues').json()
    assert [e['title'] for e in data['entries']]==['【P1】','系统演示','【P4】']
    assert [e['text'] for e in data['entries']]==['开场原话。','原话不改。','总结原话。']
    assert data['entries'][1]['id']=='intro'
    assert demo_cues.DOCUMENT.read_bytes()==raw.encode('utf-8')
    assert demo_cues.DOCUMENT.with_name('astra-demo-cues.last-valid.md').read_bytes()==raw.encode('utf-8')
    entry=data['entries'][2]
    updated=client.put('/api/astra/demo-cues',json={'revision':data['revision'],'id':entry['id'],'text':'仅用户明确编辑的段落。'}).json()
    assert updated['entries'][:2]==data['entries'][:2]
    assert demo_cues.DOCUMENT.read_bytes().startswith(raw.split('总结原话。')[0].encode('utf-8'))

def test_duplicate_plain_titles_have_stable_distinct_ids():
    first=demo_cues.parse('## 【P4】\n甲\n## 【P4】\n乙\n')
    second=demo_cues.parse('## 新插入\n丙\n## 【P4】\n甲\n## 【P4】\n乙\n')
    assert first==second[1:]
    assert len({e['id'] for e in first})==2
    with pytest.raises(ValueError):demo_cues.parse('## intro · 甲\n甲\n## intro · 乙\n乙\n')

def test_cache_is_shared_with_new_clients_and_recovers_after_repair(client):
    demo_cues.DOCUMENT.parent.mkdir(parents=True)
    demo_cues.DOCUMENT.write_text('## 【P4】\n总结原话。\n','utf-8')
    good=client.get('/api/astra/demo-cues').json()
    demo_cues.DOCUMENT.write_bytes(b'\xff\xfe\x00')
    app=FastAPI();app.include_router(demo_cues.router)
    fresh=TestClient(app)
    cached=fresh.get('/api/astra/demo-cues').json()
    assert cached['entries']==good['entries'] and cached['stale']
    assert demo_cues.DOCUMENT.read_bytes()==b'\xff\xfe\x00'
    demo_cues.DOCUMENT.write_text('## 【P4】\n修复后的原话。\n','utf-8')
    repaired=fresh.get('/api/astra/demo-cues').json()
    assert 'stale' not in repaired
    assert repaired['entries'][0]['text']=='修复后的原话。'

def test_no_cache_and_invalid_document_reports_error_without_fabricated_speech(client):
    demo_cues.DOCUMENT.parent.mkdir(parents=True)
    demo_cues.DOCUMENT.write_text('invalid','utf-8')
    assert client.get('/api/astra/demo-cues').status_code==503

def test_missing_manuscript_preserves_most_recent_saved_version(client):
    old=client.get('/api/astra/demo-cues').json()
    saved=client.put('/api/astra/demo-cues',json={
        'revision':old['revision'],'id':'intro','text':'最新开场提词。',
    }).json()
    demo_cues.DOCUMENT.rename(demo_cues.DOCUMENT.with_suffix('.editing'))

    fallback=client.get('/api/astra/demo-cues').json()
    assert fallback['stale'] is True
    assert fallback['entries']==saved['entries']
    assert fallback['revision']==saved['revision']
    assert not demo_cues.DOCUMENT.exists()
