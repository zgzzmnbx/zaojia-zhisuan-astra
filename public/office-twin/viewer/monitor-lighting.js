import * as THREE from 'three';
import {classifyNightRole,nightSeatId} from './night-lighting-policy.js';

// Floor-local screen bindings are shared by the original furniture and its batches.
export function collectMonitorLighting(root){
  root.updateMatrixWorld(true);
  const floor=root.getObjectByName('Floor_09');
  const inverse=floor?floor.matrixWorld.clone().invert():new THREE.Matrix4();
  const monitors=new Map();let screenCount=0;
  root.traverse(object=>{
    if(!object.isMesh||!object.geometry||![].concat(object.material||[]).some(m=>classifyNightRole(object,m)==='screen'))return;
    screenCount++;
    const seat=nightSeatId(object);if(!seat)return;
    object.geometry.computeBoundingBox();
    const position=object.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(object.matrixWorld).applyMatrix4(inverse);
    const facing=new THREE.Vector3(0,0,1).transformDirection(object.matrixWorld).transformDirection(inverse);
    monitors.set(seat,{position,facing});
  });
  return {monitors,screenCount};
}

export function addMonitorAttributes(geometry,monitor){
  const count=geometry.attributes.position.count,position=new Float32Array(count*4),facing=new Float32Array(count*3);
  if(monitor){
    const p=[...monitor.position.toArray(),1],f=monitor.facing.toArray();
    for(let i=0;i<count;i++){position.set(p,i*4);facing.set(f,i*3);}
  }
  geometry.setAttribute('officeSeatMonitor',new THREE.BufferAttribute(position,4));
  geometry.setAttribute('officeSeatFacing',new THREE.BufferAttribute(facing,3));
  return geometry;
}
