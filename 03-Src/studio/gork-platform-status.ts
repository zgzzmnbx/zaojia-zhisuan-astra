export type GorkPlatform={state:'checking'|'offline'|'connected'|'error';message:string;checked_at:number;worker_running?:boolean;robot_connected?:boolean;notifications_enabled?:boolean};
export function gorkPlatformPresentation(value:GorkPlatform|null,failed=false,now=Date.now()){
 if(failed)return {tone:'error',label:'Gork 连接检测失败，正在自动重试'};
 if(!value||value.state==='checking')return {tone:'offline',label:'正在自动连接 Gork'};
 if(!value.worker_running||now-value.checked_at*1000>20000)return {tone:'error',label:'Gork 连接状态异常，正在自动恢复'};
 if(value.state==='offline')return {tone:'offline',label:value.message};
 if(value.state!=='connected')return {tone:'error',label:value.message};
 return {tone:'connected',label:'Gork 已连接 · '+(value.robot_connected?'Watch 已连接':'Watch 未连接')+' · '+(value.notifications_enabled?'阶段通知已开启':'阶段通知已关闭')};
}
