import {useEffect,useState} from 'react';

export type WelcomeStyle='hero'|'classic';
export const welcomeStyleKey='astra.welcome-style.v1';
const changeEvent='astra:welcome-style-change';
export function normalizeWelcomeStyle(value:unknown):WelcomeStyle{return value==='classic'?'classic':'hero';}
export function readWelcomeStyle(storage?:Pick<Storage,'getItem'>):WelcomeStyle{
 try{return normalizeWelcomeStyle((storage??localStorage).getItem(welcomeStyleKey));}catch{return 'hero';}
}
export function writeWelcomeStyle(value:WelcomeStyle,storage?:Pick<Storage,'setItem'>){
 try{(storage??localStorage).setItem(welcomeStyleKey,normalizeWelcomeStyle(value));return '';}catch{return '浏览器暂时无法保存欢迎页样式，本次选择已生效。';}
}
export function useWelcomeStyle(){
 const [style,setStyle]=useState(readWelcomeStyle),[error,setError]=useState('');
 useEffect(()=>{
  const changed=(event:Event)=>setStyle(normalizeWelcomeStyle((event as CustomEvent).detail));
  const stored=(event:StorageEvent)=>{if(event.key===welcomeStyleKey||event.key===null)setStyle(readWelcomeStyle());};
  window.addEventListener(changeEvent,changed);window.addEventListener('storage',stored);
  return()=>{window.removeEventListener(changeEvent,changed);window.removeEventListener('storage',stored);};
 },[]);
 function select(value:WelcomeStyle){setError(writeWelcomeStyle(value));setStyle(value);window.dispatchEvent(new CustomEvent(changeEvent,{detail:value}));}
 return {style,select,error};
}
