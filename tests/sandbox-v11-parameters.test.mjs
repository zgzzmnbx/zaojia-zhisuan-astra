import test from 'node:test';
import assert from 'node:assert/strict';
import {sandboxParameterDefaults} from '../03-Src/studio/project-sandbox/defaults.ts';
import {normalizeBakedSettings,readBakedSettings} from '../03-Src/studio/project-sandbox/baked-settings.ts';
import {readVisualMode} from '../03-Src/studio/project-sandbox/visual-mode-settings.ts';
import {readDisplayParameters,sandboxParametersKey} from '../03-Src/studio/project-sandbox/parameter-storage.ts';
import {normalizeSandboxParameters,saveCurrentParameters,readPersonalParameters} from '../03-Src/studio/project-sandbox/parameter-settings.ts';
import {readAppearance,appearanceKey} from '../03-Src/studio/appearance.ts';
import fs from 'node:fs';
import {DEFAULT_GALAXY_SETTINGS} from '../03-Src/studio/knowledge-articles/galaxy-settings.mjs';
function storage(run){const values=new Map(),prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});try{run(values)}finally{if(prior)Object.defineProperty(globalThis,'localStorage',prior);else delete globalThis.localStorage}}

test('built-in defaults match the approved current browser rather than its older saved profile',()=>{
 const captured=JSON.parse(fs.readFileSync(new URL('../00-docs/handoff/2026-10-28-v0.11.21-默认参数快照.json',import.meta.url),'utf8'));
 const current=normalizeSandboxParameters(null),{conveyor,...priorBaked}=current.baked;
 assert.deepEqual({...current,baked:priorBaked},captured.sandbox);
 assert.deepEqual(conveyor,{visible:true,continuous:true,style:'building-blue-edge',nightBrightness:100,weather:'clear',weatherStrength:1});
 assert.deepEqual(DEFAULT_GALAXY_SETTINGS,{...captured.galaxy,unselectedOpacity:.5,unrelatedLinkBrightness:.05});
});

test('conveyor looks and night brightness extend older saved settings without overwriting them',()=>{
 const old=normalizeBakedSettings({conveyor:{visible:false,continuous:false,weather:'snow',weatherStrength:.5}});
 assert.equal(old.conveyor.visible,false);assert.equal(old.conveyor.continuous,false);
 assert.equal(old.conveyor.style,'building-blue-edge');assert.equal(old.conveyor.nightBrightness,100);
 assert.equal(normalizeBakedSettings({conveyor:{style:'pale-blue'}}).conveyor.style,'pale-blue');
 assert.equal(normalizeBakedSettings({conveyor:{style:'building-white',nightBrightness:0}}).conveyor.nightBrightness,0);
 assert.equal(normalizeBakedSettings({conveyor:{style:'building-blue-edge',nightBrightness:250}}).conveyor.nightBrightness,200);
 assert.equal(normalizeBakedSettings({conveyor:{style:'invalid',nightBrightness:-2}}).conveyor.style,'building-blue-edge');
});

test('restoring defaults is a complete independent preview until the explicit save',()=>storage(values=>{
 const personal=normalizeSandboxParameters({baked:{nightSettings:{shell:90},waterSettings:{enabled:false},zoom:150},visual:{city:{baked:false}},display:{roofLabels:false,autoOrbit:false,infoVisible:false,chatTransparency:0,cardTransparency:20,orbitDelay:60}});
 assert(saveCurrentParameters(personal));const original=values.get(sandboxParametersKey),restored=normalizeSandboxParameters(null);
 assert.deepEqual(restored,{version:1,...sandboxParameterDefaults});assert.equal(values.get(sandboxParametersKey),original);
 restored.baked.waterSettings.enabled=false;assert.equal(normalizeSandboxParameters(null).baked.waterSettings.enabled,true);
 assert(saveCurrentParameters(normalizeSandboxParameters(null)));assert.deepEqual(readPersonalParameters(),{version:1,...sandboxParameterDefaults});
}));

test('no personal save loads the exact approved full snapshot without creating a saved record',()=>storage(values=>{
 const all=normalizeSandboxParameters(null);assert.deepEqual(all,{version:1,...sandboxParameterDefaults});
 assert.deepEqual(readBakedSettings(),all.baked);assert.deepEqual(readVisualMode(),all.visual);assert.deepEqual(readDisplayParameters(),all.display);assert.equal(readPersonalParameters(),null);assert.equal(values.size,0);
}));

test('only explicit save persists all view parameters; later preview changes do not mutate the saved snapshot',()=>storage(values=>{
 const preview=normalizeSandboxParameters({baked:{distance:35,paintStrength:0,waterSettings:{enabled:false,speed:0},uplightSettings:{day:{brightness:0}}},visual:{city:{baked:false},dof:true,strength:0},display:{cardTransparency:20,chatTransparency:0,roofLabels:false,infoVisible:false,autoOrbit:false,orbitDelay:10}});
 assert.equal(values.size,0);assert(saveCurrentParameters(preview));const saved=values.get(sandboxParametersKey);assert.equal(values.size,1);
 assert.deepEqual(readPersonalParameters(),preview);assert.deepEqual(readBakedSettings(),preview.baked);assert.deepEqual(readVisualMode(),preview.visual);assert.deepEqual(readDisplayParameters(),preview.display);
 preview.baked.modelBrightness=70;preview.display.cardTransparency=80;preview.visual.strength=.9;assert.equal(values.get(sandboxParametersKey),saved);assert.equal(readBakedSettings().modelBrightness,145);
}));

test('personal profile overrides legacy autosaves while global palette and theme remain independent',()=>storage(values=>{
 values.set(appearanceKey,JSON.stringify({palette:'emerald',dark:true,sandboxChatTransparency:80,sandboxRoofLabels:false,sandboxAutoOrbit:false,sandboxOrbitDelay:60}));
 let a=readAppearance();assert.equal(a.palette,'emerald');assert(a.dark);assert.equal(a.sandboxChatTransparency,15);assert(a.sandboxRoofLabels);assert(a.sandboxAutoOrbit);assert.equal(a.sandboxOrbitDelay,2);
 assert(saveCurrentParameters(normalizeSandboxParameters({display:{chatTransparency:0,roofLabels:false,autoOrbit:false,orbitDelay:30}})));
 a=readAppearance();assert.equal(a.palette,'emerald');assert(a.dark);assert.equal(a.sandboxChatTransparency,0);assert.equal(a.sandboxRoofLabels,false);assert.equal(a.sandboxAutoOrbit,false);assert.equal(a.sandboxOrbitDelay,30);
}));

test('malformed or unsupported save records fall back safely without deleting the old value',()=>storage(values=>{
 for(const raw of ['bad','null','[]',JSON.stringify({version:2,baked:{},visual:{},display:{}}),JSON.stringify({version:1,baked:[],visual:{},display:{}})]){
  values.set(sandboxParametersKey,raw);assert.equal(readPersonalParameters(),null);assert.deepEqual(readBakedSettings(),sandboxParameterDefaults.baked);assert.deepEqual(readDisplayParameters(),sandboxParameterDefaults.display);assert.equal(values.get(sandboxParametersKey),raw);
 }
}));

test('storage refusal preserves the previous complete personal profile',()=>storage(values=>{
 const first=normalizeSandboxParameters({baked:{distance:40}});assert(saveCurrentParameters(first));const previous=values.get(sandboxParametersKey);
 globalThis.localStorage.setItem=()=>{throw Error('quota')};assert.equal(saveCurrentParameters(normalizeSandboxParameters({baked:{distance:120}})),false);assert.equal(values.get(sandboxParametersKey),previous);assert.deepEqual(readPersonalParameters(),first);
}));
