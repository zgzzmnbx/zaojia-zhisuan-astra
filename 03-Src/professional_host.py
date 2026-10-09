"""Astra's professional adapter. Frozen engine code and pricing assets are read-only."""
from __future__ import annotations
import json
import os
import re
import shutil
from dataclasses import replace
from pathlib import Path
from fastapi import APIRouter, Body, HTTPException

ROOT=Path(__file__).resolve().parents[1]
CONFIG=ROOT/'config/astra-connections.local.json'
router=APIRouter(prefix='/api/astra/connections')
_engine=None

@router.post('/platforms/{profile_id}/connection')
def platform_connection(profile_id:str,payload:dict=Body(...)):
    from app import feishu_app_bot
    enabled=payload.get('enabled')
    if type(enabled) is not bool:raise HTTPException(400,'enabled 必须是布尔值')
    if profile_id not in {'default','weact_cost'}:raise HTTPException(400,'平台无效')
    if enabled:
        credentials=feishu_app_bot.load_credentials(profile_id)
        if not credentials.get('app_id') or not credentials.get('app_secret'):
            raise HTTPException(409,'请先在协同设置中配置此平台凭证')
        issue=feishu_app_bot.credential_configuration_issue(profile_id,credentials)
        if issue:raise HTTPException(409,issue)
    previous=config()
    controls={}
    # Explicit connection enables the existing collaboration gate, preserving all other settings.
    if enabled and not previous.get('external_enabled'):
        # Disabled workspace can contain old enabled controls. Do not silently start other platforms.
        for item in feishu_app_bot.credential_profiles():
            identifier=item['profile_id']
            controls[identifier]=feishu_app_bot._read_enabled_control(feishu_app_bot.bot_control_path(identifier))
            feishu_app_bot.save_bot_enabled(False,identifier)
        CONFIG.parent.mkdir(parents=True,exist_ok=True)
        temporary=CONFIG.with_suffix('.tmp')
        temporary.write_text(json.dumps({**previous,'external_enabled':True},ensure_ascii=False,indent=2),encoding='utf-8')
        temporary.replace(CONFIG)
    try:
        return _engine.update_feishu_app_bot_settings({'profile_id':profile_id,'enabled':enabled})
    except Exception:
        if enabled and not previous.get('external_enabled'):
            CONFIG.write_text(json.dumps(previous,ensure_ascii=False,indent=2),encoding='utf-8')
            for identifier,value in controls.items():
                feishu_app_bot.save_bot_enabled(bool(value),identifier)
        raise

def require_review_connection(profile_id):
    from app import feishu_app_bot
    if profile_id not in {'default','weact_cost'}:raise HTTPException(400,'请选择飞书或 WeAct 投递平台')
    profile=next((p for p in feishu_app_bot.bot_status().get('profiles',[]) if p.get('profile_id')==profile_id),{})
    health=profile.get('health') or {}
    if not (profile.get('enabled') and profile.get('running') and all(health.get(key) for key in ('fresh','connected','identity_ready','backend_ok'))):
        label='飞书' if profile_id=='default' else 'WeAct'
        raise HTTPException(409,f'{label} 回调接收未就绪，请先在平台状态中恢复连接，再发送复核。')


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
        document,separator,section=filename.rpartition('#')
        markdown_section=bool(separator and section and Path(document).suffix.lower()=='.md')
        path=Path(document if markdown_section else filename)
        if not path.is_absolute():path=ROOT/path
        value=path.read_text(encoding='utf-8-sig').strip()
        if markdown_section:
            heading=re.search(r'^(#{1,6})\s+'+re.escape(section.strip())+r'\s*$',value,re.M)
            if not heading:return ''
            tail=value[heading.end():]
            end=re.search(r'^#{1,'+str(len(heading.group(1)))+r'}\s',tail,re.M)
            keys=set(re.findall(r'\bsk-[A-Za-z0-9_-]{12,}',tail[:end.start()] if end else tail))
            # An explicitly referenced section must identify exactly one key.
            if len(keys)!=1:return ''
            return next(iter(keys))
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
    global _engine
    _engine=engine
    import gork_amount
    gork_amount.install(engine)
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
    import model_adapter
    model_adapter.install(engine,model_preference)

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

    original_status=feishu_app_bot.bot_status
    def bot_status(*args,**kwargs):
        result=original_status(*args,**kwargs)
        import time
        try:
            resume_path=feishu_app_bot.RUNTIME_ROOT/'host-resume.json'
            recovery=json.loads(resume_path.read_text(encoding='utf-8'))
            monitor_fresh=time.time()-resume_path.stat().st_mtime<35
        except (OSError,ValueError):
            recovery={};monitor_fresh=False
        supervised=feishu_app_bot._pid_is_running(feishu_app_bot.RUNTIME_ROOT/'supervisor.pid')
        for profile in result.get('profiles',[]):
            profile['supervision_ok']=bool(supervised and monitor_fresh)
            profile['recovery_status']=recovery.get('status','')
            if profile.get('enabled') and not profile.get('running'):
                reason=recovery.get('status') if profile.get('profile_id') in recovery.get('profiles',[]) else ''
                profile['recovery_issue']={'blocked_old_queue':'有未完成旧队列，自动恢复已暂停；需核对后处理。','start_failed':'接收监护启动失败，请检查运行日志。'}.get(reason,'')
            if profile.get('enabled') and not profile.get('running') and profile.get('status')=='starting':
                profile['status']='stopped'
        return result
    feishu_app_bot.bot_status=bot_status

    original_enabled=feishu_app_bot.is_bot_enabled
    feishu_app_bot.is_bot_enabled=lambda profile_id=None:bool(config().get("external_enabled")) and original_enabled(profile_id)

    def start_supervisor():
        import subprocess,sys
        if os.name!='nt':return False
        pid_path=feishu_app_bot.RUNTIME_ROOT/'supervisor.pid'
        with feishu_app_bot._profile_start_lock('supervisor') as acquired:
            if not acquired or feishu_app_bot._pid_is_running(pid_path):
                return feishu_app_bot._pid_is_running(pid_path)
            log_path=feishu_app_bot.RUNTIME_ROOT/'logs/supervisor.log'
            log_path.parent.mkdir(parents=True,exist_ok=True)
            with log_path.open('a',encoding='utf-8') as output:
                process=subprocess.Popen([sys.executable,str(ROOT/'tools/run_collaboration_supervisor.py')],
                    cwd=ROOT,stdout=output,stderr=output,creationflags=subprocess.CREATE_NO_WINDOW)
            pid_path.write_text(str(process.pid),encoding='utf-8')
        return True
    feishu_app_bot.start_local_bot_supervisor=start_supervisor
