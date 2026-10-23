import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3,Raycaster,Scene,Vector3} from 'three';
import {createRiverChannel,channelProfile} from '../03-Src/studio/project-sandbox/river-channel.mjs';

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
