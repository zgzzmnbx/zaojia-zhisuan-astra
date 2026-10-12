export type QuickState={ready:boolean;busy:boolean;connected:boolean;hasResult:boolean;completed:boolean};
export const quickCommands=[
 ['match','route','批量匹配'],['analysis','chart','费用分析'],['warning','shield','经验池预警'],['risk-report','file','生成报告'],
 ['table','sheet','Excel 表格'],['report','file','Word 报告'],['document','file','公文转换'],['collaboration','users','同事复核'],['review-progress','clock','复核进度'],
] as const;
export const quickDestinations=[['projects','folder','项目看板'],['map','globe','项目地图'],['knowledge','book','知识问答'],['library','database','资料库'],['trace','route','任务轨迹'],['settings','settings','设置']] as const;
// Shared by menu clicks and exact chat commands. Navigation only opens the
// existing surface; review, conversion and editing retain their own confirmation.
export const quickPrompts={
 match:'开始批量匹配',analysis:'查看费用分析',warning:'运行经验池预警','risk-report':'生成报告',
 table:'打开 Excel 表格',report:'打开 Word 报告',document:'打开公文转换',collaboration:'准备同事复核','review-progress':'查询复核进度',
 projects:'打开项目看板',map:'打开项目地图',knowledge:'打开知识问答',library:'打开资料库',trace:'查看任务轨迹',settings:'打开设置',
 mapping:'打开列映射与转换',advanced:'打开 AI 增强编制',workload:'打开工作量抓取',risk:'查看风险详情',experience:'打开经验池导入',settlement:'打开结算审核',word:'打开 Word 分页预览',
 knowledgebase:'打开知识库管理',articles:'打开文章与知识网络',memory:'打开知识记忆','collaboration-settings':'打开协同设置',dispatch:'打开协同派发',
 aerial:'打开项目鸟瞰',tracefull:'查看任务血缘与轨迹',digital:'打开数字化项目助手',universe:'打开能力星图',gork:'打开 Gork 机器人联动',skills:'打开专业能力治理',configuration:'打开专业设置',architecture:'打开系统架构',
} as const;
export type QuickActionId=keyof typeof quickPrompts;
export function quickPrompt(id:string):string|undefined{return Object.hasOwn(quickPrompts,id)?quickPrompts[id as QuickActionId]:undefined;}
export function resolveQuickCommand(message:string):QuickActionId|undefined{
 const normalize=(value:string)=>value.replace(/\s+/g,'').toLowerCase().replace(/[。！!]+$/,'').replace(/^(?:请|帮我|麻烦|现在|我要|我想)+/,'');
 const text=normalize(message);
 for(const [id,prompt] of Object.entries(quickPrompts))if(text===normalize(prompt))return id as QuickActionId;
 // Match whole utterances, never substrings in questions, negation or quotations.
 const subject=text.replace(/^(?:打开|查看|显示|进入|切换到)/,'');
 for(const [id,prompt] of Object.entries(quickPrompts)){
  if(/^(打开|查看)/.test(prompt)&&subject===normalize(prompt).replace(/^(打开|查看)/,''))return id as QuickActionId;
 }
 const aliases:Partial<Record<QuickActionId,readonly string[]>>={
  match:['批量匹配'],analysis:['费用分析','费用分析与辅助填价'],warning:['经验池预警'],
  table:['Excel表格','控制价计算表'],report:['Word报告'],document:['公文转换'],collaboration:['同事复核'],
  'review-progress':['复核进度','审核进度'],projects:['项目看板'],map:['项目地图'],knowledge:['知识问答'],library:['资料库'],trace:['任务轨迹'],settings:['设置'],
 };
 for(const [id,values] of Object.entries(aliases))if(values?.some(value=>subject===normalize(value)))return id as QuickActionId;
 return undefined;
}
const mutations=new Set(['match','warning','risk-report']);
export function quickUnavailable(id:string,state:QuickState):string|undefined{
 if(!state.ready)return '工作空间正在恢复';
 if(state.busy&&['document','mapping','collaboration','review-progress'].includes(id))return '当前任务正在执行';
 if(!mutations.has(id))return undefined;
 if(state.busy)return '当前任务正在执行';
 if(!state.connected)return '后端尚未连接';
 if(!state.hasResult)return '请先上传资料并完成转换';
 if(id==='match')return state.completed?'当前任务已完成匹配':undefined;
 if(!state.completed)return '请先完成批量匹配';
 return undefined;
}
