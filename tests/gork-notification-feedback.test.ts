import test from 'node:test';
import assert from 'node:assert/strict';
import {debugSubmission,deliveryLabel,notificationFailure} from '../03-Src/studio/gork-notification-feedback.ts';

test('disabled source explains no send, permissions and old sentinel without requiring automatic output',()=>{
 const result=notificationFailure('调试通知未确认：EXTERNAL_CLIENT_DISABLED','send',true);
 assert.equal(result.title,'未发送 · Astra 来源未启用');
 assert.match(result.message,/先.*关闭旧 Astra.*再启用 Astra/);
 assert.equal(result.console,true);assert.equal(result.code,'EXTERNAL_CLIENT_DISABLED');
 assert.ok(!result.message.includes('启用阶段通知'));
});
test('network failures never claim an unconfirmed request was not sent',()=>{
 for(const raw of ['HTTP_ERROR','CONNECTION_UNAVAILABLE','Failed to fetch','NetworkError']){
  const result=notificationFailure(raw,'send');
  assert.equal(result.title,'发送结果尚未确认');assert.match(result.message,/避免重复发送/);
  assert.ok(!result.title.includes('未发送'));
 }
});
test('local admission reasons distinguish disabled stage, capacity and unconfirmed submission',()=>{
 const disabled=notificationFailure('此阶段未启用：ASTRA_GORK_STAGE_DISABLED','send');
 const full=notificationFailure('本地通知队列已满：ASTRA_GORK_QUEUE_FULL','send');
 assert.match(disabled.title,/此阶段未启用/);assert.match(disabled.message,/阶段设置.*保存/);
 assert.match(full.title,/本地通知队列已满/);assert.match(full.message,/过期.*自动清理/);
 assert.equal(disabled.console,false);assert.equal(full.console,false);
 assert.notEqual(disabled.message,full.message);
 const uncertain=notificationFailure('ASTRA_GORK_SUBMISSION_UNCONFIRMED','send');
 assert.equal(uncertain.title,'发送结果尚未确认');assert.match(uncertain.message,/回执.*避免重复/);
});
test('cancel and receipt failures do not overwrite original submission with a fake rejection',()=>{
 assert.equal(notificationFailure('HTTP_ERROR','cancel').title,'取消尚未确认');
 assert.equal(notificationFailure('HTTP_ERROR','receipt').title,'回执读取失败');
 assert.match(notificationFailure('EXTERNAL_OUTPUT_DENIED','delivery').title,/控制台未确认输出/);
});
test('permission, paused, unknown expression and expired cases give actionable Chinese reasons',()=>{
 for(const code of ['EXTERNAL_OUTPUT_DENIED','EXTERNAL_PRIORITY_DENIED','EXTERNAL_AUTH_REQUIRED','EXTERNAL_PAUSED','EXTERNAL_EXPRESSION_MISSING','EXTERNAL_EVENT_EXPIRED']){
  const result=notificationFailure(code,'send');assert.ok(!result.title.includes(code));assert.ok(result.message.length>10);assert.equal(result.code,code);
 }
 assert.match(notificationFailure('旧哨兵轮询仍运行','send',true).message,/关闭旧 Astra/);
});
test('local durable enqueue differs from confirmed queue and final output',()=>{
 assert.match(debugSubmission({status:'pending',remote_confirmed:false,delivery:{}}).label,/本地已提交.*尚未确认/);
 assert.equal(debugSubmission({status:'queued',remote_confirmed:true,delivery:{}}).label,'控制台已确认接收');
 assert.equal(debugSubmission({status:'queued',delivery:{}}).label,'控制台已确认接收');
 assert.match(debugSubmission({status:'completed',remote_confirmed:true,delivery:{speech:'completed_by_os'}}).message,/实际听测/);
 assert.match(debugSubmission({status:'failed',remote_confirmed:false,delivery:{}}).label,/尚未确认/);
 assert.equal(debugSubmission({status:'cancelled',remote_confirmed:true,delivery:{}}).label,'本地已取消');
});
test('human delivery labels preserve an untranslated value only in diagnostic payload',()=>{
 assert.equal(deliveryLabel('device_acknowledged'),'设备已确认');
 assert.equal(deliveryLabel('not_requested'),'未请求输出');assert.equal(deliveryLabel('completed_by_os'),'系统播放完成');assert.equal(deliveryLabel('device_playback_completed'),'设备播放完成');assert.equal(deliveryLabel('future_unknown'),'待核对');
});
