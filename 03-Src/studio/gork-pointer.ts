/** Astra-only input adapter over the console's original geometry renderer.
 * The upstream idle/turn/blink sampler owns the only RAF. Pointer input blends
 * the sampled pose; it never starts another animation loop or device request. */
export type HeadPose={headX:number;headY:number;headZ:number;[key:string]:unknown};
export type PointerEnvironment={now:()=>number;viewport:()=>{width:number;height:number};rect:()=>{left:number;top:number;width:number;height:number};enabled:()=>boolean;listen:(name:string,handler:(event:any)=>void)=>()=>void};
const clamp=(v:number,limit:number)=>Math.max(-limit,Math.min(limit,v));
export type PointerSmoothing={responseMs?:number;maxSpeed?:number};
export function createPointerLook(env:PointerEnvironment,smoothing:PointerSmoothing={}){
 let x=0,y=0,followX=0,followY=0,weight=0,lastMove=-Infinity,previous=env.now(),disposed=false;
 const reset=()=>{lastMove=-Infinity;x=0;y=0;followX=0;followY=0;weight=0;};
 const move=(e:{clientX:number;clientY:number;pointerType?:string})=>{if(disposed||!env.enabled()||e.pointerType==='touch'||!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return;const r=env.rect(),v=env.viewport();x=clamp((e.clientX-r.left-r.width/2)/Math.max(140,v.width*.35),1)*35;y=-clamp((e.clientY-r.top-r.height/2)/Math.max(140,v.height*.35),1)*28;lastMove=env.now();};
 const stops=[env.listen('pointermove',move),env.listen('pointerout',e=>{if(!e.relatedTarget)reset()}),env.listen('blur',reset)];
 return {reset,apply<T extends HeadPose>(pose:T):T{if(disposed)return pose;const now=env.now(),dt=Math.min(100,Math.max(0,now-previous));previous=now;const active=env.enabled()&&now-lastMove<2200;
  const response=smoothing.responseMs||0,alpha=response?1-Math.exp(-dt/response):1;
  let dx=(x-followX)*alpha,dy=(y-followY)*alpha;const distance=Math.hypot(dx,dy),limit=(smoothing.maxSpeed??Infinity)*dt/1000;
  if(distance>limit&&distance>0){dx*=limit/distance;dy*=limit/distance;}followX+=dx;followY+=dy;
  weight+=(Number(active)-weight)*(1-Math.exp(-dt/(response?180:130)));if(weight<.001){weight=0;return pose;}return {...pose,headX:pose.headX+(followY-pose.headX)*weight,headY:pose.headY+(followX-pose.headY)*weight};},dispose(){if(disposed)return;disposed=true;reset();stops.forEach(stop=>stop())}};
}
type Look=ReturnType<typeof createPointerLook>;
const activeLooks=new WeakMap<HTMLCanvasElement,Look>();
let wrapped=false;
/** Same-origin professional panes receive pointer events in their own document. */
function listenGorkEvent(name:string,handler:(event:any)=>void){
 window.addEventListener(name,handler,{passive:true});
 const frames=new Map<HTMLIFrameElement,()=>void>();
 const observeFrames=()=>{
  for(const [frame,stop] of frames)if(!frame.isConnected){stop();frames.delete(frame);}
  for(const frame of document.querySelectorAll('iframe')){
   if(frames.has(frame))continue;
   let remove=()=>{};
   const bind=()=>{remove();remove=()=>{};try{
    const doc=frame.contentDocument;if(!doc)return;
    const forward=(event:globalThis.PointerEvent)=>{const rect=frame.getBoundingClientRect();if(!rect.width||!rect.height)return;handler({pointerType:event.pointerType,clientX:rect.left+frame.clientLeft+event.clientX*rect.width/(frame.offsetWidth||rect.width),clientY:rect.top+frame.clientTop+event.clientY*rect.height/(frame.offsetHeight||rect.height)});};
    doc.addEventListener('pointermove',forward,{passive:true});remove=()=>doc.removeEventListener('pointermove',forward);
   }catch{/* Opaque or external frames remain isolated. */}};
   frame.addEventListener('load',bind);bind();frames.set(frame,()=>{remove();frame.removeEventListener('load',bind);});
  }
 };
 const observer=name==='pointermove'&&typeof document!=='undefined'?new MutationObserver(observeFrames):null;
 if(observer){observeFrames();observer.observe(document.body,{childList:true,subtree:true});}
 return()=>{window.removeEventListener(name,handler);observer?.disconnect();for(const stop of frames.values())stop();frames.clear();};
}
export function attachGorkPointer(canvas:HTMLCanvasElement,enabled:()=>boolean,smoothing:PointerSmoothing={}){
 const appearance=(window as any).GorkAppearance;
 if(!appearance)throw new Error('Gork 控制台完整几何渲染未载入');
 if(!wrapped){const original=appearance.draw;appearance.draw=(ctx:CanvasRenderingContext2D,pose:HeadPose,blink:number,value:unknown)=>original(ctx,activeLooks.get(ctx.canvas)?.apply(pose)||pose,blink,value);wrapped=true;}
 const look=createPointerLook({now:()=>performance.now(),viewport:()=>({width:innerWidth,height:innerHeight}),rect:()=>canvas.getBoundingClientRect(),enabled,listen:listenGorkEvent},smoothing);
 activeLooks.set(canvas,look);
 return {reset:look.reset,dispose(){look.dispose();activeLooks.delete(canvas)}};
}
