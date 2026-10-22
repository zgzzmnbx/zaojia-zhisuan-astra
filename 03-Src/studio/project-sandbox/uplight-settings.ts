import {sandboxDefaults} from './defaults.ts';

export const uplightSettingsKey='astra.sandbox.uplights.v1';
export type UplightSettings={day:{brightness:number;color:string};night:{brightness:number;color:string}};
export function normalizeUplightSettings(raw:unknown):UplightSettings{
 const v=raw&&typeof raw==='object'?raw as Partial<UplightSettings>:{};
 const mode=(key:'day'|'night')=>{
  const value=v[key],fallback=sandboxDefaults.uplights[key];
  return {brightness:typeof value?.brightness==='number'&&Number.isFinite(value.brightness)?Math.max(0,Math.min(200,value.brightness)):fallback.brightness,
   color:typeof value?.color==='string'&&/^#[0-9a-f]{6}$/i.test(value.color)?value.color.toLowerCase():fallback.color};
 };
 return {day:mode('day'),night:mode('night')};
}
export function readUplightSettings():UplightSettings{
 try{return normalizeUplightSettings(JSON.parse(localStorage.getItem(uplightSettingsKey)||'null'))}catch{return normalizeUplightSettings(null)}
}
