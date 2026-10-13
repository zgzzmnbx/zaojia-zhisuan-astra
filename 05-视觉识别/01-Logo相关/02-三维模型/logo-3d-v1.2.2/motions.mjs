import {Euler,Quaternion,QuaternionKeyframeTrack,Vector3} from 'three';
import {basePose,transitionPose,ease,HERO,PARTS,bakeClip} from './model.mjs';

import {LOGO_MOTIONS,normalizeMotion} from './motion-options.mjs';
export {LOGO_MOTIONS,normalizeMotion};
export function sampleMotion(id,time){
  const motion=LOGO_MOTIONS.find(m=>m.id===normalizeMotion(id));
  const t=((time%motion.duration)+motion.duration)%motion.duration;
  let parts=basePose();const rotation=[0,0,0];
  if(motion.id==='sway'){
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
  return {parts,rotation};
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
