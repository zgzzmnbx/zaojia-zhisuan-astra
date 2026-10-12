import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceWelcome,welcomeBeat,WELCOME_STAGES} from '../03-Src/studio/welcome-demo.mjs';
test('welcome pipeline proceeds through every scene and wraps with elapsed remainder',()=>{
 let state={index:0,elapsed:0};for(let i=0;i<WELCOME_STAGES.length;i++){state=advanceWelcome(state,WELCOME_STAGES[i].duration);assert.equal(state.index,(i+1)%WELCOME_STAGES.length);assert.equal(state.elapsed,0);}
 assert.deepEqual(advanceWelcome({index:6,elapsed:5990},30),{index:0,elapsed:20});
});
test('paused time is not consumed and resumed stages retain their elapsed position',()=>{
 const state=advanceWelcome({index:2,elapsed:3000},0);assert.deepEqual(state,{index:2,elapsed:3000});assert.deepEqual(advanceWelcome(state,400),{index:3,elapsed:200});
});
test('long frame gaps remain bounded without changing cycle order',()=>{
 const duration=WELCOME_STAGES.reduce((n,s)=>n+s.duration,0);
 assert.deepEqual(advanceWelcome({index:3,elapsed:100},duration*100+200),{index:3,elapsed:300});
});

test('compact story gives every request a beat before its response, within 24 seconds',()=>{
 assert.equal(WELCOME_STAGES.reduce((n,s)=>n+s.duration,0),24000);
 assert.deepEqual(welcomeBeat({index:3,elapsed:600}),{index:3,reply:false});
 assert.deepEqual(welcomeBeat({index:3,elapsed:650}),{index:3,reply:true});
 assert.ok(WELCOME_STAGES.every(s=>s.duration>=2400));
});
