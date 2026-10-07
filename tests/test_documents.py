import hashlib
import io
import sys
import zipfile
from pathlib import Path

import pytest
from docx import Document
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '03-Src'))
import server
import documents

BASE = '/api/astra/documents'
WORKSPACE = '/api/astra/workspace'

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(server.paths, 'RUNTIME_DIR', tmp_path)
    with TestClient(server.app) as client:
        yield client

def upload(client, name, content):
    conversation = client.post(WORKSPACE+'/conversations', json={}).json()['id']
    response = client.post(WORKSPACE+'/assets', data={'conversation_id': conversation}, files={'file': (name, content)})
    assert response.status_code == 200, response.text
    asset = response.json()
    return {'kind': 'asset', 'source_id': asset['id'], 'conversation_id': conversation, 'sha256': asset['sha256']}

def test_markdown_conversion_uses_real_core_and_immutable_artifact(client):
    content = '# 费用核对说明\n\n## 一、费用构成\n\n核对金额128.60万元，单位m³，偏差-3.50%。\n\n| 专业 | 金额 |\n|---|---|\n| 勘察 | 86.40 |\n'
    request = upload(client, '费用.md', content.encode())
    reply = client.post(BASE+'/format', json=request)
    assert reply.status_code == 200, reply.text
    output = reply.json()
    params = {'conversation_id': request['conversation_id']}
    raw = client.get(BASE+'/'+output['id']+'/download', params=params).content
    assert hashlib.sha256(raw).hexdigest() == output['sha256']
    doc = Document(io.BytesIO(raw))
    assert '核对金额128.60万元，单位m³，偏差-3.50%。' in [p.text for p in doc.paragraphs]
    assert doc.tables[0].cell(1, 1).text == '86.40'
    checks = client.get(BASE+'/'+output['id']+'/download', params={**params, 'kind': 'checks'}).json()
    assert checks['manifest']['profile_id'] == 'official_body'
    assert checks['manifest']['profile_version'] == '1.2.0'
    assert not any(c['status'] == 'fail' for c in checks['checks'])
    original = client.get(WORKSPACE+'/assets/'+request['source_id'], params=params).content
    assert original == content.encode()
    other = client.post(WORKSPACE+'/conversations', json={}).json()['id']
    assert client.get(BASE+'/'+output['id']+'/download', params={'conversation_id': other}).status_code == 403

def test_docx_preserves_tables_and_source_package(client):
    doc = Document(); doc.add_heading('核对报告', 0); doc.add_paragraph('金额 1521.56 万元。')
    doc.add_table(rows=2, cols=2).cell(1, 1).text = '保留123.45'
    buffer = io.BytesIO(); doc.save(buffer); original = buffer.getvalue()
    request = upload(client, '原文.docx', original)
    reply = client.post(BASE+'/format', json=request)
    assert reply.status_code == 200, reply.text
    raw = client.get(BASE+'/'+reply.json()['id']+'/download', params={'conversation_id': request['conversation_id']}).content
    output = Document(io.BytesIO(raw))
    assert [p.text for p in output.paragraphs] == [p.text for p in doc.paragraphs]
    assert output.tables[0].cell(1, 1).text == '保留123.45'
    assert hashlib.sha256(original).hexdigest() == request['sha256']
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        assert 'word/document.xml' in archive.namelist()

def test_scope_stale_source_and_invalid_document_fail_closed(client):
    request = upload(client, '无效.docx', b'not a docx')
    assert client.post(BASE+'/format', json={**request, 'sha256': 'old'}).status_code == 409
    other = client.post(WORKSPACE+'/conversations', json={}).json()['id']
    assert client.post(BASE+'/format', json={**request, 'conversation_id': other}).status_code == 403
    assert client.post(BASE+'/format', json=request).status_code == 422
    assert client.get(BASE+'/source', params={**request, 'source_id': '../source'}).status_code == 400

def test_missing_engine_does_not_publish(client, monkeypatch):
    request = upload(client, '正文.md', '# 测试'.encode())
    monkeypatch.setenv('ASTRA_GONGWEN_ROOT', str(Path('missing-source').resolve()))
    assert client.post(BASE+'/format', json=request).status_code == 503
