import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3,Raycaster,Scene,Vector3} from 'three';
import {createRiverChannel,channelProfile} from '../03-Src/studio/project-sandbox/river-channel.mjs';

test('channel cuts all supported terrain assets, lowers water, preserves buildings and restores source geometry',async()=>{
 for(const file of ['white-sandbox-v0.1.0/white-sandbox.glb','lighting-v1/sandbox-lightmapped.glb','lighting-v2/sandbox-surface.glb']){
  const bytes=fs.readFileSync('05-视觉识别/02-3D场景/'+file);
  const {scene:root}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const scene=new Scene();scene.add(root);root.updateMatrixWorld(true);
  const saved:any[]=[];root.traverse((m:any)=>{if(m.isMesh)saved.push({m,g:m.geometry,position:m.position.clone(),indices:m.geometry.index?.count,vertices:m.geometry.attributes.position.count,isLand:m.parent.name==='zone_land'})});
  const channel=createRiverChannel(root,scene);assert.equal(channel.active,true,file);assert.ok(channel.state().replaced>=2);
  root.updateMatrixWorld(true);channel.group.updateMatrixWorld(true);
  const x=-8,z=5.1-1.25*Math.sin(x*.24),ray=new Raycaster(new Vector3(x,2,z),new Vector3(0,-1,0));
  const water=saved.find(({m})=>m.material.name==='Blue river').m;
  assert.ok(Math.abs(new Box3().setFromObject(water).min.y-channelProfile.water)<1e-6);
  // The replacement solid has a real open channel; its first hit is the bed, below water.
  assert.ok(ray.intersectObject(channel.group,true)[0].point.y<channelProfile.water-.4);
  const bases=saved.filter(({m,g})=>m.geometry!==g).map(({m})=>m);
  assert.equal(ray.intersectObjects(bases).length,0,'old continuous slab must not seal the opening');
  ray.ray.origin.z=z+2;assert.ok(Math.abs(ray.intersectObject(channel.group,true)[0].point.y-channelProfile.bank)<.03);
  for(const {m,g,position,indices,vertices,isLand} of saved){
   assert.equal(m.geometry.attributes.position.count,vertices);assert.equal(m.geometry.index?.count,indices);
   if(!isLand){assert.equal(m.geometry,g);assert.deepEqual(m.position,position);}
  }
  channel.dispose();for(const {m,g,position} of saved){assert.equal(m.geometry,g);assert.deepEqual(m.position,position);}
  root.traverse((m:any)=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});
 }
});
import {createRiverLife} from '../03-Src/studio/project-sandbox/river-life.mjs';

test('water end faces span bed to raised waterline and small fish remain submerged within curved banks',()=>{
 const life=createRiverLife(channelProfile);life.group.updateMatrixWorld(true);
 const x=17,z=5.1-1.25*Math.sin(x*.24),y=(channelProfile.water+channelProfile.bed+.03)/2;
 const ray=new Raycaster(new Vector3(18,y,z),new Vector3(-1,0,0));
 const hits=ray.intersectObject(life.volume);assert.ok(hits.length>0);assert.ok(Math.abs(hits[0].point.x-17)<1e-6);
 for(let i=0;i<3000;i++){
  life.tick(.05,true);
  for(const [x,y,z] of life.state().positions){assert.ok(y+.04<channelProfile.water);assert.ok(y-.04>channelProfile.bed);assert.ok(Math.abs(z-(5.1-1.25*Math.sin(x*.24)))<channelProfile.halfWidth-.2);assert.ok(Math.abs(x)<16);}
 }
 const frozen=life.state();life.tick(.05,false);assert.deepEqual(life.state(),frozen);
 life.setEnabled(false);life.tick(.05,true);assert.equal(life.state().time,frozen.time);assert.equal(life.state().fish,0);
 life.setEnabled(true);life.tick(.05,true);assert.ok(life.state().time>frozen.time);assert.equal(life.state().fish,5);
 life.dispose();assert.equal(life.group.parent,null);
});
