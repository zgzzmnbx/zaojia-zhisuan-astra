import {sandboxParameterDefaults} from './defaults.ts';
export const sandboxParametersKey='astra.sandbox.saved-parameters.v1';
export type SandboxDisplayParameters={infoVisible:boolean;cardTransparency:number;chatTransparency:number;roofLabels:boolean;autoOrbit:boolean;orbitDelay:number};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Only this explicit-save record is authoritative; legacy auto-save keys stay intact. */
export function readSavedParameterRecord(){
 try{const v:unknown=JSON.parse(localStorage.getItem(sandboxParametersKey)||'null');return object(v)&&v.version===1&&object(v.baked)&&object(v.visual)&&object(v.display)?v:null}catch{return null}
}
export function normalizeDisplayParameters(raw:unknown):SandboxDisplayParameters{
 const v=object(raw)?raw:{},base=sandboxParameterDefaults.display;
 const level=(key:'cardTransparency'|'chatTransparency',min:number,max:number)=>typeof v[key]==='number'&&Number.isFinite(v[key])?Math.round(Math.max(min,Math.min(max,v[key] as number))):base[key];
 const flag=(key:'infoVisible'|'roofLabels'|'autoOrbit')=>typeof v[key]==='boolean'?v[key] as boolean:base[key];
 return {infoVisible:flag('infoVisible'),cardTransparency:level('cardTransparency',20,85),chatTransparency:level('chatTransparency',0,80),roofLabels:flag('roofLabels'),autoOrbit:flag('autoOrbit'),orbitDelay:[0,2,5,10,15,30,60].includes(v.orbitDelay as number)?v.orbitDelay as number:base.orbitDelay};
}
export function readDisplayParameters(){return normalizeDisplayParameters(readSavedParameterRecord()?.display)}
