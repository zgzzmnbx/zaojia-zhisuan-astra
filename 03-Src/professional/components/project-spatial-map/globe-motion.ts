export type GlobeCamera={lng:number;lat:number;zoom:number};
export type TourPhase='intro'|'cruise'|'return';
export type GlobeTour={phase:TourPhase;elapsed:number;camera:GlobeCamera;from:GlobeCamera};
export const EARTH_VIEW:GlobeCamera={lng:65,lat:14,zoom:.8};
export const CHINA_VIEW:GlobeCamera={lng:108,lat:32,zoom:2.7};
export const INTRO_MS=4200,RETURN_MS=5200;
export function createGlobeTour():GlobeTour{return {phase:'intro',elapsed:0,camera:{...EARTH_VIEW},from:{...EARTH_VIEW}};}
export function returnToChina(camera:GlobeCamera):GlobeTour{return {phase:'return',elapsed:0,camera:{...camera},from:{...camera}};}
const smooth=(t:number)=>t*t*t*(t*(t*6-15)+10);
function blend(a:GlobeCamera,b:GlobeCamera,t:number):GlobeCamera{const p=smooth(Math.min(1,t));return {lng:a.lng+(b.lng-a.lng)*p,lat:a.lat+(b.lat-a.lat)*p,zoom:a.zoom+(b.zoom-a.zoom)*p};}
/** Time is visible-frame time, never wall time. Hidden gaps cannot advance a tour. */
export function advanceGlobeTour(tour:GlobeTour,delta:number,chinaVisible:boolean):GlobeTour{
  const dt=Math.max(0,Math.min(64,delta)),elapsed=tour.elapsed+dt;
  if(tour.phase==='intro'||tour.phase==='return'){
    const duration=tour.phase==='intro'?INTRO_MS:RETURN_MS;
    const camera=blend(tour.from,CHINA_VIEW,elapsed/duration);
    if(elapsed>=duration)return {phase:'cruise',elapsed:0,camera:{...CHINA_VIEW},from:{...CHINA_VIEW}};
    return {...tour,elapsed,camera};
  }
  // Gentle acceleration after arrival; turn back before the China focus leaves
  // the usable canvas. The angle cap also protects the globe's far hemisphere.
  const speed=.00075*smooth(Math.min(1,elapsed/2400));
  const camera={...tour.camera,lng:tour.camera.lng+dt*speed};
  if((!chinaVisible&&camera.lng-CHINA_VIEW.lng>8)||camera.lng-CHINA_VIEW.lng>=68)return returnToChina(camera);
  return {...tour,elapsed,camera};
}
