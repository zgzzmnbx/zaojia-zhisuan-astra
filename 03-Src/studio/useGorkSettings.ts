import {useSyncExternalStore} from 'react';
import '../vendor/gork/gork-catalog.js';
import {gorkPreferencesKey,normalizeGorkPreferences,type GorkPreferences,type GorkPreset} from './gork-preferences';

export const robotPresets:readonly GorkPreset[]=(window as any).GorkAppearance.presets;
export const robotExpressions:readonly string[]=(window as any).GorkCatalog.sequences.map((s:{id:string})=>s.id);
const normalize=(value:unknown)=>normalizeGorkPreferences(value,robotPresets,robotExpressions);
const read=()=>{try{return {preferences:normalize(JSON.parse(localStorage.getItem(gorkPreferencesKey)||'null')),error:''};}catch{return {preferences:normalize(null),error:'浏览器暂时无法读取偏好，已使用默认形象。'};}};
let snapshot=read();
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(fn=>fn());
function storage(event:StorageEvent){if(event.storageArea===localStorage&&(event.key===gorkPreferencesKey||event.key===null)){snapshot=read();emit();}}
function subscribe(fn:()=>void){if(!listeners.size)window.addEventListener('storage',storage);listeners.add(fn);return()=>{listeners.delete(fn);if(!listeners.size)window.removeEventListener('storage',storage);};}
export function saveGorkPreferences(value:GorkPreferences){
 const preferences=normalize(value);let error='';
 try{localStorage.setItem(gorkPreferencesKey,JSON.stringify(preferences));}catch{error='本次设置已生效，但浏览器无法保存；刷新后可能恢复默认。';}
 snapshot={preferences,error};emit();
}
export function resetGorkPreferences(){saveGorkPreferences(normalize(null));}
export function useGorkSettings(){return useSyncExternalStore(subscribe,()=>snapshot);}
