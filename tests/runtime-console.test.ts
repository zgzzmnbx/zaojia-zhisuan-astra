import test from 'node:test';
import assert from 'node:assert/strict';
import {clampConsole,mergeConsoleEvents,type ConsoleEvent,type ConsoleSnapshot} from '../03-Src/studio/runtime-console.ts';
const row=(id:number):ConsoleEvent=>({id,time:'2026-10-11T00:00:00Z',level:'info',source:'宿主',message:'记录'});
const snapshot=(events:ConsoleEvent[],extra:Partial<ConsoleSnapshot>={}):ConsoleSnapshot=>({events,instance:'a',cursor:4,capacity:3,reset:false,truncated:false,uptime:1,active:[],...extra});
test('incremental records deduplicate and preserve bounded history',()=>{
 assert.deepEqual(mergeConsoleEvents([row(1),row(2)],snapshot([row(2),row(3),row(4)]),'a').map(r=>r.id),[2,3,4]);
});
test('host restart does not mix reused event IDs with old process history',()=>{
 assert.deepEqual(mergeConsoleEvents([row(5)],snapshot([row(1)],{instance:'b',reset:true}),'a').map(r=>r.id),[1]);
});
test('drag and resize stay inside resized desktop viewport',()=>{
 assert.deepEqual(clampConsole({x:1900,y:-10,width:560,height:700},1000,600),{x:428,y:12,width:560,height:576});
 assert.deepEqual(clampConsole({x:10,y:10,width:50,height:40},1440,900),{x:12,y:12,width:420,height:300});
});
