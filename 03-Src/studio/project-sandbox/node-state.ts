import type {Result,SheetConfig} from '../types';
import type {CurrentProject} from '../workbench/current-project';
import type {ReviewProgressTask} from '../../professional/components/agent-workspace/reviewProgress';
import {latestReviewTasksByPlatform,summarizeReviewProgress} from '../../professional/components/agent-workspace/reviewProgress.ts';
export type ZoneId='import'|'price'|'risk'|'knowledge'|'report'|'review'|'table';
export type NodeState={id:ZoneId;title:string;status:string;summary:string;tone:'idle'|'running'|'done'|'attention'|'error';facts:[string,string][];action:string;actionLabel:string;disabled?:string};
export type SandboxInput={ready:boolean;project:CurrentProject|null;result:Result|null;filename:string;sheets:SheetConfig[];busy:string;qaRunning:boolean;operationError?:string;cancelVersion?:number;needsRecalculate:boolean;riskLoading:boolean;riskError:string;reportReady:boolean;citations:number;reviewTasks:ReviewProgressTask[]|null;reviewError:string};
const count=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,v):null;
export function runningZone(busy:string,qa=false):ZoneId|null{
 if(qa||/检索|知识依据/.test(busy))return 'knowledge';if(/报告|文稿|排版|Markdown|Word|公文/.test(busy))return 'report';if(/经验池.*阈值|预警|风险/.test(busy))return 'risk';if(/转换|识别|上传|载入.*样本|载入.*样例/.test(busy))return 'import';if(/匹配|填价|候选/.test(busy))return 'price';if(/派发|发送|复核进度/.test(busy))return 'review';if(/重算|单元格|工作表|保存.*值/.test(busy))return 'table';return null;
}
/** Restore completed color from current, valid result data, never just request settlement. */
export function completedSandboxZones(input:SandboxInput):ZoneId[]{
 if(!input.ready)return [];
 const nodes=sandboxNodes({...input,busy:'',qaRunning:false});
 return nodes.filter(n=>n.tone==='done'||(n.id==='risk'&&n.status==='检查完成')).map(n=>n.id);
}
export function sandboxNodes(input:SandboxInput):NodeState[]{
 const p=input.project,r=input.ready&&p?.jobId&&p.jobId===input.result?.job_id?input.result:null,s=r?.summary;
 const completed=s?.matching_status==='completed',dirty=!!r&&(input.needsRecalculate||!!r.needs_recalculate),total=count(s?.total_data_rows),matched=count(s?.matched_rows);
 const version=r?.artifact_version??r?.task_tracking?.task.artifact_version;
 const versionText=version==null?'未提供版本号':`v${version}`;
 const citations=input.ready?input.citations:0;
 const filename=input.ready?(r?.input_filename||input.filename):'';
 const nodes:NodeState[]=[
  {id:'import',title:'清单导入',status:r?'已转换':filename?'待确认结构':'待上传',summary:r?(total===null?'清单已就绪':`${total} 项清单`):filename||'添加工程清单',tone:r?'done':filename?'attention':'idle',facts:[['输入文件',filename||'尚未上传'],['工作表',r?String(s?.table_preview?.sheets?.length||1):String((input.ready?input.sheets.filter(x=>x.enabled).length:0)||'待识别')]],action:filename?'mapping':'attach',actionLabel:filename?'查看编制设置':'上传清单'},
  {id:'price',title:'智能填价',status:completed?'匹配完成':r?'待匹配':'待开始',summary:completed&&matched!==null&&total!==null?`匹配 ${matched} / ${total} 项`:'单价与系数匹配',tone:completed?'done':'idle',facts:[['匹配数量',matched===null?'待匹配':`${matched} / ${total??'—'}`],['待人工确认',s?.review_rows==null?'待匹配':`${s.review_rows} 项`]],action:completed?'table':'match',actionLabel:completed?'查看匹配结果':'开始匹配',disabled:!r?'请先导入清单并确认结构':undefined},
  {id:'risk',title:'风险复核',status:!r?'未检查':input.riskError?'读取失败':input.riskLoading?'读取中':p?.riskLoaded?'检查完成':'未检查',summary:r&&p?.riskLoaded?`${p.riskTotal} 项风险 · ${p.severity.high} 项重点`:'查看检查结果与依据',tone:r&&input.riskError?'error':r&&p?.riskLoaded?(p.riskTotal?'attention':'done'):'idle',facts:[['风险情况',r&&input.riskError?input.riskError:r&&p?.riskLoaded?`${p.riskTotal} 项，需人工核对`:'尚未取得检查结果'],['结果版本',dirty?'成果已修改，需重新检查':versionText]],action:'risk',actionLabel:'打开风险复核',disabled:!r?'请先完成清单转换':undefined},
  {id:'knowledge',title:'知识检索',status:citations?'已有引用':'随时可查',summary:citations?`本对话 ${citations} 条引用`:'检索原文与依据',tone:citations?'done':'idle',facts:[['资料范围','按现有知识库设置'],['引用数量',citations?`${citations} 条（本对话）`:'尚无引用']],action:'knowledge',actionLabel:'打开知识检索'},
  {id:'report',title:'报告生成',status:r&&input.reportReady?'已生成 · 待审阅':'待生成',summary:r&&input.reportReady?'查看当前 Word 成果':'生成风险报告',tone:r&&input.reportReady?'done':'idle',facts:[['成果版本',versionText],['报告状态',r&&input.reportReady?'已生成，待审阅':'尚无当前成果']],action:r&&input.reportReady?'report':'risk-report',actionLabel:r&&input.reportReady?'打开报告':'生成风险报告',disabled:!completed?'请先完成填价':undefined},
  {id:'review',title:'协同复核',status:input.reviewError?'读取失败':!r?'未发送':input.reviewTasks===null?'读取中':'未发送',summary:input.reviewError?'回执暂不可用':'确认后发送，跟踪回执',tone:input.reviewError?'error':'idle',facts:[['回执',input.reviewError||(!r?'尚无可复核成果':input.reviewTasks===null?'正在读取':'尚未派发')]],action:'collaboration',actionLabel:'准备同事复核',disabled:!completed?'请先完成填价':undefined},
  {id:'table',title:'表格大屏',status:r?(dirty?'待重算':'成果就绪'):'暂无成果',summary:r?`${s?.table_preview?.sheets?.length||1} 张工作表 · ${versionText}`:'工作表与当前成果',tone:r?(dirty?'attention':'done'):'idle',facts:[['成果版本',versionText],['重算状态',r?(dirty?'待重新计算':r.formula_recalculated?'已确认重算':'公式重算未确认'):'尚无成果']],action:'table',actionLabel:'打开工作表',disabled:!r?'请先导入清单并完成转换':undefined},
 ];

 if(r){
  nodes[0].facts.push(['清单行数',total===null?'尚未取得':`${total} 项`]);
  if(completed)nodes[1].facts.push(['保留原值',s?.unchanged_rows==null?'尚未取得':`${s.unchanged_rows} 项`]);
  if(p?.riskLoaded&&!input.riskError&&!input.riskLoading){
   nodes[2].facts.push(['风险分布',`高 ${p.severity.high} · 中 ${p.severity.medium} · 低 ${p.severity.low} · 其他 ${p.severity.other}`]);
   if(p.priorityRisk)nodes[2].facts.push(['重点事项',p.priorityRisk.title],['所在位置',`${p.priorityRisk.sheet_name} · 第 ${p.priorityRisk.excel_row} 行`]);
  }
  nodes[6].facts.push(['工作表数量',String(s?.table_preview?.sheets?.length||1)],['预览范围','前 50 行；完整内容可下载 Excel']);
 }
 const fee=r?p?.fees:null;
 if(completed&&fee){const amount=fee.totalWithTax!==null&&fee.unit?`${fee.totalWithTax.toLocaleString('zh-CN',{maximumFractionDigits:2})} ${fee.unit}`:'尚未取得';nodes[1].facts.push(['含税合计',amount],['公式状态',dirty?'待重算':r?.formula_recalculated?'已重算':'重算未确认']);if(amount!=='尚未取得')nodes[1].summary+=` · ${amount}`;}
 if(r&&input.reviewTasks&&!input.reviewError){const tasks=latestReviewTasksByPlatform(input.reviewTasks,r.job_id),review=summarizeReviewProgress(tasks);if(tasks.length){const delivered=tasks.every(t=>t.review_card_status==='sent'&&t.submission_delivery_status==='sent');Object.assign(nodes[5],{status:delivered?`最近一轮 · ${review.label}`:'送达待核验',summary:`${review.approved} 人通过 · ${review.pending} 人待回复`,tone:review.returned?'attention':delivered&&review.tone==='completed'?'done':'attention',facts:[['结果范围','最近派发轮次，当前成果版本请在复核进度中核对'],['复核情况',`${review.total} 人 · ${review.returned} 人退回`],['送达状态',delivered?'文件与复核卡已送达':'存在未完成送达步骤']],action:'review-progress',actionLabel:'查看复核进度'});}}
 if(dirty)for(const node of nodes.filter(n=>['price','risk','report'].includes(n.id))){if(node.tone!=='idle'){node.status='需更新';node.tone='attention';node.summary+=' · 成果已修改';}}
 const active=runningZone(input.busy,input.qaRunning);if(active){const node=nodes.find(n=>n.id===active)!;node.status='处理中';node.tone='running';node.summary=input.busy||'正在检索资料';}
 for(const n of nodes){if(!input.ready)n.disabled='工作空间正在恢复';else if(input.busy&&!['knowledge','table'].includes(n.id))n.disabled='当前任务正在执行';}
 return nodes;
}
