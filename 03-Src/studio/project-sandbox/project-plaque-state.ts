import {sandboxNodes,completedSandboxZones,runningZone,type SandboxInput} from './node-state.ts';
import type {TaskActivity} from './task-activity.ts';

/** Four result-backed milestones; knowledge and external review are optional actions,
 * not invented percentages of the whole project. */
export function projectPlaqueState(input:SandboxInput,activity:TaskActivity|null=null){
 const valid=input.ready&&input.project?.jobId===input.result?.job_id?input.result:null;
 const filename=input.ready?(valid?.input_filename||input.filename||'尚未上传项目文件'):'正在恢复项目…';
 const nodes=sandboxNodes(input),done=new Set(completedSandboxZones(input));
 const stages=(['import','price','risk','report'] as const).map(id=>({id,label:nodes.find(n=>n.id===id)!.title,done:done.has(id)}));
 const running=input.ready?runningZone(input.busy,input.qaRunning):null;
 const current=nodes.find(n=>n.id===running)||nodes.find(n=>n.id===[...stages].reverse().find(s=>s.done)?.id)||nodes[0];
 const stopped=activity&&(activity.phase==='error'||activity.phase==='cancelled');
 const status=!input.ready?'正在恢复项目':stopped?(activity.phase==='error'?'处理失败 · 已完成成果保留':'已停止 · 已完成成果保留'):input.needsRecalculate||valid?.needs_recalculate?'成果已修改 · 待更新':running?`${current.title} · ${input.busy||'处理中'}`:`${current.title} · ${current.status}`;
 return {filename,status,running,stages,completed:stages.filter(s=>s.done).length};
}
