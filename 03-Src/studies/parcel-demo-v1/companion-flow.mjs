import {Group,Vector3} from 'three';
import {createInformationFlow} from '../../studio/project-sandbox/information-flow.js';
// The demo compiler adds a route argument; all shell, pulse and port materials
// remain the exact formal component. No production source file is changed.
export function companionRoute(timeline){
 const points=[],cuts=[0];
 for(const leg of timeline.paths){for(const p of leg){const v=new Vector3(...p);if(!points.length||points.at(-1).distanceToSquared(v)>1e-10)points.push(v)}cuts.push(points.length-1)}
 const offset=points.map((p,i)=>{const before=p.clone().sub(points[Math.max(0,i-1)]),after=points[Math.min(points.length-1,i+1)].clone().sub(p);before.y=after.y=0;if(before.lengthSq()<1e-10)before.copy(after);if(after.lengthSq()<1e-10)after.copy(before);before.normalize();after.normalize();const side1=new Vector3(before.z,0,-before.x),side2=new Vector3(after.z,0,-after.x),side=side1.clone().add(side2).normalize(),miter=Math.min(1.05,(timeline.companionOffset??.74)/Math.max(.5,side.dot(side1)));return p.clone().addScaledVector(side,miter).add(new Vector3(0,.08,0)).toArray()});
 const legs=cuts.slice(0,-1).map((start,i)=>offset.slice(start,cuts[i+1]+1));
 return {preRounded:true,speed:4.5,pulseSpacing:14,legs,stops:timeline.stations.map((s,i)=>({...s,point:offset[cuts[i]]}))};
}
export function createCompanionFlow(parent,timeline){
 const group=new Group();group.name='Original information flow alongside conveyor';parent.add(group);
 const route=companionRoute(timeline),flow=createInformationFlow(group,route);flow.setStage(null);flow.setNight(false);let clock=0;
 const shell=()=>{let material;group.traverse(o=>{if(o.userData.informationFlowShell)material=o.material});return {type:material.type,color:material.color.getHexString(),opacity:material.opacity,roughness:material.roughness,metalness:material.metalness,transparent:material.transparent}};
 return {tick(delta,moving){if(flow.getState().playing!==moving)flow.setPlaying(moving);if(moving)clock+=delta*1000;flow.tick(clock)},state:()=>({...flow.getState(),clock,shell:shell(),source:'formal information-flow.js',route:route.legs.map(p=>[p[0],p.at(-1)])}),dispose(){flow.setPlaying(false);const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?[].concat(o.material):[])materials.add(m)});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.removeFromParent()}};
}
