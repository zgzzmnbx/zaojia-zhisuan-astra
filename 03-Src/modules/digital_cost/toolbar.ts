export const toolbarProtocol='digital-cost-toolbar/1';
export type ToolbarState={taskId:string;revision:number;tasks:{id:string;label:string}[];tabs:string[];selected:string;busy:boolean;blocked:boolean;primary:{label:string;disabled:boolean}|null};
export type ToolbarPacket={token:string;state:ToolbarState};
const text=(v:unknown,max=300):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
export function readToolbarPacket(data:any):ToolbarPacket|null{
 if(!data||data.protocol!==toolbarProtocol||data.type!=='state'||!text(data.token,100))return null;
 const s=data.state;
 if(!s||!text(s.taskId,100)||!Number.isSafeInteger(s.revision)||s.revision<0||typeof s.busy!=='boolean'||typeof s.blocked!=='boolean')return null;
 if(!Array.isArray(s.tasks)||s.tasks.length>1000||!s.tasks.every((t:any)=>t&&text(t.id,100)&&text(t.label))||!s.tasks.some((t:any)=>t.id===s.taskId))return null;
 if(!Array.isArray(s.tabs)||s.tabs.length<1||s.tabs.length>8||!s.tabs.every((t:any)=>text(t,30))||new Set(s.tabs).size!==s.tabs.length||!s.tabs.includes(s.selected))return null;
 if(s.primary!==null&&(!s.primary||!text(s.primary.label,80)||typeof s.primary.disabled!=='boolean'))return null;
 // Copy only the supported display data. No HTML or executable handlers cross frames.
 return {token:data.token,state:{taskId:s.taskId,revision:s.revision,tasks:s.tasks.map((t:any)=>({id:t.id,label:t.label})),tabs:[...s.tabs],selected:s.selected,busy:s.busy,blocked:s.blocked,primary:s.primary?{label:s.primary.label,disabled:s.primary.disabled}:null}};
}
