import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readBackgrounds,backgroundKey,validBackground} from '../03-Src/studio/project-sandbox/scene-theme.ts';
import {readSandboxEffects} from '../03-Src/studio/project-sandbox/effect-settings.ts';
test('retired effect preferences stay archived and cannot restore old runtime paths',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const values=new Map([[backgroundKey,JSON.stringify({classic:'#FFFFFF',solid:'#123456'})],['astra.sandbox.solid-version','on'],['astra.sandbox.local-surface','on'],['astra.sandbox.baked-lighting','on']]);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null}});
 try{
  assert.deepEqual(readBackgrounds(),{classic:'#ffffff'});assert.equal(validBackground('url(test)'),null);
  const effects=readSandboxEffects();assert(!('localSurface'in effects));assert(!('bakedLighting'in effects));assert.equal(values.size,4);
  for(const file of ['scene.mjs','ProjectSandbox.tsx','lighting.mjs'])assert(!/solidVersion|solidSettings|loadLocalSurface|bakedLighting/.test(fs.readFileSync('03-Src/studio/project-sandbox/'+file,'utf8')));
  for(const file of ['solid-materials.mjs','solid-lighting.mjs','local-surface.mjs'])assert(!fs.existsSync('03-Src/studio/project-sandbox/'+file));
 }finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete (globalThis as any).localStorage}
});
