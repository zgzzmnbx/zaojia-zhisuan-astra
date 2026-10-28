import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const {chromium}=createRequire(process.argv[2])('./');
const profile=path.resolve('Codex-Temp/parcel-conveyor-v1/motion-profile-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const chrome=spawn(process.env.PLAQUE_BROWSER,['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;!fs.existsSync(portFile)&&i<100;i++)await new Promise(r=>setTimeout(r,100));
const browser=await chromium.connectOverCDP('http://127.0.0.1:'+fs.readFileSync(portFile,'utf8').split('\n')[0],{noDefaults:true});
const context=browser.contexts()[0],p=await context.newPage(),errors=[];await p.setViewportSize({width:1600,height:1000});p.on('pageerror',e=>errors.push(String(e)));
const result={errors},state=()=>p.evaluate(()=>({time:window.__parcelControls.time,frames:window.__parcelControls.frames,weather:window.__parcelControls.weatherState.time,information:window.__parcelDemo.api.state().parcel.information}));
try{
 await p.goto('http://127.0.0.1:5189/parcel-demo/index.html');await p.waitForFunction(()=>window.__parcelDemo?.ready,null,{timeout:60000});await p.waitForTimeout(800);
 let a=await state();await p.waitForTimeout(1000);let b=await state();assert.ok(b.time>a.time);result.visibleFramesPerSecond=b.frames-a.frames;
 await p.getByRole('button',{name:'暂停演示',exact:true}).click();await p.waitForTimeout(600);a=await state();await p.waitForTimeout(600);assert.deepEqual(await state(),a);result.pausedNoFrames=true;
 const pose=await p.evaluate(()=>window.__parcelDemo.api.getViewPose());await p.mouse.move(600,480);await p.mouse.down();await p.mouse.move(800,520,{steps:15});await p.mouse.up();await p.waitForTimeout(500);assert.notDeepEqual(await p.evaluate(()=>window.__parcelDemo.api.getViewPose()),pose);
 await p.getByRole('combobox',{name:'天气',exact:true}).selectOption('rain');await p.getByRole('button',{name:'播放演示',exact:true}).click();await p.waitForTimeout(400);
 const cdp=await context.newCDPSession(p);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});const cover=await context.newPage();await cover.goto('about:blank');await cover.bringToFront();await p.waitForTimeout(500);
 result.hidden=await p.evaluate(()=>document.hidden);assert.equal(result.hidden,true);a=await state();await p.waitForTimeout(1000);assert.deepEqual(await state(),a);await cover.close();await p.bringToFront();await p.waitForTimeout(500);b=await state();assert.ok(b.time>a.time);assert.ok(b.time-a.time<.8);result.resumeNoCatchup=true;
 await p.getByRole('combobox',{name:'天气',exact:true}).selectOption('clear');await p.getByRole('checkbox',{name:'显示传送带方案',exact:true}).uncheck();await p.waitForTimeout(500);a=await state();await p.waitForTimeout(500);assert.deepEqual(await state(),a);result.hiddenAddonNoFrames=true;
 assert.equal(errors.length,0);result.passed=true;
}catch(e){result.failure=String(e);process.exitCode=1;console.error(e)}finally{fs.writeFileSync('Codex-Temp/parcel-conveyor-v1/browser-1.0.2/motion.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await(await browser.newBrowserCDPSession()).send('Browser.close').catch(()=>{});await browser.close();chrome.kill()}

