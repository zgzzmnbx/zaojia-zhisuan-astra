import {feeSnapshot} from './fee-summary.ts';
import type {Action,ConversationCard,Message,Result,Risk,SelectedCell,SheetConfig} from './types';

/** Adapt saved cards without changing their persisted task binding or generating again. */
export function conversationActions(message:Message):Action[] {
  const actions=(message.actions||[]).map(action=>message.card?.kind==='review'&&action.action==='report'&&action.label==='查看报告'
    ?{...action,label:'生成报告',action:'risk-report'}:action);
  if(message.card?.kind==='artifact'&&['风险报告 · 公文格式','演示预设 · 公文格式'].includes(message.card.caption||'')&&!actions.some(action=>action.action==='report')){
    return [...actions,{label:'查看报告',action:'report',primary:true}];
  }
  return actions;
}

/** Cards are snapshots of business responses; they never infer prices or completion. */
export function inputCard(filename:string,sheets:SheetConfig[]):ConversationCard {
  return {kind:'input',title:'资料已就位，确认后开始编制',caption:'资料识别',icon:'sheet',status:'待你确认',tone:'attention',
    items:[{title:filename,detail:`Excel 工作簿 · ${sheets.length} 个候选工作表`,icon:'sheet',action:{label:'核对字段映射',action:'mapping'}}],
    steps:[{label:'读取资料',state:'done'},{label:'确认结构',state:'current'},{label:'规则匹配',state:'waiting'},{label:'复核成果',state:'waiting'}],
    disclosure:{label:'查看识别到的工作表',lines:sheets.map(s=>`${s.sheet_name} · 第 ${s.header_row} 行表头${s.enabled?' · 已选用':' · 未选用'}`)},
    note:'按右侧工作表与字段设置转换，价格在下一步匹配。'};
}

export function resultCard(result:Result,restored=false):ConversationCard {
  const s=result.summary, done=s.matching_status==='completed';
  const warned=s.warning_summary?.executed===true;
  const dirty=result.needs_recalculate===true;
  const ai=result.ai_matching?.requested_mode==='ai_enhanced'||result.process_options?.matching_mode==='ai_enhanced';
  const mode=ai?(result.ai_matching?.effective_mode==='mechanical'?'机械降级 · 待人工复核':'AI 增强 · 逐字段确认'):'机械规则 · 保留原值';
  return {kind:done?'result':'confirmation',title:done?(restored?'继续这份控制价成果':'规则匹配已完成'):'结构已转换，准备匹配',
    caption:restored?'任务恢复':done?'匹配结果':'执行确认',icon:done?'circlecheck':'route',
    status:dirty?'待重算':done?(s.review_rows?'待复核':'已匹配'):'待你确认',tone:dirty||!done||s.review_rows?'attention':'success',
    fees:done?feeSnapshot(result):undefined,
    metrics:done?[{label:'处理行数',value:s.total_data_rows},{label:'价格命中',value:s.matched_rows},{label:'保留原值',value:s.unchanged_rows},{label:'待复核',value:s.review_rows,tone:s.review_rows?'attention':undefined}]:[{label:'待处理行数',value:s.total_data_rows}],
    facts:!done?[{label:'匹配方式',value:mode},{label:'匹配范围',value:'基价 / 实物系数 / 技术系数'}]:undefined,
    items:done?artifactItems(result):undefined,
    note:dirty?'存在人工修改，请先重算公式与报告再交付。':done?(warned?'经验池检查已执行；请结合风险与依据完成复核。':'经验池预警尚未执行，建议继续检查。'):ai?'先在专业编制中核对 AI 映射与候选，再开始匹配。':'尚未填写价格。确认后将按既有专业规则执行匹配。'};
}

function artifactItems(result:Result):NonNullable<ConversationCard['items']> {
  const items:NonNullable<ConversationCard['items']>=[];
  if(result.downloads.excel)items.push({title:'控制价计算表',detail:'Excel · 打开表格与下载',icon:'sheet',action:{label:'打开控制价计算表',action:'table'}});
  if(result.downloads.report)items.push({title:'控制价报告',detail:'Word · 预览与下载',icon:'report',action:{label:'打开控制价报告',action:'report'}});
  return items;
}

export function reviewCard(risks:Risk[]):ConversationCard {
  return {kind:'review',caption:'经验池检查',title:risks.length?'这些事项需要你复核':'本次检查未发现风险事项',icon:'shield',
    status:risks.length?`${risks.length} 项待查看`:'检查完成',tone:risks.length?'attention':'success',
    items:risks.slice(0,3).map(r=>({title:r.title,detail:`${r.severity_label} · ${r.sheet_name} · 第 ${r.excel_row} 行`,icon:'alert',action:{label:`定位${r.sheet_name}第 ${r.excel_row} 行`,action:'locate',target:{sheet:r.sheet_name,row:r.excel_row,...(r.metric?{metric:r.metric,severity:r.severity,riskId:r.id}:{})}}})),
    note:risks.length>3?`卡片展示前 3 项；共 ${risks.length} 项的依据与处理建议可在右侧查看。`:'风险事项来自本次检查；是否采用候选或修改数值，由你决定。'};
}

export function artifactCard(result:Result,note?:string):ConversationCard {
  return {kind:'artifact',caption:'任务成果',title:'成果已整理在这里',icon:'folder',status:result.needs_recalculate?'待重算':'可查看',tone:result.needs_recalculate?'attention':undefined,
    fees:result.summary.matching_status==='completed'?feeSnapshot(result):undefined,
    items:artifactItems(result),note:note||(result.needs_recalculate?'请先重算公式与报告，再下载交付。':'点击成果，在右侧查看细节；可临时全屏展开。')};
}

export function sourceCard(cell:SelectedCell,count:number):ConversationCard {
  return {kind:'source',caption:'依据引用',title:`第 ${cell.row} 行的来源与候选`,icon:'book',status:'只读核对',
    facts:[{label:'工作表',value:cell.sheet},{label:'基价辅助候选',value:`${count} 项 · 尚未采用`}],
    note:'候选不自动写入价格；核对依据后可在计算表中人工修改。'};
}

export function editCard(cell:SelectedCell,value:unknown,note:string):ConversationCard {
  return {kind:'edit',caption:'人工修改',title:'修改已保存，记得刷新成果',icon:'edit',status:'待重算',tone:'attention',
    facts:[{label:'位置',value:`${cell.sheet} · 第 ${cell.row} 行 · ${cell.header}`},{label:'数值',value:`${cell.value??'空值'} → ${value??'空值'}`}],
    disclosure:{label:'查看本次修改依据',lines:[note]},note:'已写入输出副本并保留记录；公式与报告需要重算。'};
}

export const capabilitiesCard:ConversationCard={kind:'capabilities',caption:'专业能力',title:'从资料到成果，在这里推进',icon:'spark',status:'已接通',
  items:[{title:'识别与编制',detail:'Excel 结构识别、字段确认、规则匹配',icon:'sheet'},{title:'核对与留痕',detail:'经验池预警、来源查看、人工修改',icon:'shield'},{title:'成果交付',detail:'公式重算、Excel 与 Word 输出',icon:'folder'}],
  note:'编制按已保存的模式运行，AI 建议须逐字段确认。'};

export function errorCard(message:string):ConversationCard {
  return {kind:'error',caption:'执行反馈',title:'这一步未完成',icon:'alert',status:'需要处理',tone:'error',note:message};
}

/** A historical confirmation must never operate on another file or repeat a completed phase. */
export function actionUnavailable(message:Message,action:Action,state:{context:string;result:Result|null;busy:boolean;needsRecalculate:boolean}):string|undefined {
  if((message.context&&message.context!==state.context)||(message.job&&message.job!==state.result?.job_id))return '历史卡片，请使用当前任务的操作';
  if(action.action==='convert'&&state.result)return '结构已确认';
  if(action.action==='mapping'&&state.result)return '结构已转换';
  if(action.action==='match'&&state.result?.summary.matching_status==='completed')return '匹配已完成';
  if(action.action==='recalculate'&&!state.needsRecalculate)return '已刷新';
  if(state.busy)return '正在执行，请稍候';
  return undefined;
}
