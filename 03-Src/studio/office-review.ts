import {reviewPeople, nextRound, type ReviewOptions, type ReviewPlatform, type ReviewRequest, type ReviewTask} from './review-flow.ts';
import {reviewParticipants} from '../professional/components/agent-workspace/reviewProgress.ts';

export type OfficePerson = {id:string; name:string; selectable:boolean; selected:boolean; accounts:{platform:string;name:string}[]};
export type OfficeTask = {id:string; dispatchId?:string; employeeId:string; employeeName?:string; title:string; projectName?:string; reviewRound?:number; createdAt?:string; artifactName?:string; status:string; personStatus?:string; roundStatus?:string; platformLabel?:string; demo:boolean; comment?:string};
export type PendingOfficeReview = {taskId:string; platform:string; reviewerRef:string; reviewerName:string; projectName:string; taskName:string; artifactName:string; reviewRound?:number; createdAt?:string};
export type OfficeReviewChannel = {
  id:string; label:string; reason:string;
  members:{id:string; name:string; selected:boolean}[];
};
export type OfficeSnapshot = {
  context:string; revision:number; request:ReviewRequest; people:OfficePerson[]; tasks:OfficeTask[];
  toggle:(id:string,selected:boolean)=>void;
  channels?:OfficeReviewChannel[];
  toggleChannel?:(profile:string,id:string,selected:boolean)=>void;
};
export function createOfficeBridge() {
  let snapshot:OfficeSnapshot|null=null;
  let revision=0;
  const listeners=new Set<()=>void>();
  return {
    getSnapshot:()=>snapshot,
    subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
    publish(value:Omit<OfficeSnapshot,'revision'>){snapshot={...value,revision:++revision};listeners.forEach(fn=>fn());},
    clear(context:string){if(snapshot?.context===context){snapshot=null;listeners.forEach(fn=>fn());}},
  };
}
export type OfficeBridge=ReturnType<typeof createOfficeBridge>;

export function officeDirectory(records:{profileId:string;options:ReviewOptions}[]):OfficePerson[] {
  return officeRoster(records.map(record=>({...record,label:record.profileId,deliveryChannels:['direct'],
    selectedReviewers:[],enabled:false,expanded:false,group:'',task:null,configurationOk:false,loading:false,feedback:''})),true);
}

// These directory aliases identify the user's two accounts. Actual selections use
// only the stable person_ref returned by the current, validated platform directory.
export function isOfficeOwner(platform:string,name:string) {
  return (platform==='default'&&name==='大尾巴')||(platform==='weact_cost'&&name==='石萌');
}
function channelMemberId(profile:string,person:{person_ref:string;display_name:string}) {
  return isOfficeOwner(profile,person.display_name)?'owner':`${profile}:${person.person_ref}`;
}
export function officeChannel(platform:ReviewPlatform,busy:boolean):OfficeReviewChannel {
  const group=platform.options?.directory.groups.find(g=>g.group_ref===platform.group);
  let reason='';
  if(busy||platform.loading)reason='正在更新复核卡';
  else if(!platform.configurationOk||!platform.options)reason='请在协同设置中启用平台';
  else if(platform.task&&!nextRound(platform.task))reason='本轮复核进行中';
  else if(!platform.enabled&&platform.selectedReviewers.length)reason='请在复核卡重新启用已有名单';
  else if(!platform.deliveryChannels.length)reason='请先选择发送方式';
  else if(platform.deliveryChannels.includes('group')&&(!group?.authorized||!group.members_available||group.member_count>10))reason='请先在复核卡选择可用工作群';
  else if(platform.deliveryChannels.includes('direct')&&platform.options.direct_delivery.status!=='available')reason='个人私聊尚未核验';
  return {id:platform.profileId,label:platform.label,reason,members:reviewPeople(platform).map(person=>({
    id:channelMemberId(platform.profileId,person),name:person.display_name,
    selected:platform.enabled&&platform.selectedReviewers.includes(person.person_ref)
  }))};
}
/** Both entry points edit the same platform's recipient references. */
export function selectReviewer(p:ReviewPlatform,ref:string,checked:boolean):ReviewPlatform {
  return {...p,selectedReviewers:checked?[...new Set([...p.selectedReviewers,ref])].slice(0,10):p.selectedReviewers.filter(r=>r!==ref)};
}
export function selectOfficeReviewer(p:ReviewPlatform,employeeId:string,checked:boolean):ReviewPlatform {
  if(officeChannel(p,false).reason)return p;
  const matches=reviewPeople(p).filter(person=>channelMemberId(p.profileId,person)===employeeId);
  if(matches.length!==1)return p;
  const ref=matches[0].person_ref;
  if(checked&&!p.selectedReviewers.includes(ref)&&p.selectedReviewers.length>=10)return p;
  if((p.enabled||!checked)&&p.selectedReviewers.includes(ref)===checked)return p;
  return {...selectReviewer(p,ref,checked),enabled:checked||p.enabled};
}
export function officeRoster(platforms:ReviewPlatform[],busy:boolean):OfficePerson[] {
  const people=new Map<string,OfficePerson>();
  for(const platform of platforms) {
    const available=reviewPeople(platform);
    for(const person of platform.options?.directory.people||[]) {
      const owner=isOfficeOwner(platform.profileId,person.display_name);
      const id=owner?'owner':`${platform.profileId}:${person.person_ref}`;
      const previous=people.get(id);
      const selectable=owner&&!busy&&platform.enabled&&platform.configurationOk&&
        (!platform.task||nextRound(platform.task))&&available.some(p=>p.person_ref===person.person_ref);
      people.set(id,{id,name:owner?'石萌':person.display_name,selectable:!!previous?.selectable||selectable,
        selected:!!previous?.selected||platform.selectedReviewers.includes(person.person_ref),accounts:[...(previous?.accounts||[]),{platform:platform.profileId,name:person.display_name}]});
    }
  }
  return [...people.values()].sort((a,b)=>Number(b.id==='owner')-Number(a.id==='owner'));
}
export function officeTasks(tasks:(ReviewTask & {task_name?:string})[],request:ReviewRequest,people:OfficePerson[]=[]):OfficeTask[] {
  return tasks.flatMap(task=>reviewParticipants(task).map((person,index)=>({
    id:`${task.task_id}:${index}`,dispatchId:task.task_id,employeeId:isOfficeOwner(task.platform,person.name)?'owner':people.find(p=>p.accounts.some(a=>a.platform===task.platform&&a.name===person.name))?.id||`${task.platform}:${person.name}`,
    employeeName:person.name,title:task.task_name||request.projectName||request.fileName,status:`${task.platform==='default'?'飞书':'WeAct'} · ${person.status} · ${task.status_label}`,
    artifactName:request.fileName,projectName:request.projectName,reviewRound:task.review_round,createdAt:task.created_at,personStatus:person.status,roundStatus:task.status_label,platformLabel:task.platform==='default'?'飞书':'WeAct',demo:false,comment:person.comment,
  })));
}
export function pendingOfficeTask(row:PendingOfficeReview):OfficeTask {
  const employeeId=isOfficeOwner(row.platform,row.reviewerName)?'owner':`${row.platform}:${row.reviewerRef}`;
  const platformLabel=row.platform==='default'?'飞书':row.platform==='weact_cost'?'WeAct':row.platform;
  return {id:`${row.taskId}:${row.reviewerRef}`,dispatchId:row.taskId,employeeId,employeeName:row.reviewerName,
    title:row.taskName||row.projectName||row.artifactName||'成果复核',artifactName:row.artifactName,projectName:row.projectName,reviewRound:row.reviewRound,createdAt:row.createdAt,
    status:'待复核',personStatus:'待复核',platformLabel,demo:false};
}
