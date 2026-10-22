export const waterSettingsKey='astra.sandbox.water.v1';
export type WaterSettings={enabled:boolean;quality:'normal'|'high';speed:number;ripple:number;reflection:number;bloom:number};
export const waterDefaults:WaterSettings={enabled:true,quality:'normal',speed:35,ripple:35,reflection:35,bloom:15};
export function normalizeWaterSettings(raw:unknown):WaterSettings{
 const v=raw&&typeof raw==='object'?raw as Partial<WaterSettings>:{};
 const level=(key:'speed'|'ripple'|'reflection'|'bloom')=>typeof v[key]==='number'&&Number.isFinite(v[key])?Math.max(0,Math.min(100,v[key]!)):waterDefaults[key];
 return {enabled:typeof v.enabled==='boolean'?v.enabled:waterDefaults.enabled,quality:v.quality==='high'?'high':'normal',speed:level('speed'),ripple:level('ripple'),reflection:level('reflection'),bloom:level('bloom')};
}
export function readWaterSettings():WaterSettings{try{return normalizeWaterSettings(JSON.parse(localStorage.getItem(waterSettingsKey)||'null'))}catch{return normalizeWaterSettings(null)}}
