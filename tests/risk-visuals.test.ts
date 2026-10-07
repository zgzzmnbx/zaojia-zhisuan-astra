import test from 'node:test';
import assert from 'node:assert/strict';
import {riskNumbers,deviationScale,prefersCompressed,comparisonScale,riskPercent} from '../03-Src/studio/risk-visuals.ts';
import type {Risk} from '../03-Src/studio/types.ts';
const item=(values:Partial<Risk>)=>({id:'risk',title:'风险',sheet_name:'表2',excel_row:5,metric:'基价',severity:'high',severity_label:'高风险',message:'',suggested_action:'',evidence:[],...values} as Risk);
test('risk charts use the engine percentage unchanged and derive direction separately',()=>{
 const high=riskNumbers(item({current_value:500000,reference_value:4274,deviation_percent:11598.642957,sample_count:1}));
 assert.equal(high.deviation,11598.642957);assert.equal(high.direction,'高于均值');assert.equal(high.samples,1);
 assert.equal(riskPercent(high.deviation),'11,598.64%');
 const low=riskNumbers(item({current_value:1,reference_value:1.15,deviation_percent:13.043478}));
 assert.equal(low.direction,'低于均值');assert.equal(low.deviation,13.043478);
});
test('missing, invalid and zero-reference data are never shown as zero-percent evidence',()=>{
 for(const value of [undefined,null,'', ' ', 'N/A','NaN','Infinity',-1])assert.equal(riskNumbers(item({deviation_percent:value})).deviation,null);
 assert.equal(riskNumbers(item({current_value:2,reference_value:0,deviation_percent:0})).deviation,null);
 assert.equal(riskNumbers(item({current_value:2,reference_value:2,deviation_percent:0})).deviation,0);
 assert.equal(riskNumbers(item({sample_count:'',current_value:'',reference_value:''})).samples,null);
 assert.equal(riskPercent(.00012),'<0.01%');
});
test('compressed scale keeps extreme outliers and small deviations visible on a shared labelled scale',()=>{
 const values=[11598.642957,13.043478,null];assert.equal(prefersCompressed(values),true);
 const compressed=deviationScale(values,true);assert.ok(compressed.position(13.043478)>20);assert.ok(compressed.position(11598.642957)<100);
 assert.equal(compressed.position(0),0);assert.equal(compressed.position(compressed.end),100);
 assert.ok(compressed.ticks.every((v,i,a)=>i===0||compressed.position(v)>compressed.position(a[i-1])));
 const linear=deviationScale(values,false);assert.equal(linear.position(11598.642957),100);assert.ok(linear.position(13.043478)<1);
 assert.equal(prefersCompressed([13,20]),false);
});
test('value comparisons use a common zero and preserve opposite signs and all-zero values',()=>{
 const positive=comparisonScale(500000,4274);assert.equal(positive.bar(500000).width,100);assert.equal(positive.bar(4274).width,.8548);
 const mixed=comparisonScale(-10,30);assert.equal(mixed.zero,25);assert.deepEqual(mixed.bar(-10),{left:0,width:25});assert.deepEqual(mixed.bar(30),{left:25,width:75});
 assert.deepEqual(comparisonScale(0,0).bar(0),{left:0,width:0});
});
