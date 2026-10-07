import test from 'node:test';
import assert from 'node:assert/strict';
import {feeNumber,feeSnapshot} from '../03-Src/studio/fee-summary.ts';
import {resultCard,artifactCard} from '../03-Src/studio/conversation-cards.ts';
import {currentProjectSnapshot} from '../03-Src/studio/workbench/current-project.ts';

const fixture=()=>({job_id:'job-a',needs_recalculate:false,formula_recalculated:false,task_tracking:{task:{task_id:'task-a',artifact_version:2}},downloads:{},summary:{matching_status:'completed',table_preview:{sheet_name:'表2',headers:[],rows:[],sheets:[{sheet_name:'费用汇总',headers:['序号','项目','费用（万元）'],rows:[[1,'管道工程',0],[2,'通用工程测量',1018.6355463536004],[3,'地质测绘',17.292371799999998],[4,'通用工程勘察',1890.1754988528003],['小计','',2926.1034170064004],['','',0.9],[5,'浮动后勘察费',2633.4930753057606],[6,'其他相关费用',39.356],['合计（含税）','',2672.8491],['合计（不含税）','',2521.5558],['增值税','',151.29329999999982]]}]}}} as any);
test('fees use the V3.1 summary values; tax, floating adjustment and professional bases stay separate',()=>{
 const fees=feeSnapshot(fixture())!;assert.equal(fees.unit,'万元');assert.equal(fees.totalWithTax,2672.8491);assert.equal(fees.totalWithoutTax,2521.5558);assert.equal(fees.vat,151.29329999999982);
 assert.deepEqual(fees.finalComposition.map(i=>i.value),[2633.4930753057606,39.356]);assert.equal(fees.professionalComposition.length,4);assert.equal(fees.professionalComposition[0].label,'通用工程勘察');assert.equal(fees.professionalComposition[3].value,0);assert.ok(Math.abs(fees.finalComposition.reduce((sum,i)=>sum+i.share!,0)-1)<1e-12);
});
test('blank, missing, boolean, formula, and invalid cells are not silently converted into zero',()=>{
 for(const value of [null,undefined,'','  ',false,true,'=SUM(A1:A2)','#VALUE!',NaN,Infinity,'0x10'])assert.equal(feeNumber(value),null);
 assert.equal(feeNumber(0),0);assert.equal(feeNumber('1，234.50'),1234.5);assert.equal(feeNumber('-3.25'),-3.25);
});
test('fresh matching title rows and refreshed explicit headers yield exactly the same financial snapshot',()=>{
 const r=fixture(),expected=feeSnapshot(r),sheet=r.summary.table_preview.sheets[0];
 sheet.rows=[['项目名称：V3.1 只读验收'],sheet.headers,...sheet.rows];sheet.headers=['油气长输管道工程勘察测量费用测算表','',''];
 assert.deepEqual(feeSnapshot(r),expected);
});
test('missing total and unknown unit are preserved rather than invented from subtotals',()=>{
 const r=fixture(),sheet=r.summary.table_preview.sheets[0];sheet.headers[2]='费用';sheet.rows=sheet.rows.filter((row:any[])=>row[0]!=='合计（含税）');
 const fees=feeSnapshot(r)!;assert.equal(fees.totalWithTax,null);assert.equal(fees.unit,null);assert.equal(fees.finalComposition.length,2);
});
test('negative, blank and all-zero compositions retain raw amounts but do not make misleading shares',()=>{
 for(const value of [-3,null,0]){const r=fixture();r.summary.table_preview.sheets[0].rows[6][2]=value;r.summary.table_preview.sheets[0].rows[7][2]=0;const items=feeSnapshot(r)!.finalComposition;assert.equal(items[0].value,value);assert.ok(items.every(i=>i.share===null));}
});
test('an absent final component is not misrepresented as a complete 100 percent pie',()=>{
 const r=fixture();r.summary.table_preview.sheets[0].rows=r.summary.table_preview.sheets[0].rows.filter((row:any[])=>row[1]!=='其他相关费用');
 const items=feeSnapshot(r)!.finalComposition;assert.equal(items[1].value,null);assert.ok(items.every(item=>item.share===null));
});
test('absent summary and unmatched previews do not produce synthetic fees',()=>{
 assert.equal(feeSnapshot(null),null);const r=fixture();r.summary.matching_status='pending';assert.equal(feeSnapshot(r),null);assert.equal(resultCard(r).fees,undefined);r.summary.matching_status='completed';r.summary.table_preview=undefined;assert.equal(feeSnapshot(r),null);assert.equal(resultCard(r).fees,null);
});
test('chat snapshots survive subsequent result edits and retain recalculation and version provenance',()=>{
 const r=fixture(),card=resultCard(r);r.summary.table_preview.sheets[0].rows[8][2]=999;r.needs_recalculate=true;
 assert.equal(card.fees!.totalWithTax,2672.8491);assert.equal(card.fees!.version,2);assert.equal(card.fees!.status,'unconfirmed');assert.equal(artifactCard(r).fees!.status,'dirty');r.needs_recalculate=false;r.formula_recalculated=true;assert.equal(feeSnapshot(r)!.status,'recalculated');
 assert.deepEqual(JSON.parse(JSON.stringify(card)).fees,card.fees);
});
test('project fees require exact project, conversation and job ownership',()=>{
 const input:any={ready:true,active:{id:'c-a',project_id:'p-a'},projects:[{id:'p-a',name:'甲项目'},{id:'p-b',name:'乙项目'}],conversations:[],result:fixture(),resultScope:{conversationId:'c-a',projectId:'p-a',jobId:'job-a'},risks:[],riskJobId:'',filename:'',debug:false};
 assert.equal(currentProjectSnapshot(input)!.fees!.totalWithTax,2672.8491);
 for(const scope of [{conversationId:'c-b',projectId:'p-a',jobId:'job-a'},{conversationId:'c-a',projectId:'p-b',jobId:'job-a'},{conversationId:'c-a',projectId:'p-a',jobId:'job-b'}])assert.equal(currentProjectSnapshot({...input,resultScope:scope})!.fees,null);
});
