export type OrbitMotion={speed:number;acceleration:number};
export function normalizeOrbitMotion(raw:unknown):OrbitMotion{
 const v=(raw&&typeof raw==='object'?raw:{}) as Partial<OrbitMotion>;
 const value=(key:keyof OrbitMotion,max:number)=>typeof v[key]==='number'&&Number.isFinite(v[key])?Math.max(25,Math.min(max,v[key]!)):100;
 return {speed:value('speed',200),acceleration:value('acceleration',300)};
}

/** Sine velocity ramps with optional cruise. Default is the original cosine sweep.
 * A short 30-degree run may reach the braking point before the selected speed cap. */
export function orbitSweepAngle(seconds:number,motion:OrbitMotion):number{
 const distance=30,acceleration=15*.182**2*motion.acceleration/100;
 const speed=Math.min(2.73*motion.speed/100,Math.sqrt(distance*acceleration/2));
 const frequency=acceleration/speed,rampTime=Math.PI/(2*frequency),rampDistance=speed/frequency;
 const cruiseTime=Math.max(0,(distance-2*rampDistance)/speed),halfTime=2*rampTime+cruiseTime;
 const phase=seconds%(2*halfTime),returning=phase>=halfTime,t=returning?phase-halfTime:phase;
 const x=t<rampTime?rampDistance*(1-Math.cos(frequency*t)):
  t<rampTime+cruiseTime?rampDistance+speed*(t-rampTime):
  distance-rampDistance*(1-Math.cos(frequency*(halfTime-t)));
 return (returning?distance-x:x)*Math.PI/180;
}

export function createOrbitSweep(){
 let time=0,angle=0,key='';
 return {
  reset(){time=0;angle=0;key=''},
  step(delta:number,motion:OrbitMotion){
   const next=`${motion.speed}/${motion.acceleration}`;
   // New settings restart gently from the current camera, never jump to a new angle.
   if(next!==key){time=0;angle=0;key=next}
   time+=Math.max(0,delta);const nextAngle=orbitSweepAngle(time,motion),change=nextAngle-angle;angle=nextAngle;return change;
  },
 };
}
