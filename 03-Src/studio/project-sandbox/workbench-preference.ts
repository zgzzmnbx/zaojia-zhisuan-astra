import {useEffect,useState} from 'react';
export type WorkbenchStyle='sandbox'|'classic';
export const workbenchStyleKey='astra.project-workbench.v1';
export function readWorkbenchStyles(raw:string|null):Record<string,WorkbenchStyle>{
 try{const value=JSON.parse(raw||'{}');if(!value||typeof value!=='object'||Array.isArray(value))return {};return Object.fromEntries(Object.entries(value).filter(([key,value])=>key!=='__proto__'&&key!=='constructor'&&(value==='sandbox'||value==='classic'))) as Record<string,WorkbenchStyle>}catch{return {}}
}
export function useWorkbenchStyle(context:string){
 const [styles,setStyles]=useState(()=>{try{return readWorkbenchStyles(localStorage.getItem(workbenchStyleKey))}catch{return {}}});
 useEffect(()=>{const sync=(e:StorageEvent)=>{if(e.key===workbenchStyleKey)setStyles(readWorkbenchStyles(e.newValue))};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[]);
 return {style:styles[context]||'sandbox',styleFor:(key:string)=>styles[key]||'sandbox',setStyle:(style:WorkbenchStyle)=>{if(!context)return;setStyles(current=>{let saved={};try{saved=readWorkbenchStyles(localStorage.getItem(workbenchStyleKey))}catch{}const next={...current,...saved,[context]:style};try{localStorage.setItem(workbenchStyleKey,JSON.stringify(next))}catch{}return next})}};
}
