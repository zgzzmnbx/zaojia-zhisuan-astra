import type {Risk} from './types';
import {feeNumber} from './fee-summary.ts';

export function riskNumbers(risk:Risk){
 const current=feeNumber(risk.current_value),reference=feeNumber(risk.reference_value),raw=feeNumber(risk.deviation_percent),count=feeNumber(risk.sample_count);
 // The engine reports absolute deviation. A zero reference cannot define a rate.
 const deviation=reference===0||raw===null||raw<0?null:raw;
 return {current,reference,deviation,samples:count!==null&&count>=0&&Number.isInteger(count)?count:null,direction:current===null||reference===null?'':current>reference?'高于均值':current<reference?'低于均值':'与均值一致'};
}
export function deviationScale(values:(number|null)[],compressed:boolean){
 const valid=values.filter((v):v is number=>v!==null&&Number.isFinite(v)&&v>=0);
 const max=Math.max(1,...valid),end=compressed?10**Math.ceil(Math.log10(max)):max;
 const position=(value:number)=>100*(compressed?Math.log10(1+value)/Math.log10(1+end):value/end);
 const ticks=compressed?[0,...Array.from({length:Math.ceil(Math.log10(end))+1},(_,i)=>10**i).filter(v=>v<=end&&(end<=10||v>=10))]:[0,end/4,end/2,end*3/4,end];
 return {end,position,ticks};
}
export function prefersCompressed(values:(number|null)[]){
 const positive=values.filter((v):v is number=>v!==null&&Number.isFinite(v)&&v>0);
 return positive.length>1&&Math.max(...positive)>100&&Math.max(...positive)/Math.min(...positive)>20;
}
export function comparisonScale(current:number,reference:number){
 const min=Math.min(0,current,reference),max=Math.max(0,current,reference),span=max-min||1;
 const zero=min===0?0:-min/span*100;
 return {zero,bar:(value:number)=>({left:Math.min(zero,(value-min)/span*100),width:Math.abs(value)/span*100})};
}
export function riskValue(value:number|null){return value===null?'—':value.toLocaleString('zh-CN',{maximumFractionDigits:4});}
export function riskPercent(value:number|null){return value===null?'暂无偏离率':`${value!==0&&value<.01?'<0.01':value.toLocaleString('zh-CN',{maximumFractionDigits:2})}%`;}
