import test from 'node:test';
import assert from 'node:assert/strict';
import {readSandboxEffects,sandboxEffectControls,sandboxEffectDisabled} from '../03-Src/studio/project-sandbox/effect-settings.ts';

test('effect preferences preserve explicit off and migrate legacy enhancement without changing storage',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const values=new Map<string,string>([['astra.sandbox.enhanced','off']]);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null}});
 try{
  assert.deepEqual(readSandboxEffects(),{solidVersion:false,studioLighting:false,softShadows:false,bakedLighting:false,brightBackground:false,nightBloom:true,localSurface:false});
  values.set('astra.sandbox.studio-lighting','on');values.set('astra.sandbox.night-bloom','off');
  assert.equal(readSandboxEffects().studioLighting,true);assert.equal(readSandboxEffects().nightBloom,false);
  assert.equal(values.size,3);
  values.clear();for(const c of sandboxEffectControls)values.set('astra.sandbox.'+c.key,'off');
  assert.ok(Object.values(readSandboxEffects()).every(v=>v===false));
  values.clear();values.set('astra.sandbox.surface-detail','off');
  assert.deepEqual(readSandboxEffects(),{solidVersion:false,studioLighting:true,softShadows:false,bakedLighting:false,brightBackground:true,nightBloom:true,localSurface:false});
  values.set('astra.sandbox.solid-version','on');assert.equal(readSandboxEffects().solidVersion,true);values.set('astra.sandbox.solid-version','off');assert.equal(readSandboxEffects().solidVersion,false);
  values.set('astra.sandbox.soft-shadows','on');assert.equal(readSandboxEffects().softShadows,true);
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage;}
});

test('solid day locks preset controls but leaves the water effect usable at night',()=>{
 const on={solidVersion:true,studioLighting:true,softShadows:true,bakedLighting:true,brightBackground:true,nightBloom:true,localSurface:true};
 assert.equal(sandboxEffectDisabled('solidVersion',on,false),false);
 assert.equal(sandboxEffectDisabled('studioLighting',on,false),true);
 assert.equal(sandboxEffectDisabled('bakedLighting',on,false),true);
 assert.equal(sandboxEffectDisabled('localSurface',on,false),true);
 assert.equal(sandboxEffectDisabled('nightBloom',on,false),false);
 assert.equal(sandboxEffectDisabled('localSurface',on,true),false,'night still applies the local surface');
 assert.equal(sandboxEffectDisabled('studioLighting',on,true),true,'day-only controls stay locked while solid is saved on');
 assert.equal(sandboxEffectDisabled('localSurface',{...on,solidVersion:false},false),false);
 assert.equal(sandboxEffectDisabled('solidVersion',on,false,true),true);
 assert.equal(sandboxEffectDisabled('localSurface',on,false,true),true);
});
