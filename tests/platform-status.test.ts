import test from 'node:test';
import assert from 'node:assert/strict';
import {platformStatus,type BotProfile,type StatusSnapshot} from '../03-Src/studio/platform-status.ts';
const snapshot=(profile?:Partial<BotProfile>):StatusSnapshot=>({data:{profiles:profile?[{profile_id:'default',...profile}]:[]},error:'',checkedAt:1});
test('unread, unreachable and unconfigured remain distinct',()=>{
 assert.equal(platformStatus({data:null,error:'',checkedAt:null},'default'),'未检测');
 assert.equal(platformStatus({...snapshot(),error:'offline'},'default'),'检测失败');
 assert.equal(platformStatus(snapshot(),'default'),'未配置');
});
test('configuration, process and stale heartbeat cannot imply a connected platform',()=>{
 assert.equal(platformStatus(snapshot({configured:true}),'default'),'已关闭');
 assert.equal(platformStatus(snapshot({configured:true,enabled:true}),'default'),'启动中');
 assert.equal(platformStatus(snapshot({configured:true,running:true,health:{healthy:true}}),'default'),'待核验');
});
test('platform identity, backend and delivery health must all pass',()=>{
 const p:BotProfile={profile_id:'default',configured:true,running:true,enabled:true,health:{fresh:true,connected:true,identity_ready:true,backend_ok:true,healthy:true}};
 assert.equal(platformStatus(snapshot(p),'default'),'运行中');
 assert.equal(platformStatus(snapshot(p),'weact_cost'),'未配置');
 for(const [field,label] of [['connected','重连中'],['identity_ready','身份待恢复'],['backend_ok','后端异常'],['healthy','待核验']] as const)
  assert.equal(platformStatus(snapshot({...p,health:{...p.health,[field]:false}}),'default'),label);
 assert.equal(platformStatus(snapshot({...p,health:{...p.health,queues:{outbox:{failed:1}}}}),'default'),'有失败消息');
 assert.equal(platformStatus(snapshot({...p,health:{...p.health,queues:{outbox:{pending:1}}}}),'default'),'待补发');
 assert.equal(platformStatus({...snapshot(p),error:'offline'},'default'),'检测失败');
});
