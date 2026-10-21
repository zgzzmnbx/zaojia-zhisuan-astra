import test from 'node:test';
import assert from 'node:assert/strict';
import {readSandboxEffects,sandboxEffectControls} from '../03-Src/studio/project-sandbox/effect-settings.ts';

test('effect preferences preserve explicit off and migrate legacy enhancement without changing storage',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const values=new Map<string,string>([['astra.sandbox.enhanced','off']]);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null}});
 try{
  assert.deepEqual(readSandboxEffects(),{solidVersion:false,studioLighting:false,softShadows:false,bakedLighting:false,brightBackground:false,nightBloom:true});
  values.set('astra.sandbox.studio-lighting','on');values.set('astra.sandbox.night-bloom','off');
  assert.equal(readSandboxEffects().studioLighting,true);assert.equal(readSandboxEffects().nightBloom,false);
  assert.equal(values.size,3);
  values.clear();for(const c of sandboxEffectControls)values.set('astra.sandbox.'+c.key,'off');
  assert.ok(Object.values(readSandboxEffects()).every(v=>v===false));
  values.clear();values.set('astra.sandbox.surface-detail','off');
  assert.deepEqual(readSandboxEffects(),{solidVersion:false,studioLighting:true,softShadows:false,bakedLighting:false,brightBackground:true,nightBloom:true});
  values.set('astra.sandbox.solid-version','on');assert.equal(readSandboxEffects().solidVersion,true);values.set('astra.sandbox.solid-version','off');assert.equal(readSandboxEffects().solidVersion,false);
  values.set('astra.sandbox.soft-shadows','on');assert.equal(readSandboxEffects().softShadows,true);
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage;}
});
