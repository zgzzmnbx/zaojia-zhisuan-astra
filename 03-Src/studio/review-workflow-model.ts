import {reviewParticipants,reviewParticipantKind,summarizeReviewProgress,type ReviewProgressTask} from '../professional/components/agent-workspace/reviewProgress.ts';
export type WorkflowItem={id:string;title:string;detail:string;kind:'artifact'|'platform'|'person'|'result';tone:string;platform?:string;comment?:string;x:number;y:number};
export type WorkflowDraft={profileId:string;label:string;enabled:boolean;configurationOk:boolean;selectedReviewers:string[];people:{person_ref:string;display_name:string}[];deliveryChannels:string[]};
/** Projection only: edges never create or reorder external review tasks. */
export function reviewWorkflow(tasks:ReviewProgressTask[],drafts?:WorkflowDraft[]){
 const items:WorkflowItem[]=[{id:'artifact',title:'当前成果',detail:drafts?'配置本次复核':'已发起的复核',kind:'artifact',tone:'accent',x:104,y:0}];
 const links:{id:string;source:string;target:string;tone:string}[]=[];
 const link=(source:string,target:string,tone='muted')=>links.push({id:`${source}:${target}`,source,target,tone});
 let bottom=300;
 for(const [i,id] of ['default','weact_cost'].entries()){
  const task=tasks.find(t=>t.platform===id),draft=drafts?.find(p=>p.profileId===id),label=i?'WeAct':'飞书';
  const people=drafts?(draft?.enabled?draft.people.filter(p=>draft.selectedReviewers.includes(p.person_ref)).map(p=>({name:p.display_name,status:'待发送',comment:''})):[]):task?reviewParticipants(task):[];
  const tone=drafts?(draft?.enabled?'accent':'muted'):task?(task.status==='completed'?'approved':task.status==='returned'?'returned':'pending'):'muted';
  const detail=drafts?(draft?.enabled?draft.deliveryChannels.map(c=>c==='direct'?'私聊':'工作群').join(' + ')||'选择发送方式':draft?.configurationOk?'未选用':'未就绪'):task?`第 ${task.review_round||1} 轮 · ${task.status_label}`:'尚未发起';
  items.push({id,title:label,detail,kind:'platform',tone,platform:id,x:i*208,y:100});link('artifact',id,tone);
  let last=id;
  people.forEach((person,j)=>{const pid=`${id}-person-${j}`,pt=drafts?'pending':reviewParticipantKind(person.status);items.push({id:pid,title:person.name,detail:person.status,comment:person.comment,kind:'person',tone:pt,platform:id,x:i*208,y:200+j*90});link(id,pid,pt);last=pid;});
  bottom=Math.max(bottom,200+people.length*90+10);
  // Each person is an independent reviewer, never a serial approval chain.
  if(people.length)people.forEach((_,j)=>link(`${id}-person-${j}`,'result',drafts?'muted':reviewParticipantKind(people[j].status)));
  else link(last,'result','muted');
 }
 const summary=summarizeReviewProgress(tasks);
 items.push({id:'result',title:drafts?'确认并发送':summary.label,detail:drafts?'核对范围与期限':`${summary.approved} 通过 · ${summary.pending} 待复核 · ${summary.returned} 退回`,kind:'result',tone:drafts?'accent':summary.tone==='completed'?'approved':summary.tone==='returned'?'returned':'muted',x:104,y:bottom});
 return {items,links};
}
export type ReviewBounds={left:number;top:number;width:number;height:number};
export function fitReviewWindow(bounds:ReviewBounds,expanded:boolean,offset={x:0,y:0}):ReviewBounds{
 const width=Math.min(bounds.width,expanded?780:440),height=Math.min(bounds.height,expanded?820:640);
 return {left:bounds.left+Math.max(0,Math.min(bounds.width-width,(bounds.width-width)/2+offset.x)),top:bounds.top+Math.max(0,Math.min(bounds.height-height,offset.y)),width,height};
}
