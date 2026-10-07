export type Platform='default'|'weact_cost';
export const platforms=[{id:'default' as const,label:'飞书'},{id:'weact_cost' as const,label:'WeAct'}];
export type BotProfile={profile_id:string;domain_host?:string;app_id_suffix?:string;configured?:boolean;configuration_error?:string;status?:string;running?:boolean;enabled?:boolean;health?:{fresh?:boolean;healthy?:boolean;connected?:boolean;identity_ready?:boolean;backend_ok?:boolean;queues?:{outbox?:Record<string,number>;inbox?:Record<string,number>}}};
export type BotStatus={profiles:BotProfile[]};
export type StatusSnapshot={data:BotStatus|null;error:string;checkedAt:number|null};
// Match the retained professional UI: a process or configuration alone is not a healthy connection.
export function platformStatus(snapshot:StatusSnapshot,id:Platform){
 if(snapshot.error)return '检测失败';
 if(!snapshot.data)return '未检测';
 const p=snapshot.data.profiles.find(p=>p.profile_id===id);
 if(!p)return '未配置';
 if(p.configuration_error||p.status==='configuration_error')return '配置异常';
 if(!p.configured||p.status==='not_configured')return '未配置';
 if(p.status==='stopping')return '停止中';
 if(p.running){
  const h=p.health;
  if(!h?.fresh)return '待核验';
  if(!h.connected)return '重连中';
  if(!h.identity_ready)return '身份待恢复';
  if(!h.backend_ok)return '后端异常';
  if(h.queues?.outbox?.failed||h.queues?.inbox?.failed)return '有失败消息';
  if(h.queues?.outbox?.pending)return '待补发';
  return h.healthy?'运行中':'待核验';
 }
 return p.enabled?'启动中':'已关闭';
}
