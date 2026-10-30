import {guideProtocol,readDigitalState,type DigitalState,type DigitalSession,type DigitalCommand} from "./guide";
import {createPortal} from "react-dom";
import {DigitalToolbar} from "./DigitalToolbar";
import {toolbarProtocol,readToolbarPacket,type ToolbarPacket} from "./toolbar";
import {useEffect,useRef,useState} from 'react';
import {DEBUG_MODE} from '../../frontend-debug/mock-adapter';
import {Button,Note} from '../../studio/ui';
import './digital-cost.css';

const protocol='digital-cost-host/1';
type Health={available:boolean;version?:string;model_configured?:boolean;detail?:string};
export function DigitalAssistant({dark=false,palette='astra',active=true,onExpand,toolbarTarget=null,guided,onGuide,onGuideError,guideCommand,onSelectTask}:{onSelectTask?:(taskId:string)=>void;guided?:DigitalSession;onGuide?:(state:DigitalState)=>void;onGuideError?:(error:string)=>void;guideCommand?:DigitalCommand|null;toolbarTarget?:HTMLElement|null;dark?:boolean;palette?:string;active?:boolean;onExpand?:()=>void}){
 const guide=useRef({guided,onGuide,onGuideError});guide.current={guided,onGuide,onGuideError};
 const initial=useRef(guided),importSent=useRef(''),commandSent=useRef('');
 const frame=useRef<HTMLIFrameElement>(null);
 const [toolbar,setToolbar]=useState<ToolbarPacket|null>(null);
 const lastTrigger=useRef<HTMLElement|null>(null);
 const modalBlocked=useRef(false),restoreFocus=useRef(false);
 const target=useRef(toolbarTarget);target.current=toolbarTarget;
 const [epoch,setEpoch]=useState(0);
 const [health,setHealth]=useState<Health|null>(null),[error,setError]=useState(''),[checking,setChecking]=useState(false);
 const mounted=useRef(true),working=useRef(false);
 const appearance=useRef({dark,palette,active});appearance.current={dark,palette,active};
 function sync(){frame.current?.contentWindow?.postMessage({protocol:guideProtocol,type:'request'},location.origin);frame.current?.contentWindow?.postMessage({protocol,type:'host-state',...appearance.current},location.origin);frame.current?.contentWindow?.postMessage({protocol:toolbarProtocol,type:target.current?'request':'release'},location.origin);}
 async function connect(){
  if(working.current||DEBUG_MODE)return;initial.current=guide.current.guided;working.current=true;setToolbar(null);importSent.current='';setChecking(true);setError('');
  try{
   const response=await fetch('/api/astra/digital/start',{method:'POST',headers:{'Content-Type':'application/json','X-Astra-Module':'digital-cost'},body:'{}',signal:AbortSignal.timeout(22000)});
   const reply=await response.json();if(!response.ok)throw Error(reply.detail||'模块未能连接');
   if(mounted.current){setHealth(reply);setEpoch(n=>n+1);setError('');}
  }catch(e){if(mounted.current)setError((e as Error).message);}finally{working.current=false;if(mounted.current)setChecking(false);}
 }
 useEffect(()=>{mounted.current=true;if(active)void connect();return()=>{mounted.current=false};},[]);
 useEffect(()=>{sync();},[dark,palette,active,toolbarTarget]);
 useEffect(()=>{
  if(toolbarTarget&&toolbar){frame.current?.contentWindow?.postMessage({protocol:toolbarProtocol,type:'attached',token:toolbar.token},location.origin);if(restoreFocus.current&&!toolbar.state.blocked){restoreFocus.current=false;lastTrigger.current?.focus({preventScroll:true});}}
 },[toolbarTarget,toolbar]);
 function command(action:string,value?:string){
  if(!toolbar||toolbar.state.blocked||!active||error||checking)return;
  if(action==='create'&&onSelectTask){onSelectTask('');return;}
  if(action==='task'&&value&&onSelectTask){onSelectTask(value);return;}
  lastTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  frame.current?.contentWindow?.postMessage({protocol:toolbarProtocol,type:'command',token:toolbar.token,id:crypto.randomUUID(),action,value},location.origin);
 }
 useEffect(()=>{if(guideCommand&&toolbar&&!toolbar.state.blocked&&!toolbar.state.busy&&active&&!error&&!checking&&commandSent.current!==guideCommand.id){commandSent.current=guideCommand.id;command('guide-'+guideCommand.action);}},[guideCommand?.id,toolbar?.token,toolbar?.state.blocked,toolbar?.state.busy,active,error,checking]);
 useEffect(()=>{
  const message=(e:MessageEvent)=>{
   if(e.origin!==location.origin||e.source!==frame.current?.contentWindow)return;
   if(e.data?.protocol===guideProtocol&&guide.current.guided){
    const data=e.data;
    if(data.type==='ready'&&typeof data.token==='string'&&guide.current.guided.file&&importSent.current!==guide.current.guided.id){
      importSent.current=guide.current.guided.id;
      frame.current?.contentWindow?.postMessage({protocol:guideProtocol,type:'import',token:data.token,id:guide.current.guided.id,file:guide.current.guided.file},location.origin);
    }
    if(data.type==='imported'&&!data.ok){importSent.current='';guide.current.onGuideError?.('文档导入未完成，请查看右侧提示后重试。');}
    if(data.type==='error'&&typeof data.error==='string')guide.current.onGuideError?.(data.error);
    if(data.type==='state'){const state=readDigitalState(data.state);if(state)guide.current.onGuide?.(state);}
    return;
   }
   if(e.data?.protocol===toolbarProtocol){
    if(e.data.type==='clear'){setToolbar(current=>current?.token===e.data.token?null:current);return;}
    const packet=readToolbarPacket(e.data);if(packet&&target.current){if(modalBlocked.current&&!packet.state.blocked)restoreFocus.current=true;modalBlocked.current=packet.state.blocked;setToolbar(packet);}return;
   }
   if(e.data?.protocol!==protocol)return;
   if(e.data.type==='ready'){setToolbar(null);sync();}if(e.data.type==='expand')onExpand?.();
  };
  window.addEventListener('message',message);return()=>window.removeEventListener('message',message);
 },[onExpand]);
 useEffect(()=>{
  if(!active||!health?.available)return;
  let stopped=false;const abort=new AbortController();
  const timer=setInterval(()=>{void fetch('/api/astra/digital/status',{signal:abort.signal}).then(r=>r.json()).then((state:Health)=>{if(!stopped)setError(state.available?'':state.detail||'模块连接中断');}).catch(()=>{if(!stopped)setError('模块连接中断，可重新连接');});},10000);
  return()=>{stopped=true;clearInterval(timer);abort.abort();};
 },[active,health?.available]);
 if(DEBUG_MODE)return <div className="panel-content"><Note>前端调试版不连接数字化造价服务。</Note></div>;
 return <div className="digital-cost-module">
  {toolbarTarget&&toolbar&&createPortal(<DigitalToolbar state={toolbar.state} send={command} disabled={!active||!!error||checking||toolbar.state.blocked}/>,toolbarTarget)}
  {health?.available?<>
   {error&&<div className="digital-cost-status" role="alert"><span>{error}</span><Button disabled={checking} onClick={()=>void connect()}>重新连接</Button></div>}
   <iframe key={epoch} ref={frame} src={"/modules/digital-cost/?embed=1"+(initial.current?"&guided=1"+(initial.current.taskId?"&task="+encodeURIComponent(initial.current.taskId):""):"")} title="数字化造价工作台" onLoad={()=>{setToolbar(null);sync();}} sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"/>
  </>:<div className="empty-state"><h3>数字化造价</h3><p>对照需求原文，核对功能点，形成可追溯的开发费测算。</p><p role="status">{checking?'正在准备独立工作台…':error||'工作台尚未连接'}</p>{!checking&&<Button primary onClick={()=>void connect()}>连接工作台</Button>}</div>}
 </div>;
}
