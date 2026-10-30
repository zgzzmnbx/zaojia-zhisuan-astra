import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {mountLogo} from './logo-renderer.mjs';
import {useLoadingMotion} from './useLoadingMotion';
import './loading-logo.css';

/** Decorative only: the owning request supplies its own unchanged status text. */
export function LoadingLogo({size=32,active=true,paused=false,allowMotion=false}:{size?:number;active?:boolean;paused?:boolean;allowMotion?:boolean}){
 const host=useRef<HTMLSpanElement>(null),controller=useRef<ReturnType<typeof mountLogo>|null>(null);
 const [motion]=useLoadingMotion(),[visible,setVisible]=useState(false),[ready,setReady]=useState(false);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const latest=useRef({motion,paused,reduced,allowMotion});latest.current={motion,paused,reduced,allowMotion};
 function update(){
  const p=latest.current;
  controller.current?.update({mode:p.motion,loading:true,palette:'original',seed:'#228be6',dark:document.documentElement.dataset.astraScheme==='dark',speed:1,paused:p.paused||(p.reduced&&!p.allowMotion),active:true});
 }
 useEffect(()=>{
  const el=host.current;if(!el)return;
  const io=new IntersectionObserver(entries=>setVisible(entries[0]?.isIntersecting===true));io.observe(el);
  const mq=matchMedia('(prefers-reduced-motion: reduce)'),sync=()=>setReduced(mq.matches);mq.addEventListener('change',sync);
  return()=>{io.disconnect();mq.removeEventListener('change',sync);};
 },[]);
 useEffect(()=>{
  const el=host.current;if(!el||!visible||!active)return;
  let disposed=false;
  const fail=()=>{if(disposed)return;controller.current?.dispose();controller.current=null;setReady(false);};
  import('./logo-renderer.mjs').then(({mountLogo})=>{
   if(disposed)return;try{controller.current=mountLogo(el,fail);update();setReady(true);}catch{fail();}
  }).catch(fail);
  const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-astra-scheme','data-astra-palette']});
  Object.defineProperty(el,'logoDiagnostics',{value:()=>controller.current?.inspect()??null,configurable:true});
  return()=>{disposed=true;observer.disconnect();controller.current?.dispose();controller.current=null;setReady(false);delete (el as any).logoDiagnostics;};
 },[visible,active]);
 useEffect(update,[motion,paused,reduced,allowMotion]);
 return <span className="loading-logo" style={{'--loading-logo-size':`${size}px`} as CSSProperties} aria-hidden="true" data-motion={motion} data-ready={ready} data-reduced={reduced&&!allowMotion}>
  <span className="loading-logo__canvas" ref={host}/>
  {!ready&&<svg className="loading-logo__fallback" viewBox="0 0 160 160" focusable="false"><path fill="#52afe7" d="M26 18h108v23H26z"/><path fill="#329ee9" d="M96 41h24v26H96z"/><path fill="#228be6" d="M72 66h24v26H72z"/><path fill="#1676d5" d="M48 91h24v26H48z"/><path fill="#1055bc" d="M26 117h108v23H26z"/></svg>}
 </span>;
}
