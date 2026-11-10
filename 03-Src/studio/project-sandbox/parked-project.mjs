import {Box3,BoxGeometry,BufferGeometry,Float32BufferAttribute,Line,LineBasicMaterial,CanvasTexture,Group,Mesh,MeshBasicMaterial,Sprite,SpriteMaterial,SRGBColorSpace,Vector3} from 'three';
import {conveyorTimeline} from './conveyor-route.mjs';

// A presentation-only sibling: never enters the task motion/state machine.
export const parkedStations=conveyorTimeline.stations.map(({id,title})=>({id,title}));
const offsets={import:[0,1.15],price:[0,1.15],risk:[0,1.15],report:[0,-1.15],review:[0,-1.15],table:[0,-1.15],knowledge:[-1.15,0]};
export function parkedProjectPose(station='report'){
 const stop=conveyorTimeline.stations.find(item=>item.id===station)??conveyorTimeline.stations.find(item=>item.id==='report');
 const [x,z]=offsets[stop.id];return {station:stop.id,position:[stop.point[0]+x,stop.point[1],stop.point[2]+z]};
}

export function createParkedProject(parent,source){
 const root=new Group();root.name='DEMO_PARKED_PROJECT';root.visible=false;parent.add(root);
 const parcel=source.clone(true),materials=[];parcel.name='Static demonstration parcel';
 parcel.position.set(0,0,0);parcel.rotation.set(0,0,0);
 parcel.traverse(object=>{
  if(!object.isMesh)return;
  const copies=[].concat(object.material).map(source=>{
   const material=source.clone(),strap=/enamel/i.test(source.name);
   material.color.set(strap?'#fff3d9':/Porcelain/i.test(source.name)||object.name==='Parcel_lid'?'#bc702e':'#f4d1a0');
   if(material.emissive){material.emissive.set('#985523');material.emissiveIntensity=.12;}
   materials.push(material);return material;
  });object.material=Array.isArray(object.material)?copies:copies[0];
 });root.add(parcel);
 const bounds=new Box3().setFromObject(parcel);
 const pad=new Mesh(new BoxGeometry(.86,.08,.86),new MeshBasicMaterial({color:'#d0a16c',toneMapped:false}));
 pad.position.y=bounds.min.y-.04;root.add(pad);
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;
 const ctx=canvas.getContext('2d'),texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
 const badge=new Sprite(new SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
 badge.name='Demo project name';badge.center.set(.5,0);badge.position.y=bounds.max.y+.10;badge.renderOrder=999;root.add(badge);
 const leader=new Line(new BufferGeometry().setAttribute('position',new Float32BufferAttribute(6,3)),new LineBasicMaterial({color:'#b47c42',depthTest:false,transparent:true,opacity:.8}));leader.renderOrder=998;leader.frustumCulled=false;leader.visible=false;root.add(leader);
 let name='',station='report',pixels=126,labelLift=0;const position=new Vector3(),nearPosition=new Vector3(),projected=new Vector3(),up=new Vector3();
 function configure(value){
  root.visible=value?.enabled===true&&value?.parkedProject===true;
  const pose=parkedProjectPose(value?.parkedStation);station=pose.station;root.position.fromArray(pose.position);
  const next=typeof value?.parkedName==='string'?value.parkedName.trim().slice(0,12):'演示项目 B';
  if(next===name)return;name=next||'演示项目 B';pixels=Math.max(126,Array.from(name).length*14+26);
  ctx.clearRect(0,0,768,192);ctx.fillStyle='#744419';ctx.strokeStyle='#ffe4bc';ctx.lineWidth=5;
  ctx.beginPath();ctx.roundRect(8,8,752,134,28);ctx.fill();ctx.stroke();
  ctx.font='600 84px "PingFang SC","Microsoft YaHei",sans-serif';ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,384,78,702);
  ctx.strokeStyle='#d0a16c';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(384,144);ctx.lineTo(384,189);ctx.stroke();texture.needsUpdate=true;
 }
 function update(camera,height,nearParcel){
  if(!root.visible)return;root.getWorldPosition(position);
  const h=camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom:2*position.distanceTo(camera.position)*Math.tan(camera.fov*Math.PI/360)/camera.zoom;
  badge.scale.set(h*pixels/Math.max(1,height),h*pixels/4/Math.max(1,height),1);
  labelLift=0;
  if(nearParcel?.visible){
   nearParcel.getWorldPosition(nearPosition);nearPosition.project(camera);projected.copy(position).project(camera);
   const dx=Math.abs(projected.x-nearPosition.x)*height*(camera.aspect||1)/2,dy=Math.abs(projected.y-nearPosition.y)*height/2;
   if(dx<(pixels+84)/2+12&&dy<75)labelLift=76;
  }
  badge.position.set(0,bounds.max.y+.10,0);leader.visible=labelLift>0;
  if(labelLift){
   const attr=leader.geometry.attributes.position;attr.setXYZ(0,...badge.position.toArray());
   up.set(0,1,0).applyQuaternion(camera.quaternion).multiplyScalar(h*labelLift/Math.max(1,height));badge.position.add(up);
   attr.setXYZ(1,...badge.position.toArray());attr.needsUpdate=true;
  }
 }
 return {configure,update,state:()=>({visible:root.visible,name,station,position:root.position.toArray(),palette:'amber',static:true,labelLift}),dispose(){root.removeFromParent();leader.geometry.dispose();leader.material.dispose();materials.forEach(m=>m.dispose());pad.geometry.dispose();pad.material.dispose();badge.material.dispose();texture.dispose();}};
}
