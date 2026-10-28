import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const {chromium}=createRequire(process.argv[2])('./'),out=path.resolve('Codex-Temp/parcel-conveyor-v1/browser');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAQUE_BROWSER});
const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:'reduce',recordVideo:{dir:out,size:{width:1600,height:1000}}}),p=await context.newPage(),errors=[],apiRequests=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiRequests.push(r.url())});
const result={errors,apiRequests},state=()=>p.evaluate(()=>({time:window.__parcelControls.time,position:window.__parcelControls.position,frames:window.__parcelControls.frames,paused:window.__parcelControls.paused}));
async function photo(name){await p.screenshot({path:path.join(out,name+'.png')})}
try{
 await p.goto('http://127.0.0.1:5189/parcel-demo/index.html');await p.waitForFunction(()=>window.__parcelDemo?.ready,null,{timeout:60000});await p.waitForTimeout(600);await photo('overview');assert.equal((await state()).paused,true);
 let a=await state();await p.waitForTimeout(400);assert.equal((await state()).time,a.time);
 await p.getByRole('button',{name:'运输近景',exact:true}).click();await p.waitForTimeout(300);await photo('closeup');
 await p.getByRole('button',{name:'模型特写',exact:true}).click();await p.waitForTimeout(300);await photo('model');
 await p.getByRole('button',{name:'播放演示',exact:true}).click();a=await state();await p.waitForTimeout(1800);assert.ok((await state()).time>a.time);assert.notDeepEqual((await state()).position,a.position);
 await p.getByRole('button',{name:'暂停演示',exact:true}).click();await p.waitForTimeout(200);a=await state();await p.waitForTimeout(500);assert.equal((await state()).time,a.time);
 // Every receiving dock is reached using the exported Blender keyframes.
 const stops=await p.evaluate(()=>window.__parcelDemo.timeline.stations),dwells=await p.evaluate(()=>window.__parcelDemo.timeline.timeline.filter(s=>s.kind==='dwell'));
 result.docks=[];
 for(let i=0;i<stops.length;i++){await p.getByRole('slider',{name:'动画时间',exact:true}).fill(String(Math.round((dwells[i].start+.5)*10)/10));await p.waitForTimeout(180);const s=await state();const d=Math.hypot(...s.position.map((v,j)=>v-stops[i].point[j]));assert.ok(d<.07,`dock ${i} offset ${d}`);result.docks.push({id:stops[i].id,offset:d})}
 await p.getByRole('button',{name:'运输近景',exact:true}).click();await p.getByRole('checkbox',{name:'跟随包裹视角',exact:true}).check();await p.getByRole('button',{name:'播放演示',exact:true}).click();await p.waitForTimeout(7000);await photo('follow');
 await p.getByRole('button',{name:'沙盘全景',exact:true}).click();await p.waitForTimeout(500);await photo('overview-moving');
 await p.getByRole('button',{name:'暂停演示',exact:true}).click();
 await p.getByRole('checkbox',{name:'显示传送带方案',exact:true}).uncheck();await p.waitForTimeout(150);await photo('without-conveyor');await p.getByRole('checkbox',{name:'显示传送带方案',exact:true}).check();
 assert.equal(apiRequests.length,0);assert.equal(await p.evaluate(()=>localStorage.length),0);assert.equal(errors.length,0);result.asset=await p.evaluate(()=>window.__parcelDemo.api.state().parcel);result.passed=true;
}catch(e){result.failure=String(e);console.error(e);process.exitCode=1}finally{fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify(result,null,2));await context.close();await browser.close();console.log(JSON.stringify(result))}

