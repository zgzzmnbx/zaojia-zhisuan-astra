import type {DocumentSource,FormattedDocument,GongwenDraft,GongwenPrepared} from './document-types';
import type {ConversationCard} from './types';
export function reportProgressCard(stage:number,failed=false):ConversationCard{
 const labels=['生成文字报告','整理 Markdown','公文排版','保存成果'];
 return {kind:'confirmation',title:'生成报告',caption:'自动处理',icon:'file',status:failed?'未完成':stage===4?'已完成':labels[stage],tone:failed?'error':stage===4?'success':undefined,
  steps:labels.map((label,index)=>({label,state:index<stage?'done':index===stage?'current':'waiting'}))};
}
export type RiskReportReply={risk_report_mode:string;risk_report_markdown_filename?:string;risk_report_markdown_sha256?:string;generated_by_model?:boolean};
export function riskMarkdownSource(job:string,reply:RiskReportReply):DocumentSource{
 if(reply.risk_report_markdown_filename!=='risk-report.md'||!reply.risk_report_markdown_sha256||!/^[a-f0-9]{64}$/.test(reply.risk_report_markdown_sha256))throw Error('风险报告未提供完整 Markdown 成果，请更新报告服务后重试。');
 return {kind:'risk-markdown',source_id:job,name:reply.risk_report_markdown_filename,revision:reply.risk_report_markdown_sha256};
}

/** The demo already uses a fixed no-title layout; defer title candidates until settings are opened. */
export async function formatRiskReport(source:DocumentSource,conversation:string,reply:RiskReportReply,request:<T>(path:string,payload:Record<string,unknown>)=>Promise<T>,current:()=>boolean):Promise<{output:FormattedDocument;formatDraft?:GongwenDraft}|undefined>{
 if(!current())return;
 const payload={...source,conversation_id:conversation,sha256:source.revision};
 if(reply.risk_report_mode==='demo_preset'&&reply.generated_by_model===false){
  const output=await request<FormattedDocument>('/api/astra/documents/format',{...payload,options:{confirmed_title:'none'}});
  return current()?{output}:undefined;
 }
 const prepared=await request<GongwenPrepared>('/api/astra/documents/prepare',payload);
 if(!current())return;
 const output=await request<FormattedDocument>('/api/astra/documents/format',{...payload,sha256:prepared.sha256,prepared_id:prepared.id,options:{...prepared.defaults,confirmed_title:'none'}});
 return current()?{output,formatDraft:{prepared,options:prepared.defaults,titleMode:'none',selected:'',manualTitle:''}}:undefined;
}
