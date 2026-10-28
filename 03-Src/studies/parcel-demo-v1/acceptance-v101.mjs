import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const {chromium}=createRequire(process.argv[2])('./'),out=path.resolve('Codex-Temp/parcel-conveyor-v1/browser-'+(process.env.PARCEL_DEMO_VERSION||'1.0.1'));fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAQUE_BROWSER});const c=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'}),p=await c.newPage(),errors=[],requests=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(r.url())});
const result={errors,requests},read=()=>p.evaluate(()=>({time:__parcelControls.time,position:__parcelControls.position,camera:__parcelControls.camera,weather:__parcelControls.weatherState}));
async function photo(name){await p.screenshot({path:path.join(out,name+'.png')})}
try{
 await p.goto('http://127.0.0.1:5189/parcel-demo/index.html');await p.waitForFunction(()=>__parcelDemo?.ready,null,{timeout:60000});await p.waitForTimeout(2200);
 const manifest=await p.evaluate(()=>__parcelDemo.timeline);assert.deepEqual(manifest.stations.map(s=>s.id),['import','price','risk','report','review','table','knowledge']);await photo('overview');
 await p.getByRole('button',{name:'运输近景',exact:true}).click();await p.waitForTimeout(2200);await photo('closeup');
 const start=(await read()).camera.eye;await p.getByRole('button',{name:'包裹第一视角',exact:true}).click();await p.waitForTimeout(100);let s=await read();assert.equal(s.camera.transition,true);assert.ok(Math.hypot(...s.camera.eye.map((v,i)=>v-start[i]))<8);await p.waitForTimeout(2400);s=await read();assert.equal(s.camera.transition,false);assert.ok(s.camera.obstacles>=7);await photo('first');result.first=s;
 result.docks=[];
 for(const d of manifest.timeline.filter(s=>s.kind==='dwell')){await p.getByRole('slider',{name:'动画时间',exact:true}).fill(String(Math.round((d.start+.4)*10)/10));await p.waitForTimeout(2200);s=await read();const station=manifest.stations[d.station],offset=Math.hypot(...s.position.map((v,i)=>v-station.point[i]));assert.ok(offset<.07);assert.ok(s.camera.clearance<.001);await photo('dock-'+station.id);result.docks.push({id:station.id,offset,camera:s.camera})}
 await p.getByRole('button',{name:'沙盘全景',exact:true}).click();await p.waitForTimeout(2200);
 await p.getByRole('combobox',{name:'天气',exact:true}).selectOption('rain');await p.waitForTimeout(300);await photo('rain');let a=await read();await p.waitForTimeout(300);assert.equal((await read()).weather.time,a.weather.time);
 await p.getByRole('button',{name:'从第一站重播',exact:true}).click();await p.getByRole('button',{name:'播放演示',exact:true}).click();await p.waitForTimeout(800);assert.ok((await read()).weather.time>a.weather.time);await p.getByRole('button',{name:'暂停演示',exact:true}).click();
 await p.getByRole('combobox',{name:'天气',exact:true}).selectOption('snow');await p.waitForTimeout(400);await photo('snow');assert.equal((await read()).weather.particles,700);
 await p.getByRole('checkbox',{name:'太阳',exact:true}).uncheck();await p.waitForTimeout(200);assert.equal((await read()).weather.sun,false);await p.getByRole('checkbox',{name:'太阳',exact:true}).check();
 await p.getByRole('combobox',{name:'天气',exact:true}).selectOption('clear');await p.getByRole('button',{name:'模型特写',exact:true}).click();await p.waitForTimeout(2200);await photo('model');
 assert.equal(errors.length,0);assert.equal(requests.length,0);assert.equal(await p.evaluate(()=>localStorage.length),0);result.passed=true;
}catch(e){result.failure=String(e);process.exitCode=1;console.error(e)}finally{fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify(result,null,2));await c.close();await browser.close();console.log(JSON.stringify(result))}
