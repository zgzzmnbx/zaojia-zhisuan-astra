import {conveyorStations,stationDistances} from './conveyor-route.mjs';

/** One-way projection of existing task activity; it never changes business state. */
export function createTaskParcelMotion(){
 let scope='',job='',key='',initialized=false,visible=false,phase='idle',distance=0,target=0;
 function state(){return {visible,phase,distance,target,zone:visible?conveyorStations[stationDistances.indexOf(target)]??null:null}}
 function update(input){
  let changed=false;const nextScope=input?.scope??'',nextJob=input?.job??'',activity=input?.activity??null;
  if(nextScope!==scope||nextJob!==job){scope=nextScope;job=nextJob;key='';initialized=false;visible=false;phase='idle';distance=target=0;changed=true}
  if(!input?.ready){initialized=false;visible=false;phase='idle';distance=target=0;return true}
  const zone=activity?.phase==='running'?activity.zone:input?.running;
  if(!initialized){initialized=true;if(zone&&conveyorStations.includes(zone)){distance=target=stationDistances[conveyorStations.indexOf(zone)];visible=true;phase='running';key=`${scope}:${job}:${activity?.run??0}:${zone}`}return true}
  if(activity?.phase==='error'||activity?.phase==='cancelled'){phase=activity.phase;target=distance;return true}
  if(!zone||!conveyorStations.includes(zone))return changed;
  const nextKey=`${scope}:${job}:${activity?.run??0}:${zone}`;if(nextKey===key)return changed;
  key=nextKey;target=stationDistances[conveyorStations.indexOf(zone)];visible=true;phase='running';return true;
 }
 function tick(delta,reduced){if(!visible)return false;
  if(reduced){const changed=distance!==target;distance=target;return changed}
  if(Math.abs(target-distance)<=1e-4)return false;
  const step=Math.min(Math.abs(target-distance),Math.max(0,delta)*5.5);distance+=Math.sign(target-distance)*step;return step>0;
 }
 return {update,tick,state};
}
