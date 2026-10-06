"""Astra's professional adapter. Frozen engine code and pricing assets are read-only."""
from __future__ import annotations
import json
import os
import shutil
from dataclasses import replace
from pathlib import Path
from fastapi import APIRouter, Body, HTTPException

ROOT=Path(__file__).resolve().parents[1]
CONFIG=ROOT/'config/astra-connections.local.json'
router=APIRouter(prefix='/api/astra/connections')

def config():
    try:
        value=json.loads(CONFIG.read_text(encoding='utf-8'))
        return value if isinstance(value,dict) else {}
    except (OSError,ValueError):return {}

def model_key(provider='deepseek'):
    settings=config().get('models',{}).get(provider,{})
    if not settings.get('enabled'):return ''
    filename=settings.get('key_file','')
    if not filename:return ''
    try:
        path=Path(filename)
        if not path.is_absolute():path=ROOT/path
        value=path.read_text(encoding='utf-8-sig').strip()
        if not value or '\n' in value or len(value)>4096:return ''
        return value
    except (OSError,ValueError):return ''

@router.get('')
def status():
    settings=config()
    import weknora
    try: wk=json.loads(weknora.CONFIG_FILE.read_text(encoding='utf-8'))
    except (OSError,ValueError):wk={}
    return {'models':{provider:{'enabled':bool(settings.get('models',{}).get(provider,{}).get('enabled')),
        'key_file':settings.get('models',{}).get(provider,{}).get('key_file',''),
        'configured':bool(model_key(provider)),'verified':False} for provider in ['deepseek','siliconflow']},
        'external_enabled':bool(settings.get('external_enabled',False)),
        'collaboration_file':str(settings.get('collaboration_file','')),
        'weknora':{key:wk.get(key,default) for key,default in [('enabled',False),('base_url','http://127.0.0.1:18091'),('api_key_file','')]},
        'note':'配置状态不代表模型或外部平台已联通。密钥仅在请求时读取，不返回浏览器。'}

@router.put('')
def save(payload:dict=Body(...)):
    models={}
    for provider in ['deepseek','siliconflow']:
        item=payload.get('models',{}).get(provider,{})
        filename=str(item.get('key_file','')).strip()
        if len(filename)>512 or any(char in filename for char in '\n\r\0'):
            raise HTTPException(400,'凭证文件路径无效')
        models[provider]={'enabled':item.get('enabled') is True,'key_file':filename}
    collaboration_file=str(payload.get('collaboration_file','')).strip()
    if len(collaboration_file)>512 or any(c in collaboration_file for c in '\r\n\0'):
        raise HTTPException(400,'协同凭证文件路径无效')
    wk_config=None
    if 'weknora' in payload:
        import weknora
        from urllib.parse import urlparse
        wk=payload['weknora'];base=str(wk.get('base_url','http://127.0.0.1:18091')).rstrip('/')
        parsed=urlparse(base)
        if parsed.scheme!='http' or parsed.hostname not in {'127.0.0.1','localhost'} or parsed.path or parsed.query or parsed.fragment or parsed.username:
            raise HTTPException(400,'WeKnora 地址必须为本机 HTTP 服务')
        filename=str(wk.get('api_key_file','')).strip()
        if len(filename)>512 or any(c in filename for c in '\r\n\0'):raise HTTPException(400,'WeKnora 凭证文件路径无效')
        wk_config={'enabled':wk.get('enabled') is True,'base_url':base,'api_key_file':filename}
    # Validate the entire form before writing either settings file.
    CONFIG.parent.mkdir(parents=True,exist_ok=True)
    temporary=CONFIG.with_suffix('.tmp')
    temporary.write_text(json.dumps({**config(),'models':models,'collaboration_file':collaboration_file,'external_enabled':payload.get('external_enabled') is True},ensure_ascii=False,indent=2),encoding='utf-8')
    temporary.replace(CONFIG)
    if wk_config is not None:
        weknora.CONFIG_FILE.parent.mkdir(parents=True,exist_ok=True)
        wk_temp=weknora.CONFIG_FILE.with_suffix('.tmp')
        wk_temp.write_text(json.dumps(wk_config,ensure_ascii=False,indent=2),encoding='utf-8')
        wk_temp.replace(weknora.CONFIG_FILE)
    return status()

@router.get('/model')
def model_preference():
    return config().get('model',{'provider':'deepseek','model':'deepseek-v4-flash','baseUrl':'https://api.deepseek.com','temperature':0.2,'maxTokens':1800})

@router.put('/model')
def save_model(payload:dict=Body(...)):
    from urllib.parse import urlparse
    if payload.get('provider') not in {'deepseek','siliconflow'}:raise HTTPException(400,'请选择支持的模型平台')
    parsed=urlparse(str(payload.get('baseUrl','')))
    if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password:raise HTTPException(400,'模型地址必须为 HTTPS 且不含凭证')
    if not str(payload.get('model','')).strip():raise HTTPException(400,'模型名称不能为空')
    clean={key:payload[key] for key in ['provider','model','baseUrl','temperature','maxTokens'] if key in payload}
    CONFIG.parent.mkdir(parents=True,exist_ok=True)
    CONFIG.write_text(json.dumps({**config(),'model':clean},ensure_ascii=False,indent=2),encoding='utf-8')
    return clean

PREFIXES=('/api/settlement-audit/','/api/professional-skills/','/api/experience-pool/',
    '/api/workload-capture/','/api/knowledge-memory/','/api/trusted-experience/',
    '/api/collaboration/','/api/experience-warnings/')
EXACT={'/api/input/field-preferences','/api/ui-preferences','/api/preview-column-preferences',
    '/api/quality/experience-pool','/api/projects/map','/api/projects/unlocated','/api/projects/spatial-candidates',
    '/api/projects/{project_id}/spatial','/api/projects/{project_id}/spatial/analyze',
    '/api/process/{job_id}/ai-matching','/api/process/{job_id}/ai-matching/analyze',
    '/api/process/{job_id}/ai-matching/confirm','/api/process/{job_id}/ai-matching/cancel',
    '/api/llm-chat','/api/task-monitor/current','/api/tasks/{task_id}/monitor','/api/demo/load-sample'}

def accepts(path):return path in EXACT or path.startswith(PREFIXES)

def install(engine,paths):
    # Fork only mutable pool / preferences. Formal KB, rules, manifests and templates stay frozen.
    working=paths.RUNTIME_DIR/'astra-working-assets'
    working.mkdir(parents=True,exist_ok=True)
    names=['DEFAULT_EXPERIENCE_POOL_PATH','DEFAULT_INPUT_FIELD_PREFERENCES_PATH',
        'DEFAULT_EXPERIENCE_FIELD_PREFERENCES_PATH','DEFAULT_EXPERIENCE_WARNING_SETTINGS_PATH',
        'DEFAULT_WORKLOAD_FIELD_PREFERENCES_PATH','DEFAULT_WORKLOAD_TARGET_FIELD_PREFERENCES_PATH']
    for name in names:
        source=getattr(paths,name);target=working/source.name
        if not target.exists() and source.is_file():shutil.copy2(source,target)
        setattr(paths,name,target);setattr(engine,name,target)
    original=engine._skill_runtime_context
    def runtime(snapshot):
        context=original(snapshot)
        if context.skill_id!='survey-measurement-limit-price':return context
        return replace(context,risk_profile={**context.risk_profile,
            'experiencePool':engine.DEFAULT_EXPERIENCE_POOL_PATH,
            'warningSettings':engine.DEFAULT_EXPERIENCE_WARNING_SETTINGS_PATH})
    engine._skill_runtime_context=runtime
    from app.llm import LlmConfig
    LlmConfig.resolved_api_key=lambda self:model_key(self.provider)

    from app import settlement_audit_api
    settlement_audit_api.SETTLEMENT_REFERENCE_TEMPLATE=ROOT/"03-Src/professional-assets/settlement-reference.xlsx"
    settlement_audit_api.MAX_SETTLEMENT_FILE_BYTES=30*1024*1024
    from app import feishu_app_bot,feishu_robot_settings
    original_defaults=feishu_app_bot.load_bot_defaults
    def bot_defaults():
        return {**original_defaults(),'apiBaseUrl':'http://127.0.0.1:5189','maxFileSizeMb':30,'expectedProfiles':{}}
    feishu_app_bot.load_bot_defaults=bot_defaults
    original_section=feishu_robot_settings.load_section
    def section(name):
        saved=original_section(name)
        filename=config().get('collaboration_file','')
        if name!='app_bot' or not filename:return saved
        try:
            path=Path(filename)
            raw=json.loads((path if path.is_absolute() else ROOT/path).read_text(encoding='utf-8-sig'))
            credentials=raw.get('app_bot',raw)
            return {**saved,'profiles':credentials.get('profiles',{}),'active_profile':saved.get('active_profile') or credentials.get('active_profile','')}
        except (OSError,ValueError,AttributeError):return saved
    feishu_robot_settings.load_section=section

    original_enabled=feishu_app_bot.is_bot_enabled
    feishu_app_bot.is_bot_enabled=lambda profile_id=None:bool(config().get("external_enabled")) and original_enabled(profile_id)
