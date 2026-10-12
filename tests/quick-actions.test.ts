import test from 'node:test';
import assert from 'node:assert/strict';
import {quickUnavailable,quickCommands,quickDestinations,quickPrompts,quickPrompt,resolveQuickCommand,type QuickState} from '../03-Src/studio/quick-actions.ts';
const state:QuickState={ready:true,busy:false,connected:true,hasResult:true,completed:false};
test('quick matching only becomes available after a connected current conversion',()=>{
 assert.ok(quickUnavailable('match',{...state,ready:false}));assert.ok(quickUnavailable('match',{...state,connected:false}));assert.ok(quickUnavailable('match',{...state,hasResult:false}));assert.equal(quickUnavailable('match',state),undefined);assert.ok(quickUnavailable('match',{...state,completed:true}));
});
test('warning and risk report require completed current matching',()=>{
 for(const id of ['warning','risk-report']){assert.ok(quickUnavailable(id,state));assert.equal(quickUnavailable(id,{...state,completed:true}),undefined);assert.ok(quickUnavailable(id,{...state,completed:true,hasResult:false}));}
});
test('busy work blocks execution and preparation while navigation stays available',()=>{
 for(const id of ['match','warning','risk-report'])assert.ok(quickUnavailable(id,{...state,completed:true,busy:true}));
 for(const [id] of [...quickDestinations,...quickCommands.filter(([id])=>!['match','warning','risk-report','document','collaboration','review-progress'].includes(id))])assert.equal(quickUnavailable(id,{ready:true,busy:true,connected:false,hasResult:false,completed:false}),undefined);
});
test('review shortcuts open existing preparation and status screens without a send action',()=>{
 assert.ok(quickCommands.some(([id])=>id==='collaboration'));assert.ok(quickCommands.some(([id])=>id==='review-progress'));assert.equal(quickCommands.some(([id])=>String(id).startsWith('send')),false);
});

test('every menu prompt round-trips to the same action including polite phrasing',()=>{
 for(const [id,prompt] of Object.entries(quickPrompts)){
  assert.equal(quickPrompt(id),prompt);
  for(const text of [prompt,`请${prompt}。`,`帮我${prompt}！`])assert.equal(resolveQuickCommand(text),id,text);
 }
 for(const [id] of [...quickCommands,...quickDestinations])assert.ok(quickPrompt(id),id);
 assert.equal(quickPrompt('unknown'),undefined);
});
test('whole-utterance shortcut recognition preserves questions, negation and quoted text',()=>{
 for(const text of ['不要打开设置','打开设置是什么意思','“打开设置”','请问公文转换怎么用？','#知识库：打开公文转换','打开设置然后发送同事复核','生成报告吗','如果生成报告失败怎么办'])assert.equal(resolveQuickCommand(text),undefined,text);
 assert.equal(resolveQuickCommand('公文转换'),'document');
 assert.equal(resolveQuickCommand('Excel 表格'),'table');
 assert.equal(resolveQuickCommand('查看任务轨迹'),'trace');
 assert.equal(resolveQuickCommand('打开 Word 分页预览'),'word');
});
test('restoring a conversation blocks all shortcuts and busy work blocks preparation',()=>{
 for(const id of Object.keys(quickPrompts))assert.ok(quickUnavailable(id,{...state,ready:false}),id);
 for(const id of ['document','mapping','collaboration','review-progress'])assert.ok(quickUnavailable(id,{...state,busy:true}),id);
});
