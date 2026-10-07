import type {ReviewProgressTask} from '../professional/components/agent-workspace/reviewProgress';
export type Person={person_ref:string;display_name:string};
export type Group={group_ref:string;name:string;member_count:number;members_available:boolean;authorized:boolean;people:Person[]};
export type ReviewOptions={active_profile:string;platforms:{profile_id:string;configuration_ok:boolean}[];directory:{groups:Group[];people:Person[];refresh_error?:string};direct_delivery:{status:string}};
export type ReviewTask=ReviewProgressTask&{can_retry:boolean;error?:string};
export type ReviewPlatform={profileId:string;label:string;configurationOk:boolean;enabled:boolean;expanded:boolean;options:ReviewOptions|null;deliveryChannels:('direct'|'group')[];group:string;selectedReviewers:string[];task:ReviewTask|null;loading:boolean;feedback:string};
export type ReviewRequest={kind:'setup'|'progress';jobId:string;fileName:string;projectName:string;reviewRows:number;version:number;closed?:boolean};
export function reviewPeople(p:ReviewPlatform){return p.deliveryChannels.includes('group')?p.options?.directory.groups.find(g=>g.group_ref===p.group)?.people||[]:p.options?.directory.people||[];}
export function nextRound(task:ReviewTask|null){return !!task&&['completed','returned'].includes(task.status);}
/** Original 2.0 recipient and round rules, checked again immediately before POST. */
export function reviewProblem(platforms:ReviewPlatform[],confirmed:boolean,instructions:string,deadline:string){
 const selected=platforms.filter(p=>p.enabled);
 if(!selected.length)return '请至少选择飞书或 WeAct。';
 for(const p of selected){
  if(!p.configurationOk||!p.options||p.loading)return `${p.label} 配置或目录未就绪，请刷新。`;
  if(!p.deliveryChannels.length)return `请选择 ${p.label} 的发送方式。`;
  if(p.deliveryChannels.includes('direct')&&p.options.direct_delivery.status!=='available')return `${p.label} 个人私聊尚未核验。`;
  const group=p.options.directory.groups.find(g=>g.group_ref===p.group);
  if(p.deliveryChannels.includes('group')&&(!group?.authorized||!group.members_available||group.member_count>10))return `${p.label} 工作群未授权、成员不可用或超过 10 人。`;
  const refs=[...new Set(p.selectedReviewers)];
  if(!refs.length||refs.length>10||refs.some(ref=>!reviewPeople(p).some(person=>person.person_ref===ref)))return `请重新选择 ${p.label} 的 1 至 10 名复核人。`;
  if(p.task&&!nextRound(p.task))return `${p.label} 已有进行中的复核，请查看进度或仅重试失败步骤。`;
 }
 if(!confirmed)return '请先核对并确认本次发送范围。';
 if(!instructions.trim())return '请填写复核说明。';
 if(!Number.isFinite(new Date(deadline).getTime()))return '请设置有效的截止时间。';
 return '';
}
export function reviewPayload(p:ReviewPlatform,request:ReviewRequest,instructions:string,deadline:string){return {job_id:request.jobId,platform_profile_id:p.profileId,reviewer_refs:[...new Set(p.selectedReviewers)],delivery_mode:p.deliveryChannels.length===2?'mixed':p.deliveryChannels[0],target_group_ref:p.deliveryChannels.includes('group')?p.group:'',deadline:new Date(deadline).toISOString(),instructions:instructions.trim(),project_name:request.projectName,start_new_round:!!p.task,existing_task_id:p.task?.task_id||'',previous_review_round:p.task?.review_round||0};}
