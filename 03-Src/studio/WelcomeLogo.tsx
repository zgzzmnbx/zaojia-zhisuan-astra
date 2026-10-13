import {useEffect,useId,useRef,useState} from 'react';
import {Icon} from './ui';
import {LOGO_MOTIONS,normalizeMotion} from './brand/motion-options.mjs';
import type {mountLogo} from './brand/logo-renderer.mjs';
import {normalizeLogoConfig,welcomeLogoKey,welcomeLogoEvent} from './brand/logo-config.mjs';
import {usePageCycles} from './brand/usePageCycles';
import './welcome-logo.css';

const key=welcomeLogoKey;
function readPreference(){try{const p=JSON.parse(localStorage.getItem(key)||'{}'),c=normalizeLogoConfig(p);return {mode:normalizeMotion(p.mode),paused:p.paused===true,palette:c.palette,speed:c.speed};}catch{return {mode:'tail',paused:false,palette:'theme',speed:1};}}
/** Lazy 3D, independent preference and static fallback; no workspace side effects. */
export function WelcomeLogo({dark,active=true,openLibrary}:{dark:boolean;active?:boolean;openLibrary?:()=>void}){
 const host=useRef<HTMLDivElement>(null),controller=useRef<ReturnType<typeof mountLogo>|null>(null);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),choice=useRef<HTMLSelectElement>(null);
 const [controlsOpen,setControlsOpen]=useState(false),controlsId=useId();
 const [preference,setPreference]=useState(readPreference),[failed,setFailed]=useState(false),[ready,setReady]=useState(false);
 const [cycles,changeCycle]=usePageCycles(),automatic=cycles.welcome!=='manual';
 const [reduced,setReduced]=useState(()=>typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [allowed,setAllowed]=useState(false);const latest=useRef({preference,dark,reduced,allowed,active,cycles});latest.current={preference,dark,reduced,allowed,active,cycles};
 const update=()=>{const p=latest.current,rest=p.reduced&&!p.allowed,cycle=p.cycles.welcome!=='manual';controller.current?.update({mode:rest||cycle?'static':p.preference.mode,sequence:!rest&&cycle?'welcome':undefined,paused:cycle?p.cycles.welcome==='paused':p.preference.paused,palette:p.preference.palette,speed:p.preference.speed,active:p.active,seed:getComputedStyle(document.documentElement).getPropertyValue('--astra-primary').trim()||'#284bd4',dark:p.dark});};
 useEffect(()=>{const sync=()=>setPreference(readPreference()),storage=(e:StorageEvent)=>{if(e.key===key)sync();};window.addEventListener(welcomeLogoEvent,sync);window.addEventListener('storage',storage);return()=>{window.removeEventListener(welcomeLogoEvent,sync);window.removeEventListener('storage',storage);};},[]);
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>{setReduced(mq.matches);setAllowed(false);};mq.addEventListener('change',change);change();return()=>mq.removeEventListener('change',change);},[]);
 useEffect(()=>{let disposed=false;const element=host.current;if(!element)return;
  import('./brand/logo-renderer.mjs').then(({mountLogo})=>{if(disposed)return;try{controller.current=mountLogo(element,()=>{if(!disposed){setFailed(true);setReady(false);controller.current?.dispose();controller.current=null;}});update();setReady(true);}catch{setFailed(true);}}).catch(()=>{if(!disposed)setFailed(true);});
  const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-astra-palette','data-astra-scheme']});
  // Read-only diagnostics for browser acceptance, removed with the component.
  const inspect=()=>controller.current?.inspect()??null;
  Object.defineProperty(element,'logoDiagnostics',{value:inspect,configurable:true});
  return()=>{disposed=true;observer.disconnect();controller.current?.dispose();controller.current=null;delete (element as any).logoDiagnostics;};
 },[]);
 useEffect(update,[preference,dark,reduced,allowed,active,cycles]);
 useEffect(()=>{if(!controlsOpen)return;choice.current?.focus({preventScroll:true});
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setControlsOpen(false);};
  document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
 },[controlsOpen]);
 function change(next:typeof preference){setPreference(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{/* The in-memory choice still works. */}}
 const resting=reduced&&!allowed;
 const paused=automatic?cycles.welcome==='paused':preference.paused;
 return <div className="welcome-logo" ref={root} data-ready={ready} data-fallback={failed} data-mode={resting?'static':preference.mode} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setControlsOpen(false);}} onKeyDown={event=>{if(event.key==='Escape'&&controlsOpen){event.preventDefault();event.stopPropagation();setControlsOpen(false);trigger.current?.focus({preventScroll:true});}}}>
  <div className="welcome-logo-stage" ref={host} role="img" aria-label="造价智算阶梯 Z 标志"/>
  {!ready&&<svg className="welcome-logo-fallback" viewBox="0 0 160 160" aria-hidden="true"><g fill="currentColor"><path opacity=".48" d="M26 18h108v23H26z"/><path opacity=".65" d="M96 41h24v26H96z"/><path opacity=".78" d="M72 66h24v26H72z"/><path opacity=".9" d="M48 91h24v26H48z"/><path d="M26 117h108v23H26z"/></g></svg>}
  <button ref={trigger} type="button" className="btn btn-ghost btn-square welcome-logo-trigger" aria-label="Logo 动效设置" title="Logo 动效设置" aria-expanded={controlsOpen} aria-controls={controlsId} onClick={()=>setControlsOpen(v=>!v)}><Icon name="settings"/></button>
  <div className="welcome-logo-controls" id={controlsId} role="group" aria-label="Logo 动效设置" hidden={!controlsOpen}>
   <select ref={choice} aria-label="Logo 动效" value={automatic?'cycle':preference.mode} disabled={failed} onChange={e=>{setAllowed(true);changeCycle('welcome',e.target.value==='cycle'?'loop':'manual');if(e.target.value!=='cycle')change({...preference,mode:e.target.value,paused:false});}}><option value="cycle">页面循环 · 波浪 / 圆环</option>{LOGO_MOTIONS.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
   <button type="button" className="btn btn-ghost btn-square" disabled={failed||!automatic&&preference.mode==='static'} aria-label={paused||resting?'播放 Logo 动效':'暂停 Logo 动效'} title={paused||resting?'播放 Logo 动效':'暂停 Logo 动效'} onClick={()=>{setAllowed(true);if(automatic)changeCycle('welcome',paused||resting?'loop':'paused');else change({...preference,paused:resting?false:!paused});}}><Icon name={paused||resting?'play':'pause'}/></button>
   {openLibrary&&<button type="button" className="btn btn-ghost btn-square" aria-label="打开 Logo 与动效设置" title="全部设置" onClick={()=>{setControlsOpen(false);openLibrary();}}><Icon name="arrow-up-right"/></button>}
  </div>
 </div>;
}

