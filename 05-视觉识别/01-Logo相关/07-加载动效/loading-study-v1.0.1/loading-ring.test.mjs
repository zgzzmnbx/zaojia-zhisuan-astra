import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {sampleLoadingRing,RING_LOADING_DURATION} from './loading-ring.mjs';
import {basePose} from './model.mjs';

test('ring completes 360 degrees over 1.5 seconds and reunites slowly without boundary jumps',()=>{
 assert.equal(RING_LOADING_DURATION,3.8);
 const home=basePose();
 for(const t of [0,3.5,3.8,7.6])sampleLoadingRing(t).parts.forEach((p,i)=>assert.ok(p.position.distanceTo(home[i].position)<1e-12));
 const circle=sampleLoadingRing(1);
 circle.parts.forEach(p=>assert.ok(Math.abs(p.position.length()-3.15)<1e-10));
 assert.ok(Math.abs(sampleLoadingRing(1.7).rotation[2]+Math.PI)<1e-10);
 assert.ok(Math.abs(sampleLoadingRing(2.45).rotation[2]+Math.PI*2)<1e-10);
 assert.ok(sampleLoadingRing(3.2).parts.some((p,i)=>p.position.distanceTo(home[i].position)>.01));
 for(let t=0;t<3.8;t+=1/120){
  const angle=sampleLoadingRing(t).rotation[2];
  assert.ok(Math.abs(angle)<=Math.PI*2+1e-12);
  const delta=angle-sampleLoadingRing(t+1/120).rotation[2];
  assert.ok(Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))<.07);
  if(t>=2.45&&t<3.4)assert.equal(angle,-Math.PI*2);
 }
 // Compare rendered world-space coordinates at every phase boundary.
 for(const t of [0,.6*.95/2.5,1.3*.95/2.5,.95,2.45,3.05,3.4,3.8]){
  const positions=time=>{const p=sampleLoadingRing(time),q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),p.rotation[2]);return p.parts.map(v=>v.position.clone().applyQuaternion(q));};
  const a=positions(t-1e-6),b=positions(t+1e-6);
  a.forEach((v,i)=>assert.ok(v.distanceTo(b[i])<.0001));
 }
});
