// Explicit, local visual examples. These are never business completion events.
export const resultExamples=Object.freeze({
 import:{status:'completed',label:'导入完成',summary:'2 张工作表 · 128 项',metrics:[['工作表','2 张'],['清单条目','128 项']],details:[['文件','工程工作量清单.xlsx'],['字段校验','通过']]},
 price:{status:'completed',label:'填价完成',summary:'匹配 128 项 · 248.60 万元',metrics:[['匹配条目','128 / 128'],['费用合计','248.60 万元']],details:[['待确认条目','0 项'],['金额口径','示例含税合计']]},
 risk:{status:'attention',label:'检查完成',summary:'3 项待复核 · 1 项重点',metrics:[['待复核','3 项'],['重点风险','1 项']],details:[['其他风险','2 项'],['处理状态','待人工复核']]},
 knowledge:{status:'completed',label:'检索完成',summary:'6 条引用 · 4 份资料',metrics:[['引用条目','6 条'],['参考资料','4 份']],details:[['检索问题','勘察工作量如何复核？'],['引用状态','已列出原文依据']]},
 report:{status:'completed',label:'报告已生成',summary:'1 份报告 · Word',metrics:[['报告成果','1 份'],['文稿格式','Word']],details:[['文件','工程清单复核报告.docx'],['审阅状态','待确认']]},
 review:{status:'pending',label:'等待复核',summary:'2 人待确认 · 未发送',metrics:[['拟复核人员','2 人'],['派发回执','未发送']],details:[['成果版本','示例版本 v1'],['派发状态','待确认']]},
 table:{status:'completed',label:'工作表已更新',summary:'2 张工作表 · 128 行',metrics:[['工作表','2 张'],['数据行','128 行']],details:[['当前工作表','勘察工作量表'],['成果版本','示例版本 v1']]},
});

export function createNodeResultStore(ids,onChange){
 const known=new Set(ids),states=new Map(ids.map(id=>[id,null]));
 return {
  get:id=>states.get(id)??null,
  getState:()=>Object.fromEntries([...states].map(([id,result])=>[id,result?{status:result.status,label:result.label,summary:result.summary,example:true}:{status:'idle',label:'待开始',example:false}])),
  completeExample(id){if(!known.has(id))return;states.set(id,{...resultExamples[id],example:true});onChange(id)},
  showExamples(value){for(const id of known){states.set(id,value?{...resultExamples[id],example:true}:null);onChange(id)}},
 };
}
