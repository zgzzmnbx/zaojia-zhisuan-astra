import {Vector3} from 'three';
import {basePose,PARTS,ease} from './model.mjs';

export const CONVERSATION_SETTLED=2.55;
export const CONVERSATION_CYCLE=2.85;
export const CONVERSATION_FINISH=2.72;
const axes=PARTS.map((part,i)=>new Vector3(...part.axis).add(new Vector3(.18,.35,i%2?.12:-.12)).normalize());

export function advanceConversationTime(time,delta,finishing){
  const step=Math.max(0,Math.min(delta,.2));
  const remaining=Math.max(0,CONVERSATION_FINISH-time%CONVERSATION_CYCLE);
  return time+(finishing?Math.min(step,remaining):step);
}

// Leave a gap between neighbouring cubes before turning them on their own axes.
export function sampleConversationLoading(time){
  const t=((time%CONVERSATION_CYCLE)+CONVERSATION_CYCLE)%CONVERSATION_CYCLE;
  const parts=basePose();
  if(t===0||t>=CONVERSATION_SETTLED)return {parts,rotation:[0,0,0]};
  const turn=ease((t-.78)/1.05);
  parts.forEach((part,i)=>{
    const delay=Math.abs(PARTS[i].home[0])*.045;
    const open=ease((t-.08-delay)/.55)*(1-ease((t-1.83-delay)/.63));
    part.position.x*=1+.52*open;
    part.position.y*=1+.09*open;
    part.position.z+=((i%3)-1)*.35*open;
    part.quaternion.setFromAxisAngle(axes[i],(i%2?-1:1)*2*Math.PI*turn);
  });
  return {parts,rotation:[0,.24*Math.sin(Math.PI*turn),0]};
}
