import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {sampleLoadingRing,RING_LOADING_DURATION} from './loading-ring.mjs';
import {basePose} from './model.mjs';

test('three-second ring turns gently and reunites slowly without boundary jumps',()=>{
 assert.equal(RING_LOADING_DURATION,3);
 const home=basePose();
 for(const t of [0,2.7,3,6])sampleLoadingRing(t).parts.forEach((p,i)=>assert.ok(p.position.distanceTo(home[i].position)<1e-12));
 const circle=sampleLoadingRing(.8);
 circle.parts.forEach(p=>assert.ok(Math.abs(p.position.length()-3.15)<1e-10));
 assert.ok(Math.abs(sampleLoadingRing(1.65).rotation[2]+Math.PI/2)<1e-10);
 assert.ok(sampleLoadingRing(2.4).parts.some((p,i)=>p.position.distanceTo(home[i].position)>.01));
 for(let t=0;t<3;t+=1/120){
  const angle=sampleLoadingRing(t).rotation[2];
  assert.ok(Math.abs(angle)<=Math.PI/2+1e-12);
  assert.ok(Math.abs(angle-sampleLoadingRing(t+1/120).rotation[2])<.04);
 }
 // Compare rendered world-space coordinates at every phase boundary.
 for(const t of [0,.18,.39,.75,1.65,2.25,2.6,3]){
  const positions=time=>{const p=sampleLoadingRing(time),q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),p.rotation[2]);return p.parts.map(v=>v.position.clone().applyQuaternion(q));};
  const a=positions(t-1e-6),b=positions(t+1e-6);
  a.forEach((v,i)=>assert.ok(v.distanceTo(b[i])<.0001));
 }
});
