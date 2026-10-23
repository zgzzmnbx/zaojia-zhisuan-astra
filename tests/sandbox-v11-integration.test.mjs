import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVisualMode,visualPresentation,visualModeKey} from '../03-Src/studio/project-sandbox/visual-mode-settings.ts';
import {createModeController} from '../03-Src/studies/sandbox-v11/mode-controller.js';

test('production defaults retain original mode; false and zero survive independently',()=>{
 assert.equal(normalizeVisualMode(null).mode,'original');
 assert.notEqual(visualModeKey,'astra.sandbox-v11.preview.v1');
 assert.deepEqual(normalizeVisualMode({mode:'baked',city:{original:false,baked:false},dof:false,strength:0}),{mode:'baked',city:{original:false,baked:false},dof:false,strength:0});
 assert.equal(normalizeVisualMode({strength:NaN}).strength,.4);
 assert.equal(normalizeVisualMode({strength:3}).strength,1);
});
test('night and assembly are presentation fallbacks without rewriting selected mode',()=>{
 const choice=normalizeVisualMode({mode:'baked'});
 for(const flags of [{dark:true,assembly:false},{dark:false,assembly:true},{dark:true,assembly:true}]){const p=visualPresentation(choice.mode,flags);assert.equal(p.mode,'original');assert(p.reason);assert.equal(choice.mode,'baked')}
 assert.deepEqual(visualPresentation(choice.mode,{dark:false,assembly:false}),{mode:'baked',reason:''});
});
test('pending baked load cannot activate after user returns original; both release on unmount',async()=>{
 let finish;const gate=new Promise(resolve=>finish=resolve),state={original:false,baked:false},released=[];
 const controller=createModeController({create:mode=>({ready:mode==='baked'?gate:Promise.resolve(),setActive:v=>state[mode]=v,dispose:()=>released.push(mode)})});
 await controller.switchMode('original');const late=controller.switchMode('baked');await Promise.resolve();await controller.switchMode('original');finish();await late;
 assert.deepEqual(state,{original:true,baked:false});controller.dispose();assert.deepEqual(state,{original:false,baked:false});assert.deepEqual(released.sort(),['baked','original']);
});
