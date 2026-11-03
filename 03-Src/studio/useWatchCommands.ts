import {useEffect,useRef} from 'react';
import type {WatchAction} from './watch-commands';
const base='/api/astra/gork/commands';
type State={enabled:boolean;context:string;job:string;execute:(action:WatchAction)=>string};
export function useWatchCommands(state:State){
 const current=useRef(state);current.current=state;
 useEffect(()=>{
  const client=crypto.randomUUID();let stopped=false,running=false;
  const controller=new AbortController();
  const post=async(path:string,body:unknown)=>{
   const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Astra-Voice-UI':'1'},body:JSON.stringify(body),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(4000)])});
   if(!r.ok)throw new Error('Watch command unavailable');return r.json();
  };
  const tick=async()=>{
   if(stopped||running||document.hidden||!current.current.enabled)return;
   running=true;const snapshot=current.current;const identity={client,context:snapshot.context,job:snapshot.job};
   try{
    const reply=await post('/workspace',identity);
    if(!reply.command||stopped||document.hidden||!current.current.enabled||current.current.context!==snapshot.context||current.current.job!==snapshot.job)return;
    if(!['check_risk','query_progress'].includes(reply.command.action))return;
    const message=current.current.execute(reply.command.action);
    await post('/ack',{...identity,request_id:reply.command.request_id,message});
   }catch{/* Disconnection never queues offline actions or repeats a claimed command. */}
   finally{running=false;}
  };
  void tick();const timer=window.setInterval(tick,1000);
  document.addEventListener('visibilitychange',tick);
  return()=>{stopped=true;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',tick);};
 },[]);
}
