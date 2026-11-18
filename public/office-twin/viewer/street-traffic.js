import {CatmullRomCurve3,Vector2,Vector3,Vector4} from 'three';

// The drop-off lane passes the crossing. The return lane stays between the
// front tree rows, with space to turn at each end of the paved forecourt.
const route=[
  [-24,35.6],[-13.4,35.6],[0,35.6],[14.8,35.6],[25,35.6],[29.6,35.9],
  [33.1,38.3],[33.7,42.4],[31.4,45.7],[27.4,46.5],[24,44.2],[20.5,42.1],
  [12,41.7],[-6,41.7],[-20.3,41.9],[-24.1,44.2],[-28,46.1],[-31.7,45.4],
  [-34.1,42.5],[-33.9,38.7],[-31.1,36.1]
];

function buildLane(){
  const curve=new CatmullRomCurve3(route.map(([x,z])=>new Vector3(x,0,z)),true);
  curve.arcLengthDivisions=600;
  const points=curve.getSpacedPoints(512), headings=[], times=[0];
  const count=points.length-1;
  for(let i=0;i<count;i++){
    headings.push(points[(i+1)%count].clone().sub(points[(i+count-1)%count]).normalize());
    const {x,z}=points[i];
    const atCrossing=z<38 && Math.abs(x)<10;
    const speed=atCrossing ? .95+1.45*Math.min(1,Math.max(0,(Math.abs(x)-3.8)/6.2))
      :2.4-.83*Math.min(1,Math.max(0,(Math.abs(x)-22)/7));
    times.push(times[i]+points[i].distanceTo(points[i+1])/speed);
  }
  headings.push(headings[0]);
  return {points,headings,times,duration:times[count]};
}

export function createStreetTraffic(root){
  const cars=[];
  root?.traverse(node=>{if(node.userData?.trafficVehicle)cars.push(node);});
  if(!cars.length)return null;
  const lane=buildLane(), count=lane.points.length-1;
  const poses=cars.map(()=>new Vector4()),sizes=cars.map(car=>new Vector2(...car.userData.trafficVehicle.halfSize));
  const states=cars.map(car=>{
    let index=0;
    for(let i=1;i<count;i++){
      const d=lane.points[i].distanceToSquared(car.position);
      if(d<lane.points[index].distanceToSquared(car.position))index=i;
    }
    return {index,time:lane.times[index]};
  });
  const direction=new Vector3();
  function step(seconds){
    cars.forEach((car,i)=>{
      const state=states[i];
      state.time=(state.time+seconds)%lane.duration;
      if(state.time<lane.times[state.index])state.index=0;
      while(state.index<count-1 && lane.times[state.index+1]<=state.time)state.index++;
      const j=state.index, t=(state.time-lane.times[j])/(lane.times[j+1]-lane.times[j]);
      const from=lane.points[j],to=lane.points[j+1];
      car.position.x=from.x+(to.x-from.x)*t;
      car.position.z=from.z+(to.z-from.z)*t;
      direction.lerpVectors(lane.headings[j],lane.headings[j+1],t).normalize();
      car.rotation.y=-Math.atan2(direction.z,direction.x);
      car.updateMatrix();
      poses[i].set(car.position.x,car.position.z,direction.x,direction.z);
    });
  }
  step(0);
  return {step,poses:{value:poses},sizes:{value:sizes},count:cars.length,
    positions:()=>poses.map(p=>[p.x,p.y])};
}
