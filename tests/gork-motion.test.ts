import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {choreographGork,createGorkController,gorkActivity,greetings} from '../03-Src/studio/gork-motion.ts';

const catalogText=readFileSync(new URL('../03-Src/vendor/gork/gork-catalog.js',import.meta.url),'utf8');
const source=JSON.parse(catalogText.slice(catalogText.indexOf(' = ')+3).trim().replace(/;$/,''));
const catalog=choreographGork(source);
function fixture(){
  let now=0,id=0;const timers=new Map<number,{fn:()=>void;due:number}>();
  const mounts:{state:string;still:boolean;disposed:boolean}[]=[],changes:string[]=[],statuses:{state:string;active:boolean}[]=[];
  const controller=createGorkController((state,still)=>{
    const record={state,still,disposed:false};mounts.push(record);
    return {set:(next:string)=>{record.state=next;changes.push(next);},dispose:()=>{record.disposed=true;}};
  },status=>statuses.push(status),{now:()=>now,after:(fn,delay)=>{timers.set(++id,{fn,due:now+delay});return id;},cancel:n=>{timers.delete(n as number);}});
  const update=(state='idle',visible=true,paused=false)=>controller.update({state,visible,paused});
  const advance=(elapsed:number)=>{now+=elapsed;for(const [key,t] of timers)if(t.due<=now){timers.delete(key);t.fn();}};
  return {controller,update,advance,mounts,changes,statuses,timers,status:()=>statuses.at(-1)!};
}

test('choreography reuses original poses without mutating vendor assets',()=>{
  assert.deepEqual(source,JSON.parse(catalogText.slice(catalogText.indexOf(' = ')+3).trim().replace(/;$/,'')));
  assert.equal(catalog.expressions,source.expressions);
  const ids=new Set(catalog.expressions.map(p=>p.id));
  for(const sequence of catalog.sequences)for(const step of sequence.steps)assert.ok(ids.has(step.expressionId));
  assert.equal(new Set(catalog.sequences.map(s=>s.id)).size,catalog.sequences.length);
  assert.equal(catalog,source,'console catalog is no longer re-choreographed');
  for(const name of [...greetings,'happy']) assert.ok(catalog.sequences.some(s=>s.id===name));
  const idle=catalog.sequences.find(s=>s.id==='idle')!;
  assert.equal(idle.steps.reduce((sum,s)=>sum+s.holdMs+s.transitionMs,0),11400);
  assert.deepEqual(idle.blink,{enabled:true,initialDelayMs:2600,minIntervalMs:3400,maxIntervalMs:6200,durationMs:280});
});
test('real activity separates looking up, working, composing and errors',()=>{
  assert.equal(gorkActivity('正在检索知识依据','old error',true),'searching');
  assert.equal(gorkActivity('正在匹配价格与双系数','',true),'working');
  assert.equal(gorkActivity('WeKnora 正在生成回答并核验引用','',false),'thinking');
  assert.equal(gorkActivity('','failed',true),'confused');
  assert.equal(gorkActivity('','',true),'listening');
  assert.equal(gorkActivity('','',false),'idle');
});
test('state changes keep a single animated renderer for smooth transitions',()=>{
  const f=fixture();f.update();f.update('searching');f.update('working');f.update('listening');
  assert.equal(f.mounts.length,1);assert.deepEqual(f.changes,['searching','working','listening']);
  f.controller.dispose();assert.equal(f.mounts[0].disposed,true);
});
test('greeting expires back to the current input state, without replaying',()=>{
  const f=fixture();f.update();assert.ok(f.controller.react('wink'));f.update('listening');
  assert.equal(f.status().state,'wink');f.advance(3200);
  assert.deepEqual(f.status(),{state:'listening',active:true});assert.equal(f.timers.size,0);
});
test('play cannot mask work; actual completion waits for busy and runs once',()=>{
  const f=fixture();f.update('working');assert.equal(f.controller.react('greeting'),false);
  assert.ok(f.controller.react('happy',true));assert.equal(f.status().state,'working');
  f.update();assert.equal(f.status().state,'happy');f.advance(3200);assert.equal(f.status().state,'idle');
});
test('error cancels any queued completion; returning to idle does not celebrate',()=>{
  const f=fixture();f.update('working');f.controller.react('happy',true);f.update('confused');
  assert.equal(f.timers.size,0);f.update();assert.equal(f.status().state,'idle');
});
test('a new operation discards the previous reaction, including after cancellation',()=>{
  const f=fixture();f.update();f.controller.react('happy',true);f.update('searching');
  assert.equal(f.timers.size,0);f.update();assert.equal(f.status().state,'idle');
});
test('invisible/fullscreen/page-hidden releases player and timer with no delayed reaction',()=>{
  const f=fixture();f.update();f.controller.react('wink');f.update('idle',false);
  assert.ok(f.mounts[0].disposed);assert.equal(f.timers.size,0);assert.equal(f.status().active,false);
  f.advance(4000);f.update();assert.equal(f.status().state,'idle');assert.equal(f.mounts.length,2);
});
test('pause and reduced motion draw correct static pose without scheduling reactions',()=>{
  const f=fixture();f.update();f.controller.react('greeting');f.update('idle',true,true);
  assert.ok(f.mounts[0].disposed);assert.equal(f.mounts[1].still,true);assert.equal(f.timers.size,0);
  assert.equal(f.controller.react('happy',true),false);f.update('confused',true,true);
  assert.ok(f.mounts[1].disposed);assert.equal(f.mounts[2].state,'confused');assert.equal(f.mounts[2].still,true);
  f.update();assert.equal(f.status().state,'idle');assert.equal(f.mounts[3].still,false);
});
test('disposing with a pending reaction cancels all work and ignores late updates',()=>{
  const f=fixture();f.update();f.controller.react('nod');f.controller.dispose();f.advance(9000);f.update();
  assert.equal(f.controller.react('wink'),false);assert.equal(f.timers.size,0);assert.equal(f.mounts.length,1);assert.ok(f.mounts[0].disposed);
});
test('real pinned renderer leaves no RAF after pause, visibility change or disposal',()=>{
  const frames=new Map<number,unknown>();let id=0,draws=0;
  const ctx=new Proxy({},{get:(_,name)=>name==='clearRect'?()=>draws++:()=>{},set:()=>true});
  const canvas={clientWidth:56,width:112,height:112,getContext:()=>ctx};
  const root:any={devicePixelRatio:2,matchMedia:()=>({matches:false})};
  vm.runInNewContext(readFileSync(new URL('../03-Src/vendor/gork/gork-avatar.js',import.meta.url),'utf8'),{window:root,performance:{now:()=>0},requestAnimationFrame:(fn:unknown)=>{frames.set(++id,fn);return id;},cancelAnimationFrame:(key:number)=>frames.delete(key)});
  const c=createGorkController((state,still)=>{const p=root.GorkAvatar.mount(canvas,catalog,{still,expression:state});if(!still)p.set(state);return p;},()=>{});
  c.update({state:'idle',visible:true,paused:false});assert.equal(frames.size,1);
  c.update({state:'working',visible:true,paused:false});assert.equal(frames.size,1);
  c.update({state:'working',visible:true,paused:true});assert.equal(frames.size,0);assert.equal(draws,1);
  c.update({state:'confused',visible:true,paused:true});assert.equal(frames.size,0);assert.equal(draws,2);
  c.update({state:'idle',visible:true,paused:false});assert.equal(frames.size,1);
  c.update({state:'idle',visible:false,paused:false});assert.equal(frames.size,0);
  c.update({state:'idle',visible:true,paused:false});c.dispose();assert.equal(frames.size,0);
});
