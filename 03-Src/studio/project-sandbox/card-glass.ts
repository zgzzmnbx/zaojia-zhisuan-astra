export const cardTransparencyKey='astra.sandbox.info-transparency';
export const defaultCardTransparency=65;
export function readCardTransparency(raw:string|null){
 if(raw===null||raw.trim()==='')return defaultCardTransparency;
 const value=Number(raw);
 return Number.isFinite(value)?Math.max(20,Math.min(85,Math.round(value))):defaultCardTransparency;
}
