import {BakedControls} from './BakedControls';
import {readBakedSettings,bakedSettingsKey,type BakedSettings} from './baked-settings';
import {saveThemeValue} from './scene-theme';
import {useTaskDisclosure} from './useTaskDisclosure';
import {NodeDisclosureSlot} from './NodeDisclosureSlot';
import {WorkbenchModeSwitch} from './WorkbenchModeSwitch';
import {cardTransparencyKey,readCardTransparency} from './card-glass';
import {sandboxDefaults,savedSwitch} from './defaults';
import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {Icon} from '../ui';
import {api} from '../api';
import {sandboxNodes,completedSandboxZones,runningZone,type SandboxInput,type ZoneId} from './node-state';
import {mountVisualSandbox as mountSandbox} from './visual-mode-scene.mjs';
import {VisualModeControls} from './VisualModeControls';
import {readVisualMode,visualModeKey,type VisualModeSettings} from './visual-mode-settings';
import {groundTones} from './ground-tones';
import {groupLogoModes,readGroupLogo} from './group-logo';
import {useIdleOrbit} from './useIdleOrbit';
import {nextTaskActivity,type TaskActivity} from './task-activity';
import type {ReviewProgressTask} from '../../professional/components/agent-workspace/reviewProgress';


type Props={chatTransparency?:number;setChatTransparency?:(value:number)=>void;overview?:ReactNode;simple?:()=>void;roofLabels:boolean;setRoofLabels:(value:boolean)=>void;autoOrbit:boolean;setAutoOrbit?:(value:boolean)=>void;orbitDelay:number;setOrbitDelay?:(value:number)=>void;orbitSettings:()=>void;variant:'immersive'|'card';immersive:()=>void;context:string;active:boolean;dark:boolean;title:string;taskId:string;tasks:{id:string;title:string}[];input:Omit<SandboxInput,'reviewTasks'|'reviewError'>;chatCollapsed:boolean;toggleChat:()=>void;classic:()=>void;toggleDark:()=>void;selectTask:(id:string)=>void;enter:(action:string)=>void};
export default function ProjectSandbox(props:Props){
 const [visualSettings,setVisualSettings]=useState(readVisualMode);
 const [visualStatus,setVisualStatus]=useState({mode:'baked',reason:'',loading:false,error:''});
 const [bakedSettings,setBakedSettings]=useState(readBakedSettings);
 function changeBaked(value:BakedSettings){setBakedSettings(value);if(!saveThemeValue(bakedSettingsKey,value))setLightingMessage('白色版参数保存失败')}
 useEffect(()=>{try{if(!localStorage.getItem(bakedSettingsKey))saveThemeValue(bakedSettingsKey,bakedSettings)}catch{}},[]);
 useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key===bakedSettingsKey||e.key===null)setBakedSettings(readBakedSettings())};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update)},[]);
 function changeVisual(value:VisualModeSettings){setVisualSettings(value);if(!saveThemeValue(visualModeKey,value))setLightingMessage('画面设置保存失败')}
 useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key===visualModeKey||e.key===null)setVisualSettings(readVisualMode())};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update)},[]);
 const fpsLabel=useRef<HTMLSpanElement>(null);
 const host=useRef<HTMLDivElement>(null),markers=useRef(new Map<string,HTMLDivElement>()),scene=useRef<ReturnType<typeof mountSandbox>|null>(null);
 const selectRef=useRef<(id:ZoneId|null,action:string)=>void>(()=>{});

 function changeCamera(key:'elevation'|'zoom'|'distance',value:number){if(key!=='zoom'){setSelected(null);setTaskFocus(null)}changeBaked({...bakedSettings,[key]:value})}
 function changeGround(value:typeof groundTones[number]['id']){changeBaked({...bakedSettings,groundTone:value})}
 function changeGroupLogo(value:ReturnType<typeof readGroupLogo>){changeBaked({...bakedSettings,groupLogo:value})}
 function changePaintStrength(value:number){changeBaked({...bakedSettings,paintStrength:value})}
 const [lightingMessage,setLightingMessage]=useState('');
 const [menu,setMenu]=useState(false);
 const [cardTransparency,setCardTransparency]=useState(()=>{try{return readCardTransparency(localStorage.getItem(cardTransparencyKey))}catch{return readCardTransparency(null)}});
 function changeCardTransparency(value:number){setCardTransparency(value);try{localStorage.setItem(cardTransparencyKey,String(value))}catch{}}
 useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key===cardTransparencyKey)setCardTransparency(readCardTransparency(e.newValue))};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update)},[]);
 const [infoVisible,setInfoVisible]=useState(()=>{try{return savedSwitch(localStorage.getItem('astra.sandbox.info-cards'),'visible','hidden',sandboxDefaults.infoVisible)}catch{return sandboxDefaults.infoVisible}});
 function toggleInfo(value:boolean){setInfoVisible(value);try{localStorage.setItem('astra.sandbox.info-cards',value?'visible':'hidden')}catch{}}
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[selected,setSelected]=useState<ZoneId|null>(null),[orbit,setOrbit]=useState(false);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [review,setReview]=useState<{job:string;tasks:ReviewProgressTask[]|null;error:string}>({job:'',tasks:null,error:''});
 const [activityRecord,setActivityRecord]=useState<{scope:string;value:TaskActivity|null}>({scope:props.context,value:null});
 const activity=activityRecord.scope===props.context?activityRecord.value:null;
 const [taskFocus,setTaskFocus]=useState<ZoneId|null>(null),focusedActivity=useRef('');
 const controlsRef=useRef<HTMLDivElement>(null),controlsButton=useRef<HTMLButtonElement>(null);
 const [controlsOpen,setControlsOpen]=useState(false);
 const [pageVisible,setPageVisible]=useState(()=>!document.hidden);
 const disclosure=useTaskDisclosure(activity,props.context,props.active&&pageVisible,reduced);
 const progressOpen=!!activity&&disclosure==='progress';
 const idleOrbit=useIdleOrbit(props.autoOrbit,props.orbitDelay,!ready||!props.active||!pageVisible||reduced||!!props.input.busy||props.input.qaRunning||!!selected||!!taskFocus||menu||controlsOpen,()=>{setOrbit(false);scene.current?.pauseOrbit()});
 const orbiting=orbit||idleOrbit;
 useEffect(()=>{const update=()=>setPageVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update)},[]);
 useEffect(()=>{setActivityRecord(previous=>({scope:props.context,value:nextTaskActivity(previous.scope===props.context?previous.value:null,{ready:props.input.ready,busy:props.input.busy,qaRunning:props.input.qaRunning,error:props.input.operationError,cancelVersion:props.input.cancelVersion})}))},[props.context,props.input.ready,props.input.busy,props.input.qaRunning,props.input.operationError,props.input.cancelVersion]);
 const job=props.input.project?.jobId===props.input.result?.job_id?props.input.result?.job_id||'':'';
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(m.matches);m.addEventListener('change',update);update();return()=>m.removeEventListener('change',update)},[]);
 useEffect(()=>{
  const el=host.current!;setReady(false);setError('');let api:ReturnType<typeof mountSandbox>|null=null;
  try{api=mountSandbox(el,markers.current,props.context,(id:ZoneId|null,action:string)=>selectRef.current(id,action),()=>setReady(true),(message:string)=>setError(message),()=>setOrbit(false),fpsLabel.current,setLightingMessage,setVisualStatus);scene.current=api;(el as any).__sandboxState=api.state;(el as any).__sandboxVisual={getViewPose:api.getViewPose,setViewPose:api.setViewPose,capture:api.capture};}catch{setError('当前设备无法开启三维画面，可使用下方功能入口或经典界面。')}
  return()=>{api?.dispose();scene.current=null;delete (el as any).__sandboxState;delete (el as any).__sandboxVisual};
 },[props.context,retry]);
 useEffect(()=>{scene.current?.setVisualSettings(visualSettings)},[visualSettings,props.context,retry]);
 useEffect(()=>{scene.current?.setOptions({bakedSettings,roofLabels:props.roofLabels,compact:props.variant==='card',active:props.active,orbit:orbiting&&!reduced,running:runningZone(props.input.busy,props.input.qaRunning)})},[bakedSettings,props.roofLabels,props.context,props.variant,props.chatCollapsed,props.active,orbiting,reduced,props.input.busy,props.input.qaRunning,retry]);
 useEffect(()=>{setSelected(null);setTaskFocus(null);setMenu(false);},[props.variant,props.context]);
 useEffect(()=>{scene.current?.select(selected)},[selected,retry]);
 useEffect(()=>{
  if(!activity){focusedActivity.current='';return;}
  if(activity.phase!=='running'||!ready||!props.active||!pageVisible)return;
  const key=props.context+':'+activity.run;if(focusedActivity.current===key)return;
  focusedActivity.current=key;focusZone(activity.zone);
 },[activity,ready,props.active,pageVisible,props.context]);
 useEffect(()=>{if(!job||!props.active)return;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let inFlight=false;
  const read=async()=>{if(document.hidden||inFlight)return;inFlight=true;try{const response=await api<{items:ReviewProgressTask[]}>('/api/collaboration/external-dispatch/tasks?limit=100',{signal:controller.signal});if(!controller.signal.aborted)setReview({job,tasks:response.items,error:''})}catch(e){if(!controller.signal.aborted)setReview({job,tasks:null,error:(e as Error).message})}finally{inFlight=false;if(!controller.signal.aborted&&!document.hidden)timer=setTimeout(read,15000)}};
  const visibility=()=>{clearTimeout(timer);if(!document.hidden)void read()};void read();document.addEventListener('visibilitychange',visibility);
  return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',visibility)};
 },[job,props.context,props.active]);
 const nodeInput={...props.input,reviewTasks:review.job===job?review.tasks:null,reviewError:review.job===job?review.error:''};
 const nodes=sandboxNodes(nodeInput),paintCompleted=completedSandboxZones(nodeInput).join(',');
 const paintScope=props.context+':'+(job||props.input.filename||'empty');
 useEffect(()=>{scene.current?.setPaint({scope:paintScope,conversation:props.context,job,completed:paintCompleted?paintCompleted.split(','):[],activity:props.input.ready?activity:null})},[paintScope,paintCompleted,activity,ready,retry,props.input.ready]);
 selectRef.current=(id,action)=>{if(!id){resetView();return}focusZone(id)};
 function focusZone(id:ZoneId){setTaskFocus(null);setMenu(false);setOrbit(false);setSelected(id);if(id===selected)scene.current?.select(id)}
 function enterNode(action:string){setMenu(false);setOrbit(false);props.enter(action)}
 useEffect(()=>{if(!controlsOpen)return;const outside=(e:PointerEvent)=>{if(!controlsRef.current?.contains(e.target as Node))setControlsOpen(false)};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[controlsOpen]);
 function resetView(restoreFocus=false){const id=selected;setTaskFocus(null);setSelected(null);setOrbit(false);setMenu(false);scene.current?.home();if(restoreFocus&&id)markers.current.get(id)?.querySelector<HTMLButtonElement>('.sandbox-marker-title')?.focus({preventScroll:true})}
 useEffect(()=>{if(!props.active)return;const escape=(e:KeyboardEvent)=>{if(e.key!=='Escape'||(!controlsOpen&&!selected&&!taskFocus&&!menu&&!orbit))return;e.preventDefault();e.stopImmediatePropagation();if(controlsOpen){setControlsOpen(false);controlsButton.current?.focus({preventScroll:true})}else if(menu)setMenu(false);else if(selected||taskFocus)resetView(true);else setOrbit(false)};document.addEventListener('keydown',escape,true);return()=>document.removeEventListener('keydown',escape,true)},[props.active,selected,taskFocus,menu,orbit,controlsOpen]);
 useEffect(()=>{scene.current?.refresh()},[JSON.stringify(nodes),ready,progressOpen,disclosure,retry,selected]);
 return <section className={`project-sandbox ${props.variant==='card'?'sandbox-card-mode':''} ${error?'scene-fallback':''}`} aria-label="项目沙盘工作台" data-roof-labels={props.roofLabels} data-auto-orbit={idleOrbit} data-ready={ready} data-focused={!!selected} data-motion-paused={!props.active||!pageVisible} data-focused-stage={activity?.phase==='running'?activity.zone:undefined} data-running={runningZone(props.input.busy,props.input.qaRunning)||'idle'}>
  <div className="sandbox-canvas" ref={host}/>
  <header className="sandbox-toolbar">
   <div className="sandbox-project"><strong>项目工作台</strong></div>
   <div className="sandbox-toolbar-actions">{props.variant!=='card'&&<button className="btn btn-ghost btn-square btn-sm sandbox-all" aria-label={props.chatCollapsed?'展开对话':'收起对话'} title={props.chatCollapsed?'展开对话':'收起对话'} onClick={props.toggleChat}><Icon name="panel"/></button>}<button className="btn btn-ghost btn-sm sandbox-all" aria-label="恢复默认视角" title="恢复默认视角" onClick={()=>resetView()}><Icon name="home"/>全景</button><button className="btn btn-ghost btn-sm sandbox-all" aria-expanded={menu} aria-controls="sandbox-all-menu" onClick={()=>{setControlsOpen(false);setMenu(v=>!v)}}><Icon name="grid"/>全部模块</button><div ref={controlsRef} className="sandbox-view-controls" aria-label="沙盘视图控制" data-expanded={controlsOpen}>
   <button ref={controlsButton} type="button" className="btn btn-ghost btn-sm sandbox-all sandbox-controls-toggle" aria-label={controlsOpen?'收起沙盘视图控制':'展开沙盘视图控制'} aria-expanded={controlsOpen} aria-controls="sandbox-view-options" onClick={()=>{setMenu(false);setControlsOpen(v=>!v)}} title={controlsOpen?'收起视图控制':'沙盘视图控制'}><Icon name="sliders"/><span>视图</span><Icon name="chevron"/></button>
   {controlsOpen&&<div id="sandbox-view-options" className="sandbox-view-options">
   <VisualModeControls value={visualSettings} change={changeVisual} status={visualStatus} retry={()=>setRetry(n=>n+1)}/><div className="sandbox-view-toggles">{props.variant!=='card'&&props.overview&&<label><input type="checkbox" className="toggle toggle-xs" checked={infoVisible} onChange={e=>toggleInfo(e.target.checked)}/>项目信息卡片</label>}<label className="sandbox-label-setting" title="平面磨砂标签固定在建筑顶部"><input type="checkbox" className="toggle toggle-xs" checked={props.roofLabels} onChange={e=>props.setRoofLabels(e.target.checked)}/>楼顶标牌</label>
   <button className="btn btn-ghost btn-sm" aria-pressed={orbiting} disabled={reduced} title={reduced?'已遵循减少动效':'自动环游'} onClick={()=>{if(selected||taskFocus)resetView();setOrbit(!orbiting)}}><Icon name={orbiting?'pause':'play'}/>{orbiting?'暂停':'环游'}</button>
   <button className="btn btn-ghost btn-square btn-sm" aria-label="放大沙盘" onClick={()=>scene.current?.zoom(.85)}><Icon name="magnifying-glass-plus"/></button><button className="btn btn-ghost btn-square btn-sm" aria-label="缩小沙盘" onClick={()=>scene.current?.zoom(1.18)}><Icon name="magnifying-glass-minus"/></button>

   <button type="button" className="btn btn-ghost btn-square btn-sm" aria-label="自动环游设置" title="自动环游设置" onClick={props.orbitSettings}><Icon name="settings"/></button>
   </div><BakedControls value={bakedSettings} change={changeBaked}/>{lightingMessage&&<small role="status">{lightingMessage}</small>}<div className="sandbox-camera-settings">{props.variant!=='card'&&props.overview&&<label title="只调整卡片底色，文字保持清晰；数值越大越透明">信息卡透明度 <output>{cardTransparency}%</output><input className="range range-xs" aria-label="信息卡透明度" type="range" min="20" max="85" step="5" value={cardTransparency} onChange={e=>changeCardTransparency(Number(e.target.value))}/></label>}{props.variant!=='card'&&props.setChatTransparency&&<label title="只调整左侧聊天面板底色，文字保持清晰；数值越大越透明">左侧菜单透明度 <output>{props.chatTransparency}%</output><input className="range range-xs" aria-label="左侧菜单透明度" aria-valuetext={`${props.chatTransparency}%`} type="range" min="0" max="80" step="1" value={props.chatTransparency} onChange={e=>props.setChatTransparency?.(Number(e.target.value))}/></label>}<fieldset className="sandbox-ground-tones sandbox-group-logo" disabled={bakedSettings.preset==='original'}><legend>集团 Logo</legend><div>{groupLogoModes.map(mode=><button key={mode.id} type="button" className="btn btn-ghost btn-sm" aria-label={`集团 Logo：${mode.label}`} aria-pressed={bakedSettings.groupLogo===mode.id} onClick={()=>changeGroupLogo(mode.id)}>{mode.label}</button>)}</div></fieldset><fieldset className="sandbox-ground-tones" disabled={bakedSettings.preset==='original'}><legend>外围平台</legend><div>{groundTones.map(t=><button key={t.id} type="button" className="btn btn-ghost btn-sm" aria-label={`外围平台：${t.label}`} aria-pressed={bakedSettings.groundTone===t.id} onClick={()=>changeGround(t.id)}><i style={{background:t.color}} aria-hidden="true"/>{t.label}</button>)}</div></fieldset><label title="调整已完成及处理中建筑的局部雾蓝浓度；0% 恢复白模">染色浓度 <output>{bakedSettings.paintStrength}%</output><input className="range range-xs" aria-label="染色浓度" disabled={bakedSettings.preset==='original'} type="range" min="0" max="100" step="5" value={bakedSettings.paintStrength} onChange={e=>changePaintStrength(Number(e.target.value))}/></label><label>鸟瞰高度 <output>{bakedSettings.elevation}°</output><input className="range range-xs" aria-label="鸟瞰高度" type="range" min="22" max="45" step="1" value={bakedSettings.elevation} onChange={e=>changeCamera('elevation',Number(e.target.value))}/></label><label title="数值越大，鸟瞰镜头越远">鸟瞰远近 <output>{bakedSettings.distance}%</output><input className="range range-xs" aria-label="鸟瞰远近" type="range" min="35" max="140" step="5" value={bakedSettings.distance} onChange={e=>changeCamera('distance',Number(e.target.value))}/></label><label>单楼放大 <output>{bakedSettings.zoom}%</output><input className="range range-xs" aria-label="单楼放大" type="range" min="100" max="160" step="5" value={bakedSettings.zoom} onChange={e=>changeCamera('zoom',Number(e.target.value))}/></label>{props.setAutoOrbit&&<div className="sandbox-idle-setting"><label><input type="checkbox" className="toggle toggle-xs" checked={props.autoOrbit} disabled={reduced} onChange={e=>props.setAutoOrbit?.(e.target.checked)}/>空闲自动环游</label><select className="select select-sm" aria-label="自动环游等待时间" value={props.orbitDelay} onChange={e=>props.setOrbitDelay?.(Number(e.target.value))}>{[2,5,10,15,30,60].map(s=><option key={s} value={s}>{s} 秒后</option>)}</select></div>}<small>{reduced?'已遵循系统减少动效设置':idleOrbit?'正在缓慢环游':selected||taskFocus?'返回全景后开始空闲计时':'收起视图面板后开始空闲计时'}</small></div></div>}
  </div><WorkbenchModeSwitch value={props.variant==='card'?'classic':'sandbox'} change={mode=>{setControlsOpen(false);setMenu(false);if(mode==='sandbox')props.immersive();else if(mode==='classic')props.classic();else props.simple?.()}}/></div>
  </header>
  {menu&&<nav className="sandbox-all-menu" id="sandbox-all-menu" aria-label="沙盘全部模块">{nodes.map((n,i)=><button className="btn btn-ghost" key={n.id} aria-label={`聚焦${n.title}`} aria-pressed={selected===n.id} title={`聚焦${n.title}`} onClick={()=>{focusZone(n.id);markers.current.get(n.id)?.querySelector<HTMLButtonElement>('.sandbox-marker-title')?.focus({preventScroll:true})}}><span>{String(i+1).padStart(2,'0')}</span>{n.title}</button>)}</nav>}
  {!ready&&!error&&<div className="sandbox-loading" role="status"><span className="loading loading-spinner loading-sm"/>正在载入项目沙盘…</div>}
  {error&&<div className="sandbox-load-error" role="status"><p>{error}</p><button className="btn btn-sm btn-ghost" onClick={()=>setRetry(n=>n+1)}>重试画面</button><button className="btn btn-sm btn-primary" onClick={props.classic}>使用经典界面</button></div>}
  <div className="sandbox-markers" aria-label="项目功能节点">{nodes.map((node,i)=><div key={node.id} ref={el=>{if(el)markers.current.set(node.id,el);else markers.current.delete(node.id)}} className={`sandbox-marker ${selected===node.id?'selected':''}`} data-zone={node.id} data-tone={node.tone} data-progress-open={activity?.zone===node.id&&progressOpen}>
   <button className="sandbox-marker-title" aria-label={`定位${node.title}`} aria-pressed={selected===node.id} aria-expanded={selected===node.id} aria-controls={`sandbox-node-info-${node.id}`} title={selected===node.id?'再次点击返回鸟瞰视角':`聚焦${node.title}`} onClick={()=>selected===node.id?resetView():focusZone(node.id)}><small>{String(i+1).padStart(2,'0')}</small><span>{node.title}</span></button>
   <NodeDisclosureSlot selected={selected===node.id} scope={props.context} phase={activity?.zone===node.id?disclosure:'idle'}>
   <div className="sandbox-node-menu" inert={activity?.zone===node.id&&disclosure!=='details'} aria-hidden={activity?.zone===node.id&&disclosure!=='details'}>
   {(node.id!=='table'||selected===node.id)&&<button className="sandbox-result-trigger" data-tone={node.tone} aria-label={`${node.title}结果：${node.status}，${node.summary}；展开详情`} aria-expanded={selected===node.id} aria-controls={`sandbox-node-info-${node.id}`} title="展开建筑信息" onClick={()=>focusZone(node.id)}><span className="sandbox-node-status"><i/>{node.status}</span><span className="sandbox-node-summary" title={node.summary}>{node.id==='price'?node.summary.split(' · ').map((part,i)=><span key={i} className={i===1?'sandbox-amount':undefined}>{part}</span>):node.summary}</span></button>}
   {selected===node.id&&<section id={`sandbox-node-info-${node.id}`} className="sandbox-node-info" aria-label={`${node.title}详细信息`}>
    <div className="sandbox-node-facts" tabIndex={0} aria-label="节点信息明细"><dl>{node.facts.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
    <footer><button className="btn btn-primary btn-sm" disabled={!!node.disabled} onClick={()=>enterNode(node.action)}>{node.actionLabel}<Icon name="arrow-right"/></button>{node.disabled&&<small>{node.disabled}</small>}</footer>
   </section>}</div>
   <div className="sandbox-node-progress" data-open={activity?.zone===node.id&&progressOpen} data-phase={activity?.zone===node.id?activity.phase:undefined} aria-hidden={activity?.zone!==node.id||!progressOpen}>
    <div><div className="sandbox-progress-content"><span role={activity?.zone===node.id&&progressOpen?'status':undefined} title={activity?.zone===node.id?activity.label:undefined}>{activity?.phase==='error'?'未完成 · 请查看对话':activity?.phase==='cancelled'?'已停止':activity?.phase==='settled'?'处理结束':'处理中'}</span><p className="sandbox-progress-label">{activity?.zone===node.id?activity.label:''}</p><div className="sandbox-stage-progress" role={activity?.zone===node.id&&progressOpen?'progressbar':undefined} aria-label={`${node.title}处理进度`} aria-valuetext={activity?.zone===node.id?(activity.phase==='running'?'处理中，染色与进度条为时间动效，非实际完成百分比':activity.label):undefined}><span/></div></div></div>
   </div></NodeDisclosureSlot><span className="sandbox-pin" aria-hidden="true"/>
  </div>)}</div>
  {props.overview&&<div className="sandbox-info-rail" style={{'--sandbox-card-opacity':`${100-cardTransparency}%`} as CSSProperties} hidden={!infoVisible||props.variant==='card'}>{props.overview}</div>}
  <span className="sandbox-scene-caption"><span ref={fpsLabel} className="sandbox-fps" title="沙盘实际渲染帧率，每秒更新；静止时停止采样" aria-live="off">FPS · —</span></span>
 </section>;
}
