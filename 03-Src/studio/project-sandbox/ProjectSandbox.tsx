import {useTaskDisclosure} from './useTaskDisclosure';
import {NodeDisclosureSlot} from './NodeDisclosureSlot';
import {LightingTrialPanel} from './LightingTrialPanel';
import {readTrial,approvedLighting} from './lighting-trial';
import {sandboxEffectControls,readSandboxEffects,sandboxEffectDisabled} from './effect-settings';
import {WorkbenchModeSwitch} from './WorkbenchModeSwitch';
import {cardTransparencyKey,readCardTransparency} from './card-glass';
import {sandboxDefaults,savedSwitch,readSandboxSwitch,saveSandboxSwitch} from './defaults';
import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {Icon} from '../ui';
import {api} from '../api';
import {sandboxNodes,completedSandboxZones,runningZone,type SandboxInput,type ZoneId} from './node-state';
import {mountSandbox} from './scene.mjs';
import {readSandboxView,sandboxViewKey} from './view-settings';
import {groundTones,groundToneKey,sandboxGroundTone} from './ground-tones';
import {groupLogoKey,groupLogoModes,readGroupLogo} from './group-logo';
import {useIdleOrbit} from './useIdleOrbit';
import {sandboxPaintKey,readPaintStrength} from './paint-settings';
import {nextTaskActivity,type TaskActivity} from './task-activity';
import type {ReviewProgressTask} from '../../professional/components/agent-workspace/reviewProgress';

const officialLighting=approvedLighting();
const legacyEffects={solidVersion:false,studioLighting:true,softShadows:true,bakedLighting:true,brightBackground:true,nightBloom:true,localSurface:false};

type Props={overview?:ReactNode;simple?:()=>void;roofLabels:boolean;setRoofLabels:(value:boolean)=>void;autoOrbit:boolean;setAutoOrbit?:(value:boolean)=>void;orbitDelay:number;setOrbitDelay?:(value:number)=>void;orbitSettings:()=>void;variant:'immersive'|'card';immersive:()=>void;context:string;active:boolean;dark:boolean;title:string;taskId:string;tasks:{id:string;title:string}[];input:Omit<SandboxInput,'reviewTasks'|'reviewError'>;chatCollapsed:boolean;toggleChat:()=>void;classic:()=>void;toggleDark:()=>void;selectTask:(id:string)=>void;enter:(action:string)=>void};
export default function ProjectSandbox(props:Props){
 const fpsLabel=useRef<HTMLSpanElement>(null);
 const host=useRef<HTMLDivElement>(null),markers=useRef(new Map<string,HTMLDivElement>()),scene=useRef<ReturnType<typeof mountSandbox>|null>(null);
 const selectRef=useRef<(id:ZoneId|null,action:string)=>void>(()=>{});

 const [cameraView,setCameraView]=useState(()=>{try{return readSandboxView(localStorage.getItem(sandboxViewKey))}catch{return readSandboxView(null)}});
 function changeCamera(key:'elevation'|'zoom'|'distance',value:number){if(key==='elevation'||key==='distance'){setSelected(null);setTaskFocus(null);scene.current?.home()}const next={...cameraView,[key]:value};setCameraView(next);try{localStorage.setItem(sandboxViewKey,JSON.stringify(next))}catch{}}
 const [groundTone,setGroundTone]=useState(()=>{try{return sandboxGroundTone(localStorage.getItem(groundToneKey)).id}catch{return sandboxDefaults.groundTone}});
 function changeGround(value:typeof groundTones[number]['id']){setGroundTone(value);try{localStorage.setItem(groundToneKey,value)}catch{}}
 useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key===groundToneKey)setGroundTone(sandboxGroundTone(e.newValue).id)};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update)},[]);
 const [groupLogo,setGroupLogo]=useState(()=>{try{return readGroupLogo(localStorage.getItem(groupLogoKey))}catch{return readGroupLogo(null)}});
 function changeGroupLogo(value:ReturnType<typeof readGroupLogo>){setGroupLogo(value);try{localStorage.setItem(groupLogoKey,value)}catch{}}
 useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key===groupLogoKey)setGroupLogo(readGroupLogo(e.newValue))};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update)},[]);
 const [paintStrength,setPaintStrength]=useState(()=>{try{return readPaintStrength(localStorage.getItem(sandboxPaintKey))}catch{return sandboxDefaults.paintStrength}});
 function changePaintStrength(value:number){setPaintStrength(value);try{localStorage.setItem(sandboxPaintKey,String(value))}catch{}}
 useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key===sandboxPaintKey)setPaintStrength(readPaintStrength(e.newValue))};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update)},[]);
 const [lightingMessage,setLightingMessage]=useState('');
 const [enhanced,setEnhanced]=useState(()=>readSandboxSwitch('astra.sandbox.surface-detail',readSandboxSwitch('astra.sandbox.enhanced',sandboxDefaults.enhanced))!);
 const [legacyPreview,setLegacyPreview]=useState(false);
 const [trial,setTrial]=useState(readTrial),[trialActive,setTrialActive]=useState(false),[trialOpen,setTrialOpen]=useState(false);
 const [appliedTrial,setAppliedTrial]=useState<ReturnType<typeof readTrial>|null>(null);
 useEffect(()=>{if(!trialActive){setAppliedTrial(null);return}const timer=setTimeout(()=>setAppliedTrial(trial),180);return()=>clearTimeout(timer)},[trial,trialActive]);
 const trialButton=useRef<HTMLButtonElement>(null);
 function closeTrial(){setTrialOpen(false);(trialButton.current??controlsButton.current)?.focus({preventScroll:true})}
 const [effects,setEffects]=useState(readSandboxEffects);
 useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key===null||sandboxEffectControls.some(c=>e.key==='astra.sandbox.'+c.key))setEffects(readSandboxEffects())};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update)},[]);
 const [bloom,setBloom]=useState(()=>readSandboxSwitch('astra.sandbox.bloom',sandboxDefaults.bloom)!);
 useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key==='astra.sandbox.surface-detail')setEnhanced(savedSwitch(e.newValue,'on','off',sandboxDefaults.enhanced));if(e.key==='astra.sandbox.bloom')setBloom(savedSwitch(e.newValue,'on','off',sandboxDefaults.bloom));};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update)},[]);
 const [menu,setMenu]=useState(false);
 const [cardTransparency,setCardTransparency]=useState(()=>{try{return readCardTransparency(localStorage.getItem(cardTransparencyKey))}catch{return readCardTransparency(null)}});
 function changeCardTransparency(value:number){setCardTransparency(value);try{localStorage.setItem(cardTransparencyKey,String(value))}catch{}}
 useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key===cardTransparencyKey)setCardTransparency(readCardTransparency(e.newValue))};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update)},[]);
 const [infoVisible,setInfoVisible]=useState(()=>{try{return savedSwitch(localStorage.getItem('astra.sandbox.info-cards'),'visible','hidden',sandboxDefaults.infoVisible)}catch{return sandboxDefaults.infoVisible}});
 function toggleInfo(value:boolean){setInfoVisible(value);try{localStorage.setItem('astra.sandbox.info-cards',value?'visible':'hidden')}catch{}}
 const [cool,setCool]=useState(()=>{try{return savedSwitch(localStorage.getItem('astra.sandbox.day-tone'),'cool','original',sandboxDefaults.cool)}catch{return sandboxDefaults.cool}});
 function changeTone(value:boolean){setCool(value);try{localStorage.setItem('astra.sandbox.day-tone',value?'cool':'original')}catch{}}
 useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key==='astra.sandbox.day-tone')setCool(savedSwitch(e.newValue,'cool','original',sandboxDefaults.cool))};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update)},[]);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[selected,setSelected]=useState<ZoneId|null>(null),[shadows,setShadows]=useState(()=>readSandboxSwitch('astra.sandbox.shadows',sandboxDefaults.shadows)!),[orbit,setOrbit]=useState(false);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),[flowChoice,setFlowChoice]=useState<boolean|null>(()=>readSandboxSwitch('astra.sandbox.flow',null));
 const [review,setReview]=useState<{job:string;tasks:ReviewProgressTask[]|null;error:string}>({job:'',tasks:null,error:''});
 const [activityRecord,setActivityRecord]=useState<{scope:string;value:TaskActivity|null}>({scope:props.context,value:null});
 const activity=activityRecord.scope===props.context?activityRecord.value:null;
 const [taskFocus,setTaskFocus]=useState<ZoneId|null>(null),focusedActivity=useRef('');
 const controlsRef=useRef<HTMLDivElement>(null),controlsButton=useRef<HTMLButtonElement>(null);
 const [controlsOpen,setControlsOpen]=useState(false);
 const [pageVisible,setPageVisible]=useState(()=>!document.hidden);
 const disclosure=useTaskDisclosure(activity,props.context,props.active&&pageVisible,reduced);
 const progressOpen=!!activity&&disclosure==='progress';
 const idleOrbit=useIdleOrbit(props.autoOrbit,props.orbitDelay,!ready||!props.active||!pageVisible||reduced||!!props.input.busy||props.input.qaRunning||!!selected||!!taskFocus||menu||controlsOpen||trialOpen,()=>{setOrbit(false);scene.current?.pauseOrbit()});
 const orbiting=orbit||idleOrbit;
 useEffect(()=>{const update=()=>setPageVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update)},[]);
 useEffect(()=>{setActivityRecord(previous=>({scope:props.context,value:nextTaskActivity(previous.scope===props.context?previous.value:null,{ready:props.input.ready,busy:props.input.busy,qaRunning:props.input.qaRunning,error:props.input.operationError,cancelVersion:props.input.cancelVersion})}))},[props.context,props.input.ready,props.input.busy,props.input.qaRunning,props.input.operationError,props.input.cancelVersion]);
 const job=props.input.project?.jobId===props.input.result?.job_id?props.input.result?.job_id||'':'';
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(m.matches);m.addEventListener('change',update);update();return()=>m.removeEventListener('change',update)},[]);
 useEffect(()=>{
  const el=host.current!;setReady(false);setError('');let api:ReturnType<typeof mountSandbox>|null=null;
  try{api=mountSandbox(el,markers.current,props.context,(id:ZoneId|null,action:string)=>selectRef.current(id,action),()=>setReady(true),(message:string)=>setError(message),()=>setOrbit(false),fpsLabel.current,setLightingMessage);scene.current=api;(el as any).__sandboxState=api.state;}catch{setError('当前设备无法开启三维画面，可使用下方功能入口或经典界面。')}
  return()=>{api?.dispose();scene.current=null;delete (el as any).__sandboxState};
 },[props.context,retry]);
 useEffect(()=>{scene.current?.setOptions({trial:legacyPreview?null:trialActive?(appliedTrial??trial):officialLighting,...(legacyPreview?legacyEffects:effects),enhanced:legacyPreview||enhanced,bloom:legacyPreview||bloom,roofLabels:props.roofLabels,compact:props.variant==='card',active:props.active,dark:props.dark,cool:legacyPreview||cool,groundTone,groupLogo,paintStrength,...cameraView,shadows:legacyPreview||shadows,orbit:orbiting&&!reduced,flow:flowChoice??(sandboxDefaults.flow&&!reduced),running:runningZone(props.input.busy,props.input.qaRunning)})},[enhanced,bloom,props.roofLabels,props.context,props.variant,props.chatCollapsed,props.active,props.dark,cool,groundTone,groupLogo,paintStrength,cameraView,shadows,orbiting,reduced,flowChoice,props.input.busy,props.input.qaRunning,retry,effects,appliedTrial,legacyPreview,trialActive]);
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
 useEffect(()=>{if(!props.active)return;const escape=(e:KeyboardEvent)=>{if(trialOpen)return;if(e.key!=='Escape'||(!controlsOpen&&!selected&&!taskFocus&&!menu&&!orbit))return;e.preventDefault();e.stopImmediatePropagation();if(controlsOpen){setControlsOpen(false);controlsButton.current?.focus({preventScroll:true})}else if(menu)setMenu(false);else if(selected||taskFocus)resetView(true);else setOrbit(false)};document.addEventListener('keydown',escape,true);return()=>document.removeEventListener('keydown',escape,true)},[props.active,selected,taskFocus,menu,orbit,controlsOpen,trialOpen]);
 useEffect(()=>{scene.current?.refresh()},[JSON.stringify(nodes),ready,progressOpen,disclosure,retry,selected]);
 return <section className={`project-sandbox ${props.variant==='card'?'sandbox-card-mode':''} ${error?'scene-fallback':''}`} aria-label="项目沙盘工作台" data-roof-labels={props.roofLabels} data-auto-orbit={idleOrbit} data-ready={ready} data-focused={!!selected} data-motion-paused={!props.active||!pageVisible} data-focused-stage={activity?.phase==='running'?activity.zone:undefined} data-running={runningZone(props.input.busy,props.input.qaRunning)||'idle'}>
  <div className="sandbox-canvas" ref={host}/>
  <header className="sandbox-toolbar">
   <div className="sandbox-project"><strong>项目工作台</strong></div>
   <div className="sandbox-toolbar-actions">{props.variant!=='card'&&<button className="btn btn-ghost btn-square btn-sm sandbox-all" aria-label={props.chatCollapsed?'展开对话':'收起对话'} title={props.chatCollapsed?'展开对话':'收起对话'} onClick={props.toggleChat}><Icon name="panel"/></button>}<button className="btn btn-ghost btn-sm sandbox-all" aria-label="恢复默认视角" title="恢复默认视角" onClick={()=>resetView()}><Icon name="home"/>全景</button><button className="btn btn-ghost btn-sm sandbox-all" aria-expanded={menu} aria-controls="sandbox-all-menu" onClick={()=>{setControlsOpen(false);setMenu(v=>!v)}}><Icon name="grid"/>全部模块</button><div ref={controlsRef} className="sandbox-view-controls" aria-label="沙盘视图控制" data-expanded={controlsOpen}>
   <button ref={controlsButton} type="button" className="btn btn-ghost btn-sm sandbox-all sandbox-controls-toggle" aria-label={controlsOpen?'收起沙盘视图控制':'展开沙盘视图控制'} aria-expanded={controlsOpen} aria-controls="sandbox-view-options" onClick={()=>{setMenu(false);setControlsOpen(v=>!v)}} title={controlsOpen?'收起视图控制':'沙盘视图控制'}><Icon name="sliders"/><span>视图</span><Icon name="chevron"/></button>
   {controlsOpen&&<div id="sandbox-view-options" className="sandbox-view-options">
   <div className="sandbox-view-toggles">{props.variant!=='card'&&props.overview&&<label><input type="checkbox" className="toggle toggle-xs" checked={infoVisible} onChange={e=>toggleInfo(e.target.checked)}/>项目信息卡片</label>}<label className="sandbox-label-setting" title="平面磨砂标签固定在建筑顶部"><input type="checkbox" className="toggle toggle-xs" checked={props.roofLabels} onChange={e=>props.setRoofLabels(e.target.checked)}/>楼顶标牌</label>
   <button className="btn btn-ghost btn-sm" aria-pressed={orbiting} disabled={reduced} title={reduced?'已遵循减少动效':'自动环游'} onClick={()=>{if(selected||taskFocus)resetView();setOrbit(!orbiting)}}><Icon name={orbiting?'pause':'play'}/>{orbiting?'暂停':'环游'}</button>
   <button className="btn btn-ghost btn-square btn-sm" aria-label="放大沙盘" onClick={()=>scene.current?.zoom(.85)}><Icon name="magnifying-glass-plus"/></button><button className="btn btn-ghost btn-square btn-sm" aria-label="缩小沙盘" onClick={()=>scene.current?.zoom(1.18)}><Icon name="magnifying-glass-minus"/></button>

   <label title={props.dark?'冷白色调仅作用日间，退出夜航后生效':'日间采用冷白材质与柔和蓝色补光'}><input type="checkbox" className="toggle toggle-xs" disabled={legacyPreview||props.dark||effects.solidVersion} checked={legacyPreview||cool} onChange={e=>changeTone(e.target.checked)}/>冷白色调</label>
   <label title="静态建筑使用缓存阴影"><input type="checkbox" className="toggle toggle-xs" disabled={legacyPreview} checked={legacyPreview||shadows} onChange={e=>{setShadows(e.target.checked);saveSandboxSwitch('astra.sandbox.shadows',e.target.checked)}}/>阴影</label>
   <label title="蓝色信息流动效，不表示任务执行进度"><input type="checkbox" className="toggle toggle-xs" checked={flowChoice??(sandboxDefaults.flow&&!reduced)} onChange={e=>{setFlowChoice(e.target.checked);saveSandboxSwitch('astra.sandbox.flow',e.target.checked)}}/>信息流</label>
   <button className="btn btn-ghost btn-sm" aria-pressed={props.dark} onClick={props.toggleDark}><Icon name={props.dark?'sun':'moon'}/>{props.dark?'日间':'夜航'}</button><button type="button" className="btn btn-ghost btn-square btn-sm" aria-label="自动环游设置" title="自动环游设置" onClick={props.orbitSettings}><Icon name="settings"/></button>
   </div><div className="sandbox-lighting-settings" aria-label="沙盘光影"><label title="白墙微表面与管罐涂层质感"><input type="checkbox" className="toggle toggle-xs" disabled={legacyPreview||effects.solidVersion} checked={legacyPreview||enhanced} onChange={e=>{setEnhanced(e.target.checked);saveSandboxSwitch('astra.sandbox.surface-detail',e.target.checked)}}/>材质质感</label><label title="仅在当前聚焦建筑底部显示柔光，不影响全画面"><input type="checkbox" className="toggle toggle-xs" disabled={legacyPreview} checked={legacyPreview||bloom} onChange={e=>{setBloom(e.target.checked);saveSandboxSwitch('astra.sandbox.bloom',e.target.checked)}}/>聚焦辉光</label>{sandboxEffectControls.map(control=><label key={control.id} title={control.hint}><input type="checkbox" className="toggle toggle-xs" disabled={sandboxEffectDisabled(control.id,effects,props.dark,legacyPreview)} checked={legacyPreview?legacyEffects[control.id]:effects[control.id]} onChange={e=>{const value=e.target.checked;setEffects(previous=>({...previous,[control.id]:value}));saveSandboxSwitch('astra.sandbox.'+control.key,value)}}/><span>{control.label}<small aria-hidden="true">{control.scope}</small></span></label>)}{lightingMessage&&<small role="status">{lightingMessage}</small>}</div><div className="sandbox-trial-entry"><button ref={trialButton} disabled={effects.solidVersion} title={effects.solidVersion?'关闭纯色版后可继续试调':undefined} className="btn btn-sm btn-ghost" onClick={()=>{setControlsOpen(false);setTrialOpen(true);setOrbit(false)}}>光照试调</button><span>{legacyPreview?'原默认 · 备份预览':effects.solidVersion?'纯色版':trialActive?'试调中 · 待确认':'已确认 · 正式默认'}</span></div><div className="sandbox-camera-settings">{props.variant!=='card'&&props.overview&&<label title="只调整卡片底色，文字保持清晰；数值越大越透明">信息卡透明度 <output>{cardTransparency}%</output><input className="range range-xs" aria-label="信息卡透明度" type="range" min="20" max="85" step="5" value={cardTransparency} onChange={e=>changeCardTransparency(Number(e.target.value))}/></label>}<fieldset className="sandbox-ground-tones sandbox-group-logo"><legend>集团 Logo</legend><div>{groupLogoModes.map(mode=><button key={mode.id} type="button" className="btn btn-ghost btn-sm" aria-label={`集团 Logo：${mode.label}`} aria-pressed={groupLogo===mode.id} onClick={()=>changeGroupLogo(mode.id)}>{mode.label}</button>)}</div></fieldset><fieldset className="sandbox-ground-tones" disabled={props.dark||effects.solidVersion}><legend>外围平台{props.dark?' · 日间可调':''}</legend><div>{groundTones.map(t=><button key={t.id} type="button" className="btn btn-ghost btn-sm" aria-label={`外围平台：${t.label}`} aria-pressed={groundTone===t.id} onClick={()=>changeGround(t.id)}><i style={{background:t.color}} aria-hidden="true"/>{t.label}</button>)}</div></fieldset><label title="调整已完成及处理中建筑的局部雾蓝浓度；0% 恢复白模">染色浓度 <output>{paintStrength}%</output><input className="range range-xs" aria-label="染色浓度" type="range" min="0" max="100" step="5" value={paintStrength} onChange={e=>changePaintStrength(Number(e.target.value))}/></label><label>鸟瞰高度 <output>{cameraView.elevation}°</output><input className="range range-xs" aria-label="鸟瞰高度" type="range" min="22" max="45" step="1" value={cameraView.elevation} onChange={e=>changeCamera('elevation',Number(e.target.value))}/></label><label title="数值越大，鸟瞰镜头越远">鸟瞰远近 <output>{cameraView.distance}%</output><input className="range range-xs" aria-label="鸟瞰远近" type="range" min="70" max="140" step="5" value={cameraView.distance} onChange={e=>changeCamera('distance',Number(e.target.value))}/></label><label>单楼放大 <output>{cameraView.zoom}%</output><input className="range range-xs" aria-label="单楼放大" type="range" min="100" max="160" step="5" value={cameraView.zoom} onChange={e=>changeCamera('zoom',Number(e.target.value))}/></label>{props.setAutoOrbit&&<div className="sandbox-idle-setting"><label><input type="checkbox" className="toggle toggle-xs" checked={props.autoOrbit} disabled={reduced} onChange={e=>props.setAutoOrbit?.(e.target.checked)}/>空闲自动环游</label><select className="select select-sm" aria-label="自动环游等待时间" value={props.orbitDelay} onChange={e=>props.setOrbitDelay?.(Number(e.target.value))}>{[2,5,10,15,30,60].map(s=><option key={s} value={s}>{s} 秒后</option>)}</select></div>}<small>{reduced?'已遵循系统减少动效设置':idleOrbit?'正在缓慢环游':selected||taskFocus?'返回全景后开始空闲计时':'收起视图面板后开始空闲计时'}</small></div></div>}
  </div>{(trialActive||legacyPreview)&&<button className="btn btn-sm btn-ghost" onClick={()=>setTrialOpen(v=>!v)}>{legacyPreview?'原默认预览':'光照试调中'}</button>}<WorkbenchModeSwitch value={props.variant==='card'?'classic':'sandbox'} change={mode=>{setControlsOpen(false);setMenu(false);if(mode==='sandbox')props.immersive();else if(mode==='classic')props.classic();else props.simple?.()}}/></div>
  </header>
  {trialOpen&&<LightingTrialPanel value={trialActive?trial:officialLighting} change={setTrial} active={trialActive} legacy={legacyPreview} restoreLegacy={()=>{setLegacyPreview(true);setTrialActive(false)}} activate={value=>{setLegacyPreview(false);setTrialActive(value)}} dark={props.dark} day={props.toggleDark} close={closeTrial}/>}
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
