import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {AnimationMixer,Box3,Vector3,Matrix3,Matrix4,Quaternion} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OBB} from 'three/addons/math/OBB.js';
import {PARTS,HERO,CYCLE,VERSION,basePose,assemblyPose,transitionPose,soloPose} from './model.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const collisionChecks=[];
function noOverlap(pose,label){
  const boxes=pose.map((p,i)=>new OBB(p.position.clone(),new Vector3(...PARTS[i].size).multiplyScalar(.5),new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromQuaternion(p.quaternion))));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(!boxes[i].intersectsOBB(boxes[j],1e-9),`${label}: ${PARTS[i].name} intersects ${PARTS[j].name}`);
}
assert.equal(PARTS.length,13);assert.equal(PARTS[HERO].name,'Lower_Cube_5');
for(const p of PARTS)assert.ok(p.size.every(n=>n===p.size[0]),`${p.name} is not a cube`);
noOverlap(basePose(),'home');
for(let f=0;f<=CYCLE*120;f++)noOverlap(assemblyPose(f/120),`assembly ${f/120}`);
collisionChecks.push('12-second choreography at 120 Hz');
for(const spread of [false,true]){
  const pose=basePose(spread);
  for(let i=0;i<PARTS.length;i++)for(const axis of [[1,0,0],[0,1,0],[0,0,1]]){
    for(let f=0;f<=216;f++)noOverlap(soloPose(pose,i,f/60,axis),`solo ${spread} ${i} ${axis} ${f/60}`);
  }
}
collisionChecks.push('every cube, every axis, assembled and exploded');
for(const start of [.7,2.3,4,6.2,7.5,10.8])for(const spread of [false,true])for(let f=0;f<=144;f++)noOverlap(transitionPose(assemblyPose(start),spread,f/60),`transition ${start} ${spread} ${f/60}`);
collisionChecks.push('interrupted motion safely transitions to assemble / explode');
const glbs=[];
for(const id of ['brand','vertical','icon']){
  const buffer=await readFile(path.join(here,`ZSuan-${id}-v1.2.glb`));
  const gltf=await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
  const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert.equal(meshes.length,id==='icon'?13:17);assert.equal(gltf.animations.length,16);
  const mixer=new AnimationMixer(gltf.scene), action=mixer.clipAction(gltf.animations.find(a=>a.name==='Assembly_Loop')).play();
  const identity=new Quaternion();
  for(const t of [0,.75,2.6,4.2,7.6,8.4,10.8,11.9,12]){
    mixer.setTime(t);
    const expected=assemblyPose(t===12?0:t);
    for(let i=0;i<PARTS.length;i++){
      const object=gltf.scene.getObjectByName(PARTS[i].name);
      assert.ok(object.position.distanceTo(expected[i].position)<.004);
      assert.ok(object.quaternion.angleTo(expected[i].quaternion)<.002);
      assert.ok(object.scale.distanceTo(new Vector3(1,1,1))<1e-7,'Cubes must not shrink');
    }
  }
  mixer.setTime(.7);action.paused=true;const before=gltf.scene.getObjectByName(PARTS[HERO].name).position.clone();mixer.update(1);assert.ok(gltf.scene.getObjectByName(PARTS[HERO].name).position.distanceTo(before)<1e-7);
  if(id!=='icon')for(let i=0;i<4;i++){const m=gltf.scene.getObjectByName(`Wordmark_${i}`);assert.equal(m.userData.character,[...'造价智算'][i]);assert.ok(m.geometry.attributes.position.count>100);}
  glbs.push({id,bytes:buffer.length,meshes:meshes.length,clips:gltf.animations.map(a=>a.name)});
}
const html=await readFile(path.join(here,'造价智算-精细模型与组装动效.html'),'utf8');
assert.ok(!html.includes('__ASSETS__'),'Embedded model payload not replaced');
assert.ok(!/<script[^>]+src\s*=/i.test(html));assert.ok(!/<link[^>]+href\s*=/i.test(html));
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const report={version:VERSION,parts:PARTS.map(p=>p.name),hero:PARTS[HERO].name,allPartsTrueCubes:true,constantScale:true,collisionChecks,glbs,htmlBytes:Buffer.byteLength(html),browserInteraction:'Not yet tested; prior file protocol block not bypassed'};
await writeFile(path.join(here,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
