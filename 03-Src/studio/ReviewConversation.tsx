import {useEffect,useRef,useState} from 'react';
import InlineReviewSetupCard from '../professional/components/agent-workspace/InlineReviewSetupCard';
import InlineReviewProgressCard from '../professional/components/agent-workspace/InlineReviewProgressCard';
import {latestReviewTasksByPlatform} from '../professional/components/agent-workspace/reviewProgress';
import {api,json} from './api';
import {initialReviewEnabled,reviewPeople,reviewProblem,reviewPayload,type ReviewOptions,type ReviewPlatform,type ReviewRequest,type ReviewTask} from './review-flow';
import './review-conversation.css';

const profiles=[['default','飞书'],['weact_cost','WeAct']] as const;
function defaultDeadline(){const d=new Date(Date.now()+86400000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);}
export function ReviewConversation({request,busy,onBusy,onSettings,onClose}:{request:ReviewRequest;busy:boolean;onBusy:(label:string)=>void;onSettings:()=>void;onClose:()=>void}){
 const [platforms,setPlatforms]=useState<ReviewPlatform[]>([]),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[feedback,setFeedback]=useState(''),[error,setError]=useState('');
 const [confirmed,setConfirmed]=useState(false),[round,setRound]=useState(false),[deadline,setDeadline]=useState(defaultDeadline),[instructions,setInstructions]=useState('请复核当前成果、匹配依据和风险项；在复核卡中填写意见后通过或退回。');
 const [tasks,setTasks]=useState<ReviewTask[]>([]),[fetchedAt,setFetchedAt]=useState(''),[external,setExternal]=useState(false);
 const alive=useRef(true),epoch=useRef(0),lock=useRef(false),controller=useRef<AbortController|null>(null);
 const edit=(id:string,fn:(p:ReviewPlatform)=>ReviewPlatform)=>{setConfirmed(false);setRound(false);setPlatforms(all=>all.map(p=>p.profileId===id?fn(p):p));};
 async function load(refresh=false){
  if(lock.current)return;const generation=++epoch.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;setLoading(true);setConfirmed(false);setRound(false);setError('');
  try{
   const connection=await api<{external_enabled:boolean}>('/api/astra/connections',{signal:abort.signal});
   const list=await api<{items:ReviewTask[]}>('/api/collaboration/external-dispatch/tasks?limit=100',{signal:abort.signal});
   const current=latestReviewTasksByPlatform(list.items,request.jobId) as ReviewTask[];
   const options=request.kind==='setup'?await Promise.allSettled(profiles.map(([id])=>api<ReviewOptions>(`/api/collaboration/external-dispatch/options?profile_id=${id}${refresh?'&refresh_directory=true':''}`,{signal:abort.signal}))):[];
   if(!alive.current||generation!==epoch.current)return;
   setExternal(connection.external_enabled);setTasks(current);setFetchedAt(new Date().toISOString());
   if(request.kind==='setup')setPlatforms(old=>profiles.map(([id,label],index)=>{
    const outcome=options[index],o=outcome?.status==='fulfilled'?outcome.value:null,previous=old.find(p=>p.profileId===id),task=current.find(t=>t.platform===id)||null;
    const available=!!o&&o.active_profile===id&&o.platforms.some(p=>p.profile_id===id&&p.configuration_ok)&&connection.external_enabled;
    const group=o?.directory.groups.find(g=>g.group_ref===previous?.group)||o?.directory.groups.find(g=>g.authorized);
    return {profileId:id,label,options:o,configurationOk:available,enabled:initialReviewEnabled(available,task,previous),expanded:previous?.expanded??true,deliveryChannels:previous?.deliveryChannels||[o?.direct_delivery.status==='available'?'direct':'group'],group:group?.group_ref||'',selectedReviewers:[],task,loading:false,feedback:outcome?.status==='rejected'?(outcome.reason as Error).message:o?.directory.refresh_error?`目录刷新失败：${o.directory.refresh_error}`:!connection.external_enabled?'请先在协同设置中启用本工作区。':''};
   }));
   setFeedback(refresh?'目录已重新读取，请重新勾选复核人。':'');
  }catch(e){if(alive.current&&generation===epoch.current){setExternal(false);setError((e as Error).message);setPlatforms(old=>old.map(p=>({...p,configurationOk:false})));}}
  finally{if(alive.current&&generation===epoch.current)setLoading(false);}
 }
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;epoch.current++;controller.current?.abort();};},[]);
 async function send(renew=false){
  if(lock.current||busy||loading)return;
  const problem=reviewProblem(platforms,confirmed,instructions,deadline);if(problem){setFeedback(problem);return;}
  if(!external){setFeedback('请先完成协同设置。');return;}
  if(platforms.some(p=>p.enabled&&p.task)&&!renew){setRound(true);return;}
  lock.current=true;setSending(true);setRound(false);onBusy('正在发送同事复核');
  const selected=platforms.filter(p=>p.enabled);
  try{
   const responses=await Promise.allSettled(selected.map(async p=>{
    const payload=await api<{task:ReviewTask;created?:boolean;started_new_round?:boolean}>('/api/collaboration/external-dispatch/web-review',json(reviewPayload(p,request,instructions,deadline)));
    if(!payload.task||payload.task.platform!==p.profileId||payload.task.source_job_id!==request.jobId)throw new Error('复核回执与当前平台或成果不一致，请刷新核对。');
    return payload;
   }));
   if(!alive.current)return;
   const notes:string[]=[];
   responses.forEach((outcome,index)=>{
    const p=selected[index];
    if(outcome.status==='fulfilled'){
     const task=outcome.value.task;setTasks(old=>[...old.filter(t=>t.platform!==p.profileId),task]);
     const message=task.can_retry?'部分投递未完成，可仅重试失败步骤。':outcome.value.created||outcome.value.started_new_round?'已发起复核，请核对送达状态。':'已找到现有任务，没有重复发送。';
     edit(p.profileId,current=>({...current,task,enabled:false,feedback:message}));notes.push(`${p.label}：${message}`);
    }else{edit(p.profileId,current=>({...current,feedback:(outcome.reason as Error).message}));notes.push(`${p.label}：${(outcome.reason as Error).message}`);}
   });
   setFeedback(notes.join(' '));setFetchedAt(new Date().toISOString());setConfirmed(false);
  }finally{lock.current=false;onBusy('');if(alive.current)setSending(false);}
 }
 async function retry(id:string){
  const p=platforms.find(p=>p.profileId===id);if(lock.current||busy||loading||!p?.task?.can_retry||!external)return;
  lock.current=true;setSending(true);onBusy('正在重试复核失败步骤');
  try{const data=await api<{task:ReviewTask}>(`/api/collaboration/external-dispatch/tasks/${encodeURIComponent(p.task.task_id)}/retry`,{method:'POST'});if(!alive.current)return;if(data.task?.task_id!==p.task.task_id||data.task.platform!==id||data.task.source_job_id!==request.jobId)throw Error('重试回执不一致，请刷新核对。');edit(id,current=>({...current,task:data.task,feedback:`重试结果：${data.task.status_label}`}));setTasks(old=>old.map(t=>t.task_id===data.task.task_id?data.task:t));}catch(e){if(alive.current)setFeedback((e as Error).message);}finally{lock.current=false;onBusy('');if(alive.current)setSending(false);}
 }
 const display=platforms.map(p=>({...p,directDeliveryAvailable:p.options?.direct_delivery.status==='available',groups:p.options?.directory.groups||[],people:reviewPeople(p)}));
 return <div className="astra-review">
  <div className="review-toolbar"><span className="badge badge-outline">飞书 / WeAct</span><button className="btn btn-ghost btn-sm" disabled={sending} onClick={onSettings}>协同设置</button></div>
  {error&&<div className="alert review-read-error" role="alert"><span>{error}</span><button className="btn btn-sm" disabled={loading||sending} onClick={()=>void load()}>重试读取</button></div>}
  {request.kind==='setup'?<InlineReviewSetupCard fileName={request.fileName} jobId={request.jobId} reviewRows={request.reviewRows} platforms={display} deadline={deadline} instructions={instructions} audienceConfirmed={confirmed} feedback={feedback} loading={loading} sending={sending||busy} newRoundConfirmationOpen={round}
   onPlatformEnabledChange={(id,value)=>edit(id,p=>({...p,enabled:value,expanded:value||p.expanded}))} onPlatformExpandedChange={(id,value)=>setPlatforms(all=>all.map(p=>p.profileId===id?{...p,expanded:value}:p))}
   onDeliveryChannelChange={(id,channel,checked)=>edit(id,p=>({...p,deliveryChannels:checked?[...new Set([...p.deliveryChannels,channel])]:p.deliveryChannels.filter(c=>c!==channel),selectedReviewers:[]}))}
   onGroupChange={(id,group)=>edit(id,p=>({...p,group,selectedReviewers:[]}))} onReviewerChange={(id,ref,checked)=>edit(id,p=>({...p,selectedReviewers:checked?[...new Set([...p.selectedReviewers,ref])].slice(0,10):p.selectedReviewers.filter(r=>r!==ref)}))}
   onDeadlineChange={value=>{setDeadline(value);setConfirmed(false);setRound(false);}} onInstructionsChange={value=>{setInstructions(value);setConfirmed(false);setRound(false);}}
   onAudienceConfirmedChange={setConfirmed} onRefresh={()=>void load(true)} onCancel={onClose} onSubmit={()=>void send()} onRetry={id=>void retry(id)} onOpenNewRoundConfirmation={()=>setRound(true)} onCloseNewRoundConfirmation={()=>setRound(false)} onConfirmNewRound={()=>void send(true)}/>:null}
  {request.kind==='setup'&&tasks.some(t=>t.can_retry)&&<div className="review-retry-actions">{platforms.filter(p=>p.task?.can_retry).map(p=><button key={p.profileId} className="btn btn-outline btn-sm" disabled={sending||busy||loading||!external} onClick={()=>void retry(p.profileId)}>仅重试 {p.label} 失败步骤</button>)}</div>}
  {(request.kind==='progress'||tasks.length>0)&&<InlineReviewProgressCard snapshot={{jobId:request.jobId,fileName:request.fileName,fetchedAt,tasks,error}} refreshing={loading} onRefresh={()=>void load()} onStartReview={onClose} onAddPlatform={request.kind==='progress'?onClose:()=>{setConfirmed(false);setPlatforms(all=>all.map(p=>({...p,enabled:p.configurationOk&&!p.task,expanded:!p.task||p.expanded})));}}/>}
 </div>;
}
