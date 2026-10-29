import {Vector3} from 'three';
import timeline from '../../../05-视觉识别/02-3D场景/parcel-conveyor-v1/timeline.json' with {type:'json'};

export const conveyorTimeline=timeline;
export const conveyorStations=timeline.stations.map(station=>station.id);

/** The Blender route is already rounded. Use the exact same samples for the belt and the tube. */
export function companionRoute(source=timeline){
 const points=[],cuts=[0];
 for(const leg of source.paths){
  for(const point of leg){const vector=new Vector3(...point);if(!points.length||points.at(-1).distanceToSquared(vector)>1e-10)points.push(vector)}
  cuts.push(points.length-1);
 }
 const offset=points.map((point,index)=>{
  const before=point.clone().sub(points[Math.max(0,index-1)]),after=points[Math.min(points.length-1,index+1)].clone().sub(point);
  before.y=after.y=0;if(before.lengthSq()<1e-10)before.copy(after);if(after.lengthSq()<1e-10)after.copy(before);
  before.normalize();after.normalize();const side1=new Vector3(before.z,0,-before.x),side2=new Vector3(after.z,0,-after.x);
  const side=side1.clone().add(side2).normalize(),miter=Math.min(1.05,(source.companionOffset??.74)/Math.max(.5,side.dot(side1)));
  return point.clone().addScaledVector(side,miter).add(new Vector3(0,.08,0)).toArray();
 });
 return {preRounded:true,speed:4.5,pulseSpacing:14,legs:cuts.slice(0,-1).map((start,index)=>offset.slice(start,cuts[index+1]+1)),stops:source.stations.map((station,index)=>({...station,point:offset[cuts[index]]}))};
}

const lengths=timeline.paths.map(path=>{let length=0;for(let i=1;i<path.length;i++)length+=new Vector3(...path[i]).distanceTo(new Vector3(...path[i-1]));return length});
export const stationDistances=[0];for(const length of lengths)stationDistances.push(stationDistances.at(-1)+length);
export const routeLength=stationDistances.at(-1);

export function routePose(distance){
 const d=Math.max(0,Math.min(routeLength,distance));let leg=Math.max(0,stationDistances.findIndex((stop,index)=>index>0&&stop>=d)-1);
 if(leg<0)leg=lengths.length-1;
 const path=timeline.paths[leg];let remaining=d-stationDistances[leg];
 for(let i=1;i<path.length;i++){
  const a=new Vector3(...path[i-1]),b=new Vector3(...path[i]),segment=a.distanceTo(b);
  if(remaining<=segment||i===path.length-1){const tangent=b.clone().sub(a).normalize();return {position:a.lerp(b,Math.max(0,Math.min(1,remaining/Math.max(segment,1e-6)))),tangent,leg}}
  remaining-=segment;
 }
}

export function whiteParcelDistance(time){
 const t=((time%timeline.duration)+timeline.duration)%timeline.duration;
 const segment=timeline.timeline.find(item=>t<=item.end)??timeline.timeline.at(-1);
 if(segment.kind==='dwell')return stationDistances[segment.station];
 return stationDistances[segment.leg]+(stationDistances[segment.leg+1]-stationDistances[segment.leg])*(t-segment.start)/(segment.end-segment.start);
}
