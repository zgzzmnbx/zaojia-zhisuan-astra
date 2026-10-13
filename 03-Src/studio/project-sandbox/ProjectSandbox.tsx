import {useEffect,useRef,useState} from 'react';
import {Icon} from '../ui';
import {api} from '../api';
import {zones} from './zones.js';
import {sandboxNodes,runningZone,type SandboxInput,type ZoneId} from './node-state';
import {mountSandbox} from './scene.mjs';
import type {ReviewProgressTask} from '../../professional/components/agent-workspace/reviewProgress';

type Props={context:string;active:boolean;dark:boolean;title:string;taskId:string;tasks:{id:string;title:string}[];input:Omit<SandboxInput,'reviewTasks'|'reviewError'>;chatCollapsed:boolean;toggleChat:()=>void;classic:()=>void;toggleDark:()=>void;selectTask:(id:string)=>void;enter:(action:string)=>void};
export default function ProjectSandbox(props:Props){
 const host=useRef<HTMLDivElement>(null),markers=useRef(new Map<string,HTMLDivElement>()),scene=useRef<ReturnType<typeof mountSandbox>|null>(null),closeButton=useRef<HTMLButtonElement>(null),resultCard=useRef<HTMLElement>(null),resultClose=useRef<HTMLButtonElement>(null);
 const [resultId,setResultId]=useState<ZoneId|null>(null),[menu,setMenu]=useState(false);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[selected,setSelected]=useState<ZoneId|null>(null),[shadows,setShadows]=useState(true),[orbit,setOrbit]=useState(false);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),[flowChoice,setFlowChoice]=useState<boolean|null>(null);
 const [review,setReview]=useState<{job:string;tasks:ReviewProgressTask[]|null;error:string}>({job:'',tasks:null,error:''});
 const job=props.input.project?.jobId===props.input.result?.job_id?props.input.result?.job_id||'':'';
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(m.matches);m.addEventListener('change',update);update();return()=>m.removeEventListener('change',update)},[]);
 useEffect(()=>{
  const el=host.current!;setReady(false);setError('');let api:ReturnType<typeof mountSandbox>|null=null;
  try{api=mountSandbox(el,markers.current,props.context,(id:ZoneId)=>focusZone(id),()=>setReady(true),(message:string)=>setError(message),()=>setOrbit(false));scene.current=api;(el as any).__sandboxState=api.state;}catch{setError('当前设备无法开启三维画面，可使用下方功能入口或经典界面。')}
  return()=>{api?.dispose();scene.current=null;delete (el as any).__sandboxState};
 },[props.context,retry]);
 useEffect(()=>{scene.current?.setOptions({active:props.active,dark:props.dark,shadows,orbit:orbit&&!reduced,flow:flowChoice??!reduced,running:runningZone(props.input.busy,props.input.qaRunning)})},[props.context,props.active,props.dark,shadows,orbit,reduced,flowChoice,props.input.busy,props.input.qaRunning,retry]);
 useEffect(()=>{scene.current?.select(selected);if(selected)closeButton.current?.focus({preventScroll:true})},[selected,retry]);
 useEffect(()=>{if(!job||!props.active)return;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let inFlight=false;
  const read=async()=>{if(document.hidden||inFlight)return;inFlight=true;try{const response=await api<{items:ReviewProgressTask[]}>('/api/collaboration/external-dispatch/tasks?limit=100',{signal:controller.signal});if(!controller.signal.aborted)setReview({job,tasks:response.items,error:''})}catch(e){if(!controller.signal.aborted)setReview({job,tasks:null,error:(e as Error).message})}finally{inFlight=false;if(!controller.signal.aborted&&!document.hidden)timer=setTimeout(read,15000)}};
  const visibility=()=>{clearTimeout(timer);if(!document.hidden)void read()};void read();document.addEventListener('visibilitychange',visibility);
  return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',visibility)};
 },[job,props.context,props.active]);
 const nodes=sandboxNodes({...props.input,reviewTasks:review.job===job?review.tasks:null,reviewError:review.job===job?review.error:''}),chosen=nodes.find(n=>n.id===selected),resultNode=nodes.find(n=>n.id===resultId);
 function focusZone(id:ZoneId){setResultId(null);setMenu(false);setOrbit(false);setSelected(id);if(id===selected){scene.current?.select(id);closeButton.current?.focus({preventScroll:true})}}
 function closeResult(restore=true){const id=resultId;setResultId(null);if(restore&&id)markers.current.get(id)?.querySelector<HTMLButtonElement>('.sandbox-result-trigger')?.focus({preventScroll:true})}
 useEffect(()=>{scene.current?.setResultCard(resultId,resultCard.current);if(resultId)resultClose.current?.focus({preventScroll:true});return()=>scene.current?.setResultCard(null,null)},[resultId,retry]);
 useEffect(()=>{if(!resultId)return;const outside=(e:PointerEvent)=>{if(!resultCard.current?.contains(e.target as Node)&&!markers.current.get(resultId)?.contains(e.target as Node))closeResult(false)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[resultId]);
 function close(){const id=selected;setResultId(null);setSelected(null);scene.current?.home();if(id)markers.current.get(id)?.querySelector<HTMLButtonElement>('.sandbox-marker-title')?.focus({preventScroll:true})}
 useEffect(()=>{if(!props.active)return;const escape=(e:KeyboardEvent)=>{if(e.key!=='Escape'||(!resultId&&!selected&&!menu&&!orbit))return;e.preventDefault();e.stopImmediatePropagation();if(resultId)closeResult();else if(menu)setMenu(false);else if(selected)close();else setOrbit(false)};document.addEventListener('keydown',escape,true);return()=>document.removeEventListener('keydown',escape,true)},[props.active,resultId,selected,menu,orbit]);
 useEffect(()=>{scene.current?.refresh()},[JSON.stringify(nodes),ready]);
 return <section className={`project-sandbox ${error?'scene-fallback':''}`} aria-label="项目沙盘工作台" data-ready={ready} data-focused={!!selected} data-running={runningZone(props.input.busy,props.input.qaRunning)||'idle'}>
  <div className="sandbox-canvas" ref={host}/>
  <header className="sandbox-toolbar">
   <div className="sandbox-project"><span className="sandbox-eyebrow">项目工作台</span><strong title={props.title}>{props.title}</strong><label><span className="sr-only">当前项目任务</span><select className="select select-ghost" aria-label="当前项目任务" value={props.taskId} disabled={!props.input.ready||!!props.input.busy} onChange={e=>props.selectTask(e.target.value)}>{props.tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label></div>
   <div className="sandbox-toolbar-actions"><button className="btn btn-ghost btn-square btn-sm sandbox-all" aria-label={props.chatCollapsed?'展开对话':'收起对话'} title={props.chatCollapsed?'展开对话':'收起对话'} onClick={props.toggleChat}><Icon name="panel"/></button><button className="btn btn-ghost btn-sm sandbox-all" aria-expanded={menu} aria-controls="sandbox-all-menu" onClick={()=>setMenu(v=>!v)}><Icon name="grid"/>全部功能</button><div className="sandbox-switch"><span className="sandbox-mode-current"><Icon name="orbit"/>沙盘</span><button className="btn btn-ghost btn-sm" onClick={props.classic} title="保留当前对话与成果，切换到经典界面">经典</button></div></div>
  </header>
  {menu&&<nav className="sandbox-all-menu" id="sandbox-all-menu" aria-label="沙盘全部功能">{nodes.map((n,i)=><button className="btn btn-ghost" key={n.id} onClick={()=>focusZone(n.id)}><span>{String(i+1).padStart(2,'0')}</span>{n.title}</button>)}</nav>}
  {!ready&&!error&&<div className="sandbox-loading" role="status"><span className="loading loading-spinner loading-sm"/>正在载入项目沙盘…</div>}
  {error&&<div className="sandbox-load-error" role="status"><p>{error}</p><button className="btn btn-sm btn-ghost" onClick={()=>setRetry(n=>n+1)}>重试画面</button><button className="btn btn-sm btn-primary" onClick={props.classic}>使用经典界面</button></div>}
  <div className="sandbox-markers" aria-label="项目功能节点">{nodes.map((node,i)=><div key={node.id} ref={el=>{if(el)markers.current.set(node.id,el);else markers.current.delete(node.id)}} className={`sandbox-marker ${selected===node.id?'selected':''}`} data-zone={node.id} data-tone={node.tone}>
   <button className="sandbox-marker-title" aria-label={`进入${node.title}`} aria-pressed={selected===node.id} onClick={()=>focusZone(node.id)}><small>{String(i+1).padStart(2,'0')}</small>{node.title}</button>
   <button className="sandbox-result-trigger" data-tone={node.tone} aria-label={`${node.title}结果：${node.status}，${node.summary}`} aria-expanded={resultId===node.id} aria-controls="sandbox-result-card" onClick={()=>resultId===node.id?closeResult():setResultId(node.id)}><span className="sandbox-node-status"><i/>{node.status}</span><span className="sandbox-node-summary" title={node.summary}>{node.id==='price'?node.summary.split(' · ').map((part,i)=><span key={i} className={i===1?'sandbox-amount':undefined}>{part}</span>):node.summary}</span></button><span className="sandbox-pin" aria-hidden="true"/>
  </div>)}</div>
  {resultNode&&<section ref={resultCard} id="sandbox-result-card" className="sandbox-result-card card" role="dialog" aria-label={`${resultNode.title}结果详情`}>
   <header><h2>{resultNode.title}</h2><button ref={resultClose} className="btn btn-ghost btn-square btn-sm" aria-label="关闭节点结果" onClick={()=>closeResult()}><Icon name="close"/></button></header>
   <span className="sandbox-detail-state">{resultNode.status}</span><dl>{resultNode.facts.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   <footer><span>当前任务</span><button className="btn btn-ghost btn-sm" onClick={()=>focusZone(resultNode.id)}>进入功能<Icon name="arrow-right"/></button></footer>
  </section>}
  {chosen&&<aside className="sandbox-node-detail card" aria-label={`${chosen.title}详情`}>
   <header><div><span className="sandbox-eyebrow">当前任务</span><h2>{chosen.title}</h2></div><button ref={closeButton} className="btn btn-ghost btn-square btn-sm" aria-label="关闭节点详情" onClick={close}><Icon name="close"/></button></header>
   <p className="sandbox-zone-description">{zones.find(z=>z.id===chosen.id)?.desc}</p><div className="sandbox-detail-state" data-tone={chosen.tone}>{chosen.status}</div><dl>{chosen.facts.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   {chosen.disabled&&<p className="sandbox-disabled-reason">{chosen.disabled}</p>}
   <button className="btn btn-primary" disabled={!!chosen.disabled} onClick={()=>props.enter(chosen.action)}>{chosen.actionLabel}<Icon name="arrow-right"/></button>
   {chosen.id==='price'&&props.input.result&&<button className="btn btn-ghost btn-sm" disabled={!!props.input.busy} onClick={()=>props.enter('advanced')}>核对单价与系数</button>}
   {chosen.id==='risk'&&props.input.result?.summary.matching_status==='completed'&&<button className="btn btn-ghost btn-sm" disabled={!!props.input.busy} onClick={()=>props.enter('warning')}>重新检查风险</button>}
  </aside>}
  <div className="sandbox-view-controls" aria-label="沙盘视图控制">
   <button className="btn btn-ghost btn-sm" aria-pressed={orbit} disabled={reduced} title={reduced?'已遵循减少动效':'自动环游'} onClick={()=>{if(selected)close();setOrbit(v=>!v)}}><Icon name={orbit?'pause':'play'}/>{orbit?'暂停':'环游'}</button>
   <button className="btn btn-ghost btn-square btn-sm" aria-label="放大沙盘" onClick={()=>scene.current?.zoom(.85)}><Icon name="magnifying-glass-plus"/></button><button className="btn btn-ghost btn-square btn-sm" aria-label="缩小沙盘" onClick={()=>scene.current?.zoom(1.18)}><Icon name="magnifying-glass-minus"/></button>
   <button className="btn btn-ghost btn-square btn-sm" aria-label="沙盘回到全景" onClick={()=>{setResultId(null);setSelected(null);setOrbit(false);scene.current?.home()}}><Icon name="home"/></button>
   <label title="静态建筑使用缓存阴影"><input type="checkbox" className="toggle toggle-xs" checked={shadows} onChange={e=>setShadows(e.target.checked)}/>阴影</label>
   <label title="蓝色信息流动效，不表示任务执行进度"><input type="checkbox" className="toggle toggle-xs" checked={flowChoice??!reduced} onChange={e=>setFlowChoice(e.target.checked)}/>信息流</label>
   <button className="btn btn-ghost btn-sm" aria-pressed={props.dark} onClick={props.toggleDark}><Icon name={props.dark?'sun':'moon'}/>{props.dark?'日间':'夜航'}</button>
  </div>
  <span className="sandbox-scene-caption">{props.input.result?.job_id?`任务 ${props.input.result.job_id.slice(0,8)}`:'从一份清单开始'}{props.input.project?.debug?' · 演示数据':''}{(flowChoice??!reduced)?' · 信息流示意':''}</span>
 </section>;
}
