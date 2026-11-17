import {createOrbitSweep,normalizeOrbitMotion} from './astra-orbit-motion.js';
import {createIdleOrbit} from './astra-idle-orbit.js';

export function createOfficeOrbit({canRun,requestFrame,change=()=>{},clock={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)}}){
  let settings={enabled:false,delay:0,blocked:false,motion:normalizeOrbitMotion(null)};
  let paused=false,focused=false,running=false,last=0,degrees=0,key='';
  const sweep=createOrbitSweep();
  const state=()=>({...settings,idleDelay:settings.delay||5,paused,focused,running,degrees});
  const idle=createIdleOrbit(value=>{
    running=value;last=0;if(value)focused=false;else{sweep.reset();degrees=0;}
    change(state());if(value)requestFrame();
  },canRun,clock);
  function sync(){
    const options={enabled:settings.enabled,delay:(settings.delay||5)*1000,blocked:paused||settings.blocked||!canRun()};
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
