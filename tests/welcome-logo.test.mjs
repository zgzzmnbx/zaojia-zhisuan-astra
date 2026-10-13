import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Matrix3,Matrix4,Euler,Quaternion} from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {LOGO_MOTIONS,IDLE_ORDER,IDLE_TIMING,RING_RADIUS,WAVE_TIMING,sampleMotion,poseClips} from '../03-Src/studio/brand/motions.mjs';
import {PARTS,HERO,basePose} from '../03-Src/studio/brand/model.mjs';
import {normalizeLogoConfig,parseLogoConfig,serializeLogoConfig,LOGO_PALETTES} from '../03-Src/studio/brand/logo-config.mjs';
import {sequenceSteps,sampleSequence,normalizePageCycles} from '../03-Src/studio/brand/sequences.mjs';
const signature=p=>p.map(x=>[...x.position.toArray(),...x.quaternion.toArray()]);
test('page cycles hold exact wall-clock waits, play each action once and repeat in order',()=>{
 for(const [id,rest,actions] of [['welcome',3,['wave','ring']],['studio',20,['wave','tail','idle']]])for(const speed of [.5,1,1.5]){
  const steps=sequenceSteps(id,speed);assert.deepEqual(steps.filter(s=>s.phase==='motion').map(s=>s.mode),actions);
  const total=steps.reduce((v,s)=>v+s.duration,0);let time=0;
  steps.forEach((step,index)=>{
   const mid=sampleSequence(id,time+step.duration/2,speed);assert.equal(mid.index,index);assert.equal(mid.mode,step.mode);
   if(step.phase==='rest')assert.equal(step.duration,rest);
   else {
    const before=sampleMotion(step.mode,step.start),after=sampleMotion(step.mode,step.start+step.duration*step.rate);
    for(const pose of [before,after])pose.parts.forEach((p,i)=>assert.ok(p.position.distanceTo(basePose()[i].position)<1e-8&&p.quaternion.angleTo(basePose()[i].quaternion)<1e-7,'Every action joins an assembled rest without a snap'));
   }
   time+=step.duration;
  });
  for(const cycle of [1,2,100]){const state=sampleSequence(id,total*cycle+.001,speed);assert.equal(state.cycle,cycle);assert.equal(state.index,0);assert.equal(state.phase,'rest');assert.ok(state.remaining>rest-.002);}
 }
 assert.deepEqual(normalizePageCycles({welcome:'bad',studio:'bad'}),{welcome:'loop',studio:'loop'});
 assert.deepEqual(normalizePageCycles({welcome:'manual',studio:'paused'}),{welcome:'manual',studio:'paused'});
});
test('static and resting intervals preserve the assembled mark; tail moves alone',()=>{
 const rest=signature(basePose());
 for(const t of [0,1,5,99])assert.deepEqual(signature(sampleMotion('static',t).parts),rest);
 for(const t of [0,2,4.79,7.21,9.9])assert.deepEqual(signature(sampleMotion('tail',t).parts),rest);
 const flying=sampleMotion('tail',6).parts;
 assert.ok(flying[HERO].position.distanceTo(basePose()[HERO].position)>1);
 flying.forEach((p,i)=>{if(i!==HERO)assert.deepEqual(signature([p]),[rest[i]]);});
});
test('sway is bounded and every preset closes without accumulated drift',()=>{
 assert.ok(sampleMotion('sway',2).rotation[1]>.16);
 assert.ok(sampleMotion('sway',6).rotation[1]<-.16);
 for(const mode of LOGO_MOTIONS){
  const start=sampleMotion(mode.id,0),end=sampleMotion(mode.id,mode.duration);
  assert.deepEqual(signature(start.parts),signature(end.parts));assert.deepEqual(start.rotation,end.rotation);
 }
});
test('all presets retain true cube dimensions without collisions at 120 Hz',()=>{
 for(const mode of LOGO_MOTIONS)for(let f=0;f<=mode.duration*120;f++){
  const parts=sampleMotion(mode.id,f/120).parts;
  const boxes=parts.map((p,i)=>new OBB(p.position.clone(),new Vector3(...PARTS[i].size).multiplyScalar(.5),new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromQuaternion(p.quaternion))));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(!boxes[i].intersectsOBB(boxes[j],1e-9),`${mode.id} ${f/120} ${i} ${j}`);
 }
});
test('presets export real body and part keyframes, including static reset',()=>{
 const clips=poseClips();assert.equal(clips.length,LOGO_MOTIONS.length);
 for(const clip of clips){assert.equal(clip.tracks.length,27);assert.ok(clip.tracks.some(t=>t.name==='ZSuan_Stepped_Z.quaternion'));assert.ok(clip.tracks.some(t=>t.name==='Lower_Cube_5.position'));}
});

test('idle turns all thirteen cubes sequentially, keeps the body still and rests between loops',()=>{
 assert.deepEqual([...IDLE_ORDER].sort((a,b)=>a-b),PARTS.map((_,i)=>i));
 const home=basePose();
 IDLE_ORDER.forEach((index,slot)=>{
  const pose=sampleMotion('idle',IDLE_TIMING.lead+slot*IDLE_TIMING.slot+IDLE_TIMING.clear+IDLE_TIMING.turn/2);
  assert.deepEqual(pose.rotation,[0,0,0]);
  pose.parts.forEach((p,i)=>{if(i===index){assert.ok(p.position.z>.2&&p.position.distanceTo(home[i].position)<.28);assert.ok(Math.abs(p.quaternion.angleTo(home[i].quaternion)-Math.PI/2)<1e-8);}else assert.deepEqual(signature([p]),signature([home[i]]));});
 });
 assert.equal(LOGO_MOTIONS.find(m=>m.id==='idle').duration,12);
 for(const t of [0,.59,11,11.99])assert.deepEqual(signature(sampleMotion('idle',t).parts),signature(home));
 for(let frame=0;frame<12*120;frame++){
  const now=sampleMotion('idle',frame/120).parts,next=sampleMotion('idle',(frame+1)/120).parts;
  now.forEach((p,i)=>{assert.ok(p.position.distanceTo(home[i].position)<.28);assert.ok(p.quaternion.angleTo(home[i].quaternion)<=Math.PI/2+1e-8);assert.ok(p.quaternion.angleTo(next[i].quaternion)<.11,'Idle rotation must settle continuously');});
 }
});

test('reusable presets round-trip all palettes and motions and reject unsupported imports',()=>{
 for(const palette of LOGO_PALETTES)for(const motion of LOGO_MOTIONS){const config=normalizeLogoConfig({palette:palette.id,mode:motion.id,speed:1.25,layout:'vertical',background:'transparent'});assert.deepEqual(parseLogoConfig(serializeLogoConfig(config)),config);}
 assert.equal(normalizeLogoConfig({speed:Infinity}).speed,1);
 assert.equal(normalizeLogoConfig({speed:99}).speed,1.5);
 assert.throws(()=>parseLogoConfig('{"version":2,"format":"zhisuan-logo-preset","settings":{}}'));
 assert.throws(()=>parseLogoConfig('{"version":1,"format":"zhisuan-logo-preset","settings":{"palette":"missing"}}'));
});

test('ring forms thirteen evenly spaced cubes, revolves once and reassembles',()=>{
 const ring=sampleMotion('ring',2.65),angles=ring.parts.map(p=>Math.atan2(p.position.y,p.position.x)).sort((a,b)=>a-b);
 ring.parts.forEach(p=>{assert.ok(Math.abs(p.position.length()-RING_RADIUS)<1e-8);assert.equal(p.position.z,0);});
 angles.forEach((a,i)=>{const next=i===12?angles[0]+Math.PI*2:angles[i+1];assert.ok(Math.abs(next-a-Math.PI*2/13)<1e-8);});
 assert.deepEqual(signature(sampleMotion('ring',4.6).parts),signature(ring.parts));
 assert.ok(Math.abs(sampleMotion('ring',4.6).rotation[2]+Math.PI)<1e-8);
 assert.deepEqual(signature(sampleMotion('ring',9).parts),signature(basePose()));
 assert.equal(sampleMotion('ring',9).viewScale,1);
});

test('wave propagates along the Z with a rise and fall for every cube',()=>{
 const home=basePose();
 IDLE_ORDER.forEach((index,order)=>{
  const start=WAVE_TIMING.start+order*WAVE_TIMING.delay;
  const crest=sampleMotion('wave',start+WAVE_TIMING.pulse/3).parts[index];
  const trough=sampleMotion('wave',start+WAVE_TIMING.pulse*2/3).parts[index];
  assert.ok(crest.position.y-home[index].position.y*1.32>.2);
  assert.ok(trough.position.y-home[index].position.y*1.32<-.2);
 });
 const first=sampleMotion('wave',WAVE_TIMING.start+WAVE_TIMING.pulse/3);
 assert.ok(first.parts[IDLE_ORDER[0]].position.y-home[IDLE_ORDER[0]].position.y*1.32>.2);
 assert.equal(first.parts[IDLE_ORDER.at(-1)].position.y,home[IDLE_ORDER.at(-1)].position.y*1.32);
 assert.deepEqual(signature(sampleMotion('wave',7).parts),signature(home));
});

test('new poses have continuous world motion and presentation framing at every phase boundary',()=>{
 for(const id of ['ring','wave']){
  const duration=LOGO_MOTIONS.find(m=>m.id===id).duration;
  for(let f=0;f<duration*120;f++){
   const a=sampleMotion(id,f/120),b=sampleMotion(id,(f+1)/120),qa=new Quaternion().setFromEuler(new Euler(...a.rotation)),qb=new Quaternion().setFromEuler(new Euler(...b.rotation));
   assert.ok(qa.angleTo(qb)<.03);assert.ok(Math.abs(a.viewScale-b.viewScale)<.012);
   a.parts.forEach((p,i)=>{assert.ok(p.position.clone().applyQuaternion(qa).distanceTo(b.parts[i].position.clone().applyQuaternion(qb))<.1);assert.deepEqual(p.scale.toArray(),[1,1,1]);});
  }
 }
});
