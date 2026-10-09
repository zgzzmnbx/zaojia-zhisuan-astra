import io,json,sys
from pathlib import Path
from types import SimpleNamespace
import pytest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'03-Src'))
import server
import model_adapter
from app.llm import LlmConfig

@pytest.mark.parametrize('content,finish,raises', [('普通答案','stop',False),('','stop',True),('截断正文','length',True)])
def test_ordinary_deepseek_disables_thinking_and_rejects_missing_body(monkeypatch,content,finish,raises):
    calls=[]
    def request(req,timeout):
        calls.append(json.loads(req.data));return io.BytesIO(json.dumps({'choices':[{'message':{'content':content},'finish_reason':finish}]}).encode())
    monkeypatch.setattr(model_adapter,'urlopen',request)
    monkeypatch.setattr(LlmConfig,'resolved_api_key',lambda self:'test-key')
    cfg=LlmConfig(model='deepseek-flash')
    if raises:
        with pytest.raises(RuntimeError):model_adapter.knowledge_completion(cfg,[])
    else:assert model_adapter.knowledge_completion(cfg,[])=='普通答案'
    assert calls[0]['thinking']=={'type':'disabled'}

def test_knowledge_context_preserves_snapshot_and_does_not_escape_scope(monkeypatch):
    calls=[]
    monkeypatch.setattr(model_adapter,'knowledge_completion',lambda config,messages:calls.append(config.max_tokens) or 'answer')
    cfg=LlmConfig(model='deepseek-flash')
    settings={'maxTokens':2048}
    with model_adapter.knowledge_request(settings):
        settings['maxTokens']=4096
        assert server.engine.call_chat_completion(cfg,[])=='answer'
    assert calls==[2048] and model_adapter._knowledge_request.get() is None


def test_blocking_local_model_does_not_block_parallel_event_loop(monkeypatch):
    import asyncio
    import threading
    release=threading.Event()
    monkeypatch.setattr(server.professional_host,'model_preference',lambda:{'provider':'deepseek','maxTokens':2048})
    monkeypatch.setattr(server.professional_host,'model_key',lambda provider:'test-key')
    monkeypatch.setattr(server.engine,'get_demo_answer',lambda question:None)
    async def blocked_model(payload):
        assert model_adapter._knowledge_request.get()['maxTokens']==2048
        return {'overlap':release.wait(1)}
    monkeypatch.setattr(server.engine,'knowledge_ask',blocked_model)
    async def run():
        # Models can wait synchronously; an independent stream must still run.
        asyncio.get_running_loop().call_later(.02,release.set)
        result=await server.knowledge_answer({'question':'并行回归验证'})
        assert result['overlap'] is True
        assert model_adapter._knowledge_request.get() is None
    asyncio.run(run())


def test_blocking_local_retrieval_also_releases_event_loop(monkeypatch):
    import asyncio
    import threading
    release=threading.Event()
    monkeypatch.setattr(server.professional_host,'model_preference',lambda:{'provider':'deepseek'})
    monkeypatch.setattr(server.professional_host,'model_key',lambda provider:'')
    monkeypatch.setattr(server.engine,'get_demo_answer',lambda question:None)
    async def blocked_search(payload):
        assert release.wait(1), 'retrieval blocked the ASGI event loop'
        return {'results':[],'evidence_found':False}
    monkeypatch.setattr(server.engine,'knowledge_search',blocked_search)
    async def run():
        asyncio.get_running_loop().call_later(.02,release.set)
        result=await server.knowledge_answer({'question':'并行回归验证'})
        assert result['model_configured'] is False
        assert result['answer_mode']=='evidence_only'
    asyncio.run(run())
