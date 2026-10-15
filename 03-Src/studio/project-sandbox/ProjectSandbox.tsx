import {useEffect,useRef,useState} from 'react';
import {Icon} from '../ui';
import {api} from '../api';
import {sandboxNodes,runningZone,type SandboxInput,type ZoneId} from './node-state';
import {mountSandbox} from './scene.mjs';
import {readSandboxView,sandboxViewKey,compactSandboxTitle} from './view-settings';
import {useIdleOrbit} from './useIdleOrbit';
import {nextTaskActivity,type TaskActivity} from './task-activity';
import type {ReviewProgressTask} from '../../professional/components/agent-workspace/reviewProgress';

type Props={roofLabels:boolean;setRoofLabels:(value:boolean)=>void;autoOrbit:boolean;setAutoOrbit?:(value:boolean)=>void;orbitDelay:number;setOrbitDelay?:(value:number)=>void;orbitSettings:()=>void;variant:'immersive'|'card';immersive:()=>void;context:string;active:boolean;dark:boolean;title:string;taskId:string;tasks:{id:string;title:string}[];input:Omit<SandboxInput,'reviewTasks'|'reviewError'>;chatCollapsed:boolean;toggleChat:()=>void;classic:()=>void;toggleDark:()=>void;selectTask:(id:string)=>void;enter:(action:string)=>void};
export default function ProjectSandbox(props:Props){
 const host=useRef<HTMLDivElement>(null),markers=useRef(new Map<string,HTMLDivElement>()),scene=useRef<ReturnType<typeof mountSandbox>|null>(null);
 const selectRef=useRef<(id:ZoneId|null,action:string)=>void>(()=>{});
 const modeButton=useRef<HTMLButtonElement>(null),lastVariant=useRef(props.variant);
 const [cameraView,setCameraView]=useState(()=>{try{return readSandboxView(localStorage.getItem(sandboxViewKey))}catch{return readSandboxView(null)}});
 function changeCamera(key:'elevation'|'zoom'|'distance',value:number){if(key==='elevation'||key==='distance'){setSelected(null);scene.current?.home()}const next={...cameraView,[key]:value};setCameraView(next);try{localStorage.setItem(sandboxViewKey,JSON.stringify(next))}catch{}}
 const [menu,setMenu]=useState(false);
 const [cool,setCool]=useState(()=>{try{return localStorage.getItem('astra.sandbox.day-tone')==='cool'}catch{return false}});
 function changeTone(value:boolean){setCool(value);try{localStorage.setItem('astra.sandbox.day-tone',value?'cool':'original')}catch{}}
 useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key==='astra.sandbox.day-tone')setCool(e.newValue==='cool')};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update)},[]);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[selected,setSelected]=useState<ZoneId|null>(null),[shadows,setShadows]=useState(true),[orbit,setOrbit]=useState(false);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),[flowChoice,setFlowChoice]=useState<boolean|null>(null);
 const [review,setReview]=useState<{job:string;tasks:ReviewProgressTask[]|null;error:string}>({job:'',tasks:null,error:''});
 const [activity,setActivity]=useState<TaskActivity|null>(null),focusedActivity=useRef(0);
 const [collapsedRun,setCollapsedRun]=useState<TaskActivity|null>(null);
 const progressOpen=!!activity&&(activity.phase==='running'||collapsedRun!==activity);
 useEffect(()=>{if(!activity||activity.phase==='running')return;const timer=setTimeout(()=>setCollapsedRun(activity),activity.phase==='settled'?1000:2400);return()=>clearTimeout(timer)},[activity]);
 const controlsRef=useRef<HTMLDivElement>(null),controlsButton=useRef<HTMLButtonElement>(null);
 const [controlsOpen,setControlsOpen]=useState(false);
 const [pageVisible,setPageVisible]=useState(()=>!document.hidden);
 const idleOrbit=useIdleOrbit(props.autoOrbit,props.orbitDelay,!ready||!props.active||!pageVisible||reduced||!!props.input.busy||props.input.qaRunning||!!selected||menu||controlsOpen,()=>{setOrbit(false);scene.current?.pauseOrbit()});
 const orbiting=orbit||idleOrbit;
 useEffect(()=>{const update=()=>setPageVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update)},[]);
 useEffect(()=>{setActivity(previous=>nextTaskActivity(previous,{ready:props.input.ready,busy:props.input.busy,qaRunning:props.input.qaRunning,error:props.input.operationError,cancelVersion:props.input.cancelVersion}))},[props.input.ready,props.input.busy,props.input.qaRunning,props.input.operationError,props.input.cancelVersion]);
 const job=props.input.project?.jobId===props.input.result?.job_id?props.input.result?.job_id||'':'';
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(m.matches);m.addEventListener('change',update);update();return()=>m.removeEventListener('change',update)},[]);
 useEffect(()=>{
  const el=host.current!;setReady(false);setError('');let api:ReturnType<typeof mountSandbox>|null=null;
  try{api=mountSandbox(el,markers.current,props.context,(id:ZoneId|null,action:string)=>selectRef.current(id,action),()=>setReady(true),(message:string)=>setError(message),()=>setOrbit(false));scene.current=api;(el as any).__sandboxState=api.state;}catch{setError('当前设备无法开启三维画面，可使用下方功能入口或经典界面。')}
  return()=>{api?.dispose();scene.current=null;delete (el as any).__sandboxState};
 },[props.context,retry]);
 useEffect(()=>{scene.current?.setOptions({roofLabels:props.roofLabels,compact:props.variant==='card',active:props.active,dark:props.dark,cool,...cameraView,shadows,orbit:orbiting&&!reduced,flow:flowChoice??!reduced,running:runningZone(props.input.busy,props.input.qaRunning)})},[props.roofLabels,props.context,props.variant,props.chatCollapsed,props.active,props.dark,cool,cameraView,shadows,orbiting,reduced,flowChoice,props.input.busy,props.input.qaRunning,retry]);
 useEffect(()=>{setSelected(null);setMenu(false);if(lastVariant.current!==props.variant)modeButton.current?.focus({preventScroll:true});lastVariant.current=props.variant},[props.variant]);
 useEffect(()=>{scene.current?.select(selected)},[selected,retry]);
 useEffect(()=>{
  if(activity?.phase!=='running'||!ready||focusedActivity.current===activity.run)return;
  focusedActivity.current=activity.run;
  if(!props.active||document.hidden)return;
  setSelected(null);setOrbit(false);scene.current?.focusTask(activity.zone);
 },[activity,ready,props.active]);
 useEffect(()=>{if(!job||!props.active)return;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let inFlight=false;
  const read=async()=>{if(document.hidden||inFlight)return;inFlight=true;try{const response=await api<{items:ReviewProgressTask[]}>('/api/collaboration/external-dispatch/tasks?limit=100',{signal:controller.signal});if(!controller.signal.aborted)setReview({job,tasks:response.items,error:''})}catch(e){if(!controller.signal.aborted)setReview({job,tasks:null,error:(e as Error).message})}finally{inFlight=false;if(!controller.signal.aborted&&!document.hidden)timer=setTimeout(read,15000)}};
  const visibility=()=>{clearTimeout(timer);if(!document.hidden)void read()};void read();document.addEventListener('visibilitychange',visibility);
  return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',visibility)};
 },[job,props.context,props.active]);
 const nodes=sandboxNodes({...props.input,reviewTasks:review.job===job?review.tasks:null,reviewError:review.job===job?review.error:''});
 selectRef.current=(id,action)=>{if(!id){resetView();return}const node=nodes.find(n=>n.id===id);if(action==='result'){if(node&&!node.disabled)enterNode(node.action)}else focusZone(id)};
 function focusZone(id:ZoneId){setMenu(false);setOrbit(false);setSelected(id);if(id===selected)scene.current?.select(id)}
 function enterNode(action:string){setMenu(false);setOrbit(false);props.enter(action)}
 useEffect(()=>{if(!controlsOpen)return;const outside=(e:PointerEvent)=>{if(!controlsRef.current?.contains(e.target as Node))setControlsOpen(false)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[controlsOpen]);
 function resetView(restoreFocus=false){const id=selected;setSelected(null);setOrbit(false);setMenu(false);scene.current?.home();if(restoreFocus&&id)markers.current.get(id)?.querySelector<HTMLButtonElement>('.sandbox-marker-title')?.focus({preventScroll:true})}
 useEffect(()=>{if(!props.active)return;const escape=(e:KeyboardEvent)=>{if(e.key!=='Escape'||(!controlsOpen&&!selected&&!menu&&!orbit))return;e.preventDefault();e.stopImmediatePropagation();if(controlsOpen){setControlsOpen(false);controlsButton.current?.focus({preventScroll:true})}else if(menu)setMenu(false);else if(selected)resetView(true);else setOrbit(false)};document.addEventListener('keydown',escape,true);return()=>document.removeEventListener('keydown',escape,true)},[props.active,selected,menu,orbit,controlsOpen]);
 useEffect(()=>{scene.current?.refresh()},[JSON.stringify(nodes),ready,progressOpen,retry]);
 return <section className={`project-sandbox ${props.variant==='card'?'sandbox-card-mode':''} ${error?'scene-fallback':''}`} aria-label="项目沙盘工作台" data-roof-labels={props.roofLabels} data-auto-orbit={idleOrbit} data-ready={ready} data-focused={!!selected} data-motion-paused={!props.active||!pageVisible} data-focused-stage={activity?.phase==='running'?activity.zone:undefined} data-running={runningZone(props.input.busy,props.input.qaRunning)||'idle'}>
  <div className="sandbox-canvas" ref={host}/>
  <header className="sandbox-toolbar">
   <div className="sandbox-project"><span className="sandbox-eyebrow">项目工作台</span><strong title={props.title}>{compactSandboxTitle(props.title)}</strong><label><span className="sr-only">当前项目任务</span><select className="select select-ghost" aria-label="当前项目任务" value={props.taskId} disabled={!props.input.ready||!!props.input.busy} onChange={e=>props.selectTask(e.target.value)}>{props.tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label></div>
   <div className="sandbox-toolbar-actions">{props.variant!=='card'&&<button className="btn btn-ghost btn-square btn-sm sandbox-all" aria-label={props.chatCollapsed?'展开对话':'收起对话'} title={props.chatCollapsed?'展开对话':'收起对话'} onClick={props.toggleChat}><Icon name="panel"/></button>}<button className="btn btn-ghost btn-sm sandbox-all" aria-label="恢复默认视角" title="恢复默认视角" onClick={()=>resetView()}><Icon name="home"/>全景</button><button className="btn btn-ghost btn-sm sandbox-all" aria-expanded={menu} aria-controls="sandbox-all-menu" onClick={()=>{setControlsOpen(false);setMenu(v=>!v)}}><Icon name="grid"/>全部模块</button><div ref={controlsRef} className="sandbox-view-controls" aria-label="沙盘视图控制" data-expanded={controlsOpen}>
   <button ref={controlsButton} type="button" className="btn btn-ghost btn-sm sandbox-all sandbox-controls-toggle" aria-label={controlsOpen?'收起沙盘视图控制':'展开沙盘视图控制'} aria-expanded={controlsOpen} aria-controls="sandbox-view-options" onClick={()=>{setMenu(false);setControlsOpen(v=>!v)}} title={controlsOpen?'收起视图控制':'沙盘视图控制'}><Icon name="sliders"/><span>视图</span><Icon name="chevron"/></button>
   {controlsOpen&&<div id="sandbox-view-options" className="sandbox-view-options">
   <div className="sandbox-view-toggles"><label className="sandbox-label-setting" title="平面磨砂标签固定在建筑顶部"><input type="checkbox" className="toggle toggle-xs" checked={props.roofLabels} onChange={e=>props.setRoofLabels(e.target.checked)}/>楼顶标牌</label>
   <button className="btn btn-ghost btn-sm" aria-pressed={orbiting} disabled={reduced} title={reduced?'已遵循减少动效':'自动环游'} onClick={()=>{if(selected)resetView();setOrbit(!orbiting)}}><Icon name={orbiting?'pause':'play'}/>{orbiting?'暂停':'环游'}</button>
   <button className="btn btn-ghost btn-square btn-sm" aria-label="放大沙盘" onClick={()=>scene.current?.zoom(.85)}><Icon name="magnifying-glass-plus"/></button><button className="btn btn-ghost btn-square btn-sm" aria-label="缩小沙盘" onClick={()=>scene.current?.zoom(1.18)}><Icon name="magnifying-glass-minus"/></button>

   <label title={props.dark?'冷白色调仅作用日间，退出夜航后生效':'日间采用冷白材质与柔和蓝色补光'}><input type="checkbox" className="toggle toggle-xs" checked={cool} disabled={props.dark} onChange={e=>changeTone(e.target.checked)}/>冷白色调</label>
   <label title="静态建筑使用缓存阴影"><input type="checkbox" className="toggle toggle-xs" checked={shadows} onChange={e=>setShadows(e.target.checked)}/>阴影</label>
   <label title="蓝色信息流动效，不表示任务执行进度"><input type="checkbox" className="toggle toggle-xs" checked={flowChoice??!reduced} onChange={e=>setFlowChoice(e.target.checked)}/>信息流</label>
   <button className="btn btn-ghost btn-sm" aria-pressed={props.dark} onClick={props.toggleDark}><Icon name={props.dark?'sun':'moon'}/>{props.dark?'日间':'夜航'}</button><button type="button" className="btn btn-ghost btn-square btn-sm" aria-label="自动环游设置" title="自动环游设置" onClick={props.orbitSettings}><Icon name="settings"/></button>
   </div><div className="sandbox-camera-settings"><label>鸟瞰高度 <output>{cameraView.elevation}°</output><input className="range range-xs" aria-label="鸟瞰高度" type="range" min="22" max="45" step="1" value={cameraView.elevation} onChange={e=>changeCamera('elevation',Number(e.target.value))}/></label><label title="数值越大，鸟瞰镜头越远">鸟瞰远近 <output>{cameraView.distance}%</output><input className="range range-xs" aria-label="鸟瞰远近" type="range" min="70" max="140" step="5" value={cameraView.distance} onChange={e=>changeCamera('distance',Number(e.target.value))}/></label><label>单楼放大 <output>{cameraView.zoom}%</output><input className="range range-xs" aria-label="单楼放大" type="range" min="100" max="160" step="5" value={cameraView.zoom} onChange={e=>changeCamera('zoom',Number(e.target.value))}/></label>{props.setAutoOrbit&&<div className="sandbox-idle-setting"><label><input type="checkbox" className="toggle toggle-xs" checked={props.autoOrbit} disabled={reduced} onChange={e=>props.setAutoOrbit?.(e.target.checked)}/>空闲自动环游</label><select className="select select-sm" aria-label="自动环游等待时间" value={props.orbitDelay} onChange={e=>props.setOrbitDelay?.(Number(e.target.value))}>{[10,15,30,60].map(s=><option key={s} value={s}>{s} 秒后</option>)}</select></div>}<small>{reduced?'已遵循系统减少动效设置':idleOrbit?'正在缓慢环游':selected?'返回全景后开始空闲计时':'收起视图面板后开始空闲计时'}</small></div></div>}
  </div>{props.variant==='card'?<button ref={modeButton} className="btn btn-ghost btn-sm sandbox-all" onClick={props.immersive}><Icon name="orbit"/>沉浸沙盘</button>:<div className="sandbox-switch"><span className="sandbox-mode-current"><Icon name="orbit"/>沙盘</span><button ref={modeButton} className="btn btn-ghost btn-sm" onClick={props.classic} title="保留当前对话与成果，切换到经典界面">经典</button></div>}</div>
  </header>
  {menu&&<nav className="sandbox-all-menu" id="sandbox-all-menu" aria-label="沙盘全部模块">{nodes.map((n,i)=><button className="btn btn-ghost" key={n.id} aria-label={`聚焦${n.title}`} aria-pressed={selected===n.id} title={`聚焦${n.title}`} onClick={()=>{focusZone(n.id);markers.current.get(n.id)?.querySelector<HTMLButtonElement>('.sandbox-marker-title')?.focus({preventScroll:true})}}><span>{String(i+1).padStart(2,'0')}</span>{n.title}</button>)}</nav>}
  {!ready&&!error&&<div className="sandbox-loading" role="status"><span className="loading loading-spinner loading-sm"/>正在载入项目沙盘…</div>}
  {error&&<div className="sandbox-load-error" role="status"><p>{error}</p><button className="btn btn-sm btn-ghost" onClick={()=>setRetry(n=>n+1)}>重试画面</button><button className="btn btn-sm btn-primary" onClick={props.classic}>使用经典界面</button></div>}
  <div className="sandbox-markers" aria-label="项目功能节点">{nodes.map((node,i)=><div key={node.id} ref={el=>{if(el)markers.current.set(node.id,el);else markers.current.delete(node.id)}} className={`sandbox-marker ${selected===node.id?'selected':''}`} data-zone={node.id} data-tone={node.tone} data-progress-open={activity?.zone===node.id&&progressOpen}>
   <button className="sandbox-marker-title" aria-label={`定位${node.title}`} aria-pressed={selected===node.id} title={selected===node.id?'再次点击返回鸟瞰视角':`聚焦${node.title}`} onClick={()=>selected===node.id?resetView():focusZone(node.id)}><small>{String(i+1).padStart(2,'0')}</small><span>{node.title}</span></button>
   {node.id!=='table'&&<button className="sandbox-result-trigger" data-tone={node.tone} aria-label={`${node.title}结果：${node.status}，${node.summary}；${node.disabled||node.actionLabel}`} disabled={!!node.disabled} title={node.disabled||node.actionLabel} onClick={()=>enterNode(node.action)}><span className="sandbox-node-status"><i/>{node.status}</span><span className="sandbox-node-summary" title={node.summary}>{node.id==='price'?node.summary.split(' · ').map((part,i)=><span key={i} className={i===1?'sandbox-amount':undefined}>{part}</span>):node.summary}</span></button>}<span className="sandbox-pin" aria-hidden="true"/>
   <div className="sandbox-node-progress" data-open={activity?.zone===node.id&&progressOpen} data-phase={activity?.zone===node.id?activity.phase:undefined} aria-hidden={activity?.zone!==node.id||!progressOpen}>
    <div><div className="sandbox-progress-content"><span role={activity?.zone===node.id&&progressOpen?'status':undefined} title={activity?.zone===node.id?activity.label:undefined}>{activity?.phase==='error'?'未完成 · 请查看对话':activity?.phase==='cancelled'?'已停止':activity?.phase==='settled'?'处理结束':'处理中'}</span><div className="sandbox-stage-progress" role={activity?.zone===node.id&&progressOpen?'progressbar':undefined} aria-label={`${node.title}处理进度`} aria-valuetext={activity?.zone===node.id?activity.label:undefined}><span/></div></div></div>
   </div>
  </div>)}</div>
  <span className="sandbox-scene-caption">{props.input.result?.job_id?`任务 ${props.input.result.job_id.slice(0,8)}`:'从一份清单开始'}{props.input.project?.debug?' · 演示数据':''}{(flowChoice??!reduced)?' · 信息流示意':''}</span>
 </section>;
}
