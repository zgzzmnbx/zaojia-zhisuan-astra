import {createOrbitSweep,normalizeOrbitMotion} from './astra-orbit-motion.js';
import {createIdleOrbit} from './astra-idle-orbit.js';

// A drag can finish in the host chat, outside the iframe's native pointer stream.
export function bindOfficeOrbitHold({listen,document,window,orbit}){
  const pointers=new Set();let nativeDrag=false,held=false;
  const sync=()=>{const next=nativeDrag||pointers.size>0;if(next!==held){held=next;orbit.hold(next);}};
  const release=event=>{pointers.delete(event.pointerId);sync();};
  const reset=()=>{pointers.clear();nativeDrag=false;sync();};
  listen(document,'pointerdown',event=>{pointers.add(event.pointerId);sync();},true);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(window,type,release,true);
  listen(window,'pointermove',event=>{if(event.pointerType!=='touch'&&event.buttons===0)release(event);},true);
  listen(document,'dragstart',()=>{nativeDrag=true;sync();},true);
  listen(document,'dragend',reset,true);
  listen(window,'office-chat-pointer',event=>{if(['up','cancel'].includes(event.detail?.phase))reset();});
  listen(window,'blur',reset);
  listen(document,'visibilitychange',()=>{if(document.hidden)reset();});
  listen(window,'pagehide',reset);
  return reset;
}

export function createOfficeOrbit({canRun,requestFrame,change=()=>{},clock={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)}}){
  let settings={enabled:false,delay:0,blocked:false,motion:normalizeOrbitMotion(null)};
  let paused=false,focused=false,running=false,last=0,degrees=0,key='';
  const sweep=createOrbitSweep();
  const state=()=>({...settings,idleDelay:settings.delay,paused,focused,running,degrees});
  const idle=createIdleOrbit(value=>{
    running=value;last=0;if(value)focused=false;else{sweep.reset();degrees=0;}
    change(state());if(value)requestFrame();
  },canRun,clock);
  function sync(){
    const options={enabled:settings.enabled,delay:settings.delay*1000,blocked:paused||settings.blocked||!canRun()};
    const next=JSON.stringify(options);
    if(next!==key){key=next;idle.configure(options);change(state());}
  }
  return {
    configure(value){settings={enabled:value?.enabled===true,delay:[0,2,5,10,15,30,60].includes(value?.delay)?value.delay:0,blocked:value?.blocked===true,motion:normalizeOrbitMotion(value?.motion)};sync();},
    sync,
    hold(value){idle.hold(value);},
    activity(){idle.activity();},
    focus(value){focused=value;sync();idle.activity();},
    toggle(){paused=!paused;if(!paused)focused=false;sync();},
    state,
    step(now){
      sync();if(!running)return {delta:0,angle:0,full:false};
      const delta=last?Math.min(.05,Math.max(0,(now-last)/1000)):1/60;last=now;
      const angle=sweep.step(delta,settings.motion);
      degrees+=angle*180/Math.PI;
      return {delta,angle,full:false};
    },
    dispose(){idle.dispose();},
  };
}
