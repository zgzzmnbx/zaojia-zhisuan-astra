import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createPointerLook,attachGorkPointer} from '../03-Src/studio/gork-pointer.ts';
import {createGorkController} from '../03-Src/studio/gork-motion.ts';
const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const hashes:Record<string,string>={
 'public/gork/avatar-engine.js':'9b4367bcb66db1a1155b0af70956d313a0af16e3',
 'public/gork/avatar-presets.js':'45d5ea820f23be252bc292dff08d44a68384a549',
 'public/gork/gork-appearance.js':'f9acd83dfa41bd99fa254138fb98541b5952d707',
 '03-Src/vendor/gork/gork-avatar.js':'a9d9701c65f2e9cf44c9d0b906af1e38790fd3cc',
 '03-Src/vendor/gork/gork-catalog.js':'43e75b74504e714fa1cab99c5c7e435759f56202',
};
test('upstream blobs match after normalizing the explicit-playback-only renderer option',()=>{
 for(const [file,expected] of Object.entries(hashes)){const bytes=Buffer.from(read(file).replace('(options.forceMotion||!reducedMotion?.matches)','!reducedMotion?.matches'));assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),expected,file);}
});
function consoleFixture(options:any={},reduced=false){
 let clock=0,id=0;const frames=new Map<number,(t:number)=>void>(),drawn:any[]=[];
 const scope:any={performance:{now:()=>clock},requestAnimationFrame:(f:(t:number)=>void)=>{frames.set(++id,f);return id},cancelAnimationFrame:(id:number)=>frames.delete(id),devicePixelRatio:1,matchMedia:()=>({matches:reduced}),Path2D:class {path:string;constructor(path:string){this.path=path}},Date};scope.window=scope;
 vm.createContext(scope);for(const f of ['public/gork/avatar-engine.js','public/gork/avatar-presets.js','public/gork/gork-appearance.js','03-Src/vendor/gork/gork-catalog.js','03-Src/vendor/gork/gork-avatar.js'])vm.runInContext(read(f),scope);
 const draw=scope.GorkAppearance.draw;scope.GorkAppearance.draw=(ctx:any,pose:any,blink:number,appearance:any)=>{drawn.push({pose:{...pose},blink});draw(ctx,pose,blink,appearance)};
 const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});const canvas={clientWidth:102,getContext:()=>ctx};
 const player=scope.GorkAvatar.mount(canvas,scope.GorkCatalog,{appearance:{id:'gork'},...options});
 return {scope,player,frames,drawn,tick(t:number){clock=t;const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn(t));return drawn.at(-1)}};
}
test('original full geometry displays real head projection and upstream intermittent turns',()=>{
 const f=consoleFixture(),look=f.scope.GorkAvatar.idleLook;
 assert.equal(Math.abs(look(2000).headY),0);assert.equal(look(4500).headY,-18);assert.equal(look(16200).headY,15);assert.equal(Math.abs(look(8000).headY),0);
 const e=f.scope.AvatarProceduralEngine,preset=f.scope.GorkPresets.find((p:any)=>p.id==='gork'),pose=f.scope.GorkCatalog.expressions[0];
 const a=e.renderAvatar(e.poseFromExpression({...pose,headX:0,headY:0,headZ:0}),preset.body.primary,1,{includeWire:false});
 const b=e.renderAvatar(e.poseFromExpression({...pose,headX:0,headY:30,headZ:0}),preset.body.primary,1,{includeWire:false});
 assert.notEqual(a.leftPath,b.leftPath);assert.notEqual(a.rightPath,b.rightPath);
 f.tick(0);f.tick(4500);assert.equal(f.frames.size,1);f.player.dispose();assert.equal(f.frames.size,0);
});
test('automatic blink uses console timing and duration, without CSS movement',()=>{
 const f=consoleFixture();assert.equal(f.tick(2500).blink,1);assert.equal(f.tick(2740).blink,.05);assert.equal(f.tick(2881).blink,1);
 assert.ok(!read('03-Src/studio/gork.css').includes('@keyframes'));f.player.dispose();
});
function pointerFixture(){let time=0,enabled=true;const listeners=new Map<string,Function>();const look=createPointerLook({now:()=>time,viewport:()=>({width:1000,height:800}),rect:()=>({left:450,top:350,width:100,height:100}),enabled:()=>enabled,listen:(name,fn)=>{listeners.set(name,fn);return()=>{listeners.delete(name)}}});return {look,listeners,move:(x:number,y:number,type='mouse')=>listeners.get('pointermove')?.({clientX:x,clientY:y,pointerType:type}),advance:(ms:number)=>{time+=ms},disable:()=>{enabled=false}};}
test('pointer follow turns both ways, stays bounded, returns to original idle and starts no RAF',()=>{
 const f=pointerFixture(),pose={headX:0,headY:0,headZ:0};f.move(1000,0);let result=pose;for(let i=0;i<20;i++){f.advance(16);result=f.look.apply(pose)}assert.ok(result.headY>20&&result.headY<=35);assert.ok(result.headX>15&&result.headX<=28);assert.equal(result.headZ,0);assert.equal(pose.headY,0);
 f.move(0,800);for(let i=0;i<30;i++){f.advance(16);result=f.look.apply(pose)}assert.ok(result.headY<-25&&result.headX<-20);
 f.advance(2300);for(let i=0;i<60;i++){f.advance(16);result=f.look.apply(pose)}assert.ok(Math.abs(result.headY)<.1);f.look.dispose();assert.equal(f.listeners.size,0);
});
test('pointer adapter respects work/paused states, touch, blur and repeated cleanup',()=>{
 for(let mount=0;mount<12;mount++){const f=pointerFixture(),pose={headX:7,headY:15,headZ:2};f.move(0,0,'touch');f.advance(50);assert.deepEqual(f.look.apply(pose),pose);f.disable();f.move(0,0);f.advance(50);assert.deepEqual(f.look.apply(pose),pose);f.listeners.get('blur')?.();f.look.dispose();f.look.dispose();assert.equal(f.listeners.size,0);assert.deepEqual(f.look.apply(pose),pose);}
});
test('console reaction duration completes one source sequence and repeated page transitions keep one player',()=>{
 let mounts=0,disposed=0,delay=0;const c=createGorkController(()=>{mounts++;return {set(){},dispose(){disposed++}}},()=>{}, {now:()=>0,after:(_f,d)=>{delay=d;return 1},cancel(){}},()=>11200);
 for(let i=0;i<12;i++){c.update({state:'idle',visible:true,paused:false});c.react('happy');assert.equal(delay,11200);c.update({state:'idle',visible:false,paused:false});assert.equal(mounts,disposed)}c.dispose();
});
test('welcome pointer and explicit return button are wired independently from saved skip preference',()=>{
 const welcome=read('03-Src/studio/WelcomeScreen.tsx'),app=read('03-Src/studio/App.tsx');assert.ok(welcome.includes('interactive followPointer'));assert.ok(welcome.includes("state={busy?'working':'idle'}"));assert.match(read('03-Src/studio/studio.css'),/welcome-return\{width:auto;flex-shrink:0/);assert.ok(app.includes('aria-label="返回欢迎页"'));assert.ok(app.includes('aria-label="返回欢迎页"'));assert.ok(app.includes('onClick={showWelcome}'));assert.match(app,/function showWelcome\(\)\{[^}]*setWelcomeVisible\(true\)/);assert.ok(welcome.includes("astra.skip-welcome.v1"));
 for(const f of ['index.html','professional.html']){const html=read(f);assert.ok(html.indexOf('/gork/avatar-engine.js')<html.indexOf('/gork/gork-appearance.js'));assert.ok(html.indexOf('/gork/gork-appearance.js')<html.indexOf('type="module"'));}
});

test('pointer draw wrapper is canvas-scoped and releases every listener after remounts',()=>{
 const events=new Map<string,Set<Function>>();let last:any;
 const root:any={GorkAppearance:{draw:(_ctx:any,p:any)=>{last=p}},addEventListener:(name:string,fn:Function)=>{if(!events.has(name))events.set(name,new Set());events.get(name)!.add(fn)},removeEventListener:(name:string,fn:Function)=>events.get(name)?.delete(fn)};
 (globalThis as any).window=root;(globalThis as any).innerWidth=1000;(globalThis as any).innerHeight=800;
 const canvas:any={getBoundingClientRect:()=>({left:400,top:300,width:100,height:100})},pose={headX:0,headY:0,headZ:0};
 for(let i=0;i<12;i++){const pointer=attachGorkPointer(canvas,()=>true);assert.equal([...events.values()].reduce((n,v)=>n+v.size,0),3);root.GorkAppearance.draw({canvas:{}},pose,1,{});assert.equal(last,pose);pointer.dispose();assert.equal([...events.values()].reduce((n,v)=>n+v.size,0),0);root.GorkAppearance.draw({canvas},pose,1,{});assert.equal(last,pose);}
 delete (globalThis as any).window;
});

test('explicit playback keeps upstream idle turns active even when system prefers reduced motion',()=>{
 const original=consoleFixture({},true),playing=consoleFixture({forceMotion:true},true);
 const a=original.tick(4500),b=playing.tick(4500);assert.equal(b.pose.headY-a.pose.headY,-18);original.player.dispose();playing.player.dispose();
});
test('pause controls and legacy pause preference reads are removed while invisible teardown remains',()=>{
 const gork=read('03-Src/studio/Gork.tsx'),welcome=read('03-Src/studio/WelcomeScreen.tsx'),ui=read('03-Src/studio/ui.tsx');
 assert.ok(gork.includes('return [false,(_next:boolean)=>{},true]'));assert.ok(!gork.includes('astra.gork-motion.v1'));assert.ok(!gork.includes('gork-pause'));assert.ok(!welcome.includes('aw2-motion'));assert.ok(!ui.includes('astra.galaxy-motion'));assert.ok(!ui.includes('toggleMotion'));assert.ok(ui.includes('allowReducedMotion:true'));assert.ok(gork.includes('visible:visible&&!document.hidden'));assert.ok(gork.includes('instance.dispose()'));
});
