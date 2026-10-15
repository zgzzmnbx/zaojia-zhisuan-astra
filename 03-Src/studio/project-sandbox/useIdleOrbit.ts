import {useEffect,useRef,useState} from 'react';
import {createIdleOrbit} from './idle-orbit';

export function useIdleOrbit(enabled:boolean,delay:number,blocked:boolean,stopManual:()=>void){
 const [running,setRunning]=useState(false),controller=useRef<ReturnType<typeof createIdleOrbit>|null>(null),onInput=useRef(stopManual);
 onInput.current=stopManual;
 useEffect(()=>{
  const idle=createIdleOrbit(setRunning,()=>!document.hidden&&!document.querySelector('dialog[open],.sandbox-marker :focus-visible'),{set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id as ReturnType<typeof setTimeout>)});
  controller.current=idle;
  const stop=(e:Event)=>{if(!(e.target instanceof Element)||!e.target.closest('.sandbox-view-controls'))onInput.current()};
  const activity=(e:Event)=>{stop(e);idle.activity()};
  const down=(e:Event)=>{stop(e);idle.hold(true)};
  const up=()=>{idle.hold(false)};
  const blur=()=>{onInput.current();idle.hold(true)};
  const focus=()=>idle.hold(false);
  const events=['pointermove','wheel','keydown','input','focusin'] as const;
  for(const event of events)document.addEventListener(event,activity,{capture:true,passive:true});
  document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
  window.addEventListener('blur',blur);window.addEventListener('focus',focus);
  return()=>{idle.dispose();controller.current=null;for(const event of events)document.removeEventListener(event,activity,true);document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus)};
 },[]);
 useEffect(()=>controller.current?.configure({enabled,delay:delay*1000,blocked}),[enabled,delay,blocked]);
 return running&&!blocked&&enabled;
}
