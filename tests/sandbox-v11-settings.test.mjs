import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBakedSettings,readBakedSettings,bakedSettingsKey} from '../03-Src/studio/project-sandbox/baked-settings.ts';
import {readVisualMode,visualModeKey} from '../03-Src/studio/project-sandbox/visual-mode-settings.ts';

test('legacy automatic mode and material keys do not override the approved defaults',()=>{
 const data=new Map([['astra.sandbox.visual-modes.v1',JSON.stringify({mode:'original',city:{baked:false},dof:true,strength:0})],[bakedSettingsKey,JSON.stringify({modelBrightness:70})]]);
 const before=JSON.stringify([...data]);globalThis.localStorage={getItem:k=>data.get(k)??null};
 try{assert.deepEqual(readVisualMode(),{mode:'baked',city:{baked:true},dof:false,strength:.4});assert.equal(readBakedSettings().modelBrightness,145);assert.equal(readBakedSettings().backgroundBrightness,105);assert.equal(JSON.stringify([...data]),before)}finally{delete globalThis.localStorage}
});

test('invalid sliders are bounded; zero paint and lamp power stay valid',()=>{
 const s=normalizeBakedSettings({paintStrength:0,backgroundBrightness:Infinity,modelBrightness:10000,backgroundColor:'javascript:bad',uplightSettings:{day:{brightness:0}},waterSettings:{speed:0}});
 assert.equal(s.paintStrength,0);assert.equal(s.backgroundBrightness,105);assert.equal(s.modelBrightness,150);assert.equal(s.backgroundColor,null);assert.equal(s.uplightSettings.day.brightness,0);assert.equal(s.waterSettings.speed,0);
});

test('original bake preset preserves custom parameters across switching and reload',()=>{
 const custom=normalizeBakedSettings({backgroundColor:'#ffffff',modelBrightness:75,paintStrength:80,waterSettings:{speed:95},uplightSettings:{day:{brightness:0}}});
 const original=normalizeBakedSettings(JSON.parse(JSON.stringify({...custom,preset:'original'})));
 assert.equal(original.preset,'original');assert.deepEqual({...original,preset:'adjusted'},custom);
 assert.deepEqual(normalizeBakedSettings({...original,preset:'adjusted'}),custom);
 assert.equal(normalizeBakedSettings({preset:'invalid'}).preset,'adjusted');
});
