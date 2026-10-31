import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guideReply,readDigitalState,type DigitalState} from '../03-Src/modules/digital_cost/guide.ts';
import {digitalGuideMessage} from '../03-Src/modules/digital_cost/conversation-card.ts';
import type {Message} from '../03-Src/studio/types';
const state:DigitalState={taskId:'task_demo',revision:1,files:['演示.docx'],count:0,pending:0,action:'identify',scale:null,scaleReady:false,run:'',runId:'',purpose:'',busy:false,error:'',complete:false};
test('digital history becomes host cards without changing saved content or task identity',()=>{
 const original:Message={id:'one',role:'assistant',text:'已读入文档，请核对。',context:'chat-one',digital:{taskId:'task_one',sessionId:'session-one',revision:3,key:'one'},actions:[{label:'开始功能点分析',action:'digital-identify',primary:true},{label:'对照原文',action:'digital-evidence',primary:true}]};
 const before=structuredClone(original),shown=digitalGuideMessage(original);
 assert.deepEqual(original,before);assert.equal(shown.digital,original.digital);assert.equal(shown.context,original.context);
 assert.equal(shown.card?.note,original.text);assert.equal(shown.card?.status,'待分析');assert.deepEqual(shown.actions?.map(a=>a.action),original.actions?.map(a=>a.action));assert.equal(shown.actions?.filter(a=>a.primary).length,1);
});
test('ordinary answers, user messages and existing business cards remain untouched',()=>{
 for(const m of [{id:'1',role:'assistant',text:'普通回复'}, {id:'2',role:'user',text:'数字化项目造价'}, {id:'3',role:'assistant',text:'资料就位',card:{kind:'input',title:'资料',caption:'资料识别',icon:'sheet',status:'待确认'}}] as Message[])assert.equal(digitalGuideMessage(m),m);
});
test('digital loading and failure cards never imply completed analysis',()=>{
 const loading=digitalGuideMessage({id:'1',role:'assistant',text:'正在准备这份演示案例的分析结果。',actions:[{label:'查看识别进度',action:'digital-ai'}]});
 assert.equal(loading.card?.status,'处理中');assert.equal(loading.card?.tone,undefined);
 const failed=digitalGuideMessage({id:'2',role:'assistant',text:'连接中断',actions:[{label:'查看处理状态',action:'digital-ai'}]});
 assert.equal(failed.card?.kind,'error');assert.equal(failed.card?.status,'待重试');
});
test('upload never claims recognized functions or launches paid analysis',()=>{const r=guideReply(state);assert.match(r.text,/请选择/);assert.equal(r.actions[0].action,'digital-identify');assert.doesNotMatch(r.text,/已识别|已确认/);});
test('real boundary and failure states lead to review, not fabricated completion',()=>{assert.match(guideReply({...state,run:'running',purpose:'boundary'}).text,/系统边界/);assert.match(guideReply({...state,run:'failed'}).text,/尚未完成/);assert.equal(guideReply({...state,run:'succeeded',purpose:'boundary'}).actions[0].action,'digital-ai');});
test('fixed cases describe preparation and reject invalid demo flags',()=>{assert.match(guideReply({...state,demo:true,run:'running'}).text,/准备.*演示案例/);assert.doesNotMatch(guideReply({...state,demo:true,run:'running'}).text,/模型调用|DeepSeek|正在逐段分析/);assert.equal(readDigitalState({...state,demo:'yes'}),null);});
test('scale confirmation does not claim coefficients were inferred from missing conditions',()=>{const r=guideReply({...state,scaleReady:true,scale:'100'});assert.match(r.text,/100 FP/);assert.match(r.text,/没有说明的条件请你确认/);assert.equal(r.actions[0].action,'digital-prices');});
test('incomplete and error packets cannot declare completed costs',()=>{assert.match(guideReply({...state,complete:false}).text,/发起 AI/);assert.match(guideReply({...state,error:'连接中断',complete:true}).text,/没有完成/);assert.equal(guideReply({...state,complete:true}).actions[0].action,'digital-fees');});
test('invalid session payload is rejected and distinct tasks never share guide keys',()=>{for(const invalid of [null,{}, {...state,taskId:'job_1'}, {...state,revision:-1}, {...state,files:[42]}])assert.equal(readDigitalState(invalid),null);assert.notEqual(guideReply(state).key,guideReply({...state,taskId:'task_2'}).key);});

test("confirmed stages survive history loading without duplicate chat entries",()=>{const a={...state,scaleReady:true,scale:"100"};assert.equal(guideReply(a).key,guideReply({...a,run:"succeeded",runId:"later-loaded",action:"fees"}).key);assert.equal(guideReply({...a,complete:true}).key,guideReply({...a,complete:true,revision:4}).key);});
