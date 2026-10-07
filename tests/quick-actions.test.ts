import test from 'node:test';
import assert from 'node:assert/strict';
import {quickUnavailable,quickCommands,quickDestinations,type QuickState} from '../03-Src/studio/quick-actions.ts';
const state:QuickState={ready:true,busy:false,connected:true,hasResult:true,completed:false};
test('quick matching only becomes available after a connected current conversion',()=>{
 assert.ok(quickUnavailable('match',{...state,ready:false}));assert.ok(quickUnavailable('match',{...state,connected:false}));assert.ok(quickUnavailable('match',{...state,hasResult:false}));assert.equal(quickUnavailable('match',state),undefined);assert.ok(quickUnavailable('match',{...state,completed:true}));
});
test('warning and risk report require completed current matching',()=>{
 for(const id of ['warning','risk-report']){assert.ok(quickUnavailable(id,state));assert.equal(quickUnavailable(id,{...state,completed:true}),undefined);assert.ok(quickUnavailable(id,{...state,completed:true,hasResult:false}));}
});
test('busy work blocks all mutating shortcuts while navigation stays available',()=>{
 for(const id of ['match','warning','risk-report'])assert.ok(quickUnavailable(id,{...state,completed:true,busy:true}));
 for(const [id] of [...quickDestinations,...quickCommands.filter(([id])=>!['match','warning','risk-report'].includes(id))])assert.equal(quickUnavailable(id,{ready:false,busy:true,connected:false,hasResult:false,completed:false}),undefined);
});
test('review shortcuts open existing preparation and status screens without a send action',()=>{
 assert.ok(quickCommands.some(([id])=>id==='collaboration'));assert.ok(quickCommands.some(([id])=>id==='review-progress'));assert.equal(quickCommands.some(([id])=>String(id).startsWith('send')),false);
});
