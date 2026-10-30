import {Vector3,Quaternion} from 'three';
import {basePose,ease,blendPose,PARTS} from './model.mjs';
import {sampleMotion,IDLE_ORDER} from './motions.mjs';

export const DURATIONS={pulse:2.6,orbit:4};
const rank=new Map(IDLE_ORDER.map((id,i)=>[id,i]));
export function loadingPose(kind,time){
 if(kind==='pulse'){
  const phase=((time%2.6)+2.6)%2.6/2.6;
  const powers=PARTS.map((_,i)=>{const distance=Math.abs((rank.get(i)/13-phase+1.5)%1-.5);return Math.exp(-distance*distance/.009);});
  // Keep the silhouette intact: light, not fake percentage or changing geometry.
  return {parts:basePose(),powers,scale:1,rotation:[0,0,0]};
 }
 if(time<1.2){
  const pose=sampleMotion('ring',.6+time/1.2*1.9);
  return {...pose,powers:PARTS.map(()=>.12),scale:pose.viewScale};
 }
 const angle=-(time-1.2)/4*Math.PI*2,pose=sampleMotion('ring',2.5);
 const q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),angle);
 pose.parts.forEach(p=>p.position.applyQuaternion(q));
 return {parts:pose.parts,powers:PARTS.map((_,i)=>.12+.65*Math.max(0,Math.sin(angle+i*Math.PI*2/13))**4),scale:.6,rotation:[0,0,0]};
}
export function finishPose(from,elapsed){
 const u=ease(elapsed/.95);
 if(from.kind==='orbit'&&from.time<1.2){
  const p=sampleMotion('ring',.6+from.time/1.2*1.9*(1-u));
  return {...p,scale:p.viewScale,powers:PARTS.map(()=>.12*(1-u))};
 }
 // Reverse the collision-free opening path after aligning the ring. Keep cubes rigid.
 if(from.kind==='orbit'&&from.time>=1.2){
  const raw=-(from.time-1.2)/4*Math.PI*2,angle=((raw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
  if(elapsed<.42){
   const p=loadingPose('orbit',from.time),q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-angle*ease(elapsed/.42));
   p.parts.forEach(part=>part.position.applyQuaternion(q));return {...p,powers:p.powers.map(v=>v*(1-u))};
  }
  const p=sampleMotion('ring',2.5-ease((elapsed-.42)/.95)*1.9);
  return {...p,scale:p.viewScale,powers:PARTS.map(()=>0)};
 }
 return {parts:blendPose(from.pose.parts,basePose(),u),powers:from.pose.powers.map(v=>v*(1-u)),scale:from.pose.scale+(1-from.pose.scale)*u,rotation:[0,0,0]};
}
