import {Euler,Quaternion,QuaternionKeyframeTrack,Vector3} from 'three';
import {basePose,transitionPose,assemblyPose,ease,HERO,PARTS,bakeClip} from './model.mjs';

import {LOGO_MOTIONS,normalizeMotion} from './motion-options.mjs';
export {LOGO_MOTIONS,normalizeMotion};
// Follow the Z from the upper beam to its playful lower-right tail.
export const IDLE_ORDER=[8,9,10,11,12,7,6,5,0,1,2,3,4];
export const IDLE_TIMING={lead:.6,slot:.8,clear:.14,turn:.5,return:.14};
// Preserve polar order while opening the Z into a ring, so paths cannot swap.
const ringOrder=PARTS.map((p,i)=>({i,angle:Math.atan2(p.home[1],p.home[0])})).sort((a,b)=>a.angle-b.angle);
const ringRank=new Map(ringOrder.map((p,rank)=>[p.i,rank]));
export const RING_RADIUS=3.15;
export const WAVE_TIMING={start:1.4,delay:.16,pulse:2.4};
export function sampleMotion(id,time){
  const motion=LOGO_MOTIONS.find(m=>m.id===normalizeMotion(id));
  const t=((time%motion.duration)+motion.duration)%motion.duration;
  let parts=basePose(),viewScale=1;const rotation=[0,0,0];
  if(motion.id==='idle'){
    const {lead,slot:spacing,clear,turn,return:settle}=IDLE_TIMING;
    const slot=Math.floor((t-lead)/spacing),u=t-lead-slot*spacing;
    if(slot>=0&&slot<IDLE_ORDER.length){
      const i=IDLE_ORDER[slot];
      const travel=u<clear?ease(u/clear):u<clear+turn?1:1-ease((u-clear-turn)/settle);
      const upper=PARTS[i].name.startsWith('Upper_'),lower=PARTS[i].name.startsWith('Lower_');
      // Roll beams about their length axis: a small outward nudge clears the
      // steps without a full-cube flyout. Steps yaw without growing vertically.
      parts[i].position.z+=.22*travel;
      parts[i].position.y+=(upper?.16:lower?-.16:0)*travel;
      const phase=(u-clear)/turn;
      const twist=phase<=.5?ease(phase*2):1-ease((phase-.5)*2);
      parts[i].quaternion.setFromAxisAngle(new Vector3(...(upper||lower?[1,0,0]:[0,1,0])),(slot%2?-1:1)*Math.PI*.5*twist);
    }
  }else if(motion.id==='ring'){
    const opened=ease((t-.6)/.7)*(1-ease((t-7.9)/.7));
    const circle=ease((t-1.3)/1.2)*(1-ease((t-6.7)/1.2));
    parts.forEach((p,i)=>{
      p.position.multiplyScalar(1+opened);
      const angle=(ringRank.get(i)-6)*Math.PI*2/PARTS.length;
      p.position.lerp(new Vector3(Math.cos(angle)*RING_RADIUS,Math.sin(angle)*RING_RADIUS,0),circle);
    });
    if(t>=2.8&&t<6.4)rotation[2]=-Math.PI*2*ease((t-2.8)/3.6);
    viewScale=1-.4*opened;
  }else if(motion.id==='wave'){
    const stretch=ease((t-.5)/.8)*(1-ease((t-5.85)/.8));
    IDLE_ORDER.forEach((index,order)=>{
      const u=(t-WAVE_TIMING.start-order*WAVE_TIMING.delay)/WAVE_TIMING.pulse;
      // A compact up/down pulse travels along the original Z; no row reshuffle.
      const lift=u>0&&u<1?.32*Math.sin(u*Math.PI*2)*Math.sin(u*Math.PI)**2:0;
      parts[index].position.x*=1+.2*stretch;
      parts[index].position.y=PARTS[index].home[1]*(1+.32*stretch)+lift;
    });
    viewScale=1-.1*stretch;
  }else if(motion.id==='assembly'){
    parts=assemblyPose(t);
  }else if(motion.id==='sway'){
    const swing=Math.sin(t/motion.duration*Math.PI*2);
    rotation[1]=swing*.17;rotation[2]=swing*.055;
  }else if(motion.id==='tail'&&t>=4.8&&t<=7.2){
    const u=(t-4.8)/2.4;
    const travel=u<.25?ease(u/.25):u<.75?1:1-ease((u-.75)/.25);
    parts[HERO].position.add(new Vector3(1.02,.22,.9).multiplyScalar(travel));
    parts[HERO].quaternion.setFromAxisAngle(new Vector3(0,1,0),Math.PI*2*ease((u-.25)/.5));
  }else if(motion.id==='scatter'){
    if(t>=2&&t<4.4)parts=transitionPose(basePose(),true,t-2);
    else if(t>=4.4&&t<5.8){parts=basePose(true);parts.forEach((p,i)=>p.quaternion.setFromAxisAngle(new Vector3(...PARTS[i].axis),2*Math.PI*ease((t-4.4)/1.4)));}
    else if(t>=5.8&&t<8.2)parts=transitionPose(basePose(true),false,t-5.8);
  }
  return {parts,rotation,viewScale};
}
export function poseClips(){
  return LOGO_MOTIONS.map(m=>{
    const clip=bakeClip(m.clip,m.duration,t=>sampleMotion(m.id,t).parts);
    const times=Array.from({length:m.duration*60+1},(_,i)=>i/60);
    const values=times.flatMap(t=>new Quaternion().setFromEuler(new Euler(...sampleMotion(m.id,t).rotation)).toArray());
    clip.tracks.push(new QuaternionKeyframeTrack('ZSuan_Stepped_Z.quaternion',times,values));
    return clip.optimize();
  });
}
