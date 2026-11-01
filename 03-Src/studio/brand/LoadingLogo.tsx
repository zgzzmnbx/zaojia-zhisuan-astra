import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {mountLogo} from './logo-renderer.mjs';
import {useLoadingMotion} from './useLoadingMotion';
import './loading-logo.css';

/** Decorative only: the owning request supplies its own unchanged status text. */
export function LoadingLogo({size=32,active=true,paused=false,allowMotion=false,solidFallback=false}:{size?:number;active?:boolean;paused?:boolean;allowMotion?:boolean;solidFallback?:boolean}){
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
  {!ready&&<svg className="loading-logo__fallback" viewBox="0 0 160 160" focusable="false">{solidFallback?[[0,0],[1,0],[2,0],[3,0],[4,0],[3,1],[2,2],[1,3],[0,4],[1,4],[2,4],[3,4],[4,4]].map(([col,row],i)=>{const x=20+col*22,y=24+row*22;return <g key={i}><path fill={['#8ccce7','#65b6df','#3499d5','#1977c2','#1458ac'][row]} d={`M${x} ${y}h22v22h-22z`}/><path fill={['#b4dfee','#92cee7','#72bae0','#4a9fd6','#3885c6'][row]} d={`M${x} ${y}l8 -7h22l-8 7z`}/><path fill={['#65acca','#3d98c6','#167cbb','#1266ad','#10478e'][row]} d={`M${x+22} ${y}l8 -7v22l-8 7z`}/></g>}):<><path fill="#52afe7" d="M26 18h108v23H26z"/><path fill="#329ee9" d="M96 41h24v26H96z"/><path fill="#228be6" d="M72 66h24v26H72z"/><path fill="#1676d5" d="M48 91h24v26H48z"/><path fill="#1055bc" d="M26 117h108v23H26z"/></>}</svg>}
 </span>;
}
