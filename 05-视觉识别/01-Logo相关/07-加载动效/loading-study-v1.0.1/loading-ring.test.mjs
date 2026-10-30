import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {sampleLoadingRing,RING_LOADING_DURATION} from './loading-ring.mjs';
import {basePose} from './model.mjs';

test('three-second ring starts as Z, opens, rotates once and returns before looping',()=>{
 assert.equal(RING_LOADING_DURATION,3);
 const home=basePose();
 for(const t of [0,2.7,3,6])sampleLoadingRing(t).parts.forEach((p,i)=>assert.ok(p.position.distanceTo(home[i].position)<1e-12));
 const circle=sampleLoadingRing(.8);
 circle.parts.forEach(p=>assert.ok(Math.abs(p.position.length()-3.15)<1e-10));
 assert.ok(Math.abs(sampleLoadingRing(1.38).rotation[2]+Math.PI)<1e-10);
 // Compare world-space coordinates at every phase boundary, including the 2pi reset.
 for(const source of [.6,1.3,2.5,2.8,6.4,6.7,7.9,8.6,10]){
  const t=source*.3;
  const positions=time=>{const p=sampleLoadingRing(time),q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),p.rotation[2]);return p.parts.map(v=>v.position.clone().applyQuaternion(q));};
  const a=positions(t-1e-6),b=positions(t+1e-6);
  a.forEach((v,i)=>assert.ok(v.distanceTo(b[i])<.0001));
 }
});
