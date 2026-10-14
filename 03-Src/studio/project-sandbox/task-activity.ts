import {runningZone,type ZoneId} from './node-state.ts';

export type TaskActivity={zone:ZoneId;phase:'running'|'settled'|'error'|'cancelled';label:string;run:number;initialError:string;initialCancel:number};
type ActivityInput={ready:boolean;busy:string;qaRunning:boolean;error?:string;cancelVersion?:number};
/** Only live work starts an activity. Restored result snapshots never replay it. */
export function nextTaskActivity(previous:TaskActivity|null,input:ActivityInput):TaskActivity|null{
 if(!input.ready)return null;
 const zone=runningZone(input.busy,input.qaRunning),error=input.error||'',cancel=input.cancelVersion||0;
 if(zone){
  if(previous?.phase==='running'&&previous.zone===zone){
   const label=input.busy||'正在检索资料';return previous.label===label?previous:{...previous,label};
  }
  return {zone,phase:'running',label:input.busy||'正在检索资料',run:(previous?.run||0)+1,initialError:error,initialCancel:cancel};
 }
 if(previous?.phase!=='running')return previous;
 if(cancel!==previous.initialCancel)return {...previous,phase:'cancelled',label:'已停止，已完成的结果保留'};
 if(error&&error!==previous.initialError)return {...previous,phase:'error',label:error};
 // A request ending is not proof of business completion (e.g. awaiting confirmation).
 return {...previous,phase:'settled',label:'本次处理已结束'};
}
