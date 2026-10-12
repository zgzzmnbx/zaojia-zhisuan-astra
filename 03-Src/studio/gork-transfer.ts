import {useLayoutEffect,useRef,type RefObject} from 'react';

export const GORK_TRANSFER_MS=650;
export type GorkAnchor={x:number;y:number;size:number};

/** Anchors use canvas centers, so different composer/floating sizes meet exactly. */
export function gorkTransferFrames(from:GorkAnchor,to:GorkAnchor,viewportHeight:number){
 const ratio=from.size/to.size,dx=from.x-to.x,dy=from.y-to.y;
 const direction=Math.sign(to.x-from.x)||1;
 const lift=Math.min(88,Math.max(38,Math.hypot(dx,dy)*.12));
 const frame=(offset:number,t:number,rise:number,sx=1,sy=1,turn=0)=>{
  const size=ratio+(1-ratio)*t;
  const y=Math.max(to.size*size/2+8,Math.min(viewportHeight-to.size*size/2-8,from.y+(to.y-from.y)*t-rise));
  return {offset,transform:`translate(${dx*(1-t)}px, ${y-to.y}px) rotate(${turn}deg) scale(${size*sx}, ${size*sy})`};
 };
 return [
  frame(0,0,0),
  {...frame(.14,0,-4,1.1,.86),easing:'cubic-bezier(.2,.7,.3,1)'},
  frame(.32,.2,lift, .94,1.06,-direction*8),
  {...frame(.69,.82,lift*.6,1,1,direction*3),easing:'cubic-bezier(.4,0,.8,1)'},
  frame(.85,1,-2,1.07,.92),
  frame(.94,1,3,.98,1.03),
  {offset:1,transform:'translate(0px, 0px) rotate(0deg) scale(1, 1)'},
 ];
}

/** Remember the visible origin before layout hides it; animate only one live dock.
 * No extra avatar, screenshots, persistent RAF or vendor-player changes. */
export function useGorkTransfer(active:boolean,sourceActive:boolean,dock:RefObject<HTMLDivElement|null>,identity:unknown,size:number){
 const origin=useRef<GorkAnchor|null>(null),previous=useRef({active:false,sourceActive:false});
 const stop=useRef<()=>void>(()=>{});
 useLayoutEffect(()=>{
  if(!sourceActive)return;
  const canvas=document.querySelector<HTMLCanvasElement>('.composer-companion canvas');
  if(!canvas)return;
  const remember=()=>{const r=canvas.getBoundingClientRect();if(r.width&&r.height&&r.bottom>0&&r.top<innerHeight)origin.current={x:r.left+r.width/2,y:r.top+r.height/2,size:r.width};};
  const observer=new ResizeObserver(remember);observer.observe(canvas);if(canvas.closest('.composer'))observer.observe(canvas.closest('.composer')!);
  remember();document.addEventListener('pointerdown',remember,true);document.addEventListener('keydown',remember,true);document.addEventListener('scroll',remember,true);window.addEventListener('resize',remember);
  return()=>{observer.disconnect();document.removeEventListener('pointerdown',remember,true);document.removeEventListener('keydown',remember,true);document.removeEventListener('scroll',remember,true);window.removeEventListener('resize',remember);};
 },[sourceActive]);
 useLayoutEffect(()=>{
  const departing=active&&!previous.current.active&&previous.current.sourceActive;
  previous.current={active,sourceActive};
  stop.current();
  const node=dock.current,from=origin.current;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  if(!departing||!node||!from||document.hidden||motion.matches)return;
  let done=false,frame=0,flight:Animation|null=null,landing:Animation|null=null;
  const previousVisibility=node.style.visibility;
  const hidden=()=>{if(document.hidden)finish();};
  const finish=()=>{if(done)return;done=true;cancelAnimationFrame(frame);if(flight)flight.onfinish=null;flight?.cancel();landing?.cancel();node.style.visibility=previousVisibility;node.classList.remove('is-transferring');document.removeEventListener('visibilitychange',hidden);window.removeEventListener('resize',finish);window.removeEventListener('blur',finish);motion.removeEventListener('change',finish);};
  stop.current=finish;
  document.addEventListener('visibilitychange',hidden);window.addEventListener('resize',finish);window.addEventListener('blur',finish);motion.addEventListener('change',finish);
  // Let the top-layer host and dock insets settle before measuring the landing.
  // This also allows the original renderer to paint; no blank destination flash.
  node.style.visibility='hidden';
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
   if(done)return;
   node.style.visibility=previousVisibility;
   const canvas=node.querySelector('canvas'),handle=node.querySelector<HTMLElement>('.floating-gork-handle');
   const r=canvas?.getBoundingClientRect();
   if(!r?.width||!handle){finish();return;}
   const to={x:r.left+r.width/2,y:r.top+r.height/2,size:r.width};
   if(Math.hypot(from.x-to.x,from.y-to.y)<4&&Math.abs(from.size-to.size)<2){finish();return;}
   const surface=getComputedStyle(handle);
   node.classList.add('is-transferring');
   flight=node.animate(gorkTransferFrames(from,to,innerHeight),{duration:GORK_TRANSFER_MS,easing:'linear',fill:'both'});
   landing=handle.animate([
    {offset:0,backgroundColor:'transparent',borderColor:'transparent',boxShadow:'none'},
    {offset:.72,backgroundColor:'transparent',borderColor:'transparent',boxShadow:'none'},
    {offset:1,backgroundColor:surface.backgroundColor,borderColor:surface.borderColor,boxShadow:surface.boxShadow},
   ],{duration:GORK_TRANSFER_MS,fill:'both'});
   flight.onfinish=finish;
  });});
  return finish;
 },[active,sourceActive,identity,size]);
 return ()=>stop.current();
}
