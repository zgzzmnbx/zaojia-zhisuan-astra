export {Architecture} from './SystemArchitecture';
import {useEffect,useState} from 'react';
import {api,json} from './api';
import {Button,Icon,Note} from './ui';
import {workspaceApi} from './useWorkspace';
export {KnowledgeWorkspace,KnowledgeTabs} from './KnowledgeWorkspace';
export type {Evidence,KnowledgeOptions} from './KnowledgeWorkspace';

export function CollaborationPanel({conversation,job,busy,flush,prepared}:{conversation:string;job:string;busy:boolean;flush:()=>Promise<void>;prepared:()=>void}){
  const [status,setStatus]=useState<any>(null),[drafts,setDrafts]=useState<any[]>([]),[platform,setPlatform]=useState('feishu'),[recipients,setRecipients]=useState(''),[instructions,setInstructions]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  async function refresh(){const data=await api<{items:any[]}>(`${workspaceApi}/reviews?conversation_id=${conversation}`);setDrafts(data.items);}
  useEffect(()=>{void api('/api/astra/collaboration/status').then(setStatus).catch(e=>setError(e.message));if(conversation)void refresh().catch(e=>setError(e.message));},[conversation]);
  async function save(){setSaving(true);setError('');try{await flush();await api(`${workspaceApi}/reviews`,json({conversation_id:conversation,job_id:job,platform,recipients,instructions}));await refresh();prepared();}catch(e){setError((e as Error).message);}finally{setSaving(false);}}
  return <div className="panel-content collaboration-module"><div className="module-heading"><div><span className="eyebrow">WORK TOGETHER</span><h3>让专业意见回到任务</h3></div><Icon name="users"/></div><p className="panel-lead">围绕当前成果准备复核要求，接收人、复核意见与实际送达状态各自留痕。</p><div className="platform-list">{(status?.platforms||[]).map((p:any)=><div key={p.id}><Icon name="message"/><strong>{p.name}</strong><span className="badge badge-ghost">未连接</span></div>)}</div><Note>{status?.note||'正在核对独立工作区连接状态…'}</Note>
    <h3 className="section-title">准备复核</h3>{!job?<div className="library-empty"><p>当前对话还没有计算成果。</p><small>完成编制后，可将成果和复核要求一起保存为草稿。</small></div>:<><p className="muted">成果 {job.slice(0,8)} · 草稿不会发送给任何人</p><label className="field">平台<select className="select" value={platform} onChange={e=>setPlatform(e.target.value)}><option value="feishu">飞书</option><option value="weact">WeAct</option></select></label><label className="field">拟接收人或群组<input className="input" value={recipients} onChange={e=>setRecipients(e.target.value)} placeholder="待接通平台后核对正式身份"/></label><label className="field">复核要求<textarea className="textarea" value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="需要复核的行、字段、依据与完成要求"/></label><Button primary disabled={busy||saving||!recipients.trim()||!instructions.trim()} onClick={save}>{saving?'正在保存':'保存复核草稿'}</Button></>}
    {error&&<p role="alert" className="edit-error">{error}</p>}{drafts.length>0&&<h3 className="section-title">本对话的复核草稿</h3>}{drafts.map(d=><article key={d.id} className="review-draft"><span className="badge badge-ghost">草稿 · 未发送</span><h3>{d.recipients}</h3><p>{d.instructions}</p><small>{d.platform==='feishu'?'飞书':'WeAct'} · 成果 {d.job_id.slice(0,8)} · {new Date(d.created_at).toLocaleString()}</small></article>)}<details className="migration-scope"><summary>原协同能力迁移进度</summary><p>协同草稿已持久化。专业工具中的“协同派发与复核”提供平台配置、通讯录、派发、轮次、评论与回执；外部发送需独立凭证和显式启用，配置不代表已送达。</p></details>
  </div>;
}
