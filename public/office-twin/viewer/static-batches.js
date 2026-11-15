import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {classifyNightRole,nightSeatId} from './night-lighting-policy.js';

function boundaryFor(object,root){
  let boundary=object.parent;
  while(boundary?.parent&&boundary!==root&&boundary.userData.entity_type!=='room'&&!/^(?:Room_|Layout_|Floor_\d+$|Facade_\d+$|ContextBuildings$|H1_F09_Office$)/.test(boundary.name))boundary=boundary.parent;
  return boundary;
}

// Batch only opaque static geometry within the same spatial/lighting boundary.
// Keep original named nodes for anchors, room bounds and the source-model contract.
export function batchStaticGeometry(root){
  root.updateMatrixWorld(true);
  const groups=new Map();let sources=0,batches=0;
  root.traverse(object=>{
    const g=object.geometry,m=object.material;
    if(!object.isMesh||object.isSkinnedMesh||object.isInstancedMesh||!object.visible||object.children.length||!g||!m||Array.isArray(m)||m.transparent||m.opacity!==1||object.morphTargetInfluences?.length||g.drawRange.start!==0||g.drawRange.count!==Infinity||object.matrixWorld.determinant()<=0)return;
    for(let parent=object.parent;parent;parent=parent.parent)if(!parent.visible)return;
    const role=classifyNightRole(object,m);
    if(['screen','window','sign','accent','interior_light','person'].includes(role))return;
    const boundary=boundaryFor(object,root);
    if(!boundary)return;
    const seat=nightSeatId(object)||'';
    const format=Object.entries(g.attributes).map(([k,a])=>`${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).sort().join(',');
    const key=[boundary.uuid,m.uuid,role,seat,format,!!g.index,object.renderOrder,object.castShadow,object.receiveShadow].join('|');
    if(!groups.has(key))groups.set(key,{boundary,material:m,role,seat,objects:[]});
    groups.get(key).objects.push(object);
  });
  for(const {boundary,material,role,seat,objects} of groups.values()){
    if(objects.length<2)continue;
    const inverse=boundary.matrixWorld.clone().invert();
    const parts=objects.map(o=>o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));
    const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
    if(!geometry)continue;
    const mesh=new THREE.Mesh(geometry,material);mesh.name='StaticBatch_'+batches;
    mesh.userData={night_role:role,seat_id:seat||undefined,staticBatch:true};
    mesh.castShadow=objects[0].castShadow;mesh.receiveShadow=objects[0].receiveShadow;mesh.renderOrder=objects[0].renderOrder;
    boundary.add(mesh);
    for(const object of objects){object.visible=false;object.userData.staticBatchSource=true;}
    sources+=objects.length;batches++;
  }
  return {sources,batches,savedDraws:sources-batches};
}
