import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleLoadingWave,LOADING_DURATION} from './loading-wave.mjs';
import {basePose} from './model.mjs';

test('phase transitions and loop wrap remain continuous, with rigid blocks',()=>{
 for(const boundary of [0,.2,2.475,LOADING_DURATION]){
  const a=sampleLoadingWave(boundary-1e-6),b=sampleLoadingWave(boundary+1e-6);
  a.parts.forEach((p,i)=>{assert.ok(p.position.distanceTo(b.parts[i].position)<.00001);assert.deepEqual(p.scale.toArray(),[1,1,1]);});
 }
 const end=sampleLoadingWave(LOADING_DURATION),home=basePose();
 end.parts.forEach((p,i)=>assert.ok(p.position.distanceTo(home[i].position)<1e-12));
});
