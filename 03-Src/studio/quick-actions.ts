export type QuickState={ready:boolean;busy:boolean;connected:boolean;hasResult:boolean;completed:boolean};
export const quickCommands=[
 ['match','route','批量匹配'],['analysis','chart','费用分析'],['warning','shield','经验池预警'],['risk-report','file','生成报告'],
 ['table','sheet','Excel 表格'],['report','file','Word 报告'],['document','file','公文转换'],['collaboration','users','同事复核'],['review-progress','clock','复核进度'],
] as const;
export const quickDestinations=[['projects','folder','项目看板'],['map','globe','项目地图'],['knowledge','book','知识问答'],['library','database','资料库'],['trace','route','任务轨迹'],['settings','settings','设置']] as const;
const mutations=new Set(['match','warning','risk-report']);
export function quickUnavailable(id:string,state:QuickState):string|undefined{
 if(!mutations.has(id))return undefined;
 if(!state.ready)return '工作空间正在恢复';
 if(state.busy)return '当前任务正在执行';
 if(!state.connected)return '后端尚未连接';
 if(!state.hasResult)return '请先上传资料并完成转换';
 if(id==='match')return state.completed?'当前任务已完成匹配':undefined;
 if(!state.completed)return '请先完成批量匹配';
 return undefined;
}
