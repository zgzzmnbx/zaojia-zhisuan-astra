import {BoxGeometry,CylinderGeometry,Mesh,MeshStandardMaterial,Quaternion,Raycaster,Vector3} from 'three';

/** A screen-facing sign with a fixed roof joint. Pixels stay readable when zoomed out. */
export function roofSignPose(camera,foot,width,height,viewportHeight){
 const depth=-foot.clone().applyMatrix4(camera.matrixWorldInverse).z;
 const pixelsPerUnit=viewportHeight*camera.projectionMatrix.elements[5]/(2*Math.max(.1,depth));
 const scale=Math.max(1,Math.min(1.25,pixelsPerUnit*.045));
 const worldWidth=width*scale/pixelsPerUnit,worldHeight=height*scale/pixelsPerUnit;
 const quaternion=camera.getWorldQuaternion(new Quaternion());
 const center=foot.clone().add(new Vector3(0,worldHeight/2,0).applyQuaternion(quaternion));
 return {center,quaternion,worldWidth,worldHeight,scale,depth};
}

export function createRoofLabels(scene,zones){
 const box=new BoxGeometry(1,1,1),cylinder=new CylinderGeometry(.035,.055,1,8);
 const plateMaterial=new MeshStandardMaterial({color:0xeaf4fc,roughness:.65,metalness:.08});
 const supportMaterial=new MeshStandardMaterial({color:0x79afce,roughness:.7,metalness:.05});
 const labels=new Map(zones.map(zone=>{
  const plate=new Mesh(box,plateMaterial),post=new Mesh(cylinder,supportMaterial),base=new Mesh(box,supportMaterial);
  plate.name=`Roof sign ${zone.id}`;post.name=`Roof sign support ${zone.id}`;
  scene.add(plate,post,base);plate.visible=post.visible=base.visible=false;
  return [zone.id,{plate,post,base,foot:new Vector3(...zone.anchor),roof:new Vector3(...zone.anchor)}];
 }));
 return {
  attach(model){
   model.updateMatrixWorld(true);
   for(const zone of zones){
    const entry=labels.get(zone.id);
    const ray=new Raycaster(new Vector3(zone.anchor[0],60,zone.anchor[2]),new Vector3(0,-1,0));
    const hit=ray.intersectObject(model,true).find(hit=>{let owner=hit.object;while(owner&&!owner.userData.zone)owner=owner.parent;return owner?.userData.zone===zone.id});
    if(hit)entry.roof.copy(hit.point);
    entry.foot.copy(entry.roof).add(new Vector3(0,1.15,0));
    entry.post.position.copy(entry.roof).add(new Vector3(0,.575,0));entry.post.scale.y=1.15;
    entry.base.position.copy(entry.roof).add(new Vector3(0,.04,0));entry.base.scale.set(.4,.08,.3);
   }
  },
  update(id,camera,w,h,viewportHeight,enabled,dark){
   const entry=labels.get(id);
   const pose=roofSignPose(camera,entry.foot,w,h,viewportHeight);
   const visible=enabled&&pose.depth>camera.near;
   entry.plate.visible=entry.post.visible=entry.base.visible=visible;
   if(visible){entry.plate.position.copy(pose.center);entry.plate.quaternion.copy(pose.quaternion);entry.plate.scale.set(pose.worldWidth,pose.worldHeight,.045);}
   plateMaterial.color.set(dark?0x183246:0xeaf4fc);supportMaterial.color.set(dark?0x299bdc:0x79afce);
   return {...pose,foot:entry.foot,roof:entry.roof};
  },
  hide(){for(const e of labels.values())e.plate.visible=e.post.visible=e.base.visible=false;},
  state(){return [...labels].map(([id,e])=>({id,roof:e.roof.toArray(),foot:e.foot.toArray(),quaternion:e.plate.quaternion.toArray(),visible:e.plate.visible}))},
  dispose(){for(const e of labels.values())scene.remove(e.plate,e.post,e.base);box.dispose();cylinder.dispose();plateMaterial.dispose();supportMaterial.dispose();},
 };
}
