import test from 'node:test';
import assert from 'node:assert/strict';
import {readSceneTheme,sceneThemeKey,readSolidSettings,solidSettingsKey,solidLighting,normalizeSolidSettings,readBackgrounds,backgroundKey,validBackground} from '../03-Src/studio/project-sandbox/scene-theme.ts';
import {approvedLighting} from '../03-Src/studio/project-sandbox/lighting-trial.ts';
import {createStudioEnvironmentSlot} from '../03-Src/studio/project-sandbox/studio-environment.mjs';

test('old solid choice migrates without rewriting saved lighting; explicit theme takes precedence',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null}});
 try{
  assert.equal(readSceneTheme(),'classic');values.set('astra.sandbox.solid-version','on');assert.equal(readSceneTheme(),'solid');
  values.set(sceneThemeKey,'classic');assert.equal(readSceneTheme(),'classic');
  const official=approvedLighting(),solid=readSolidSettings();assert.equal(solid.lighting.cards.length,5);assert.equal(solid.lighting.cards[3].height,22);
  values.set(solidSettingsKey,JSON.stringify({...solid,lighting:{...solid.lighting,exposure:1.3,tankMetalness:.4},bakeStrength:0,effects:{...solid.effects,bakedLighting:false}}));
  assert.equal(readSolidSettings().lighting.exposure,1.3);assert.equal(readSolidSettings().bakeStrength,0);assert.equal(readSolidSettings().effects.bakedLighting,false);assert.deepEqual(approvedLighting(),official);
  values.set(backgroundKey,JSON.stringify({classic:'#ffffff',solid:'#123456'}));assert.deepEqual(readBackgrounds(),{classic:'#ffffff',solid:'#123456'});
  assert.equal(values.size,4);
 }finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete (globalThis as any).localStorage}
});
test('solid controls clamp malformed values and preserve five independent light cards',()=>{
 const s=normalizeSolidSettings({bakeStrength:-3,bakeBrightness:Infinity,lighting:{exposure:100,cards:[{enabled:false,power:0}]}});
 assert.equal(s.bakeStrength,0);assert.equal(s.bakeBrightness,1);assert.equal(s.lighting.exposure,1.5);assert.equal(s.lighting.cards.length,5);assert.equal(s.lighting.cards[0].enabled,false);assert.equal(s.lighting.cards[0].power,0);
 assert.equal(validBackground('url(example.com)'),null);assert.equal(validBackground('#FFFFFF'),'#ffffff');
 s.lighting.cards[4].power=0;assert.equal(solidLighting().cards[4].power,2.6);
});
test('changing a fifth light updates its capture once and releases it on disposal',()=>{
 let allocations=0,releases=0;const slot=createStudioEnvironmentSlot({fromScene(scene:any){assert.equal(scene.children.length,5);allocations++;return {texture:allocations,dispose(){releases++}}}});
 const settings=normalizeSolidSettings(null),config={background:[.62,.67,.73],target:[0,1.2,0],far:150};
 slot.update(settings.lighting.cards,config);settings.lighting.exposure=1.2;slot.update(settings.lighting.cards,config);assert.equal(allocations,1);
 settings.lighting.cards[4].power=3;slot.update(settings.lighting.cards,config);assert.equal(allocations,2);assert.equal(releases,1);slot.dispose();assert.equal(releases,2);
});
