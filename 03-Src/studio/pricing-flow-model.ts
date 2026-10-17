import type {PriceCandidate} from './row-pricing.ts';

export const FLOW_PAGE_SIZE=5;
export function pricingFlowPage(items:PriceCandidate[],page:number){
 const last=Math.max(0,Math.ceil(items.length/FLOW_PAGE_SIZE)-1);
 const index=Math.max(0,Math.min(last,Math.floor(page)||0));
 return {index,start:index*FLOW_PAGE_SIZE,items:items.slice(index*FLOW_PAGE_SIZE,(index+1)*FLOW_PAGE_SIZE),last};
}
// Missing evidence stays unknown. Zero and same-price records retain their identity.
export function pricingFieldRelation(value:unknown,other:unknown):'same'|'different'|'unknown'{
 if(other==null||String(other).trim()==='')return 'unknown';
 return String(value).trim()===String(other).trim()?'same':'different';
}
