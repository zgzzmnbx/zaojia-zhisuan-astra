import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBakedSettings,readBakedSettings,bakedSettingsKey} from '../03-Src/studio/project-sandbox/baked-settings.ts';
import {readVisualMode,visualModeKey} from '../03-Src/studio/project-sandbox/visual-mode-settings.ts';

test('v0.11.1 prefers baked once, while retaining the old choice and explicit later original selection',()=>{
 const data=new Map([['astra.sandbox.visual-modes.v1',JSON.stringify({mode:'original',city:{baked:false},dof:false,strength:0})]]);
 const before=data.get('astra.sandbox.visual-modes.v1');globalThis.localStorage={getItem:k=>data.get(k)??null};
 try{assert.deepEqual(readVisualMode(),{mode:'baked',city:{baked:false,original:false},dof:false,strength:0});assert.equal(data.get('astra.sandbox.visual-modes.v1'),before);
 data.set(visualModeKey,JSON.stringify({mode:'original'}));assert.equal(readVisualMode().mode,'original');}finally{delete globalThis.localStorage}
});
test('baked controls copy original once; subsequent changes cannot rewrite original settings',()=>{
 const data=new Map([['astra.sandbox.water.v1',JSON.stringify({enabled:false,speed:0,bloom:0})],['astra.sandbox.uplights.v1',JSON.stringify({day:{brightness:0,color:'#abcdef'}})],['astra.sandbox.flow','off'],['astra.sandbox.group-logo','hidden']]);
 const old=JSON.stringify([...data]);globalThis.localStorage={getItem:k=>data.get(k)??null};
 try{const copied=readBakedSettings();assert.equal(copied.waterSettings.enabled,false);assert.equal(copied.waterSettings.speed,0);assert.equal(copied.uplightSettings.day.brightness,0);assert.equal(copied.flow,false);assert.equal(copied.groupLogo,'hidden');assert.equal(copied.backgroundColor,'#f5f7fa');assert.equal(JSON.stringify([...data]),old);
 data.set(bakedSettingsKey,JSON.stringify({...copied,backgroundColor:'#ffffff',waterSettings:{...copied.waterSettings,enabled:true}}));assert.equal(readBakedSettings().backgroundColor,'#ffffff');assert(readBakedSettings().waterSettings.enabled);assert.equal(JSON.parse(data.get('astra.sandbox.water.v1')).enabled,false);
 }finally{delete globalThis.localStorage}
});
test('invalid sliders are bounded; zero paint and lamp power stay valid',()=>{
 const s=normalizeBakedSettings({paintStrength:0,backgroundBrightness:Infinity,modelBrightness:10000,backgroundColor:'javascript:bad',uplightSettings:{day:{brightness:0}},waterSettings:{speed:0}});
 assert.equal(s.paintStrength,0);assert.equal(s.backgroundBrightness,100);assert.equal(s.modelBrightness,150);assert.equal(s.backgroundColor,null);assert.equal(s.uplightSettings.day.brightness,0);assert.equal(s.waterSettings.speed,0);
});

test('original bake preset preserves custom parameters across switching and reload',()=>{
 const custom=normalizeBakedSettings({backgroundColor:'#ffffff',modelBrightness:75,paintStrength:80,waterSettings:{speed:95},uplightSettings:{day:{brightness:0}}});
 const original=normalizeBakedSettings(JSON.parse(JSON.stringify({...custom,preset:'original'})));
 assert.equal(original.preset,'original');assert.deepEqual({...original,preset:'adjusted'},custom);
 assert.deepEqual(normalizeBakedSettings({...original,preset:'adjusted'}),custom);
 assert.equal(normalizeBakedSettings({preset:'invalid'}).preset,'adjusted');
});
