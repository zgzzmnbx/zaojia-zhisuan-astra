import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {Gork} from './Gork';
import {clampGork,cornerForKey,cornerPosition,nearestCorner,readGorkCorner,type GorkCorner,type Point} from './floating-gork-position';
import './floating-gork.css';

const storageKey='astra:floating-gork-corner';
const labels:Record<GorkCorner,string>={'bottom-left':'左下角','bottom-right':'右下角','top-left':'左上角','top-right':'右上角'};
function initialCorner(){try{return readGorkCorner(localStorage.getItem(storageKey));}catch{return 'bottom-left' as const;}}

/** Fullscreen companion stays in the browser top layer, including above modal content.
 * The original canvas renderer owns blinking and gaze; only the dock position is new. */
export function FloatingGork({active,state,completion}:{active:boolean;state:string;completion:number}){
 const [corner,setCorner]=useState(initialCorner),[position,setPosition]=useState<Point|null>(null),[host,setHost]=useState<Element>(document.body);
 const [viewport,setViewport]=useState(()=>({width:innerWidth,height:innerHeight,left:0,top:58,bottom:48}));
 const layer=useRef<HTMLDivElement>(null),drag=useRef<{id:number;node:HTMLButtonElement;start:Point;offset:Point;last:Point;moved:boolean}|null>(null);
 const handle=useRef<HTMLButtonElement>(null);
 const suppressClick=useRef(false),[menu,setMenu]=useState(false);
 function dock(next:GorkCorner){setCorner(next);setPosition(null);setMenu(false);handle.current?.focus({preventScroll:true});try{localStorage.setItem(storageKey,next);}catch{/* Position still works when storage is unavailable. */}}
 function cancelDrag(){const current=drag.current;drag.current=null;if(current?.moved)suppressClick.current=true;setPosition(null);if(current?.node.hasPointerCapture(current.id))current.node.releasePointerCapture(current.id);}
 useEffect(()=>{
  if(!active){cancelDrag();setMenu(false);setHost(document.body);return;}
  const resize=()=>{cancelDrag();setViewport({width:innerWidth,height:innerHeight,left:innerWidth>1024?(document.getElementById('project-sidebar')?.getBoundingClientRect().right||0):0,top:document.querySelector('.four-surface-topbar')?.getBoundingClientRect().bottom||58,bottom:48});};
  // A popover outside a modal is inert; keep the host inside the latest modal.
  const syncHost=()=>{const dialogs=Array.from(document.querySelectorAll('dialog:modal'));const next=dialogs.at(-1)||document.fullscreenElement||document.body;setHost(old=>old===next?old:next);};
  const observer=new MutationObserver(syncHost);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  const geometry=new ResizeObserver(resize);for(const element of [document.getElementById('project-sidebar'),document.querySelector('.four-surface-topbar')])if(element)geometry.observe(element);
  const hidden=()=>{if(document.hidden)cancelDrag();};
  resize();syncHost();window.addEventListener('resize',resize);window.addEventListener('blur',cancelDrag);document.addEventListener('visibilitychange',hidden);document.addEventListener('fullscreenchange',syncHost);
  return()=>{observer.disconnect();geometry.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('blur',cancelDrag);document.removeEventListener('visibilitychange',hidden);document.removeEventListener('fullscreenchange',syncHost);cancelDrag();};
 },[active]);
 useLayoutEffect(()=>{if(!active)return;const node=layer.current;if(!node?.isConnected)return;node.showPopover?.();return()=>{if(node.matches(':popover-open'))node.hidePopover();};},[active,host]);
 function start(event:PointerEvent<HTMLButtonElement>){
  if(event.button!==0||drag.current)return;
  const rect=event.currentTarget.getBoundingClientRect();suppressClick.current=false;
  drag.current={id:event.pointerId,node:event.currentTarget,start:{x:event.clientX,y:event.clientY},offset:{x:event.clientX-rect.left,y:event.clientY-rect.top},last:{x:rect.left,y:rect.top},moved:false};
  event.currentTarget.setPointerCapture(event.pointerId);
 }
 function move(event:PointerEvent<HTMLButtonElement>){
  const current=drag.current;if(!current||event.pointerId!==current.id)return;
  if(Math.hypot(event.clientX-current.start.x,event.clientY-current.start.y)>5)current.moved=true;
  if(!current.moved)return;
  setMenu(false);
  current.last=clampGork({x:event.clientX-current.offset.x,y:event.clientY-current.offset.y},viewport.width,viewport.height);setPosition(current.last);
 }
 function finish(event:PointerEvent<HTMLButtonElement>){
  const current=drag.current;if(!current||event.pointerId!==current.id)return;
  drag.current=null;suppressClick.current=current.moved;
  if(current.moved)dock(nearestCorner(current.last,viewport.width,viewport.height));
  if(current.node.hasPointerCapture(current.id))current.node.releasePointerCapture(current.id);
 }
 if(!active)return null;
 const point=position||cornerPosition(corner,viewport.width,viewport.height,viewport);
 return createPortal(<div ref={layer} popover="manual" className="studio floating-gork-layer">
  <div className={`floating-gork-dock ${position?'is-dragging':''}`} data-corner={corner} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setMenu(false);}} style={{left:point.x,top:point.y}} onKeyDown={event=>{if(event.key==='Escape'&&menu){event.preventDefault();event.stopPropagation();setMenu(false);handle.current?.focus();}}}>
   <button ref={handle} type="button" className="floating-gork-handle" aria-label={`移动悬浮智算，当前${labels[corner]}`} aria-expanded={menu} aria-controls="floating-gork-positions" title="拖动停靠四角 · 方向键移动 · 点击选择位置"
    onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancelDrag} onLostPointerCapture={()=>{if(drag.current)cancelDrag();}}
    onClick={()=>{if(!suppressClick.current)setMenu(value=>!value);suppressClick.current=false;}}
    onKeyDown={event=>{if(event.key==='Escape'&&(drag.current||menu)){event.preventDefault();event.stopPropagation();cancelDrag();setMenu(false);return;}const next=cornerForKey(corner,event.key);if(next){event.preventDefault();event.stopPropagation();cancelDrag();dock(next);}}}>
    <Gork size={56} state={state} completion={completion} followPointer pointerSmoothing="smooth"/>
   </button>
   {menu&&<div id="floating-gork-positions" className="floating-gork-positions" role="group" aria-label="智算停靠位置">{(['top-left','top-right','bottom-left','bottom-right'] as const).map(value=><button key={value} type="button" aria-pressed={corner===value} onClick={()=>dock(value)}>{labels[value]}</button>)}</div>}
  </div>
 </div>,host);
}
