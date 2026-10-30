import {sampleMotion} from './motions.mjs';
import {ease} from './model.mjs';

export const RING_LOADING_DURATION=3;
// Preserve opening geometry; replace the fast full turn with a gentle quarter turn.
// Reunion takes .95s (previously .57s), followed by .4s at the assembled Z.
export function sampleLoadingRing(time){
 const t=((time%RING_LOADING_DURATION)+RING_LOADING_DURATION)%RING_LOADING_DURATION;
 if(t<.75)return sampleMotion('ring',t*10/3);
 if(t<1.65){
  const pose=sampleMotion('ring',2.5);
  pose.rotation[2]=-Math.PI/2*ease((t-.75)/.9);
  return pose;
 }
 if(t<2.6){
  const u=(t-1.65)/.95,pose=sampleMotion('ring',6.7+1.9*u);
  pose.rotation[2]=-Math.PI/2*(1-ease(u));
  return pose;
 }
 return sampleMotion('static',0);
}
