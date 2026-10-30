import {sampleMotion} from './motions.mjs';

// Re-time the existing wave: quick opening, wave, reunion, then a short rest.
export const LOADING_TIMING={open:.2,wave:2.275,close:.3,rest:.5};
export const MOTION_DURATION=LOADING_TIMING.open+LOADING_TIMING.wave+LOADING_TIMING.close;
export const LOADING_DURATION=MOTION_DURATION+LOADING_TIMING.rest;
export function sampleLoadingWave(time){
 const t=((time%LOADING_DURATION)+LOADING_DURATION)%LOADING_DURATION;
 if(t>=MOTION_DURATION)return sampleMotion('static',0);
 let source;
 if(t<LOADING_TIMING.open)source=.5+t/LOADING_TIMING.open*.8;
 else if(t<LOADING_TIMING.open+LOADING_TIMING.wave)source=1.3+(t-LOADING_TIMING.open)/LOADING_TIMING.wave*4.55;
 else source=5.85+(t-LOADING_TIMING.open-LOADING_TIMING.wave)/LOADING_TIMING.close*.8;
 return sampleMotion('wave',source);
}
