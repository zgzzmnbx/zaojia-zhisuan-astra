import type {DocumentSource} from './document-types';
import type {ConversationCard} from './types';
export function reportProgressCard(stage:number,failed=false):ConversationCard{
 const labels=['生成文字报告','整理 Markdown','公文排版','打开预览'];
 return {kind:'confirmation',title:'生成报告',caption:'自动处理',icon:'file',status:failed?'未完成':stage===4?'已完成':labels[stage],tone:failed?'error':stage===4?'success':undefined,
  steps:labels.map((label,index)=>({label,state:index<stage?'done':index===stage?'current':'waiting'}))};
}
export type RiskReportReply={risk_report_mode:string;risk_report_markdown_filename?:string;risk_report_markdown_sha256?:string;generated_by_model?:boolean};
export function riskMarkdownSource(job:string,reply:RiskReportReply):DocumentSource{
 if(reply.risk_report_markdown_filename!=='risk-report.md'||!reply.risk_report_markdown_sha256||!/^[a-f0-9]{64}$/.test(reply.risk_report_markdown_sha256))throw Error('风险报告未提供完整 Markdown 成果，请更新报告服务后重试。');
 return {kind:'risk-markdown',source_id:job,name:reply.risk_report_markdown_filename,revision:reply.risk_report_markdown_sha256};
}
