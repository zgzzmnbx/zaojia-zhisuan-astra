import * as THREE from 'three';
import {createWalkGrid,connectedWalkArea} from './person-navigation.js';

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
  const office=model.getObjectByName('H1_F09_Office'),grounds=[],obstacles=[],groundBounds=new THREE.Box3();
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
    if(bounds.max.y>feet+.12&&bounds.min.y<feet+1.9){const box=[bounds.min.x,bounds.min.z,bounds.max.x,bounds.max.z];box.chair=/chair/i.test(node.name);obstacles.push(box);}
  });
  // The continuous corridor slab is a sibling of the office, not its child.
  floor.getObjectByName('H1_F09_floor_slab')?.traverse(node=>{if(node.isMesh&&!node.userData.staticBatch&&!grounds.includes(node))grounds.push(node);});
  const core=office.getObjectByName('Core_floor');
  if(core){bounds.setFromObject(core).applyMatrix4(inverse);if(!bounds.isEmpty())obstacles.push([bounds.min.x,bounds.min.z,bounds.max.x,bounds.max.z]);}
  const scale=layout.metadata.recommended_px_per_m,[ox,oz]=layout.metadata.recommended_world_origin_px;
  const room=layout.rooms.find(r=>r.id===REVIEW_ROOM_ID),roomBounds=room.bounds_px.map((v,i)=>(v-(i%2?oz:ox))/scale);
  for(const ground of grounds){ground.geometry.computeBoundingBox();groundBounds.union(ground.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,ground.matrixWorld)));}
  // Index expanded obstacle boxes, so grid construction and segment checks do
  // not scan every small item on every sample.
  const buckets=new Map(),bucketKey=(x,z)=>`${Math.floor(x)}:${Math.floor(z)}`;
  for(const b of obstacles)for(let x=Math.floor(b[0]-.3);x<=Math.floor(b[2]+.3);x++)for(let z=Math.floor(b[1]-.3);z<=Math.floor(b[3]+.3);z++){const key=bucketKey(x,z);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(b);}
  const nearby=p=>buckets.get(bucketKey(p.x,p.z))||[];
  function supported(x,z){
    const origin=floor.localToWorld(new THREE.Vector3(x,feet+.3,z));ray.set(origin,down);ray.near=0;ray.far=.7;
    return ray.intersectObjects(grounds,false).some(hit=>Math.abs(floor.worldToLocal(hit.point.clone()).y-feet)<.16);
  }
  function clear(point,occupied=[]){
    return !nearby(point).some(b=>pointInBounds(point,b,-.22))&&!occupied.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<.72)&&supported(point.x,point.z);
  }
  function clearSegment(a,b,ownBounds=null){
    const seat=ownBounds?.map((v,i)=>(v-(i%2?oz:ox))/scale),count=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.1));
    for(let i=0;i<=count;i++){
      const p={x:a.x+(b.x-a.x)*i/count,z:a.z+(b.z-a.z)*i/count};
      if(nearby(p).some(box=>!(box.chair&&seat&&pointInBounds({x:(box[0]+box[2])/2,z:(box[1]+box[3])/2},seat,-.15))&&pointInBounds(p,box,-.22)))return false;
    }
    return true;
  }
  const graph=connectedWalkArea(createWalkGrid([groundBounds.min.x,groundBounds.min.z,groundBounds.max.x,groundBounds.max.z],clear,clearSegment,.2));
  const outsideSpots=graph.cells.filter(p=>!pointInBounds(p,roomBounds));
  const meetingSpots=[];
  for(let x=roomBounds[0]+.4;x<roomBounds[2]-.4;x+=.4)for(let z=roomBounds[1]+.4;z<roomBounds[3]-.4;z+=.4){const p={x,z};if(clear(p))meetingSpots.push(p);}
  function resolve(pointerRay,occupied=[]){
    floor.updateWorldMatrix(true,false);
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-floor.localToWorld(new THREE.Vector3(0,feet,0)).y);
    const hit=pointerRay.ray.intersectPlane(plane,new THREE.Vector3());if(!hit)return null;
    const local=floor.worldToLocal(hit),meeting=pointInBounds(local,roomBounds);
    const nearest=meeting?nearestFreePoint(meetingSpots,local,occupied):nearestFreePoint(outsideSpots,local,occupied);
    const spot=!meeting&&nearest&&Math.hypot(nearest.x-local.x,nearest.z-local.z)<.3&&clear(local,occupied)&&clearSegment(local,nearest)?{x:local.x,z:local.z}:nearest;
    return {valid:!!spot,meeting,x:spot?.x??local.x,y:feet,z:spot?.z??local.z,snapped:!!spot&&Math.hypot(spot.x-local.x,spot.z-local.z)>.05,roomId:meeting?REVIEW_ROOM_ID:null};
  }
  return {resolve,feet,roomBounds,meetingSpots,grounds,obstacles,graph,clear,
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
    if(target){ring.position.set(target.x,feet+.055,target.z);ring.material.color.set(target.valid?target.meeting?0x284bd4:0x1fa67a:0xd54d50);feedback.textContent=!target.valid?'没有空闲落脚点':target.meeting?(canReview?'松开，加入多人复核':'松开，放到会议室'):target.snapped?'松开，就近落地':'松开，放到这里';feedbackPoint=new THREE.Vector3(target.x,feet+.1,target.z);}
    requestFrame();
  }
  function update(camera,view){
    const visible=['office','exploded'].includes(view);outline.visible=visible;label.hidden=!visible;ring.visible=visible&&!!lastHint;feedback.hidden=!visible||!lastHint;
    const position=(node,point)=>{point=floor.localToWorld(point.clone()).project(camera);if(point.z< -1||point.z>1){node.hidden=true;return;}node.style.left=`${(point.x*.5+.5)*viewport.clientWidth}px`;node.style.top=`${(-point.y*.5+.5)*viewport.clientHeight}px`;};
    if(visible){position(label,new THREE.Vector3(roomBounds[2]-.6,feet+.12,roomBounds[1]+.4));if(feedbackPoint&&lastHint)position(feedback,feedbackPoint);}
  }
  return {resolve,hint,update,feet,graph:surface.graph,meetingSpot:surface.meetingSpot,meetingYaw:surface.meetingYaw,
    state:()=>({meetingRoom:REVIEW_ROOM_ID,meetingSpots:meetingSpots.length,walkCells:surface.graph.cells.length,groundMeshes:grounds.length,obstacles:obstacles.length,target:lastHint}),
    dispose(){floor.remove(ring,outline);ring.geometry.dispose();ring.material.dispose();outline.geometry.dispose();outline.material.dispose();label.remove();feedback.remove();},
  };
}
