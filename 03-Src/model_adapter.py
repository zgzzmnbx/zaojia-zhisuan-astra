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
from app.formula_resolver import WorkbookFormulaResolver

_knowledge_request=ContextVar('astra_knowledge_request',default=None)
_report_request=ContextVar('astra_report_request',default=None)

@contextmanager
def report_request(settings=None):
    # Keep the frozen 2.0 prompt and Word insertion logic; budget is report-specific.
    token=_report_request.set(dict(settings or {}))
    try:yield
    finally:_report_request.reset(token)

@contextmanager
def knowledge_request(settings=None):
    token=_knowledge_request.set(dict(settings or {}))
    try:yield
    finally:_knowledge_request.reset(token)

def knowledge_completion(config,messages):
    return validated_completion(config,messages,purpose='问答')

def validated_completion(config,messages,*,purpose):
    key=config.resolved_api_key()
    if not key:raise ValueError('所选模型未配置独立凭证')
    body={'model':config.model,'messages':messages,'temperature':config.temperature,
          'max_tokens':config.max_tokens}
    if config.provider=='deepseek' and config.model in {'deepseek-flash','deepseek-v4-flash','deepseek-v4-pro'}:
        body['thinking']={'type':'disabled'}
    label='DeepSeek' if config.provider=='deepseek' else '所选模型'
    request=Request(config.chat_completions_url(),data=json.dumps(body,ensure_ascii=False).encode('utf-8'),
                    headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'},method='POST')
    try:
        with urlopen(request,timeout=90) as response:data=json.load(response)
    except HTTPError as exc:raise RuntimeError(f'{label} {purpose}请求失败（HTTP {exc.code}），未发布正文') from None
    except (URLError,TimeoutError,ConnectionError):raise RuntimeError(f'{label} {purpose}连接失败，未发布正文') from None
    except (ValueError,UnicodeError):raise RuntimeError(f'{label} {purpose}返回格式异常，未发布正文') from None
    try:
        choice=data['choices'][0]
        if not isinstance(choice,dict) or not isinstance(choice.get('message'),dict):raise TypeError('message required')
        reason=choice.get('finish_reason')
        completed=reason=='stop' or (purpose!='报告' and reason is None)
        if not completed:raise RuntimeError(f'{label} {purpose}未完整结束（{reason}），未发布截断或受限正文')
        answer=choice['message'].get('content')
        if not isinstance(answer,str):raise TypeError('text content required')
        answer=answer.strip()
    except (KeyError,IndexError,TypeError):raise RuntimeError(f'{label} {purpose}返回格式异常，未发布正文') from None
    if not answer:raise RuntimeError(f'{label} 未返回{purpose}正文，未用系统补充或原文摘录冒充模型正文')
    return answer

def report_fee_summary(path):
    # Reuse the same read-only resolver as the existing Word / table adapters.
    # A missing Excel formula cache is not a missing business amount.
    with WorkbookFormulaResolver(path) as workbook:
        if '费用汇总' not in workbook.sheetnames:return '未发现费用汇总 sheet。'
        sheet=workbook.formula_workbook['费用汇总']
        rows=[]
        for index in range(1,min(sheet.max_row,20)+1):
            values=[]
            for column in range(1,min(sheet.max_column,4)+1):
                value=workbook.cell_value('费用汇总',index,column)
                raw=sheet.cell(index,column).value
                if value is None and isinstance(raw,str) and raw.startswith('='):
                    value=f'未能解析（{sheet.cell(index,column).coordinate}）'
                values.append('' if value is None else str(value))
            if any(values):rows.append(' | '.join(values))
        return '同一成果费用汇总的只读解析值；不代表 Excel 已完成重算验收，正式出具前应核验重算。\n'+'\n'.join(rows)

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
    original_prompt=engine.build_risk_prompt
    def report_prompt(report_markdown,excel_path,knowledge_evidence=''):
        messages=original_prompt(report_markdown,excel_path,knowledge_evidence)
        if _report_request.get() is not None:
            content=messages[1]['content']
            before,separator,rest=content.partition('【费用汇总】\n\n')
            _,end,after=rest.partition('\n\n【知识库依据】')
            if separator and end:
                messages[1]={**messages[1],'content':before+separator+report_fee_summary(excel_path)+end+after}
        return messages
    engine.build_risk_prompt=report_prompt
    original_config=engine.LlmConfig
    def scoped_config(*args,**kwargs):
        config=original_config(*args,**kwargs)
        snapshot=_report_request.get()
        if snapshot is not None:
            maximum=snapshot.get('maxTokens')
            # 1800 tokens truncated a real five-section report. Do not change saved QA settings.
            maximum=max(4096,maximum) if isinstance(maximum,int) else 4096
            config=replace(config,max_tokens=maximum,temperature=snapshot.get('temperature',config.temperature))
        return config
    # Context-local constructor adaptation keeps the prompt, audit and transport identical.
    engine.LlmConfig=scoped_config
    original_completion=engine.call_chat_completion
    def completion(config,messages):
        if _report_request.get() is not None:
            return validated_completion(config,messages,purpose='报告')
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
