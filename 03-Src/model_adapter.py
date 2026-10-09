"""Use the selected independent model while freezing each AI attempt's configuration."""
import json
import time
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import replace
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from app.ai_matching.client import AiMatchingClient, AiMatchingClientError, _parse_json_response
from app.llm import LlmConfig

_knowledge_request=ContextVar('astra_knowledge_request',default=None)

@contextmanager
def knowledge_request(settings=None):
    token=_knowledge_request.set(dict(settings or {}))
    try:yield
    finally:_knowledge_request.reset(token)

def knowledge_completion(config,messages):
    key=config.resolved_api_key()
    if not key:raise ValueError('所选模型未配置独立凭证')
    body={'model':config.model,'messages':messages,'temperature':config.temperature,
          'max_tokens':config.max_tokens,'thinking':{'type':'disabled'}}
    request=Request(config.chat_completions_url(),data=json.dumps(body,ensure_ascii=False).encode('utf-8'),
                    headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'},method='POST')
    try:
        with urlopen(request,timeout=90) as response:data=json.load(response)
    except HTTPError as exc:raise RuntimeError(f'DeepSeek 问答请求失败（HTTP {exc.code}），未生成答案') from None
    except (URLError,TimeoutError,ConnectionError) as exc:raise RuntimeError('DeepSeek 问答连接失败，未生成答案') from None
    try:
        choice=data['choices'][0]
        if choice.get('finish_reason')=='length':raise RuntimeError('DeepSeek 回答达到输出上限，未发布截断答案；请提高输出上限后重试')
        answer=str(choice['message'].get('content') or '').strip()
    except (KeyError,IndexError,TypeError):raise RuntimeError('DeepSeek 问答返回格式异常，未生成答案') from None
    if not answer:raise RuntimeError('DeepSeek 未返回回答正文，未将原文摘录冒充模型答案')
    return answer

class AstraMatchingClient(AiMatchingClient):
    def __init__(self,config,preference):
        super().__init__(config)
        self.preference=preference
    def public_config(self):
        return {**super().public_config(),'provider':self.preference.get('provider','deepseek'),'base_url':self.preference.get('baseUrl','https://api.deepseek.com'),'temperature':self.preference.get('temperature',0.2),'max_tokens':self.preference.get('maxTokens') or self.config.max_tokens}
    async def call_json(self,messages,*,started_at):
        deadline=started_at+self.config.total_budget_seconds
        if time.monotonic()>=deadline:raise AiMatchingClientError('AI 匹配总时限已耗尽')
        config=LlmConfig(provider=self.preference.get('provider','deepseek'),model=self.config.model,base_url=self.preference.get('baseUrl','https://api.deepseek.com'),temperature=self.preference.get('temperature',0.2),max_tokens=self.preference.get('maxTokens') or self.config.max_tokens)
        if not config.resolved_api_key():raise AiMatchingClientError('所选模型未配置独立凭证，未调用模型')
        for attempt in range(self.config.max_transient_retries+1):
            self.calls+=1;started=time.monotonic()
            try:raw=await self._request_async(config,messages,deadline=deadline)
            finally:self.elapsed_ms+=int((time.monotonic()-started)*1000)
            try:return _parse_json_response(raw)
            except (json.JSONDecodeError,AiMatchingClientError) as exc:
                if attempt>=self.config.max_transient_retries:raise AiMatchingClientError(f'AI 匹配返回 JSON 无效：{exc}') from exc

def install(engine,preference):
    original_completion=engine.call_chat_completion
    def completion(config,messages):
        snapshot=_knowledge_request.get()
        if snapshot is not None and config.provider=='deepseek' and config.model in {'deepseek-flash','deepseek-v4-pro'}:
            maximum=snapshot.get('maxTokens')
            if isinstance(maximum,int) and maximum>0:config=replace(config,max_tokens=maximum)
            return knowledge_completion(config,messages)
        return original_completion(config,messages)
    engine.call_chat_completion=completion
    original_settings=engine._load_ai_matching_settings
    def settings():
        model=preference()
        return {**original_settings(),'model':model['model'],'modelPreference':dict(model)}
    engine._load_ai_matching_settings=settings
    original_factory=AiMatchingClient.from_options
    def factory(cls,options=None):
        original=original_factory(options)
        configured=(options or {}).get('ai_matching',{})
        # Old attempts without a captured provider retain their original DeepSeek semantics.
        return AstraMatchingClient(original.config,configured.get('modelPreference',{}))
    AiMatchingClient.from_options=classmethod(factory)
