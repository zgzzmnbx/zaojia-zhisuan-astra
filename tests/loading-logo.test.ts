import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sampleLoadingWave,LOADING_DURATION,MOTION_DURATION} from '../03-Src/studio/brand/loading-wave.mjs';
import {sampleLoadingRing,RING_LOADING_DURATION} from '../03-Src/studio/brand/loading-ring.mjs';
import {Box3,Group} from 'three';
import {basePose,createLogo} from '../03-Src/studio/brand/model.mjs';
import {sampleConversationLoading,advanceConversationTime,CONVERSATION_FINISH,CONVERSATION_CYCLE,CONVERSATION_SETTLED} from '../03-Src/studio/brand/conversation-loading.mjs';
import {normalizeLoadingMotion,readLoadingMotion,saveLoadingMotion,loadingLogoKey,loadingLogoEvent} from '../03-Src/studio/brand/loading-preferences.ts';

test('loading selection defaults to ring, persists wave, and refuses unavailable choices',()=>{
 for(const input of [null,undefined,'static','',{},'bad'])assert.equal(normalizeLoadingMotion(input),'ring');
 assert.equal(normalizeLoadingMotion('wave'),'wave');
 const storage=new Map<string,string>(),events:string[]=[];
 const oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 try{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{dispatchEvent:(e:Event)=>events.push(e.type)}});
  assert.equal(readLoadingMotion(),'ring');saveLoadingMotion('wave');assert.equal(readLoadingMotion(),'wave');
  assert.equal(storage.get(loadingLogoKey),'wave');assert.deepEqual(events,[loadingLogoEvent]);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get:()=>{throw Error('denied');}});
  assert.equal(readLoadingMotion(),'ring');assert.throws(()=>saveLoadingMotion('wave'));
 }finally{
  if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage');
  if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');
 }
});

test('production loading preserves approved timings, rigid cubes and complete-Z rest',()=>{
 const home=basePose();assert.equal(RING_LOADING_DURATION,3.8);assert.ok(Math.abs(LOADING_DURATION-3.375)<1e-10);
 for(const [sample,times] of [[sampleLoadingWave,[0,MOTION_DURATION+.1,LOADING_DURATION]],[sampleLoadingRing,[0,3.5,3.8]]] as const){
  for(const time of times)sample(time).parts.forEach((p:any,i:number)=>assert.ok(p.position.distanceTo(home[i].position)<1e-10));
 }
 assert.ok(Math.abs(sampleLoadingRing(2.45).rotation[2]+Math.PI*2)<1e-10);
 for(const sample of [sampleLoadingWave,sampleLoadingRing])for(let t=0;t<4;t+=.02)sample(t).parts.forEach((p:any)=>assert.deepEqual(p.scale.toArray(),[1,1,1]));
});

test('approved loading samplers are byte-identical to user-selected preview',()=>{
 for(const name of ['loading-wave.mjs','loading-ring.mjs'])assert.equal(fs.readFileSync(new URL('../03-Src/studio/brand/'+name,import.meta.url),'utf8'),fs.readFileSync(new URL('../05-视觉识别/01-Logo相关/07-加载动效/loading-study-v1.0.1/'+name,import.meta.url),'utf8'));
});

test('conversation Z separates in depth before turning, reassembles, and holds its exact starting pose',()=>{
 const home=basePose(),at=(t:number)=>sampleConversationLoading(t);
 assert.equal(home.length,13);
 for(const t of [0,.05,CONVERSATION_SETTLED,CONVERSATION_CYCLE-.01,CONVERSATION_CYCLE]){
  const pose=at(t);
  assert.deepEqual(pose.rotation,[0,0,0]);
  pose.parts.forEach((part:any,i:number)=>{
   assert.ok(part.position.distanceTo(home[i].position)<1e-8);
   assert.ok(Math.abs(part.quaternion.dot(home[i].quaternion))>1-1e-8);
  });
 }
 const open=at(.77),turn=at(1.305);
 assert.ok(open.parts[0].position.distanceTo(open.parts[1].position)>1);
 assert.ok(open.parts.some((part:any)=>Math.abs(part.position.z)>.3));
 open.parts.forEach((part:any,i:number)=>assert.ok(Math.abs(part.quaternion.dot(home[i].quaternion))>1-1e-8));
 assert.ok(turn.rotation[1]>.20);
 turn.parts.forEach((part:any,i:number)=>{
  assert.ok(Math.abs(part.quaternion.dot(home[i].quaternion))<.02);
  assert.ok(part.position.distanceTo(open.parts[i].position)<1e-8);
 });
 for(let t=0;t<CONVERSATION_CYCLE;t+=.025)at(t).parts.forEach((p:any)=>assert.deepEqual(p.scale.toArray(),[1,1,1]));
 assert.ok(CONVERSATION_FINISH-CONVERSATION_SETTLED>.15);
 const held=advanceConversationTime(CONVERSATION_CYCLE+2.68,.18,true);
 assert.ok(Math.abs(held-CONVERSATION_CYCLE-CONVERSATION_FINISH)<1e-8);
 assert.equal(advanceConversationTime(held,.18,true),held);
});

test('every turned corner stays inside the fixed conversation camera',()=>{
 const holder=new Group(),model=createLogo();
 holder.rotation.set(.22,.43,-.025);holder.add(model);
 for(let t=0;t<CONVERSATION_CYCLE;t+=.025){
  const frame=sampleConversationLoading(t);
  model.rotation.set(frame.rotation[0],frame.rotation[1],frame.rotation[2]);
  model.children.forEach((cube,i)=>{cube.position.copy(frame.parts[i].position);cube.quaternion.copy(frame.parts[i].quaternion);});
  holder.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(holder,true);
  assert.ok(Math.max(-bounds.min.x,bounds.max.x,-bounds.min.y,bounds.max.y)<2.65,`clipped at ${t}s`);
 }
});
