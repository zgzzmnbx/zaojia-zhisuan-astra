import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {api} from './api';
import {useGorkSettings} from './useGorkSettings';
import {createSpeechQueue,createWelcomeSpeech,welcomeSpeech,type SpeechItem,type SpeechSnapshot} from './gork-speech';
import './gork-speech.css';

function positionBubble(element:HTMLElement,target:HTMLElement){
 const r=target.getBoundingClientRect(),b=element.getBoundingClientRect();
 const left=Math.max(12,Math.min(innerWidth-b.width-12,r.left));
 const above=r.top-b.height-14>=12;
 element.style.left=`${left}px`;
 element.style.top=`${Math.max(12,Math.min(innerHeight-b.height-12,above?r.top-b.height-14:r.bottom+14))}px`;
 element.style.setProperty('--speech-tail-x',`${Math.max(18,Math.min(b.width-18,r.left+r.width/2-left))}px`);
 element.dataset.side=above?'above':'below';
}

/** Independent web presentation using the shared speech wording; no output/write API. */
export function GorkSpeechBubble({active:visible}:{active:boolean}){
 const {preferences}=useGorkSettings(),active=visible&&preferences.speechBubble;
 const node=useRef<HTMLButtonElement>(null),queue=useRef(createSpeechQueue());
 const greeting=useRef(createWelcomeSpeech());
 const hovered=useRef(false),anchor=useRef<HTMLElement|null>(null),announced=useRef('');
 const [item,setItem]=useState<SpeechItem|null>(null);
 useEffect(()=>{
  if(!active){queue.current.reset();setItem(null);if(!preferences.speechBubble)greeting.current.dismiss();return;}
  let disposed=false,timer=0,generation=0,request:AbortController|null=null;
  const poll=async()=>{
   if(disposed||document.hidden)return;
   const current=new AbortController(),scope=generation;request=current;
   const timeout=window.setTimeout(()=>current.abort(),5000);
   try{
    const q=queue.current.query();
    const result=await api<SpeechSnapshot>(`/api/astra/gork/web-speech?stream=${encodeURIComponent(q.stream)}&after=${q.after}`,{signal:current.signal});
    if(!disposed&&scope===generation&&!document.hidden)queue.current.accept(result,performance.now());
   }catch{/* Read failures never produce fake speech or initiate a hardware retry. */}
   finally{clearTimeout(timeout);if(!disposed&&scope===generation&&!document.hidden)timer=window.setTimeout(poll,1000);}
  };
  const visibility=()=>{generation++;clearTimeout(timer);request?.abort();queue.current.reset();setItem(null);if(!document.hidden)void poll();};
  document.addEventListener('visibilitychange',visibility);void poll();
  return()=>{disposed=true;clearTimeout(timer);request?.abort();document.removeEventListener('visibilitychange',visibility);};
 },[active,preferences.speechBubble]);
 useEffect(()=>{
  if(!active)return;
  let last=performance.now();
  const tick=()=>{
   const now=performance.now(),element=node.current;
   const target=Array.from(document.querySelectorAll<HTMLElement>('.floating-gork-handle, .composer-companion .gork-touch')).find(e=>{
    const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&e.checkVisibility();
   });
   anchor.current=target||null;
   const visible=!!target&&!document.hidden&&!document.querySelector('dialog:modal');
   const held=hovered.current||!!element?.contains(document.activeElement);
   const business=queue.current.tick(now,Math.min(now-last,500),visible,held);last=now;
   const next=greeting.current.tick(now,visible,business);
   setItem(old=>old?.event_id===next?.event_id?old:next);
   if(element&&target&&next)positionBubble(element,target);
  };
  tick();const timer=window.setInterval(tick,150);
  return()=>clearInterval(timer);
 },[active]);
 useLayoutEffect(()=>{
  const element=node.current;if(!element)return;
  if(item){
   element.showPopover?.();
   if(anchor.current)positionBubble(element,anchor.current);
   if(announced.current!==item.event_id){
    announced.current=item.event_id;
    (document as Document & {ariaNotify?:(text:string,options:{priority:string})=>void}).ariaNotify?.(item.text,{priority:'normal'});
   }
  }else if(element.matches(':popover-open'))element.hidePopover();
 },[item]);
 function dismiss(){
  if(node.current?.contains(document.activeElement))anchor.current?.focus({preventScroll:true});
  greeting.current.dismiss();
  if(item?.event_id!==welcomeSpeech.event_id)queue.current.dismiss();
  setItem(null);hovered.current=false;
 }
 return createPortal(<>
  <div className="gork-speech-announcement" aria-live={'ariaNotify' in document?'off':'polite'} aria-atomic="true">{item?.text||''}</div>
  <button ref={node} type="button" popover="manual" className="studio gork-speech-bubble" aria-label={item?`智算播报：${item.text} 点击收起`:undefined} hidden={!item}
   onClick={dismiss} onPointerEnter={()=>{hovered.current=true;}} onPointerLeave={()=>{hovered.current=false;}}>
   <span>{item?.text}</span>
  </button>
 </>,document.body);
}
