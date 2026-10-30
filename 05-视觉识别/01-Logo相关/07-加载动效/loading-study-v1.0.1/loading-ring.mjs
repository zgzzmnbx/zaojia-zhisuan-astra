import {sampleMotion} from './motions.mjs';

export const RING_LOADING_DURATION=3;
// Keep the original full Z -> ring -> turn -> Z choreography, only retime it.
export function sampleLoadingRing(time){
 const t=((time%RING_LOADING_DURATION)+RING_LOADING_DURATION)%RING_LOADING_DURATION;
 return sampleMotion('ring',t*10/RING_LOADING_DURATION);
}
