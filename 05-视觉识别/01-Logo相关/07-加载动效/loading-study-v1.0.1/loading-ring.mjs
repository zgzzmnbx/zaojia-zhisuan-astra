import {sampleMotion} from './motions.mjs';
import {ease} from './model.mjs';

export const RING_LOADING_DURATION=3.8;
// Preserve opening geometry; complete one full turn over 1.5 seconds.
// Reunion takes .95s (previously .57s), followed by .4s at the assembled Z.
export function sampleLoadingRing(time){
 const t=((time%RING_LOADING_DURATION)+RING_LOADING_DURATION)%RING_LOADING_DURATION;
 if(t<.95)return sampleMotion('ring',t*2.5/.95);
 if(t<2.45){
  const pose=sampleMotion('ring',2.5);
  pose.rotation[2]=-Math.PI*2*ease((t-.95)/1.5);
  return pose;
 }
 if(t<3.4){
  const u=(t-2.45)/.95,pose=sampleMotion('ring',6.7+1.9*u);
  pose.rotation[2]=-Math.PI*2;
  return pose;
 }
 return sampleMotion('static',0);
}
