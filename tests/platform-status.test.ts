import test from 'node:test';
import assert from 'node:assert/strict';
import {platformStatus,platformTone,type BotProfile,type StatusSnapshot} from '../03-Src/studio/platform-status.ts';
const snapshot=(profile?:Partial<BotProfile>):StatusSnapshot=>({data:{profiles:profile?[{profile_id:'default',...profile}]:[]},error:'',checkedAt:Date.now()});
test('unread, unreachable and unconfigured remain distinct',()=>{
 assert.equal(platformStatus({data:null,error:'',checkedAt:null},'default'),'未检测');
 assert.equal(platformStatus({...snapshot(),error:'offline'},'default'),'检测失败');
 assert.equal(platformStatus(snapshot(),'default'),'未配置');
});
test('configuration, process and stale heartbeat cannot imply a connected platform',()=>{
 assert.equal(platformStatus(snapshot({configured:true}),'default'),'未启用');
 assert.equal(platformStatus(snapshot({configured:true,enabled:true,status:'starting'}),'default'),'未运行');
 assert.equal(platformStatus(snapshot({configured:true,running:true,health:{healthy:true}}),'default'),'心跳异常');
});
test('platform identity, backend and delivery health must all pass',()=>{
 const p:BotProfile={profile_id:'default',configured:true,running:true,enabled:true,health:{fresh:true,connected:true,identity_ready:true,backend_ok:true,healthy:true}};
 assert.equal(platformStatus(snapshot(p),'default'),'运行中');
 assert.equal(platformStatus(snapshot(p),'weact_cost'),'未配置');
 for(const [field,label] of [['connected','连接中断'],['identity_ready','身份待恢复'],['backend_ok','后端异常'],['healthy','健康异常']] as const)
  assert.equal(platformStatus(snapshot({...p,health:{...p.health,[field]:false}}),'default'),label);
 assert.equal(platformStatus(snapshot({...p,health:{...p.health,queues:{outbox:{failed:1}}}}),'default'),'有失败消息');
 assert.equal(platformStatus(snapshot({...p,health:{...p.health,queues:{outbox:{pending:1}}}}),'default'),'待补发');
 assert.equal(platformStatus({...snapshot(p),error:'offline'},'default'),'检测失败');
});

test('top-right faults distinguish a stopped receiver, blocked recovery, lost supervision and stale reads',()=>{
 const p:BotProfile={profile_id:'default',configured:true,enabled:true,running:true,supervision_ok:true,health:{fresh:true,connected:true,identity_ready:true,backend_ok:true,healthy:true}};
 assert.equal(platformStatus(snapshot({...p,running:false}),'default'),'未运行');
 assert.equal(platformStatus(snapshot({...p,running:false,recovery_issue:'old queue'}),'default'),'恢复受阻');
 assert.equal(platformStatus(snapshot({...p,supervision_ok:false}),'default'),'监护异常');
 assert.equal(platformStatus({...snapshot(p),checkedAt:100},'default',20101),'状态过期');
 for(const state of ['未运行','连接中断','身份待恢复','后端异常','恢复受阻','监护异常','状态过期','检测失败'])assert.equal(platformTone(state),'error');
 for(const state of ['未启用','未配置'])assert.equal(platformTone(state),'warning');
 assert.equal(platformTone('运行中'),'healthy');
});
