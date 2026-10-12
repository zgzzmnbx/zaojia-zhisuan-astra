import test from 'node:test';
import assert from 'node:assert/strict';
import {gorkPlatformPresentation,type GorkPlatform} from '../03-Src/studio/gork-platform-status.ts';
const connected:GorkPlatform={state:'connected',message:'Gork 已连接',checked_at:10,worker_running:true,robot_connected:true,notifications_enabled:true};
test('Gork icon distinguishes a stopped platform, healthy link and connection error',()=>{
 assert.equal(gorkPlatformPresentation(connected,false,11000).tone,'connected');
 assert.match(gorkPlatformPresentation(connected,false,11000).label,/Watch 已连接/);
 assert.equal(gorkPlatformPresentation({...connected,state:'offline'},false,11000).tone,'offline');
 assert.equal(gorkPlatformPresentation({...connected,state:'error'},false,11000).tone,'error');
 assert.equal(gorkPlatformPresentation(null).tone,'offline');
});
test('stale health, lost sender and failed Astra request cannot remain green',()=>{
 assert.equal(gorkPlatformPresentation(connected,false,31000).tone,'error');
 assert.equal(gorkPlatformPresentation({...connected,worker_running:false},false,11000).tone,'error');
 assert.equal(gorkPlatformPresentation(connected,true,11000).tone,'error');
 assert.match(gorkPlatformPresentation({...connected,notifications_enabled:false},false,11000).label,/阶段通知已关闭/);
});
