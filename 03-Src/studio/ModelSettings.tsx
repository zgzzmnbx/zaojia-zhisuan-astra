import {lazy,Suspense,useEffect,useState} from 'react';
import {DEBUG_MODE} from '../frontend-debug/mock-adapter';
import {api,json} from './api';
import {Icon} from './ui';
import {modelProviders,modelValidation,modelConfigurationStatus,saveModelCredential,type ModelParameters,type ModelConnections,type ModelCredential} from './model-settings';
import './model-settings.css';

const ModelWorkflow=lazy(()=>import('./ModelWorkflow'));
export default function ModelSettings({active,changed,onBusy}:{active:boolean;changed:()=>void;onBusy:(label:string)=>void}){
 const [saved,setSaved]=useState<ModelParameters|null>(null),[draft,setDraft]=useState<ModelParameters|null>(null),[connections,setConnections]=useState<ModelConnections|null>(null);
 const [credential,setCredential]=useState<ModelCredential>({enabled:false,key_file:''});
 const [company,setCompany]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(DEBUG_MODE)return;let live=true;setError('');
  void Promise.all([api<ModelParameters>('/api/astra/connections/model'),api<ModelConnections>('/api/astra/connections')]).then(([m,c])=>{if(live){setSaved(m);setDraft(m);setConnections(c);setCredential(c.models[m.provider]||{enabled:false,key_file:''});}}).catch(e=>{if(live)setError(e.message);});
  return()=>{live=false;};
 },[retry]);
 async function save(kind:'model'|'credential'){
  if(!draft)return;
  const issue=kind==='model'?modelValidation(draft):credential.key_file.length>512||/[\r\n\0]/.test(credential.key_file)?'凭证文件路径无效。':'';
  if(issue){setError(issue);return;}
  setBusy(true);onBusy('正在保存大模型配置…');setError('');setMessage('');
  try{
   if(kind==='model'){
    const result=await api<ModelParameters>('/api/astra/connections/model',{...json({...draft,model:draft.model.trim(),baseUrl:draft.baseUrl.trim()}),method:'PUT'});
    setSaved(result);setDraft(result);setMessage('模型参数已保存，后续任务使用此配置；已开始的任务保留原配置。');
   }else{
    const result=await saveModelCredential(draft.provider,credential);setConnections(result);setCredential(result.models[draft.provider]);
    setMessage('凭证配置已保存。此操作未调用模型，连接结果需在业务任务中验证。');
   }
   changed();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);onBusy('');}
 }
 if(DEBUG_MODE)return <p>调试版不读取模型凭证，请在正式工作室配置。</p>;
 const status=modelConfigurationStatus(connections,saved);
 return <div className="model-settings">
  <div className="ms-intro"><div><h4>业务框架独立，模型按需接入</h4><p>通过 API 调用模型，保留规则、知识与人工确认流程。</p></div><span className="badge badge-outline">{status}</span></div>
  <div className="ms-development"><span>开发阶段</span><b>智能体工具 · 如 Codex</b><Icon name="arrow-right"/><b>框架与专业工具</b><Icon name="arrow-right"/><b>单机验证</b></div>
  <div className="ms-preview-tabs" role="group" aria-label="模型接入方案预览"><button type="button" className={`btn btn-sm ${!company?'btn-primary':'btn-ghost'}`} aria-pressed={!company} onClick={()=>setCompany(false)}>当前模型</button><button type="button" className={`btn btn-sm ${company?'btn-primary':'btn-ghost'}`} aria-pressed={company} onClick={()=>setCompany(true)}>管网接入预览</button><span>仅切换示意，不修改配置</span></div>
  {active&&<Suspense fallback={<div className="ms-flow-loading" role="status">正在载入模型工作流…</div>}><ModelWorkflow company={company} model={saved?.model||''} status={status} selectCompany={setCompany}/></Suspense>}
  <div className={`ms-explanation ${company?'is-company':''}`}><Icon name={company?'buildings':'link'}/><div><strong>{company?'未来：迁移公司平台，接入管网大模型 API':'当前：独立运行，通过 API 调用所选模型'}</strong><p>{company?'部署到公司平台后，替换模型地址、名称与鉴权配置。须核验接口协议、网络权限及业务效果；管网 API 尚未接入。':'大模型参与辅助分析与文字生成；规则裁决和人工确认保留。WeKnora 检索与模型在“知识与 WeKnora”中单独管理。'}</p></div></div>
  {error&&<div role="alert" className="ms-error">{error}{!draft&&<button className="btn btn-sm" onClick={()=>setRetry(v=>v+1)}>重新加载</button>}</div>}
  {!draft&&!error&&<p role="status">正在读取模型配置…</p>}
  {draft&&<form className="ms-form" onSubmit={e=>{e.preventDefault();void save('model');}}>
   <div className="ms-form-heading"><h4>模型参数</h4><span>{JSON.stringify(saved)!==JSON.stringify(draft)?'有未保存修改':'已保存配置'}</span></div>
   <fieldset disabled={busy}><div className="ms-fields">
    <label className="field">凭证通道<select className="select select-bordered" value={draft.provider} onChange={e=>{setDraft({...draft,provider:e.target.value});setCredential(connections?.models[e.target.value]||{enabled:false,key_file:''});setMessage('');}}>{modelProviders.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
    <label className="field">模型名称<input className="input input-bordered" value={draft.model} onChange={e=>setDraft({...draft,model:e.target.value})} required/></label>
    <label className="field ms-wide">API 地址<input className="input input-bordered" type="url" value={draft.baseUrl} onChange={e=>setDraft({...draft,baseUrl:e.target.value})} required spellCheck={false}/><small>当前适配 Chat Completions 接口；其他模型或企业接口需确认协议兼容。</small></label>
   </div><details className="ms-advanced"><summary>生成参数</summary><div className="ms-fields"><label className="field">温度<input className="input input-bordered" type="number" min="0" max="2" step="0.1" value={draft.temperature} onChange={e=>setDraft({...draft,temperature:e.target.valueAsNumber})}/></label><label className="field">最大输出 Tokens<input className="input input-bordered" type="number" min="1" max="131072" value={draft.maxTokens} onChange={e=>setDraft({...draft,maxTokens:e.target.valueAsNumber})}/></label></div></details>
   <div className="ms-actions"><button className="btn btn-primary btn-sm" type="submit">保存模型参数</button><button className="btn btn-ghost btn-sm" type="button" onClick={()=>{setDraft(saved);setCredential(connections?.models[saved!.provider]||{enabled:false,key_file:''});setError('');}}>撤销参数修改</button></div></fieldset>
   <details className="ms-credential"><summary>独立凭证 · {modelProviders.find(p=>p.id===draft.provider)?.label}</summary><fieldset disabled={busy}><label className="ms-enable"><input className="toggle toggle-sm" type="checkbox" checked={credential.enabled} onChange={e=>setCredential({...credential,enabled:e.target.checked})}/>启用此凭证通道</label><label className="field">API Key 文件路径<input className="input input-bordered" value={credential.key_file} placeholder="填写本机凭证文件路径" autoComplete="off" onChange={e=>setCredential({...credential,key_file:e.target.value})}/><small>只保存路径，密钥内容不返回页面。启用或保存不会发送模型请求。</small></label><button type="button" className="btn btn-outline btn-sm" onClick={()=>void save('credential')}>保存此通道凭证</button></fieldset></details>
  </form>}
  {message&&<p className="ms-message" role="status">{message}</p>}
 </div>;
}
