import * as THREE from 'three';

export const REVIEW_ROOM_ID='R_N';
export function pointInBounds(point,bounds,margin=0){return point.x>=bounds[0]+margin&&point.x<=bounds[2]-margin&&point.z>=bounds[1]+margin&&point.z<=bounds[3]-margin;}
export function nearestFreePoint(points,point,occupied=[],clearance=.72){
  let result=null,distance=Infinity;
  for(const p of points){if(occupied.some(o=>Math.hypot(o.x-p.x,o.z-p.z)<clearance))continue;const d=Math.hypot(p.x-point.x,p.z-point.z);if(d<distance){result=p;distance=d;}}
  return result;
}

// Bounds come from the final loaded furniture, including its named batching
// sources. Old plan furniture does not describe the merged 17m meeting table.
export function createPlacementSurface({model,floor,layout}){
  const office=model.getObjectByName('H1_F09_Office'),grounds=[],obstacles=[];
  const inverse=new THREE.Matrix4(),bounds=new THREE.Box3(),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  model.updateMatrixWorld(true);inverse.copy(floor.matrixWorld).invert();
  const anchor=office.getObjectByName('PersonAnchor_SEAT_SW_08')||office.getObjectByProperty('type','Object3D');
  const feet=anchor?floor.worldToLocal(anchor.getWorldPosition(new THREE.Vector3())).y:.05;
  office.traverse(node=>{
    if(!node.isMesh||node.userData.staticBatch||!node.geometry)return;
    for(let p=node;p&&p!==floor;p=p.parent)if(p.visible===false&&!p.userData.staticBatchSource)return;
    // GLTFLoader splits multi-material baked floors into unnamed child meshes.
    for(let p=node;p&&p!==office;p=p.parent)if(p.name==='H1_F09_floor_slab'||/_floor$/.test(p.name)){grounds.push(node);return;}
    node.geometry.computeBoundingBox();bounds.copy(node.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld));
    if(bounds.max.y>feet+.12&&bounds.min.y<feet+1.9)obstacles.push([bounds.min.x,bounds.min.z,bounds.max.x,bounds.max.z]);
  });
  const core=office.getObjectByName('Core_floor');
  if(core){bounds.setFromObject(core).applyMatrix4(inverse);if(!bounds.isEmpty())obstacles.push([bounds.min.x,bounds.min.z,bounds.max.x,bounds.max.z]);}
  const scale=layout.metadata.recommended_px_per_m,[ox,oz]=layout.metadata.recommended_world_origin_px;
  const room=layout.rooms.find(r=>r.id===REVIEW_ROOM_ID),roomBounds=room.bounds_px.map((v,i)=>(v-(i%2?oz:ox))/scale);
  function supported(x,z){
    const origin=floor.localToWorld(new THREE.Vector3(x,feet+.3,z));ray.set(origin,down);ray.near=0;ray.far=.7;
    return ray.intersectObjects(grounds,false).some(hit=>Math.abs(floor.worldToLocal(hit.point.clone()).y-feet)<.16);
  }
  function clear(point,occupied=[]){
    return !obstacles.some(b=>pointInBounds(point,b,-.3))&&!occupied.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<.72)&&supported(point.x,point.z);
  }
  const meetingSpots=[];
  for(let x=roomBounds[0]+.4;x<roomBounds[2]-.4;x+=.4)for(let z=roomBounds[1]+.4;z<roomBounds[3]-.4;z+=.4){const p={x,z};if(clear(p))meetingSpots.push(p);}
  function resolve(pointerRay,occupied=[]){
    floor.updateWorldMatrix(true,false);
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-floor.localToWorld(new THREE.Vector3(0,feet,0)).y);
    const hit=pointerRay.ray.intersectPlane(plane,new THREE.Vector3());if(!hit)return null;
    const local=floor.worldToLocal(hit),meeting=pointInBounds(local,roomBounds);
    const spot=meeting?nearestFreePoint(meetingSpots,local,occupied):clear(local,occupied)?{x:local.x,z:local.z}:null;
    return {valid:!!spot,meeting,x:spot?.x??local.x,y:feet,z:spot?.z??local.z,roomId:meeting?REVIEW_ROOM_ID:null};
  }
  return {resolve,feet,roomBounds,meetingSpots,grounds,obstacles,
    meetingSpot:occupied=>{const p=nearestFreePoint(meetingSpots,{x:(roomBounds[0]+roomBounds[2])/2,z:roomBounds[3]},occupied);return p?{...p,y:feet,roomId:REVIEW_ROOM_ID,meeting:true,valid:true}:null;},
    meetingYaw:p=>Math.atan2((roomBounds[0]+roomBounds[2])/2-p.x,(roomBounds[1]+roomBounds[3])/2-p.z),
  };
}
export function createPersonPlacement({model,floor,layout,viewport,requestFrame}){
  const surface=createPlacementSurface({model,floor,layout}),{feet,roomBounds,meetingSpots,grounds,obstacles,resolve}=surface;
  const ring=new THREE.Mesh(new THREE.RingGeometry(.29,.36,40),new THREE.MeshBasicMaterial({color:0x298fd7,transparent:true,opacity:.9,depthWrite:false,depthTest:false,toneMapped:false}));
  ring.rotation.x=-Math.PI/2;ring.renderOrder=100;ring.visible=false;floor.add(ring);
  const edgePoints=[[roomBounds[0]+.2,roomBounds[1]+.2],[roomBounds[2]-.2,roomBounds[1]+.2],[roomBounds[2]-.2,roomBounds[3]-.2],[roomBounds[0]+.2,roomBounds[3]-.2]].map(([x,z])=>new THREE.Vector3(x,feet+.045,z));
  const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(edgePoints),new THREE.LineBasicMaterial({color:0x298fd7,transparent:true,opacity:.35,depthWrite:false,toneMapped:false}));floor.add(outline);
  const label=document.createElement('span');label.className='office-review-zone-label';label.textContent='多人复核区';viewport.append(label);
  const feedback=document.createElement('span');feedback.className='office-placement-feedback';feedback.setAttribute('role','status');feedback.hidden=true;viewport.append(feedback);
  let feedbackPoint=null,lastHint=null;
  function hint(target,canReview=true){
    lastHint=target;ring.visible=!!target;feedback.hidden=!target;
    if(target){ring.position.set(target.x,feet+.055,target.z);ring.material.color.set(target.valid?target.meeting?0x284bd4:0x1fa67a:0xd54d50);feedback.textContent=!target.valid?'此处不能落脚':target.meeting?(canReview?'松开，加入多人复核':'松开，放到会议室'):'松开，放到这里';feedbackPoint=new THREE.Vector3(target.x,feet+.1,target.z);}
    requestFrame();
  }
  function update(camera,view){
    const visible=['office','exploded'].includes(view);outline.visible=visible;label.hidden=!visible;ring.visible=visible&&!!lastHint;feedback.hidden=!visible||!lastHint;
    const position=(node,point)=>{point=floor.localToWorld(point.clone()).project(camera);if(point.z< -1||point.z>1){node.hidden=true;return;}node.style.left=`${(point.x*.5+.5)*viewport.clientWidth}px`;node.style.top=`${(-point.y*.5+.5)*viewport.clientHeight}px`;};
    if(visible){position(label,new THREE.Vector3(roomBounds[2]-.6,feet+.12,roomBounds[1]+.4));if(feedbackPoint&&lastHint)position(feedback,feedbackPoint);}
  }
  return {resolve,hint,update,feet,meetingSpot:surface.meetingSpot,meetingYaw:surface.meetingYaw,
    state:()=>({meetingRoom:REVIEW_ROOM_ID,meetingSpots:meetingSpots.length,groundMeshes:grounds.length,obstacles:obstacles.length,target:lastHint}),
    dispose(){floor.remove(ring,outline);ring.geometry.dispose();ring.material.dispose();outline.geometry.dispose();outline.material.dispose();label.remove();feedback.remove();},
  };
}
