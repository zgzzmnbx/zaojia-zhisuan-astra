export const protocol = 'astra-professional/1';
export type ProfessionalContext = {context:string;view:string;jobId:string;dark:boolean;palette?:import("../studio/appearance").Palette;active:boolean;rowContext?:import('../studio/RowAssist').RowContext|null;businessRevision?:number;previewPreferences?:import('../studio/table/legacy-preview').PreviewColumnPreferences;knowledgeSeed?:{id:string;title:string;question:string;conclusion:string;sourceReference:string;evidenceSummary:string;sourceType:"knowledge_answer";jobId:string};input?:{file:File;sheets:unknown[]}|null};
export let currentContext:ProfessionalContext = {context:'',view:'workload',jobId:'',dark:false,active:false};
const operations:Record<string,string> = {
  '/api/process':'表格结构已转换','/api/process/batch-match':'批量匹配完成',
  '/api/preview/cell':'表格修改已保存','/api/preview/recalculate':'公式重算已返回',
  '/api/astra/row-assist/confirm':'辅助填价已确认','/api/fill-assist/confirm':'辅助填价已确认','/api/workload-capture/run':'工作量抓取完成',
  '/api/workload-capture/apply-to-current':'工作量已写入当前表格',
  '/api/experience-pool/import':'经验池导入完成','/api/settlement-audit/review':'结算审核完成',
  '/api/risk-report':'风险报告已生成','/api/experience-warnings/run':'经验池预警完成',
  '/api/knowledge-memory/candidates':'知识候选已保存',
};
export function notifyParent(type:string, payload:Record<string,unknown>={}) {
  if(window.parent!==window) window.parent.postMessage({protocol,type,context:currentContext.context,...payload},window.location.origin);
}
// This adapter is confined to this iframe's JS realm. Parent requests are untouched.
let rowSnapshot:any=null;
const originalFetch=window.fetch.bind(window);
window.fetch=async (input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,window.location.href);
  if(url.origin!==window.location.origin)throw new Error('专业模块只能连接 Astra 独立服务');
  if(init?.body&&typeof init.body==='string'&&url.pathname==='/api/fill-assist/candidates'){const body=JSON.parse(init.body);const row=currentContext.rowContext;if(row&&row.job_id===body.job_id&&row.sheet_name===body.sheet_name&&row.row_number===body.row_number){url.pathname='/api/astra/row-assist/candidates';input=url.pathname;init={...init,body:JSON.stringify({...body,conversation_id:row.conversation_id,context:row.context,expected_artifact_sha256:row.artifact_sha256})};}}
  if(init?.body&&typeof init.body==='string'&&url.pathname==='/api/fill-assist/confirm'&&rowSnapshot){const body=JSON.parse(init.body);const row=rowSnapshot.row_context;if(row.context===currentContext.context&&row.job_id===body.job_id&&row.sheet_name===body.sheet_name&&row.row_number===body.row_number&&row.column_number===body.column_number){url.pathname='/api/astra/row-assist/confirm';input=url.pathname;init={...init,body:JSON.stringify({...rowSnapshot,candidate_id:body.candidate.id,note:body.note,header_rows:body.header_rows})};}else throw new Error('当前行与候选上下文不一致，请重新打开该行');}
  if(init?.body&&typeof init.body==='string'&&url.pathname==='/api/knowledge/ask'&&rowSnapshot){const body=JSON.parse(init.body);if(body.context_type==='row'){const row=rowSnapshot.row_context;if(row.context!==currentContext.context||row.job_id!==body.job_id)throw new Error('当前行上下文已变化，请重新打开该行');url.pathname='/api/astra/row-assist/ask';input=url.pathname;init={...init,body:JSON.stringify({...rowSnapshot,question:body.question})};}}
  const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  const mutation=['POST','PUT','PATCH','DELETE'].includes(method);
  const context=currentContext.context,rowKey=JSON.stringify(currentContext.rowContext);
  const title=mutation?(operations[url.pathname] || (/\/knowledge-memory\/.*\/(confirm|reject|revoke|revise|submit|promote-general|mark-stale)$/.test(url.pathname)?'知识记忆治理已保存':/\/ai-matching\/(analyze|confirm|cancel)$/.test(url.pathname)?'AI 编制操作已返回':'')):'';
  if(title)notifyParent('busy',{label:title.replace(/已.*|完成/,'处理中')});
  try {
    const response=await originalFetch(input,init);
    if(['/api/astra/row-assist/candidates','/api/astra/row-assist/ask'].includes(url.pathname)&&(context!==currentContext.context||rowKey!==JSON.stringify(currentContext.rowContext)))throw new Error('当前行已切换，已丢弃旧响应');
    if(url.pathname==='/api/astra/row-assist/candidates'&&response.ok&&context===currentContext.context){const data=await response.clone().json();rowSnapshot={row_context:data.row_context,token:data.token};}
    if(mutation&&title&&response.ok&&context===currentContext.context){
      const data=await response.clone().json().catch(()=>({}));
      notifyParent('receipt',{title,path:url.pathname,jobId:data.job_id||currentContext.jobId,downloads:{...data.downloads,...data.workload_downloads},view:currentContext.view});
    }
    return response;
  } finally {if(title&&context===currentContext.context)notifyParent('busy',{label:''});}
};
export function setContext(value:ProfessionalContext){if(value.context!==currentContext.context||value.jobId!==currentContext.jobId||JSON.stringify(value.rowContext)!==JSON.stringify(currentContext.rowContext))rowSnapshot=null;currentContext=value;}
