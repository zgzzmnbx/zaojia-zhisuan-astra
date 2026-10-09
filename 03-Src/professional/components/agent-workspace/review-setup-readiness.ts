export type ReviewSetupPlatform={
 label:string;enabled:boolean;configurationOk:boolean;loading:boolean;
 deliveryChannels:Array<'group'|'direct'>;directDeliveryAvailable:boolean;group:string;
 groups:Array<{group_ref:string;authorized:boolean;members_available:boolean;member_count:number}>;
 selectedReviewers:string[];task:{status:string;status_label:string}|null;
};
export function reviewMethodProblem(p:ReviewSetupPlatform){
 if(!p.enabled)return `${p.label} 未启用。`;
 if(!p.configurationOk)return `${p.label} 配置未就绪。`;
 if(p.loading)return `${p.label} 正在读取目录。`;
 if(!p.deliveryChannels.length)return `请选择 ${p.label} 的发送方式。`;
 if(p.deliveryChannels.includes('direct')&&!p.directDeliveryAvailable)return `${p.label} 个人私聊尚未核验。`;
 const group=p.groups.find(g=>g.group_ref===p.group);
 if(p.deliveryChannels.includes('group')){
  if(!group)return `请选择 ${p.label} 的工作群。`;
  if(!group.authorized)return `${p.label} 工作群未授权。`;
  if(!group.members_available)return `${p.label} 工作群成员尚未就绪。`;
  if(group.member_count>10)return `${p.label} 工作群超过 10 人。`;
 }
 return '';
}
export function reviewSetupProblem(p:ReviewSetupPlatform){
 const method=reviewMethodProblem(p);if(method)return method;
 if(p.task&&!['completed','returned'].includes(p.task.status))return `${p.label} 已有进行中的复核，请查看进度或仅重试失败步骤。`;
 if(!p.selectedReviewers.length)return `请先选择 ${p.label} 的复核人员，或取消启用该平台。`;
 return '';
}
export function reviewConfirmationProblem(platforms:ReviewSetupPlatform[]){
 const selected=platforms.filter(p=>p.enabled);
 return selected.length?selected.map(reviewSetupProblem).filter(Boolean).join(' '):'请先选择复核平台。';
}
