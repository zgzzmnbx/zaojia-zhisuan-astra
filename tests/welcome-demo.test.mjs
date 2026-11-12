import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceWelcome,welcomeBeat,WELCOME_STAGES} from '../03-Src/studio/welcome-demo.mjs';
import {readWelcomeStyle,writeWelcomeStyle,welcomeStyleKey} from '../03-Src/studio/welcome-preferences.ts';

test('welcome style defaults to the new hero without rewriting existing skip preferences',()=>{
 const values=new Map([['astra.skip-welcome.v1','true']]);const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 assert.equal(readWelcomeStyle(storage),'hero');
 assert.equal(writeWelcomeStyle('classic',storage),'');assert.equal(readWelcomeStyle(storage),'classic');
 assert.equal(values.get('astra.skip-welcome.v1'),'true');
 assert.equal(writeWelcomeStyle('hero',storage),'');assert.equal(readWelcomeStyle(storage),'hero');
 values.set(welcomeStyleKey,'unknown');assert.equal(readWelcomeStyle(storage),'hero');
});
test('unavailable browser storage still has a usable default and reports save failure',()=>{
 const storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(readWelcomeStyle(storage),'hero');assert.match(writeWelcomeStyle('classic',storage),/无法保存/);
});
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
