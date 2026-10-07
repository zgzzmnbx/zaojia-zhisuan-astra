import type {Preview,Result} from './types';

// Adapted from 智算 2.0 feeAnalysis.ts. Read only the engine's 费用汇总;
// never derive a contract amount from matched rows or professional subtotals.
export type FeeItem={label:string;value:number|null;share:number|null};
export type FeeSnapshot={jobId:string;version:number|null;sourceSheet:string;unit:string|null;totalWithTax:number|null;totalWithoutTax:number|null;vat:number|null;finalComposition:FeeItem[];professionalComposition:FeeItem[];status:'dirty'|'unconfirmed'|'recalculated'};
const text=(value:unknown)=>String(value??'').replace(/\s+/g,'').trim();
export function feeNumber(value:unknown):number|null {
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 if(typeof value!=='string'||!value.trim())return null;
 const normalized=value.replace(/[,，\s]/g,'');
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized))return null;
 const number=Number(normalized);return Number.isFinite(number)?number:null;
}
function shares(items:Omit<FeeItem,'share'>[]):FeeItem[]{
 const sum=items.reduce((sum,item)=>sum+(item.value??0),0);
 const valid=items.length>0&&items.every(item=>item.value!==null&&item.value>=0)&&sum>0&&Number.isFinite(sum);
 return items.map(item=>({...item,share:valid?item.value!/sum:null}));
}
function feeSheet(preview:Preview|undefined):Preview|undefined {
 if(!preview)return;
 if(text(preview.sheet_name).includes('费用汇总'))return preview;
 for(const sheet of preview.sheets||[]){const found=feeSheet(sheet);if(found)return found;}
}
export function feeSnapshot(result:Result|null|undefined):FeeSnapshot|null {
 if(result?.summary.matching_status!=='completed')return null;
 const sheet=feeSheet(result.summary.table_preview);if(!sheet)return null;
 // Fresh batch-match includes the workbook title as headers; refresh may use
 // the actual field row. Locate both columns together within the same row.
 const candidates=[sheet.headers,...sheet.rows];
 const headerIndex=candidates.findIndex(row=>row.some(value=>/^(项目|项目名称|名称)$/.test(text(value)))&&row.some(value=>/^(费用|金额)/.test(text(value))));
 if(headerIndex<0)return null;
 const headers=candidates[headerIndex].map(text);
 const projectIndex=headers.findIndex(h=>/^(项目|项目名称|名称)$/.test(h));
 const amountIndex=headers.findIndex(h=>/费用|金额/.test(h)&&!/项目|备注/.test(h));
 if(projectIndex<0||amountIndex<0)return null;
 const unit=headers[amountIndex].match(/[（(](元|万元|亿元)[）)]/)?.[1]??null;
 const serialIndex=headers.findIndex(h=>/^(序号|ID)$/i.test(h));
 const rows=candidates.slice(headerIndex+1).map(row=>({label:text(row[projectIndex])||text(row[0]),value:feeNumber(row[amountIndex]),serial:serialIndex<0?null:feeNumber(row[serialIndex])}));
 const valueFor=(pattern:RegExp)=>rows.find(row=>pattern.test(row.label))?.value??null;
 const finalLabels=['浮动后勘察费','其他相关费用'];
 const finalComposition=shares(rows.some(row=>finalLabels.includes(row.label))?finalLabels.map(label=>({label,value:rows.find(row=>row.label===label)?.value??null})):[]);
 const professionalComposition=shares(rows.filter(row=>row.serial!==null&&Number.isInteger(row.serial)&&row.serial>0&&row.label&&!/合计|小计|增值税|浮动后勘察费|其他相关费用/.test(row.label)).map(({label,value})=>({label,value})).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity)));
 return {jobId:result.job_id,version:result.task_tracking?.task.artifact_version??null,sourceSheet:sheet.sheet_name,unit,
  totalWithTax:valueFor(/^合计[（(]含税[）)]$/),totalWithoutTax:valueFor(/^合计[（(]不含税[）)]$/),vat:valueFor(/^增值税$/),
  finalComposition,professionalComposition,status:result.needs_recalculate?'dirty':result.formula_recalculated?'recalculated':'unconfirmed'};
}
