export const protocol = 'astra-professional/1';
export type ProfessionalContext = {context:string;view:string;jobId:string;dark:boolean;palette?:import("../studio/appearance").Palette;active:boolean;knowledgeSeed?:{id:string;title:string;question:string;conclusion:string;sourceReference:string;evidenceSummary:string;sourceType:"knowledge_answer";jobId:string};input?:{file:File;sheets:unknown[]}|null};
export let currentContext:ProfessionalContext = {context:'',view:'workload',jobId:'',dark:false,active:false};
const operations:Record<string,string> = {
  '/api/process':'表格结构已转换','/api/process/batch-match':'批量匹配完成',
  '/api/preview/cell':'表格修改已保存','/api/preview/recalculate':'公式重算已返回',
  '/api/fill-assist/confirm':'辅助填价已确认','/api/workload-capture/run':'工作量抓取完成',
  '/api/workload-capture/apply-to-current':'工作量已写入当前表格',
  '/api/experience-pool/import':'经验池导入完成','/api/settlement-audit/review':'结算审核完成',
  '/api/risk-report':'风险报告已生成','/api/experience-warnings/run':'经验池预警完成',
  '/api/knowledge-memory/candidates':'知识候选已保存',
};
export function notifyParent(type:string, payload:Record<string,unknown>={}) {
  if(window.parent!==window) window.parent.postMessage({protocol,type,context:currentContext.context,...payload},window.location.origin);
}
// This adapter is confined to this iframe's JS realm. Parent requests are untouched.
const originalFetch=window.fetch.bind(window);
window.fetch=async (input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,window.location.href);
  if(url.origin!==window.location.origin)throw new Error('专业模块只能连接 Astra 独立服务');
  const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  const mutation=['POST','PUT','PATCH','DELETE'].includes(method);
  const context=currentContext.context;
  const title=mutation?(operations[url.pathname] || (/\/knowledge-memory\/.*\/(confirm|reject|revoke|revise|submit|promote-general|mark-stale)$/.test(url.pathname)?'知识记忆治理已保存':/\/ai-matching\/(analyze|confirm|cancel)$/.test(url.pathname)?'AI 编制操作已返回':'')):'';
  if(title)notifyParent('busy',{label:title.replace(/已.*|完成/,'处理中')});
  try {
    const response=await originalFetch(input,init);
    if(mutation&&title&&response.ok&&context===currentContext.context){
      const data=await response.clone().json().catch(()=>({}));
      notifyParent('receipt',{title,path:url.pathname,jobId:data.job_id||currentContext.jobId,downloads:{...data.downloads,...data.workload_downloads},view:currentContext.view});
    }
    return response;
  } finally {if(title&&context===currentContext.context)notifyParent('busy',{label:''});}
};
export function setContext(value:ProfessionalContext){currentContext=value;}
