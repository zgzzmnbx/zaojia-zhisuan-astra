import {useEffect,useMemo,useRef,useState} from 'react';
import {DEBUG_MODE} from '../frontend-debug/mock-adapter';
import {mergeConsoleEvents,type ConsoleEvent,type ConsoleSnapshot} from './runtime-console';

export function useRuntimeConsole(busy:string,failed:boolean,ready:boolean){
 const [open,setPanelOpen]=useState(false),[paused,setPaused]=useState(true),[events,setEvents]=useState<ConsoleEvent[]>([]),[local,setLocal]=useState<ConsoleEvent[]>([]);
 const collecting=open&&!paused;
 function setOpen(value:boolean){if(!value)setPaused(true);setPanelOpen(value);}
 const [snapshot,setSnapshot]=useState<ConsoleSnapshot|null>(null),[connection,setConnection]=useState('');
 const [notice,setNotice]=useState(''),[now,setNow]=useState(Date.now());
 const cursor=useRef({after:0,instance:''}),sequence=useRef(0),busyStart=useRef(Date.now()),lastBusy=useRef('');
 useEffect(()=>{
  if(lastBusy.current===busy)return;
  if(busy)busyStart.current=Date.now();
  const row:ConsoleEvent={id:--sequence.current,time:new Date().toISOString(),level:'info',source:'当前界面',message:busy?'阶段开始：'+busy:'界面阶段结束'};
  lastBusy.current=busy;if(!collecting)return;setLocal(rows=>[...rows,row].slice(-100));
 },[busy]);
 useEffect(()=>{if(failed&&collecting)setLocal(rows=>[...rows,{id:--sequence.current,time:new Date().toISOString(),level:'error',source:'当前界面',message:'操作出现异常，请在对应任务查看原因'}].slice(-100));},[failed]);
 useEffect(()=>{
  if(!collecting)return;
  if(DEBUG_MODE){setConnection('调试页面 · 未连接宿主');return;}
  setConnection('正在检测宿主');
  let live=true,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
  async function read(){
   if(!live||document.hidden)return;
   controller?.abort();const current=new AbortController();controller=current;
   const timeout=setTimeout(()=>current.abort(),5000);
   try{
    const response=await fetch(`/api/astra/runtime-console?after=${cursor.current.after}&instance=${cursor.current.instance}`,{signal:current.signal,cache:'no-store'});
    if(!response.ok)throw new Error(response.status===404?'宿主待更新':'状态读取失败');
    const data=await response.json() as ConsoleSnapshot;
    if(!Array.isArray(data.events)||!Array.isArray(data.active)||!data.instance)throw new Error('状态响应无效');
    if(!live||controller!==current)return;
    const oldInstance=cursor.current.instance;
    setEvents(rows=>mergeConsoleEvents(rows,data,oldInstance));
    if(data.reset||oldInstance&&oldInstance!==data.instance)setNotice('宿主已重启，记录已切换到本次运行');
    else if(data.truncated)setNotice('部分较早记录已超出保留范围');
    cursor.current={after:data.cursor,instance:data.instance};setSnapshot(data);setConnection('');setNow(Date.now());
   }catch(error){if(live&&controller===current&&!document.hidden)setConnection(error instanceof Error&&error.name!=='AbortError'?error.message:'连接超时');}
   finally{clearTimeout(timeout);if(live&&controller===current&&!document.hidden)timer=setTimeout(read,2000);}
  }
  function visibility(){clearTimeout(timer);controller?.abort();controller=undefined;if(document.hidden)setConnection('页面已暂停检测');else void read();}
  void read();document.addEventListener('visibilitychange',visibility);
  return()=>{live=false;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',visibility);};
 },[collecting]);
 useEffect(()=>{if(!busy)return;const timer=setInterval(()=>{if(!document.hidden)setNow(Date.now());},1000);return()=>clearInterval(timer);},[busy]);
 const active=collecting?snapshot?.active.filter(request=>!request.quiet)||[]:[];
 const label=busy?busy:failed?'最近操作异常':!ready?'正在恢复工作空间':!collecting?'日志已暂停':connection?connection:active.length>1?`${active.length} 项请求运行中`:active.length===1?`${active[0].source}处理中`:'系统就绪';
 const elapsed=busy?Math.floor((now-busyStart.current)/1000):active.length===1?Math.floor(active[0].elapsed_ms/1000):0;
 const orderedEvents=useMemo(()=>[...events,...local].sort((a,b)=>a.time.localeCompare(b.time)),[events,local]);
 return {open,setOpen,paused:!collecting,setPaused,events:orderedEvents,label,elapsed,working:!!busy||active.length>0,unavailable:collecting&&!!connection,notice,snapshot};
}
