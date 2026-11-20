import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {mountLoadingLogo,type LoadingRenderer} from './loading-renderer';
import {useLoadingMotion} from './useLoadingMotion';
import './loading-logo.css';

/** Decorative only: the owning request supplies its own unchanged status text. */
export function LoadingLogo({size=32,active=true,paused=false,allowMotion=false,finishAtRest=false,onSettled}:{size?:number;active?:boolean;paused?:boolean;allowMotion?:boolean;finishAtRest?:boolean;onSettled?:()=>void}){
 const host=useRef<HTMLSpanElement>(null),controller=useRef<LoadingRenderer|null>(null);
 const [motion]=useLoadingMotion(),[visible,setVisible]=useState(false),[started,setStarted]=useState(false),[phase,setPhase]=useState<'starting'|'ready'|'failed'>('starting');
 const [reduced,setReduced]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 const options={motion,paused,reduced,allowMotion,finishAtRest,onSettled,active:active&&visible};
 const latest=useRef(options);latest.current=options;
 function currentOptions(){
  const p=latest.current;
  return {mode:p.motion,dark:document.documentElement.dataset.astraScheme==='dark',paused:p.paused||(p.reduced&&!p.allowMotion),active:p.active,finishAtRest:p.finishAtRest};
 }
 function update(){controller.current?.update(currentOptions());}
 useLayoutEffect(()=>{
  const el=host.current;if(!el)return;
  const box=el.getBoundingClientRect();setVisible(box.width>0&&box.height>0&&box.bottom>0&&box.top<innerHeight&&box.right>0&&box.left<innerWidth);
  const io=new IntersectionObserver(entries=>setVisible(entries[0]?.isIntersecting===true));io.observe(el);
  const mq=matchMedia('(prefers-reduced-motion: reduce)'),sync=()=>setReduced(mq.matches);mq.addEventListener('change',sync);
  return()=>{io.disconnect();mq.removeEventListener('change',sync);};
 },[]);
 useLayoutEffect(()=>{if(active&&visible)setStarted(true);},[active,visible]);
 useEffect(()=>{
  const el=host.current;if(!el||!started)return;
  let disposed=false;
  const fail=()=>{if(disposed)return;controller.current?.dispose();controller.current=null;setPhase('failed');};
  try{controller.current=mountLoadingLogo(el,currentOptions(),()=>{if(!disposed)setPhase('ready');},fail,()=>latest.current.onSettled?.());}catch{fail();}
  const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-astra-scheme','data-astra-palette']});
  Object.defineProperty(el,'logoDiagnostics',{value:()=>controller.current?.inspect()??null,configurable:true});
  return()=>{disposed=true;observer.disconnect();controller.current?.dispose();controller.current=null;setPhase('starting');delete (el as any).logoDiagnostics;};
 },[started]);
 useEffect(update,[motion,paused,reduced,allowMotion,finishAtRest,active,visible]);
 useEffect(()=>{
  if(finishAtRest&&(!active||phase==='failed'||(reduced&&!allowMotion)))latest.current.onSettled?.();
 },[finishAtRest,active,phase,reduced,allowMotion]);
 return <span className="loading-logo" style={{'--loading-logo-size':`${size}px`} as CSSProperties} aria-hidden="true" data-motion={motion} data-ready={phase==='ready'} data-reduced={reduced&&!allowMotion}>
  <span className="loading-logo__canvas" ref={host}/>
  {phase==='failed'&&<span className="loading-logo__fallback"/>}
 </span>;
}
