import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {Icon} from './ui';
import {capabilityGroups} from './CapabilityHub';
import {quickCommands,quickDestinations,quickUnavailable,type QuickState} from './quick-actions';
import './composer-quick-menu.css';

type Props={active:boolean;context:string;state:QuickState;run:(id:string)=>void};
export function ComposerQuickMenu({active,context,state,run}:Props){
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),suppressHover=useRef(false);
 const [mode,setMode]=useState<'closed'|'hover'|'pinned'>('closed'),[tab,setTab]=useState<'common'|'all'>('common'),[height,setHeight]=useState(420);
 const open=active&&mode!=='closed';
 const cancelTimer=()=>{if(timer.current!==null){clearTimeout(timer.current);timer.current=null;}};
 function close(restore=false){cancelTimer();suppressHover.current=true;if(restore)trigger.current?.focus({preventScroll:true});setMode('closed');}
 function choose(id:string){if(quickUnavailable(id,state))return;close(true);run(id);}
 useEffect(()=>{cancelTimer();suppressHover.current=false;setMode('closed');setTab('common');return cancelTimer;},[active,context]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))close();};
  const hidden=()=>{if(document.hidden)close();};
  const blur=()=>close();
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){event.preventDefault();event.stopPropagation();close(true);}};
  document.addEventListener('pointerdown',outside);document.addEventListener('visibilitychange',hidden);document.addEventListener('keydown',escape,true);window.addEventListener('blur',blur);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('visibilitychange',hidden);document.removeEventListener('keydown',escape,true);window.removeEventListener('blur',blur);};
 },[open]);
 useLayoutEffect(()=>{
  if(!open)return;
  const node=root.current,conversation=node?.closest('.conversation');
  const measure=()=>{if(!node||!conversation)return;const heading=conversation.querySelector('.conversation-heading');const top=Math.max(12,heading?.getBoundingClientRect().bottom??conversation.getBoundingClientRect().top);setHeight(Math.max(64,Math.min(480,node.getBoundingClientRect().top-top-16)));};
  const observer=new ResizeObserver(measure);if(conversation)observer.observe(conversation);if(node?.parentElement)observer.observe(node.parentElement);measure();window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);
  return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);};
 },[open]);
 const tile=(id:string,icon:string,label:string,description?:string)=>{
  const reason=quickUnavailable(id,state);
  return <button type="button" data-quick-item key={id} className="quick-feature" disabled={!!reason} title={reason||description||label} onClick={()=>choose(id)}><Icon name={icon}/><span>{label}</span>{reason&&<span className="quick-feature-reason">{reason}</span>}</button>;
 };
 return <div ref={root} className={`composer-quick-menu ${open?'is-open':''}`} style={{'--quick-available-height':`${height}px`} as CSSProperties}
  onPointerEnter={event=>{cancelTimer();if(event.pointerType==='mouse'&&active&&!suppressHover.current&&mode==='closed')timer.current=setTimeout(()=>{timer.current=null;setMode('hover');},90);}}
  onPointerLeave={()=>{cancelTimer();suppressHover.current=false;if(mode==='hover'&&!panel.current?.contains(document.activeElement))timer.current=setTimeout(()=>{timer.current=null;setMode('closed');},180);}}
  onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))close();}}
  onKeyDown={event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close(true);}}}>
  <button ref={trigger} type="button" className="quick-menu-handle" aria-expanded={open} aria-controls="composer-quick-panel" onClick={()=>{cancelTimer();if(mode==='pinned')close();else setMode('pinned');}} onKeyDown={event=>{if(event.key==='ArrowUp'){event.preventDefault();cancelTimer();setMode('pinned');requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>('[data-quick-item]:not(:disabled)')?.focus());}}}><Icon name="grid"/><span>快捷功能</span><Icon name="chevron"/></button>
  <div ref={panel} id="composer-quick-panel" className="quick-menu-panel" role="region" aria-label="快捷功能" aria-hidden={!open} inert={!open}>
   <header className="quick-menu-heading"><div role="tablist" aria-label="快捷功能范围">{(['common','all'] as const).map(value=><button type="button" key={value} id={`quick-tab-${value}`} role="tab" aria-selected={tab===value} aria-controls="quick-menu-contents" tabIndex={tab===value?0:-1} onClick={()=>setTab(value)} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'common':event.key==='End'?'all':tab==='common'?'all':'common';setTab(next);root.current?.querySelector<HTMLButtonElement>(`#quick-tab-${next}`)?.focus();}}}>{value==='common'?'常用':'全部功能'}</button>)}</div><button type="button" className="quick-menu-close" aria-label="收起快捷功能" onClick={()=>close(true)}><Icon name="close"/></button></header>
   <div id="quick-menu-contents" className="quick-menu-contents" role="tabpanel" aria-labelledby={`quick-tab-${tab}`}>
    {tab==='common'?<><section><h3>编制与复核</h3><div className="quick-feature-grid">{quickCommands.map(([id,icon,label])=>tile(id,icon,label))}</div></section><section><h3>工作区</h3><div className="quick-feature-grid">{quickDestinations.map(([id,icon,label])=>tile(id,icon,label))}</div></section></>:capabilityGroups.map(group=><section key={group.title}><h3>{group.title}</h3><div className="quick-feature-grid">{group.items.map(([id,icon,label,description])=>tile(id,icon,label,description))}</div></section>)}
   </div>
  </div>
 </div>;
}
