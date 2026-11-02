import {useEffect,useRef,useState} from 'react';
import {api,json} from '../api';
import {Icon} from '../ui';
import {watchSpeechCompleted} from '../gork-notification-feedback';
import type {Result} from '../types';
import './replay-match.css';

type Receipt={event_id:string;status:string;delivery:Record<string,string>;error?:string};
export function ReplayMatchButton({result}:{result:Result;blocked:boolean;dirty:boolean}){
 const [sending,setSending]=useState(false),[message,setMessage]=useState('');
 const lock=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const version=result.artifact_version??result.task_tracking?.task.artifact_version??1;
 async function replay(){
  if(lock.current)return;
  lock.current=true;setSending(true);setMessage('正在连接 Watch…');
  const current=new AbortController();controller.current=current;
  const path=`/api/astra/gork/notifications/match/${encodeURIComponent(result.job_id)}/replay`;
  try{
   let reply=await api<Receipt>(path,{...json({artifact_version:version,request_id:crypto.randomUUID().replaceAll('-','')}),signal:current.signal});
   const until=Date.now()+95000;
   while(['pending','queued','dispatching','active','partial'].includes(reply.status)&&Date.now()<until){
    setMessage('已提交，等待 Watch 播报回执…');
    await new Promise<void>(resolve=>setTimeout(resolve,1000));
    if(current.signal.aborted)return;
    reply=await api<Receipt>(`${path}/${encodeURIComponent(reply.event_id)}`,{signal:current.signal});
   }
   if(current.signal.aborted)return;
   setMessage(watchSpeechCompleted(reply.status,reply.delivery)?'Watch 播报完成':reply.status==='completed'?'Watch 已接收，语音完成尚未确认':reply.status==='failed'?'Watch 播报失败，请检查设备连接':reply.status==='expired'?'播报已过期，请重新连接 Watch 后再试':reply.status==='cancelled'||reply.status==='superseded'||reply.status==='interrupted'?'本次播报已停止':'播报回执尚未确认，可在机器人联动中查看');
  }catch(error){if(!current.signal.aborted)setMessage((error as Error).message);}
  finally{lock.current=false;if(!current.signal.aborted)setSending(false);}
 }
 return <div className="sandbox-replay"><button type="button" className="btn btn-ghost btn-sm" disabled={sending} title="在 Watch 播报当前可用的成果摘要" onClick={()=>void replay()}><Icon name="refresh"/>{sending?'播报中…':'再次播报'}</button>{message&&<small role="status">{message}</small>}</div>;
}
