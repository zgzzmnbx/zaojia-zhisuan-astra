import {Box3,BoxGeometry,BufferGeometry,Float32BufferAttribute,Line,LineBasicMaterial,Group,Mesh,MeshBasicMaterial,Vector3} from 'three';
import {createParkedProjectInfo} from './parked-project-info.mjs';
import {conveyorTimeline} from './conveyor-route.mjs';

// A presentation-only sibling: never enters the task motion/state machine.
export const parkedStations=conveyorTimeline.stations.map(({id,title})=>({id,title}));
const offsets={import:[0,1.6],price:[0,1.6],risk:[0,1.6],report:[-2.2,0],review:[0,-1.6],table:[0,-1.6],knowledge:[-1.6,0]};
export function parkedProjectPose(station='report'){
 const stop=conveyorTimeline.stations.find(item=>item.id===station)??conveyorTimeline.stations.find(item=>item.id==='report');
 const [x,z]=offsets[stop.id];return {station:stop.id,position:[stop.point[0]+x,stop.point[1],stop.point[2]+z]};
}

export function createParkedProject(parent,source,host){
 const info=createParkedProjectInfo(host);
 const root=new Group();root.name='DEMO_PARKED_PROJECT';root.visible=false;parent.add(root);
 const parcel=source.clone(true),materials=[];parcel.name='Static demonstration parcel';
 parcel.position.set(0,0,0);parcel.rotation.set(0,0,0);
 parcel.traverse(object=>{
  if(!object.isMesh)return;
  const copies=[].concat(object.material).map(source=>{
   const material=source.clone();
   materials.push(material);return material;
  });object.material=Array.isArray(object.material)?copies:copies[0];
 });root.add(parcel);
 const bounds=new Box3().setFromObject(parcel);
 const pad=new Mesh(new BoxGeometry(.86,.08,.86),new MeshBasicMaterial({color:'#e5e9ed',toneMapped:false}));
 pad.position.y=bounds.min.y-.04;root.add(pad);
 const badge=new Group();badge.name='Demo project label anchor';badge.position.y=bounds.max.y+.10;root.add(badge);
 const leader=new Line(new BufferGeometry().setAttribute('position',new Float32BufferAttribute(6,3)),new LineBasicMaterial({color:'#a3adb8',depthTest:false,transparent:true,opacity:.8}));leader.renderOrder=998;leader.frustumCulled=false;leader.visible=false;root.add(leader);
 let name='',station='report',pixels=126,labelLift=0;const position=new Vector3(),nearPosition=new Vector3(),projected=new Vector3(),up=new Vector3();
 function configure(value){
  root.visible=value?.enabled===true&&value?.parkedProject===true;
  const pose=parkedProjectPose(value?.parkedStation);station=pose.station;root.position.fromArray(pose.position);
  info?.configure(root.visible,value?.parkedName||'演示项目 B',parkedStations.find(item=>item.id===station)?.title||'报告生成');
  const next=typeof value?.parkedName==='string'?value.parkedName.trim().slice(0,12):'演示项目 B';
  if(next===name)return;name=next||'演示项目 B';pixels=Math.max(126,Array.from(name).length*14+26);

 }
 function update(camera,height,nearParcel,nearLabelPixels=84){
  if(!root.visible)return;root.getWorldPosition(position);
  const h=camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom:2*position.distanceTo(camera.position)*Math.tan(camera.fov*Math.PI/360)/camera.zoom;
  labelLift=0;
  if(nearParcel?.visible){
   nearParcel.getWorldPosition(nearPosition);nearPosition.project(camera);projected.copy(position).project(camera);
   const dx=Math.abs(projected.x-nearPosition.x)*height*(camera.aspect||1)/2,dy=Math.abs(projected.y-nearPosition.y)*height/2;
   if(dx<(pixels+nearLabelPixels)/2+12&&dy<75)labelLift=76;
  }
  badge.position.set(0,bounds.max.y+.10,0);leader.visible=labelLift>0;
  if(labelLift){
   const attr=leader.geometry.attributes.position;attr.setXYZ(0,...badge.position.toArray());
   up.set(0,1,0).applyQuaternion(camera.quaternion).multiplyScalar(h*labelLift/Math.max(1,height));badge.position.add(up);
   attr.setXYZ(1,...badge.position.toArray());attr.needsUpdate=true;
  }
  if(info&&host){
   badge.getWorldPosition(projected);projected.project(camera);
   const width=host.clientWidth,labelHeight=pixels/4;
   info.position((projected.x+1)*width/2-pixels/2,(1-projected.y)*height/2-labelHeight+labelHeight*8/192,pixels,labelHeight*134/192,root.visible&&projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1.1&&Math.abs(projected.y)<1.1);
  }
 }
 return {configure,update,state:()=>({visible:root.visible,name,station,position:root.position.toArray(),palette:'original-illustrative',static:true,labelLift}),dispose(){info?.dispose();root.removeFromParent();leader.geometry.dispose();leader.material.dispose();materials.forEach(m=>m.dispose());pad.geometry.dispose();pad.material.dispose();}};
}
