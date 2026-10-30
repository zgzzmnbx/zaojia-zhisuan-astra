import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleLoadingWave,LOADING_DURATION,MOTION_DURATION} from './loading-wave.mjs';
import {basePose} from './model.mjs';

test('phase transitions and loop wrap remain continuous, with rigid blocks',()=>{
 for(const boundary of [0,.2,2.475,MOTION_DURATION,LOADING_DURATION]){
  const a=sampleLoadingWave(boundary-1e-6),b=sampleLoadingWave(boundary+1e-6);
  a.parts.forEach((p,i)=>{assert.ok(p.position.distanceTo(b.parts[i].position)<.00001);assert.deepEqual(p.scale.toArray(),[1,1,1]);});
 }
 const end=sampleLoadingWave(LOADING_DURATION),home=basePose();
 end.parts.forEach((p,i)=>assert.ok(p.position.distanceTo(home[i].position)<1e-12));
 assert.ok(Math.abs(LOADING_DURATION-MOTION_DURATION-.5)<1e-12);
 for(const offset of [.001,.25,.499]){
  const rest=sampleLoadingWave(MOTION_DURATION+offset);
  assert.equal(rest.viewScale,1);
  rest.parts.forEach((p,i)=>assert.ok(p.position.distanceTo(home[i].position)<1e-12));
 }
 assert.ok(sampleLoadingWave(LOADING_DURATION+.1).parts[0].position.distanceTo(home[0].position)>.01);
});
