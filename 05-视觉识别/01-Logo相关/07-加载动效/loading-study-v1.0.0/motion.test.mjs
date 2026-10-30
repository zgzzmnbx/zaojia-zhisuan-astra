import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Matrix3,Matrix4} from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {loadingPose,finishPose} from './loading-motion.mjs';
import {basePose,PARTS} from './model.mjs';
const home=basePose();
function collisions(pose){
 const boxes=pose.parts.map((p,i)=>new OBB(p.position.clone(),new Vector3(...PARTS[i].size).multiplyScalar(.5),new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromQuaternion(p.quaternion))));
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(!boxes[i].intersectsOBB(boxes[j],1e-9),`collision ${i}/${j}`);
}
test('pulse stays recognizable and the light wraps without a jump',()=>{
 for(let f=0;f<312;f++){const p=loadingPose('pulse',f/120);p.parts.forEach((c,i)=>assert.ok(c.position.distanceTo(home[i].position)<1e-9));assert.ok(p.powers.reduce((a,b)=>a+b,0)>1);}
 const a=loadingPose('pulse',2.6-.00001),b=loadingPose('pulse',2.6+.00001);a.powers.forEach((v,i)=>assert.ok(Math.abs(v-b.powers[i])<.0003));
});
test('orbit opening, full turn and every completion phase keep rigid cubes apart',()=>{
 for(let f=0;f<720;f++)collisions(loadingPose('orbit',f/120));
 for(const time of [.3,1,1.2,2.5,4,6.7,40.2,600.2]){
  const from={kind:'orbit',time,pose:loadingPose('orbit',time)};
  for(let f=0;f<=168;f++)collisions(finishPose(from,f/120));
  const end=finishPose(from,1.4);end.parts.forEach((p,i)=>assert.ok(p.position.distanceTo(home[i].position)<1e-8));assert.equal(end.scale,1);
 }
});
test('completion begins at the actual pose and settles without a sudden snap',()=>{
 for(const kind of ['pulse','orbit'])for(const time of [.2,1.1,2.1,20,300]){
  const pose=loadingPose(kind,time),from={kind,time,pose},first=finishPose(from,0);first.parts.forEach((p,i)=>assert.ok(p.position.distanceTo(pose.parts[i].position)<1e-9));
  let previous=first;for(let f=1;f<=168;f++){const next=finishPose(from,f/120);next.parts.forEach((p,i)=>assert.ok(p.position.distanceTo(previous.parts[i].position)<.36));previous=next;}
 }
});
