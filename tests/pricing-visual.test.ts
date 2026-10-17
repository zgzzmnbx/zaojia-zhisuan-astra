import assert from 'node:assert/strict';
import test from 'node:test';
import {candidateAgreement,numericPrice,pricePosition,pricingConditions,pricingGroups} from '../03-Src/studio/pricing-visual.ts';
import type {PriceCandidate} from '../03-Src/studio/row-pricing.ts';
import {pricingFlowPage,pricingFieldRelation} from '../03-Src/studio/pricing-flow-model.ts';
const candidate=(id:string,reason:string,source='knowledge_similar'):PriceCandidate=>({id,value:4274,source,source_label:source,reason,basis:id,similarity:75});
test('agreement uses authoritative counts, never experience similarity',()=>{
 assert.deepEqual(candidateAgreement(candidate('a','单位一致，3/4 个非空要素一致。')),{matched:3,total:4});
 assert.equal(candidateAgreement(candidate('b','同类匹配','experience_pool')),null);
 assert.equal(candidateAgreement(candidate('c','规则适用','rule')),null);
 assert.equal(candidateAgreement(candidate('d','5/4 个非空要素一致')),null);
});
test('groups preserve source priority and separate same-price evidence',()=>{
 const a=candidate('a','4/4 个非空要素一致'),b=candidate('b','3/4 个非空要素一致'),c=candidate('c','4/4 个非空要素一致');
 const groups=pricingGroups([a,b,c]);assert.deepEqual(groups.map(g=>g.key),['4/4','3/4']);assert.deepEqual(groups[0].items.map(c=>c.id),['a','c']);
 assert.equal(pricingGroups([candidate('r','适用规则','rule')])[0].label,'rule');
});
test('conditions retain zero and exclude missing or unrelated fields',()=>{
 assert.deepEqual(pricingConditions({要素1:0,要素2:' ',要素3:null,单位:'个',要素4:'GPS'}),[['要素1',0],['要素4','GPS']]);
});
test('price axis preserves zero, rejects missing values, and centers a single value',()=>{
 for(const value of [null,undefined,'',true,NaN,Infinity])assert.equal(numericPrice(value),null);
 assert.equal(numericPrice('0'),0);assert.equal(numericPrice(0.22),0.22);
 assert.equal(pricePosition(4274,4274,4274),50);assert.equal(pricePosition(0,0,100),0);assert.equal(pricePosition(50,0,100),50);
});

test('flow pages retain every evidence identity, including identical prices, and clamp stale page',()=>{
 const items=Array.from({length:200},(_,i)=>candidate(String(i),'4/4 个非空要素一致'));
 const pages=Array.from({length:40},(_,page)=>pricingFlowPage(items,page));
 assert.deepEqual(pages.flatMap(p=>p.items.map(c=>c.id)),items.map(c=>c.id));
 assert.equal(pricingFlowPage(items,500).index,39);
 assert.deepEqual(pricingFlowPage([],10),{index:0,start:0,items:[],last:0});
 assert.equal(pricingFlowPage(items,-1).items[0].id,'0');
});
test('flow marks missing evidence unknown rather than a difference or an exact match',()=>{
 assert.equal(pricingFieldRelation(0,'0'),'same');
 assert.equal(pricingFieldRelation('C级','E级'),'different');
 for(const value of [null,undefined,' '])assert.equal(pricingFieldRelation('C级',value),'unknown');
 assert.equal(pricingFieldRelation(' C级 ','C级'),'same');
});
