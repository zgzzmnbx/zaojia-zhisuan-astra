import type {PriceCandidate} from './row-pricing.ts';

export function pricingConditions(row:Record<string,unknown>){
 return Object.entries(row).filter(([key,value])=>/^要素\d+$/.test(key)&&value!=null&&String(value).trim()!=='');
}
// Counts are supplied by the matching engine. Experience similarity and coefficient
// rules have different meanings, so never reconstruct a count from a percentage.
export function candidateAgreement(candidate:PriceCandidate){
 if(candidate.source!=='knowledge_similar')return null;
 const count=candidate.reason.match(/(\d+)\/(\d+)\s*个非空要素一致/);
 if(!count)return null;
 const matched=Number(count[1]),total=Number(count[2]);
 return total>0&&matched<=total?{matched,total}:null;
}
export function pricingGroups(items:PriceCandidate[]){
 const groups=new Map<string,{label:string;items:PriceCandidate[]}>();
 for(const item of items){
  const count=candidateAgreement(item);
  const label=count?(count.matched===count.total?'全部一致':`有 ${count.total-count.matched} 项差异`):(item.source_label||'适用规则');
  const key=count?`${count.matched}/${count.total}`:item.source;
  if(!groups.has(key))groups.set(key,{label,items:[]});
  groups.get(key)!.items.push(item);
 }
 return [...groups.entries()].map(([key,value])=>({key,...value}));
}
export function numericPrice(value:unknown){
 if(value==null||typeof value==='boolean'||String(value).trim()==='')return null;
 const number=Number(value);return Number.isFinite(number)?number:null;
}
export function pricePosition(value:number,min:number,max:number){return max===min?50:Math.max(0,Math.min(100,(value-min)/(max-min)*100));}
