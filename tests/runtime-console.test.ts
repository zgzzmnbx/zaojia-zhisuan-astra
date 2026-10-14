import test from 'node:test';
import assert from 'node:assert/strict';
import {clampConsole,mergeConsoleEvents,consoleLine,consoleTime,type ConsoleEvent,type ConsoleSnapshot} from '../03-Src/studio/runtime-console.ts';
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
test('empty status polls preserve records but a reset clears the previous host history',()=>{
 const rows=[row(1),row(2)];
 assert.equal(mergeConsoleEvents(rows,snapshot([]),'a'),rows);
 assert.deepEqual(mergeConsoleEvents(rows,snapshot([],{reset:true}),'a'),[]);
 assert.deepEqual(mergeConsoleEvents(rows,snapshot([],{instance:'b'}),'a'),[]);
 assert.deepEqual(mergeConsoleEvents(rows,snapshot([],{capacity:1}),'a'),[rows[1]]);
});
test('shared console clock retains local time and searchable/exported evidence',()=>{
 const time='2026-10-14T09:23:45Z';
 assert.equal(consoleTime(time),new Date(time).toLocaleTimeString('zh-CN',{hour12:false}));
 assert.equal(consoleTime('invalid'),'Invalid Date');
 const text=consoleLine({...row(1),time,method:'POST',path:'/api/process',status:200,duration_ms:125,request_id:'request-1'});
 for(const expected of [consoleTime(time),'[INFO]','宿主','记录','POST /api/process','HTTP 200','125ms','#request-1'])assert.ok(text.includes(expected));
});
