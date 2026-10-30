import {Vector3} from 'three';
import {conveyorTimeline} from './conveyor-route.mjs';

/** Data light recessed in the new fascia; the parcel centerline stays immutable. */
export function fasciaRoute(source=conveyorTimeline){
 const points=[],cuts=[0];
 for(const leg of source.paths){
  for(const point of leg){const vector=new Vector3(...point);if(!points.length||points.at(-1).distanceToSquared(vector)>1e-10)points.push(vector)}
  cuts.push(points.length-1);
 }
 const offset=points.map((point,index)=>{
  const tangent=points[Math.min(points.length-1,index+1)].clone().sub(points[Math.max(0,index-1)]);tangent.y=0;tangent.normalize();
  return point.clone().addScaledVector(new Vector3(tangent.z,0,-tangent.x),-.416).add(new Vector3(0,-.150,0)).toArray();
 });
 return {preRounded:true,speed:4.5,pulseSpacing:14,legs:cuts.slice(0,-1).map((start,index)=>offset.slice(start,cuts[index+1]+1)),stops:source.stations.map((station,index)=>({...station,point:offset[cuts[index]]}))};
}
