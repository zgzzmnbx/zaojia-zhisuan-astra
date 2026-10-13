import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {AnimationMixer,Euler,Quaternion} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LOGO_MOTIONS,sampleMotion} from './motions.mjs';
import {PARTS} from './model.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),report=[];
for(const palette of fs.readdirSync(path.join(root,'GLB')))for(const name of fs.readdirSync(path.join(root,'GLB',palette))){
 const file=path.join('GLB',palette,name),buf=fs.readFileSync(path.join(root,file));
 const gltf=await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),'');
 assert.equal(gltf.animations.length,20);
 const group=gltf.scene.getObjectByName('ZSuan_Stepped_Z');assert.ok(group);
 const mixer=new AnimationMixer(gltf.scene);
 for(const motion of LOGO_MOTIONS){
  const clip=gltf.animations.find(c=>c.name===motion.clip);assert.ok(clip);assert.ok(Math.abs(clip.duration-motion.duration)<1e-5);
  for(const time of [0,Math.round(motion.duration*.5*60)/60,motion.duration-.5]){
   mixer.stopAllAction();mixer.clipAction(clip).reset().play();mixer.setTime(time);
   const expected=sampleMotion(motion.id,time);
   PARTS.forEach((p,i)=>{const obj=group.getObjectByName(p.name);assert.ok(obj);assert.ok(obj.position.distanceTo(expected.parts[i].position)<1e-5,`${file} ${motion.id} ${p.name}`);assert.ok(Math.abs(obj.quaternion.dot(expected.parts[i].quaternion))>1-1e-5);});
   const rotation=new Quaternion().setFromEuler(new Euler(...expected.rotation));assert.ok(Math.abs(group.quaternion.dot(rotation))>1-1e-5);
  }
 }
 mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 report.push({file:file.replaceAll('\\','/'),animations:20,parts:13,posePlaybackVerified:4});
}
assert.equal(report.length,24);
fs.writeFileSync(path.join(root,'glb-verification.json'),JSON.stringify({version:'1.2.2',files:report},null,2));
console.log('24 GLBs: 20 clips each, four poses replayed, all positions and orientations matched.');
