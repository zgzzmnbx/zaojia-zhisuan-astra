import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {customGorkEntries} from '../03-Src/studio/gork-custom-data.ts';
import {normalizeGorkPreferences,gorkExpression} from '../03-Src/studio/gork-preferences.ts';
import {mountGorkPlayer} from '../03-Src/studio/gork-custom.ts';

function runtime(){
 const frames=new Map<number,Function>();let id=0;
 const context:any={performance:{now:()=>0},requestAnimationFrame:(fn:Function)=>{frames.set(++id,fn);return id;},cancelAnimationFrame:(id:number)=>frames.delete(id),document:{hidden:false,addEventListener(){},removeEventListener(){}},addEventListener(){},removeEventListener(){}};
 context.window=context;vm.createContext(context);
 for(const f of ['gork-config.js','gork-pens.js','scene-controller.js','gork-player.js'])vm.runInContext(readFileSync(new URL('../public/gork/motion/'+f,import.meta.url),'utf8'),context);
 context.GorkRenderer={create:()=>({draw(){}})};
 return {context,frames};
}
test('classic scene modules load in dependency order before the React bundle',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const files=['gork-config.js','gork-pens.js','scene-controller.js','gork-renderer.js','gork-player.js'];
 const positions=files.map(f=>html.indexOf('/gork/motion/'+f));
 assert.ok(positions.every((p,i)=>p>=0&&(i===0||p>positions[i-1])));
 assert.ok(positions.at(-1)!<html.indexOf('/03-Src/studio/App.tsx'));
});
test('three saved custom expressions retain the user configurations and normalize as preferences',()=>{
 assert.deepEqual(customGorkEntries.map(e=>e.name),['我的加载1','我的疑惑','我的书写']);
 const {context}=runtime();
 for(const e of customGorkEntries){assert.deepEqual(JSON.parse(JSON.stringify(context.GorkConfig.validate(e.config))),JSON.parse(JSON.stringify(e.config)));}
 const writing=customGorkEntries.find(e=>e.scene==='writing')!;
 assert.equal(writing.config.scenes.writing.writing.x,-104);assert.equal(writing.config.scenes.writing.writing.scale,1.85);
 assert.equal(customGorkEntries[0].config.scenes.loading.motion.enterMs,850);
 const preset={id:'gork',name:'Gork',colors:{body:'#000000',eyes:'#ffffff'}};
 for(const e of customGorkEntries){const prefs=normalizeGorkPreferences({expressions:{processing:e.id}},[preset],['idle','working','happy','confused',...customGorkEntries.map(e=>e.id)]);assert.equal(gorkExpression('working',prefs),e.id);assert.equal(gorkExpression('thinking',prefs),e.id);}
});
test('custom scenes progress in time and release their animation frame when disposed',()=>{
 for(const entry of customGorkEntries){
  const {context,frames}=runtime();let last:any;
  const canvas={width:232,height:232,getBoundingClientRect:()=>({width:116,height:116})};
  const player=context.GorkScenePlayer.mount(canvas,entry.config,{onFrame:(state:any)=>last=state});player.set(entry.scene,{force:true});
  for(let n=1;n<=100;n++){const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(n*100);}
  assert.equal(last.scene,entry.scene);assert.equal(last.elapsed,10000);assert.equal(last.reducedMotion,false);
  assert.equal(frames.size,1);player.dispose();assert.equal(frames.size,0);
 }
});
test('switching standard and custom expressions retains one player and disposes the old renderer',()=>{
 let active=0,mounts=0;
 const create=()=>{active++;mounts++;return {set(){},dispose(){active--;}};};
 (globalThis as any).window={GorkAvatar:{mount:create},GorkScenePlayer:{mount:create}};
 try{
  const player=mountGorkPlayer({} as HTMLCanvasElement,{}, {still:false,expression:'idle',appearance:{id:'gork'}});
  player.set('happy');assert.equal(mounts,1);assert.equal(active,1);
  for(const entry of customGorkEntries){player.set(entry.id);assert.equal(active,1);}
  player.set('idle');assert.equal(active,1);player.dispose();assert.equal(active,0);
 }finally{delete (globalThis as any).window;}
});
