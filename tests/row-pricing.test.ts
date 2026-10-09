import test from 'node:test';
import assert from 'node:assert/strict';
import {canPriceRow,topPrices,priceText,pricingAnalysisSections} from '../03-Src/studio/row-pricing.ts';
test('price shortlist retains engine priority, deduplicates prices and never pads missing candidates',()=>{
 const candidates=[10,10,0,30,40].map((value,i)=>({id:String(i),value,source:'knowledge_similar',source_label:'计价库',reason:'',basis:''}));
 assert.deepEqual(topPrices(candidates).map(c=>c.id),['0','2','3']);
 assert.equal(topPrices(candidates.slice(0,2)).length,1);assert.deepEqual(topPrices([]),[]);
});
test('AI pricing is only offered on price-bearing business rows, never headers, blanks or totals',()=>{
 const headers=['要素1','单位','基价'];assert.equal(canPriceRow(headers,['测量','km',10],5,4),true);
 for(const [row,n,total] of [[headers,5,false],[['','',''],6,false],[['合计','km',10],7,true],[['测量','km',10],4,false]] as const)assert.equal(canPriceRow(headers,[...row],n,4,total),false);
 assert.equal(canPriceRow(['数量'],[10],5,4),false);
});
test('price labels preserve zero, precision and missing values',()=>{assert.equal(priceText(0),'0');assert.equal(priceText(1234.5678),'1,234.5678');assert.equal(priceText(null),'—');});

test('pricing analysis separates the engine preface without discarding caution or candidate values',()=>{
 const parts=pricingAnalysisSections('**结构化排序首选：4274**\n风险提示：需核对\n\n## 结论\n采用前核对4274元。\n## 适用条件与复核\n当前500000元，必须复核。\n## 使用边界\n需人工确认。');
 assert.deepEqual(parts.map(p=>p.title),['','结论','适用条件与复核','使用边界']);
 assert.match(parts[0].body,/需核对/);assert.match(parts[2].body,/500000/);assert.match(parts[3].body,/人工确认/);
});
test('pricing analysis keeps plain legacy answers and fenced headings intact',()=>{
 assert.deepEqual(pricingAnalysisSections('旧回答，无标题。'),[{title:'',body:'旧回答，无标题。'}]);
 const parts=pricingAnalysisSections('## 依据与解释\n```text\n## 保留原文\n```\n\n### 采用前核对\n系数0.22，不是价格。');
 assert.equal(parts.length,2);assert.match(parts[0].body,/## 保留原文/);assert.match(parts[1].body,/0.22/);
});
