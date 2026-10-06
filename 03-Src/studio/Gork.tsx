import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import '../vendor/gork/gork-catalog.js';
import '../vendor/gork/gork-avatar.js';
import {choreographGork,createGorkController,gorkDescriptions,greetings} from './gork-motion';
import './gork.css';

const preference='astra.gork-motion.v1',preferenceEvent='astra:gork-motion';
let motionPreference='auto';
const media=matchMedia('(prefers-reduced-motion: reduce)');
try{motionPreference=localStorage.getItem(preference)||'auto';}catch{/* Session-only when storage is unavailable. */}
function subscribe(change:()=>void){
  const storage=(e:StorageEvent)=>{if(e.key!==preference&&e.key!==null)return;try{motionPreference=localStorage.getItem(preference)||'auto';}catch{}change();};
  window.addEventListener(preferenceEvent,change);window.addEventListener('storage',storage);media.addEventListener('change',change);
  return()=>{window.removeEventListener(preferenceEvent,change);window.removeEventListener('storage',storage);media.removeEventListener('change',change);};
}
export function useGorkMotion(){
  useSyncExternalStore(subscribe,()=>`${motionPreference}:${media.matches}`);
  const paused=motionPreference==='paused'||(motionPreference!=='play'&&media.matches);
  return [paused,(next:boolean)=>{motionPreference=next?'paused':'play';try{localStorage.setItem(preference,motionPreference);}catch{}window.dispatchEvent(new Event(preferenceEvent));},motionPreference==='play'] as const;
}
const catalog=choreographGork((window as any).GorkCatalog);
type Props={state?:string;size?:number;still?:boolean;suspended?:boolean;interactive?:boolean;showPause?:boolean;completion?:number;onGreet?:()=>void};

export function Gork({state='idle',size=32,still=false,suspended=false,interactive=false,showPause=false,completion=0,onGreet}:Props){
  const canvas=useRef<HTMLCanvasElement>(null),controller=useRef<ReturnType<typeof createGorkController>|null>(null);
  const [paused,setPaused,forceMotion]=useGorkMotion(),[status,setStatus]=useState({state,active:false});
  const values=useRef({state,paused:paused||still,suspended});values.current={state,paused:paused||still,suspended};
  const reconcile=useRef<()=>void>(()=>{}),greetingIndex=useRef(0),lastGreeting=useRef(-Infinity),lastCompletion=useRef(completion);
  useEffect(()=>{
    const element=canvas.current;if(!element)return;
    let visible=false;
    const instance=createGorkController((next,frozen)=>{
      const player=(window as any).GorkAvatar.mount(element,catalog,{still:frozen,expression:next});
      if(!frozen)player.set(next);return player;
    },next=>setStatus(old=>old.state===next.state&&old.active===next.active?old:next));
    controller.current=instance;
    const update=()=>instance.update({state:values.current.state,visible:visible&&!document.hidden&&!values.current.suspended,paused:values.current.paused});
    reconcile.current=update;
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;update();});
    observer.observe(element);document.addEventListener('visibilitychange',update);
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',update);instance.dispose();controller.current=null;reconcile.current=()=>{};};
  },[]);
  useEffect(()=>reconcile.current(),[state,paused,still,suspended]);
  useEffect(()=>{
    if(completion===lastCompletion.current)return;
    lastCompletion.current=completion;controller.current?.react('happy',true);
  },[completion]);
  function greet(){
    const now=performance.now();if(now-lastGreeting.current<900)return;
    if(controller.current?.react(greetings[greetingIndex.current%greetings.length])){greetingIndex.current++;lastGreeting.current=now;}
    onGreet?.();
  }
  const picture=<canvas ref={canvas} width={size*2} height={size*2} style={{width:size,height:size}} role="img" aria-label={`Gork，智算的化身 · ${gorkDescriptions[status.state]||'与你一起工作'}`}/>;
  return <span className={`gork-companion ${interactive?'gork-interactive':''}`} data-state={status.state} data-animated={status.active&&!still} data-motion-override={forceMotion} style={{width:size,height:size}}>
    {interactive?<button type="button" className="gork-touch" aria-label="和 Gork 打个招呼" title={`${gorkDescriptions[status.state]||'与你一起工作'} · 点一下和 Gork 互动`} onClick={greet}>{picture}</button>:picture}
    {interactive&&showPause&&<button type="button" className="gork-pause" aria-label={paused?'播放 Gork 动效':'暂停 Gork 动效'} title={paused?'播放 Gork 动效':'暂停 Gork 动效'} aria-pressed={paused} onClick={()=>setPaused(!paused)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{paused?<path d="m9 5 10 7-10 7Z"/>:<path d="M8 5v14M16 5v14"/>}</svg></button>}
  </span>;
}
