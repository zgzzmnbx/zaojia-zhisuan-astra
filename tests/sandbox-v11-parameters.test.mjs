import test from 'node:test';
import assert from 'node:assert/strict';
import {sandboxParameterDefaults} from '../03-Src/studio/project-sandbox/defaults.ts';
import {readBakedSettings} from '../03-Src/studio/project-sandbox/baked-settings.ts';
import {readVisualMode} from '../03-Src/studio/project-sandbox/visual-mode-settings.ts';
import {readDisplayParameters,sandboxParametersKey} from '../03-Src/studio/project-sandbox/parameter-storage.ts';
import {normalizeSandboxParameters,saveCurrentParameters,readPersonalParameters} from '../03-Src/studio/project-sandbox/parameter-settings.ts';
import {readAppearance,appearanceKey} from '../03-Src/studio/appearance.ts';
function storage(run){const values=new Map(),prior=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});try{run(values)}finally{if(prior)Object.defineProperty(globalThis,'localStorage',prior);else delete globalThis.localStorage}}

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
