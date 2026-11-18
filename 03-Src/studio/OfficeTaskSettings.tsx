import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {api} from './api';
import {officeDirectory,pendingOfficeTask,type OfficeTask,type PendingOfficeReview} from './office-review';
import type {ReviewOptions} from './review-flow';
import './office-task-settings.css';

type Person={id:string;name:string};
type Manual={id:string;title:string;status:string;description:string};
type Adjustment={title?:string;status?:string;description?:string;hidden?:boolean};
type Member={revision:number;tasks:Manual[];adjustments:Record<string,Adjustment>};
type Plan={schemaVersion:1;revision:number;members:Record<string,Member>};
type Entry=OfficeTask&{key:string;hidden:boolean;manual?:boolean;description?:string;adjusted:boolean;originalTitle:string;originalStatus:string;originalDescription:string};
type Model={
  emptyMember:()=>Member;
  officeExamples:(people:Person[])=>OfficeTask[];
  workstationRoster:(people:Person[],settings:unknown)=>Person[];
  indexPersonTasks:(input:{tasks:OfficeTask[];pendingTasks:OfficeTask[]})=>Map<string,OfficeTask[]>;
  memberEntries:(tasks:OfficeTask[],person:string,member:Member)=>Entry[];
  olderProjectReviewKeys:(entries:Entry[])=>string[];
  taskState:(task:OfficeTask)=>{label:string};
};
type Resources={model:Model;people:Person[];pending:OfficeTask[];plan:Plan;pendingError:boolean};
const endpoint='/api/astra/office-task-settings';
const modelUrl='/office-twin/viewer/task-plan.js?v=0.49.0';
const statuses=['待处理','待复核','进行中','审核中','已完成','已通过','已退回'];
const clock=new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const dateLabel=(value?:string)=>value&&Number.isFinite(Date.parse(value))?clock.format(new Date(value)):'';
const origin=(task:Entry)=>task.manual?'自建':task.demo?'示例':task.platformLabel||'平台复核';

async function loadResources(signal:AbortSignal):Promise<Resources> {
  const options=['default','weact_cost'].map(async profileId=>({
    profileId,options:await api<ReviewOptions>('/api/collaboration/external-dispatch/options?profile_id='+profileId,{signal}),
  }));
  const [model,roster,plan,reviews,directory]=await Promise.all([
    import(/* @vite-ignore */ modelUrl) as Promise<Model>,api<{people:Person[]}>('/api/astra/office-workstations',{signal}),
    api<Plan>(endpoint,{signal}),api<{items:PendingOfficeReview[]}>('/api/astra/office-workstations/pending-reviews',{signal}).catch(()=>null),
    Promise.allSettled(options),
  ]);
  const platforms=directory.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
  const people=model.workstationRoster(officeDirectory(platforms),roster);
  return {model,people,plan,pending:(reviews?.items||[]).map(pendingOfficeTask),pendingError:!reviews};
}

function TaskGroup({name,count,reveal,initiallyOpen,children}:{name:string;count:number;reveal:boolean;initiallyOpen:boolean;children:ReactNode}){
  const ref=useRef<HTMLDetailsElement>(null);
  const start=useRef(initiallyOpen);
  useEffect(()=>{if(ref.current)ref.current.open=start.current;},[]);
  useEffect(()=>{if(reveal&&ref.current)ref.current.open=true;},[reveal]);
  return <details className="office-plan-group" ref={ref}><summary><span>{name}</span><small>{count} 项</small></summary>{children}</details>;
}

export default function OfficeTaskSettings({currentTasks,initialPerson,onBusy,onSaved}:{currentTasks:OfficeTask[];initialPerson:string;onBusy:(value:string)=>void;onSaved:(value:Plan)=>void}){
  const [data,setData]=useState<Resources|null>(null),[reload,setReload]=useState(0);
  const [person,setPerson]=useState(initialPerson||'owner'),[removed,setRemoved]=useState(false),[query,setQuery]=useState('');
  const [drafts,setDrafts]=useState<Record<string,Member>>({}),[editKey,setEditKey]=useState(''),[selected,setSelected]=useState<Set<string>>(new Set());
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false),[conflict,setConflict]=useState(false);
  const titleInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(initialPerson)setPerson(initialPerson);},[initialPerson]);
  useEffect(()=>{
    const controller=new AbortController();
    loadResources(controller.signal).then(value=>{if(!controller.signal.aborted){setData(value);setError('');}})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message||'任务设置暂时无法读取');});
    return ()=>controller.abort();
  },[reload]);
  useEffect(()=>{if(editKey)titleInput.current?.focus();},[editKey]);
  if(!data)return <p role="status">{error||'正在读取人员任务…'} {error&&<button className="btn btn-sm" onClick={()=>setReload(n=>n+1)}>重试</button>}</p>;

  const {model,people,plan}=data, who=people.find(p=>p.id===person)||people[0], personId=who?.id||'';
  const raw=model.indexPersonTasks({tasks:[...currentTasks,...model.officeExamples(people)],pendingTasks:data.pending});
  const member=drafts[personId]||plan.members[personId]||model.emptyMember();
  const entries=model.memberEntries(raw.get(personId)||[],personId,member).filter(t=>t.key);
  const inView=entries.filter(t=>!t.hidden),visible=entries.filter(t=>t.hidden===removed);
  const search=query.trim().toLocaleLowerCase();
  const filtered=visible.filter(t=>t.key===editKey||!search||[t.title,t.originalTitle,t.projectName,t.artifactName,t.description].some(v=>v?.toLocaleLowerCase().includes(search)));
  const groups=new Map<string,Entry[]>();
  for(const t of filtered){
    const name=t.manual?'自建任务':t.demo?'案例与示例':t.projectName||'平台复核';
    if(!groups.has(name))groups.set(name,[]);
    groups.get(name)!.push(t);
  }
  const older=model.olderProjectReviewKeys(entries);
  const dirty=Object.keys(drafts).length>0;
  function resetList(){setSelected(new Set());setEditKey('');setQuery('');}
  function modify(change:(member:Member)=>void){
    setDrafts(previous=>{
      const base=plan.members[personId]||model.emptyMember();
      const next=structuredClone(previous[personId]||base);change(next);
      const result={...previous};
      if(JSON.stringify(next)===JSON.stringify(base))delete result[personId];else result[personId]=next;
      return result;
    });
    setNotice('');setError('');
  }
  function clean(m:Member,key:string){
    const a=m.adjustments[key];
    if(a&&!a.hidden&&a.title===undefined&&a.description===undefined&&a.status===undefined)delete m.adjustments[key];
  }
  function hide(keys:string[],value:boolean){
    if(!keys.length)return;
    const savedManual=new Set(plan.members[personId]?.tasks.map(t=>t.id));
    modify(m=>{
      for(const key of keys){
        if(value&&key.startsWith('manual:')&&!savedManual.has(key)){
          m.tasks=m.tasks.filter(t=>t.id!==key);
          delete m.adjustments[key];
        }else{
          const a=m.adjustments[key]||={};
          if(value)a.hidden=true;else delete a.hidden;
          clean(m,key);
        }
      }
    });
    setSelected(new Set());setEditKey('');
  }
  function changeField(t:Entry,field:'title'|'status'|'description',value:string){
    modify(m=>{
      if(t.manual){const item=m.tasks.find(v=>v.id===t.key);if(item)item[field]=value;return;}
      const a=m.adjustments[t.key]||={};
      const original={title:t.originalTitle,status:t.originalStatus,description:t.originalDescription}[field];
      if(value===original)delete a[field];else a[field]=value;
      clean(m,t.key);
    });
  }
  function add(){
    const id='manual:'+crypto.randomUUID();
    modify(m=>m.tasks.unshift({id,title:'',description:'',status:'待处理'}));
    resetList();setRemoved(false);setEditKey(id);
  }
  function discard(){
    setDrafts({});resetList();setNotice('');setError('');setConflict(false);
    if(conflict){setData(null);setReload(n=>n+1);}
  }
  async function save(){
    if(saving||!dirty)return;
    for(const [id,m] of Object.entries(drafts)){
      const invalid=m.tasks.find(t=>!t.title.trim())?.id||Object.entries(m.adjustments).find(([,v])=>v.title!==undefined&&!v.title.trim())?.[0];
      if(invalid){setPerson(id);resetList();setRemoved(!!m.adjustments[invalid]?.hidden);setEditKey(invalid);setError('请填写任务名称后再保存');return;}
    }
    setSaving(true);onBusy('正在保存沙盘任务');setError('');
    try{
      const response=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:1,members:drafts})});
      const result=await response.json();
      if(!response.ok){setConflict(response.status===409);throw Error(typeof result.detail==='string'?result.detail:'沙盘任务未保存，请检查输入后重试');}
      setData(previous=>previous?{...previous,plan:result}:previous);setDrafts({});setSelected(new Set());setEditKey('');setConflict(false);setNotice('已保存到办公室沙盘');
      onSaved(result);
      try{localStorage.setItem('astra.office.task-plan.v1',String(result.revision));}catch{}
    }catch(e){setError(e instanceof Error?e.message:'保存失败，请重试');}
    finally{setSaving(false);onBusy('');}
  }
  const shownSelected=filtered.filter(t=>selected.has(t.key)).map(t=>t.key);
  const allChecked=filtered.length>0&&shownSelected.length===filtered.length;
  return <div className="office-plan">
    <fieldset disabled={saving} className="office-plan-controls"><div className="office-plan-heading">
      <label><span>同事</span><select className="select select-bordered" value={personId} onChange={e=>{setPerson(e.target.value);resetList();setRemoved(false);}}>
        {people.map(p=><option key={p.id} value={p.id}>{p.name}{drafts[p.id]?' · 未保存':''}</option>)}
      </select></label>
      <button type="button" className="btn btn-primary" onClick={add} disabled={!who}><span aria-hidden="true">＋</span>新建任务</button>
    </div>
    {data.pendingError&&<p role="status">平台待办暂未刷新。<button type="button" className="btn btn-ghost btn-xs" onClick={()=>setReload(n=>n+1)}>重试读取</button></p>}
    <div className="office-plan-filters"><div role="group" aria-label="沙盘显示范围">{[false,true].map(v=><button type="button" key={String(v)} aria-pressed={removed===v} onClick={()=>{setRemoved(v);resetList();}}>{v?'已移除':'在沙盘'} <b>{v?entries.length-inView.length:inView.length}</b></button>)}</div>
      <input className="input input-bordered" aria-label="搜索任务" placeholder="搜索项目或任务" value={query} onChange={e=>{setQuery(e.target.value);setSelected(new Set());}}/>
    </div>
    {!removed&&older.length>0&&<div className="office-plan-bulk"><span>同项目仅保留最新一条复核</span><button type="button" className="btn btn-sm" onClick={()=>hide(older,true)}>收起 {older.length} 条</button></div>}
    <div className="office-plan-select"><label><input type="checkbox" className="checkbox checkbox-sm" checked={allChecked} disabled={!filtered.length} onChange={()=>setSelected(allChecked?new Set():new Set(filtered.map(t=>t.key)))}/>全选当前列表</label>
      <button type="button" className="btn btn-ghost btn-sm" disabled={!shownSelected.length} onClick={()=>hide(shownSelected,!removed)}>{removed?'恢复所选':'移除所选'}{shownSelected.length?' '+shownSelected.length:''}</button>
    </div>
    <section className="office-plan-groups" aria-label={who?who.name+'的任务':'人员任务'}>
    {[...groups].map(([group,rows])=><TaskGroup key={personId+'|'+removed+'|'+group} name={group} count={rows.length} reveal={!!search||rows.some(t=>t.key===editKey)} initiallyOpen={rows.length===1||rows.some(t=>t.manual)}>
      {rows.map(t=><article className="office-plan-row" key={t.key} data-task-key={t.key}><div className="office-plan-row-title">
        <input type="checkbox" className="checkbox checkbox-sm" aria-label={'选择 '+(t.title||'新任务')} checked={selected.has(t.key)} onChange={e=>{const next=new Set(selected);if(e.target.checked)next.add(t.key);else next.delete(t.key);setSelected(next);}}/>
        <div><strong>{t.title||'新任务'}</strong><div className="office-plan-tags"><span>{origin(t)}</span><span>{model.taskState(t).label}</span>{t.adjusted&&<small>沙盘已调整</small>}{t.createdAt&&<small>{dateLabel(t.createdAt)}</small>}</div></div>
        <button type="button" className="btn btn-ghost btn-sm" aria-label={(removed?'恢复 ':'编辑 ')+(t.title||'新任务')} aria-expanded={removed?undefined:editKey===t.key} onClick={()=>removed?hide([t.key],false):setEditKey(editKey===t.key?'':t.key)}>{removed?'恢复':editKey===t.key?'收起':'编辑'}</button>
      </div>
      {editKey===t.key&&!removed&&<div className="office-plan-edit">
        <label>任务名称<input ref={titleInput} className="input input-bordered" maxLength={200} value={t.title} onChange={e=>changeField(t,'title',e.target.value)}/></label>
        <label>沙盘状态<select className="select select-bordered" value={model.taskState(t).label} onChange={e=>changeField(t,'status',e.target.value)}>{[...new Set([model.taskState(t).label,...statuses])].map(s=><option key={s}>{s}</option>)}</select></label>
        <label>任务备注<textarea className="textarea textarea-bordered" maxLength={1200} value={t.description||''} onChange={e=>changeField(t,'description',e.target.value)}/></label>
        {t.dispatchId&&<small>平台原记录 · {t.originalStatus} · {t.originalTitle}</small>}
        <div>{t.adjusted&&!t.manual&&<button className="btn btn-ghost btn-sm" type="button" onClick={()=>modify(m=>{delete m.adjustments[t.key];})}>恢复原内容</button>}<button className="btn btn-ghost btn-sm" type="button" onClick={()=>hide([t.key],true)}>从沙盘移除</button></div>
      </div>}</article>)}
    </TaskGroup>)}
    {!groups.size&&<p className="office-plan-empty">{search?'没有匹配的任务':removed?'没有已移除的任务':'这位同事暂无沙盘任务'}</p>}
    </section></fieldset>
    <footer className="office-plan-footer"><div><span role="status">{error||notice||(dirty?'有未保存的修改':'仅修改办公室沙盘')}</span><small>智算派发、平台任务与原始回执保留。</small></div>
      {dirty&&<button className="btn btn-ghost btn-sm" disabled={saving} type="button" onClick={discard}>{conflict?'放弃草稿并重新载入':'放弃修改'}</button>}
      <button className="btn btn-primary" type="button" disabled={!dirty||saving||conflict} onClick={()=>void save()}>{saving?'正在保存…':'保存修改'}</button>
    </footer>
  </div>;
}
