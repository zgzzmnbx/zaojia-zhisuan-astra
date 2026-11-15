// Presentation-only motion; never derives or changes a review task's business state.
export function seatFacing(position,target,fallback=0){
  if(!target)return fallback;
  const dx=target[0]-position[0],dz=target[2]-position[2];
  return Math.hypot(dx,dz)>.01?Math.atan2(dx,dz):fallback;
}
export function createPersonClock(){
  let seconds=0,last=null;
  return {step(now,enabled){
    if(!enabled){last=null;return seconds;}
    if(last!==null)seconds+=Math.min(.05,Math.max(0,(now-last)/1000));
    last=now;return seconds;
  },suspend(){last=null;},value:()=>seconds};
}
export function seatedMotion(seconds,phase=0){
  const t=seconds+phase,cycle=((t%14)+14)%14;
  const smooth=x=>{const y=Math.max(0,Math.min(1,x));return y*y*(3-2*y);};
  const typing=smooth(cycle/.7)*(1-smooth((cycle-7.3)/.7));
  return {mode:cycle<8?'typing':'reading',
    leftTap:.009*typing*Math.sin(t*8.2),rightTap:.009*typing*Math.sin(t*8.2+2.2),
    headPitch:.025+.065*typing+.008*Math.sin(t*.65),headYaw:.035*Math.sin(t*.43),
    breath:.003*Math.sin(t*1.3)};
}
