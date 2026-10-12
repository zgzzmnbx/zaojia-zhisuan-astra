import {resolveQuickCommand,type QuickActionId} from './quick-actions.ts';
export type CommandAction=QuickActionId|'download-excel'|'download-word'|'convert'|'recalculate';
const commands:[CommandAction,RegExp,string,string][]=[
 ['review-progress',/复核.*(进度|状态|到哪)|审核.*(进度|状态|到哪)|(查询|查看).*(复核|审核)/,'查询复核进度','复核进度读取当前任务的轮次与回执，不会重新执行预警。'],
 ['match',/批量匹配/,'批量匹配','批量匹配使用已确认的表格结构，填写价格和双系数并生成成果。'],
 ['analysis',/费用洞察|图表分析|费用分析|费用.*图|分析图表/,'费用分析','费用分析展示当前成果的费用构成和风险数据。'],
 ['risk-report',/生成报告|风险报告|ai审查摘要|生成审查摘要/,'生成报告','报告基于当前匹配成果补充审查正文，使用选中的模型并自动公文排版。'],
 ['download-excel',/(输出|下载|导出).*(excel|xlsx|表格)/,'下载 Excel','Excel 下载提供当前任务的计算表。'],
 ['download-word',/(输出|下载|导出).*(word|docx|报告)/,'下载 Word','Word 下载提供当前任务的报告。'],
 ['collaboration',/(同事|发送|发给).*复核|复核.*(同事|飞书|weact)/,'准备同事复核','同事复核先核对接收人、平台和成果版本，确认后才发送。'],
 ['warning',/预警|检查风险|运行经验池/,'经验池预警','经验池预警比较当前成果与经验池，按已保存的阈值返回风险。'],
 ['recalculate',/重算/,'重算公式与报告','重算刷新公式、预览和报告；公式引擎不可用时继续保留待重算提醒。'],
 ['convert',/转换/,'转换表格','转换先按确认的工作表和字段映射生成待匹配预览。'],
];
export function resolveCommand(message:string){
 const shortcut=resolveQuickCommand(message);
 if(shortcut)return {kind:'action' as const,action:shortcut,label:message.trim(),text:''};
 const text=message.replace(/\s+/g,'').toLowerCase();
 const found=commands.find(([,pattern])=>pattern.test(text));
 const explanation=/怎么|如何|为什么|是什么|什么意思|依据|来源|了解|解释|介绍|告诉我|能否|是否|吗|[？?]|不要|不需要|别|不执行|不转换|不匹配|不重算|取消|停止|引用|[“”「」"`]/.test(text);
 if(!found)return explanation?{kind:'explain' as const,text:'可以说明操作方法。选择具体功能后，再由你决定是否执行。'}:null;
 const [action,,label,detail]=found;
 if(explanation)return {kind:'explain' as const,action,label,text:detail};
 const explicit=/^(请|帮我|麻烦|立即|现在|我要|我想|先)*(执行|开始|运行|检查|生成|输出|下载|导出|发送|发给|查询|查看|重算|转换)/.test(text)||['批量匹配','经验池预警','费用洞察','图表分析','费用分析','复核到哪了','审核到哪了','复核进度查询','审核进度查询'].includes(text.replace(/[。！!]+$/,''));
 return explicit?{kind:'action' as const,action,label,text:detail}:{kind:'explain' as const,action,label,text:detail};
}
