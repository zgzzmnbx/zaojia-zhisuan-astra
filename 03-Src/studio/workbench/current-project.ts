import {feeSnapshot} from '../fee-summary.ts';
import type {Result,Risk} from '../types';
import type {Conversation,Project} from '../useWorkspace';
export type ResultScope={conversationId:string;projectId:string|null;jobId:string};
export type CurrentProjectInput={ready:boolean;active:Conversation|null;projects:Project[];conversations:Conversation[];result:Result|null;resultScope:ResultScope|null;risks:Risk[];riskJobId:string;filename:string;debug:boolean};
const count=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
export function currentProjectSnapshot(input:CurrentProjectInput){
 if(!input.ready||!input.active?.project_id)return null;
 const project=input.projects.find(p=>p.id===input.active!.project_id);if(!project)return null;
 const conversations=input.conversations.filter(c=>c.project_id===project.id);
 const scope=input.resultScope,valid=scope?.conversationId===input.active.id&&scope.projectId===project.id&&scope.jobId===input.result?.job_id;
 const result=valid?input.result:null,s=result?.summary,total=s?count(s.total_data_rows):null;
 const matched=s?Math.min(total!,count(s.matched_rows)):null,review=s?Math.min(total!,count(s.review_rows)):null;
 const loadedRisks=!!result&&input.riskJobId===result.job_id;
 const severity={high:0,medium:0,low:0,other:0};if(loadedRisks)for(const r of input.risks){const key=r.severity==='high'?'high':r.severity==='medium'?'medium':r.severity==='low'?'low':'other';severity[key]++;}
 return {id:project.id,title:project.name,background:project.background,conversationId:input.active.id,conversationTitle:input.active.title,conversationCount:conversations.length,resultConversations:new Set([...conversations.filter(c=>!!(c.job_id||c.state?.job_id)).map(c=>c.id),...(result?[input.active.id]:[])]).size,
  debug:input.debug,filename:result?.input_filename||input.filename,jobId:result?.job_id||'',total,matched,review,remaining:total===null?null:Math.max(0,total-(matched||0)),percent:total?Math.round((matched||0)/total*100):null,
  fees:feeSnapshot(result),matchingStatus:s?.matching_status||'',riskChecked:!!s?.warning_summary?.executed,riskLoaded:loadedRisks,riskTotal:loadedRisks?input.risks.length:null,severity,
  recalculated:result?.formula_recalculated===true,needsRecalculate:result?.needs_recalculate===true,hasResult:!!result};
}
export type CurrentProject=NonNullable<ReturnType<typeof currentProjectSnapshot>>;
export const currentCardClosed=(closed:string[],project:CurrentProject|null)=>!!project&&closed.includes(project.id);
export function closeCurrentCard(closed:string[],id:string){return [...new Set([...closed,id])];}
export function reopenCurrentCard(closed:string[],id:string){return closed.filter(value=>value!==id);}
