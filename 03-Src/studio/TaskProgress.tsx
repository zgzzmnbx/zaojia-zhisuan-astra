import {useEffect,useRef,useState,type ReactNode} from 'react';
import {LoadingLogo} from './brand/LoadingLogo';
import {Icon} from './ui';
import './task-progress.css';

/** Only mount while the owning request is pending. Unknown duration stays indeterminate. */
export function TaskProgress({label,detail,compact=false,leading,indicator='logo'}:{label:string;detail?:string;compact?:boolean;leading?:ReactNode;indicator?:'logo'|'spinner'}){
 const ref=useRef<HTMLDivElement>(null),[animate,setAnimate]=useState(false);
 useEffect(()=>{
  const host=ref.current;if(!host)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let visible=false;
  const update=()=>setAnimate(visible&&!document.hidden&&!reduced.matches);
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting===true;update();});
  observer.observe(host);document.addEventListener('visibilitychange',update);reduced.addEventListener('change',update);
  return()=>{observer.disconnect();document.removeEventListener('visibilitychange',update);reduced.removeEventListener('change',update);};
 },[]);
 return <div ref={ref} className={`task-progress ${compact?'task-progress--compact':''} ${indicator==='logo'?'task-progress--logo':''}`} data-animate={animate} aria-busy="true">
  {indicator==='logo'&&<span className="task-progress__spinner"><LoadingLogo size={80}/></span>}
  <div className="task-progress__heading">
   {leading}
   {indicator==='spinner'&&<span className="task-progress__spinner"><Icon name="spinner-gap"/></span>}
   <div className="task-progress__copy" role="status" aria-live="polite"><strong>{label}</strong>{detail&&<small>{detail}</small>}</div>
   <span className="task-progress__activity" aria-hidden="true"><i/><i/><i/></span>
  </div>
  <div className="task-progress__track" role="progressbar" aria-label={label} aria-valuetext="处理中，进度待返回"><span/></div>
 </div>;
}
