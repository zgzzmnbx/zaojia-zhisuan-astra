import type {Action} from '../../studio/types';
export const guideProtocol='digital-cost-guide/1';
export type DigitalState={demo?:boolean;taskId:string;revision:number;files:string[];count:number;pending:number;action:string;scale:string|null;scaleReady:boolean;run:string;runId:string;purpose:string;busy:boolean;error:string;complete:boolean};
export type DigitalSession={id:string;taskId?:string;file?:File};
export type DigitalCommand={id:string;action:string};
export function readDigitalState(value:unknown):DigitalState|null{
 const s=value as DigitalState;
 if(!s||!/^task_[a-zA-Z0-9_-]+$/.test(s.taskId)||!Number.isInteger(s.revision)||s.revision<1||!Array.isArray(s.files)||s.files.some(f=>typeof f!=='string')||!Number.isInteger(s.count)||!Number.isInteger(s.pending)||typeof s.action!=='string'||typeof s.run!=='string'||typeof s.error!=='string')return null;
 if(s.count<0||s.pending<0||s.pending>s.count||s.files.length>100||s.files.some(f=>f.length>500)||![s.scaleReady,s.busy,s.complete].every(v=>typeof v==='boolean')||typeof s.runId!=='string'||typeof s.purpose!=='string'||(s.scale!==null&&typeof s.scale!=='string'))return null;
 if(s.demo!==undefined&&typeof s.demo!=='boolean')return null;
 return structuredClone(s);
}
export function guideReply(s:DigitalState):{key:string;text:string;actions:Action[]}{
 const button=(label:string,action:string):Action=>({label,action:'digital-'+action,primary:true});
 const key=JSON.stringify([s.taskId,s.action,s.scaleReady,s.run,s.runId,s.error,s.complete]);
 if(s.error)return {key,text:`这一步暂时没有完成：${s.error}。已上传的资料会保留，可以在右侧查看并重试。`,actions:[button('查看处理状态','ai')]};
 if(['queued','running'].includes(s.run))return {key,text:s.demo?'正在准备这份演示案例的分析结果。原文对应关系与功能清单就绪后，我们继续核对。':s.purpose==='boundary'?'我正在梳理文档中的系统边界和业务范围。确认范围后，再逐段分析功能点。':'正在逐段分析需求，整理五类功能点及原文依据。你可以先在右侧阅读文档；识别完成后，我会提醒你核对。',actions:[button('查看识别进度','ai')]};
 if(['failed','interrupted','cancelled'].includes(s.run))return {key,text:'本轮识别尚未完成，已有资料和人工修改仍然保留。请查看右侧原因，再决定是否重新识别。',actions:[button('查看识别状态','ai')]};
 if(s.complete)return {key:s.taskId+':complete',text:'当前方案的费用成果已生成。你可以查看费用明细，也可以播放价格形成演示，逐步说明规模、系数、工作量与开发费的关系。',actions:[button('查看费用成果','fees'),button('演示价格形成','story')]};
 if(s.scaleReady)return {key:s.taskId+':scale-ready',text:`功能规模已确认${s.scale?`，当前为 ${s.scale} FP`:''}。接下来核对计价方案和系数：我会展示可选项及依据，文档没有说明的条件请你确认。确认后再生成费用。`,actions:[button('核对系数与费用','prices')]};
 if(s.run==='succeeded')return {key,text:s.purpose==='boundary'?'系统边界建议已整理好。请先核对右侧纳入、排除范围和待补充问题，确认后继续功能点识别。':`功能点候选已整理好${s.count?`，当前清单有 ${s.count} 项`:''}。请对照原文核对分类、重复项和遗漏项；待补充的问题会保留为待确认。`,actions:[button(s.purpose==='boundary'?'核对系统边界':'查看候选与问题','ai'),button('对照原文','evidence'),button('继续核对功能点','next')]};
 if(s.count)return {key,text:`当前有 ${s.count} 项功能点，${s.pending} 项待确认。我们先核对原文依据与业务边界，再进入规模和费用。`,actions:[button('继续核对功能点','next'),button('对照原文','evidence')]};
 return {key:s.taskId+":uploaded",text:`已读入“${s.files[0]||'项目需求'}”。右侧可以连续阅读原文。接下来请选择要分析的文档并发起 AI 识别，我会陪你核对系统边界、功能点及证据。`,actions:[button('开始功能点分析','identify')]};
}
