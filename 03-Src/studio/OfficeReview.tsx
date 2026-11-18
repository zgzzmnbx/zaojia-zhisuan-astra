import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {api} from './api';
import {officeDirectory,officeTasks,pendingOfficeTask,type PendingOfficeReview,type OfficeBridge,type OfficePerson,type OfficeTask} from './office-review';
import type {ReviewOptions,ReviewTask} from './review-flow';
import {latestReviewTasksByPlatform} from '../professional/components/agent-workspace/reviewProgress';
import './office-review.css';
import {LoadingLogo} from './brand/LoadingLogo';
import {mountOfficeDropTarget} from './office-review-drop';

const namespace='astra-office-selection:v1';
export default function OfficeReview({bridge,active,dark,palette,context,prepare,chatVisible,close}:{bridge:OfficeBridge;active:boolean;dark:boolean;palette:string;context:string;prepare:()=>void;chatVisible:boolean;close:()=>void}) {
  const frame=useRef<HTMLIFrameElement>(null);
  const actions=useRef({prepare,close});actions.current={prepare,close};
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[generation,setGeneration]=useState(0);
  const [sceneReady,setSceneReady]=useState(0);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [mounted,setMounted]=useState(false),[rendered,setRendered]=useState(false);
  useEffect(()=>{
    // Let the host's loading logo paint before the iframe initializes WebGL.
    setSettingsOpen(false);
    let second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>setMounted(true));});
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[generation]);
  const [receiptError,setReceiptError]=useState(false);
  const [inbox,setInbox]=useState<{tasks:OfficeTask[];error:boolean;loaded:boolean}>({tasks:[],error:false,loaded:false});
  const [directory,setDirectory]=useState<OfficePerson[]>([]);
  const [receipt,setReceipt]=useState<{context:string;tasks:OfficeTask[]}|null>(null);
  const snapshot=useSyncExternalStore(bridge.subscribe,bridge.getSnapshot);
  const current=snapshot?.context.startsWith(context+':')?snapshot:null;
  const latest=useRef(current);latest.current=current;
  const visible=useRef(active);visible.current=active;
  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    async function refresh(){
      try{
        const data=await api<{items:PendingOfficeReview[]}>('/api/astra/office-workstations/pending-reviews',{signal:controller.signal});
        if(!controller.signal.aborted)setInbox({tasks:data.items.map(pendingOfficeTask),error:false,loaded:true});
      }catch{if(!controller.signal.aborted)setInbox(previous=>({...previous,error:true}));}
      if(!controller.signal.aborted)timer=setTimeout(refresh,15000);
    }
    void refresh();return()=>{controller.abort();clearTimeout(timer);};
  },[active]);
  useEffect(()=>{
    if(!active||!current)return;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    const value=current;
    async function refresh(){
      try{
        const data=await api<{items:ReviewTask[]}>('/api/collaboration/external-dispatch/tasks?limit=100',{signal:controller.signal});
        if(!controller.signal.aborted){setReceipt({context:value.context,tasks:officeTasks(latestReviewTasksByPlatform(data.items,value.request.jobId) as ReviewTask[],value.request,value.people)});setReceiptError(false);}
      }catch{if(!controller.signal.aborted)setReceiptError(true);}
      if(!controller.signal.aborted)timer=setTimeout(refresh,15000);
    }
    void refresh();return()=>{controller.abort();clearTimeout(timer);};
  },[active,current?.context,current?.tasks]);
  useEffect(()=>{
    const controller=new AbortController();
    Promise.allSettled(['default','weact_cost'].map(profile=>api<ReviewOptions>(`/api/collaboration/external-dispatch/options?profile_id=${profile}`,{signal:controller.signal})))
      .then(results=>{if(controller.signal.aborted)return;
        const platforms=results.flatMap((r,i)=>r.status==='fulfilled'?[{profileId:['default','weact_cost'][i],options:r.value}]:[]);
        setDirectory(officeDirectory(platforms));
        if(!platforms.length)setError('人员目录暂不可用，可在左侧使用原复核入口刷新重试。');
      });
    return()=>controller.abort();
  },[context]);
  function send(type:string,data:Record<string,unknown>={}) {frame.current?.contentWindow?.postMessage({namespace,type,...data},location.origin);}
  useEffect(()=>{
    const chat=document.querySelector<HTMLElement>('#astra-conversation');
    if(!ready||!active||!chatVisible||!frame.current||!chat)return;
    return mountOfficeDropTarget({frame:frame.current,chat,current:()=>latest.current,active:()=>visible.current});
  },[ready,active,chatVisible,generation,current?.context,current?.revision]);
  useEffect(()=>{
    if(!ready||!active)return;
    const chat=document.querySelector('#astra-conversation');
    const measure=()=>{
      const host=frame.current;if(!host)return;
      const left=chatVisible&&chat?Math.max(0,chat.getBoundingClientRect().right-host.getBoundingClientRect().left+16):0;
      host.parentElement?.style.setProperty('--office-chat-width',`${left}px`);
      const f=host.getBoundingClientRect(),r=chatVisible?chat?.getBoundingClientRect():null;
      send('layout',{left,bottomInset:Math.max(0,f.bottom-window.innerHeight),chatRect:r?{left:r.left-f.left,top:r.top-f.top,right:r.right-f.left,bottom:r.bottom-f.top}:null});
    };
    const observer=new ResizeObserver(measure);if(chat)observer.observe(chat);if(frame.current)observer.observe(frame.current);
    window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
    measure();return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
  },[ready,active,chatVisible]);
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.origin==='null'||event.origin!==location.origin)return;
      if(event.data?.namespace==='astra-office-twin:v1'&&event.data.type==='ready'){
        if(event.data.rendererAvailable){setRendered(true);setError('');}
        else setError('办公室载入失败，可重试或继续使用左侧复核卡。');
        setSceneReady(v=>v+1);return;
      }
      if(event.data?.namespace!==namespace)return;
      if(event.data.type==='settings-visibility'&&typeof event.data.open==='boolean'){setSettingsOpen(event.data.open);return;}
      if(event.data.type==='ready'){setReady(true);setError('');}
      if(event.data.type==='action'&&visible.current){
        if(event.data.action==='prepare')actions.current.prepare();
        if(event.data.action==='close')actions.current.close();
      }
      if(event.data.type==='toggle'){
        const value=latest.current;
        if(!visible.current||!value||event.data.context!==value.context||event.data.revision!==value.revision||typeof event.data.selected!=='boolean')return;
        const person=value.people.find(p=>p.id===event.data.employeeId);
        if(person?.selectable)value.toggle(person.id,event.data.selected);
      }
    };
    window.addEventListener('message',receive);
    const timer=setTimeout(()=>{if(frame.current?.contentDocument?.documentElement.dataset.viewerStatus!=='ready')setError('办公室加载较慢，可重试或继续使用左侧复核卡。');},20000);
    return()=>{clearTimeout(timer);window.removeEventListener('message',receive);};
  },[generation]);
  useEffect(()=>{
    if(!ready)return;
    send('snapshot',{context:current?.context||context,revision:current?.revision||0,people:current?.people.length?current.people:directory,
      tasks:receipt&&current&&receipt.context===current.context?receipt.tasks:current?.tasks||[],pendingTasks:inbox.tasks,inboxError:inbox.error,inboxLoading:!inbox.loaded&&!inbox.error,title:current?.request.fileName||'当前尚无可复核成果',enabled:!!current,receiptError});
  },[ready,current,directory,context,receipt,receiptError,inbox]);
  useEffect(()=>{
    if(!ready)return;
    frame.current?.contentWindow?.postMessage({namespace:'astra-office-twin:v1',type:'visibility',visible:active},location.origin);
    frame.current?.contentWindow?.postMessage({namespace:'astra-office-twin:v1',type:'theme',theme:{palette,scheme:dark?'dark':'light'}},location.origin);
  },[ready,active,dark,palette,sceneReady]);
  return <div className="office-review-host" data-settings-open={settingsOpen&&active} aria-busy={!rendered&&!error}>
    {!rendered&&<div className="office-review-loading" role="status"><div><LoadingLogo size={200} active={active} paused={!!error} solidFallback/><span>{error?'办公室尚未载入':'正在加载办公室沙盘…'}</span></div></div>}
    {error&&<div className="alert" role="status">{error}<button className="btn btn-sm" onClick={()=>{setError('');setReady(false);setRendered(false);setMounted(false);setGeneration(v=>v+1);}}>重试</button></div>}
    {mounted&&<iframe key={generation} ref={frame} src="/office-twin/viewer/index.html?mode=embed&view=building&entrance=office&host=astra&ui=office-0.51.4" title="办公室多人复核沙盘" onError={()=>setError('办公室载入失败，左侧复核卡仍可使用。')}/>}
  </div>;
}
