import test from 'node:test';
import assert from 'node:assert/strict';
import {riskColumn,hasPreviewRow,riskActionTarget} from '../03-Src/studio/table/risk-location.ts';
import {reviewCard} from '../03-Src/studio/conversation-cards.ts';
import type {Action,Message,Preview,Risk} from '../03-Src/studio/types.ts';

const sheet:Preview={sheet_name:'表2',header_row:3,headers:['数量','原基价','基价（元）','实物工作费\n调整系数','技术工作费调整系数'],rows:[[0,1,500000,1,1],[2,2,3,1.1,1]],row_numbers:[5,27]};
test('risk fields locate physical columns using configured price output and compact coefficient headers',()=>{
 assert.equal(riskColumn(sheet,'基价','基价（元）'),3);
 assert.equal(riskColumn(sheet,'基价','C'),3);
 assert.equal(riskColumn(sheet,'基价','ZZ'),undefined);
 assert.equal(riskColumn(sheet,'基价'),undefined);
 assert.equal(riskColumn(sheet,'实物工作费调整系数'),4);
 assert.equal(riskColumn({...sheet,headers:['【经验数】实物工作费调整系数','实物工作费调整系数-测试']},'实物工作费调整系数'),2);
 assert.equal(riskColumn(sheet,'技术工作费调整系数'),5);
 assert.equal(riskColumn(sheet,'缺失字段'),undefined);
 assert.equal(riskColumn({...sheet,headers:['实物工作费调整系数','实物工作费调整系数']},'实物工作费调整系数'),undefined);
 assert.equal(riskColumn({...sheet,headers:['数量']},'基价'),undefined);
});
test('location uses explicit Excel row numbers and never treats rows outside the limited preview as visible',()=>{
 assert.equal(hasPreviewRow(sheet,5),true);assert.equal(hasPreviewRow(sheet,27),true);
 assert.equal(hasPreviewRow(sheet,4),false);assert.equal(hasPreviewRow(sheet,300),false);
 assert.equal(hasPreviewRow({...sheet,row_numbers:undefined},4),true);
});
test('new risk cards preserve metric, identity and severity; old cards recover the selected field without a live risk fetch',()=>{
 const risk={id:'r1',title:'表2 第 5 行 基价 经验偏离',sheet_name:'表2',excel_row:5,metric:'基价',severity:'high',severity_label:'高风险'} as Risk;
 const card=reviewCard([risk]);assert.deepEqual(card.items![0].action!.target,{sheet:'表2',row:5,metric:'基价',severity:'high',riskId:'r1'});
 const action:Action={label:'定位',action:'locate',target:{sheet:'表2',row:5}};
 const message={card:{...card,items:[{...card.items![0],action}]}} as Message;
 assert.equal(riskActionTarget(message,action,[])?.metric,'基价');
 assert.equal(riskActionTarget(message,action,[risk])?.severity,'high');
 message.card!.items![0].title='缺少指标的历史风险';assert.equal(riskActionTarget(message,action,[])?.metric,undefined);
 assert.deepEqual(riskActionTarget({...message,card:undefined},action,[]),action.target);
});
