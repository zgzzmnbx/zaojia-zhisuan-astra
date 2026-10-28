import test from 'node:test';
import assert from 'node:assert/strict';
import {createScenePreparation} from '../03-Src/studio/project-sandbox/scene-preparation.mjs';

function fixture(){
 let id=0;const idle=new Map(),doc=new EventTarget();doc.hidden=false;
 const host={requestIdleCallback(fn){idle.set(++id,fn);return id},cancelIdleCallback(id){idle.delete(id)},clearTimeout(){}};
 const flush=async()=>{const callbacks=[...idle.values()];idle.clear();callbacks.forEach(fn=>fn());for(let i=0;i<5;i++)await Promise.resolve()};
 return {host,doc,idle,flush};
}
test('preparation yields between finite stages and does not run while the page is hidden',async()=>{
 const f=fixture(),queue=createScenePreparation(f),ran=[];
 const result=queue.run([()=>ran.push('textures'),()=>ran.push('focus'),()=>ran.push('assembly')]);
 await f.flush();assert.deepEqual(ran,['textures']);
 f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));await f.flush();assert.deepEqual(ran,['textures']);assert.equal(f.idle.size,0);
 f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));await f.flush();assert.deepEqual(ran,['textures','focus']);
 await f.flush();assert.equal(await result,true);assert.deepEqual(ran,['textures','focus','assembly']);assert.equal(f.idle.size,0);queue.dispose();
});
test('teardown cancels a paused preparation and any remaining work',async()=>{
 const f=fixture(),queue=createScenePreparation(f);let ran=0;f.doc.hidden=true;
 const result=queue.run([()=>ran++]);queue.dispose();assert.equal(await result,false);
 f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));await f.flush();assert.equal(ran,0);assert.equal(f.idle.size,0);
});
test('teardown during an asynchronous compile prevents the next stage',async()=>{
 const f=fixture(),queue=createScenePreparation(f);let complete,ran=0;
 const result=queue.run([()=>new Promise(resolve=>complete=resolve),()=>ran++]);
 await f.flush();queue.dispose();complete();assert.equal(await result,false);await f.flush();assert.equal(ran,0);
});
