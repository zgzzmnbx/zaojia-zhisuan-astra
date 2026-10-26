import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const {chromium}=createRequire(process.argv[2])('./');
const profile=path.resolve('Codex-Temp/night-demo-v1/motion-profile-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const chrome=spawn(process.env.PLAQUE_BROWSER,['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;!fs.existsSync(portFile)&&i<100;i++)await new Promise(r=>setTimeout(r,100));
const browser=await chromium.connectOverCDP('http://127.0.0.1:'+fs.readFileSync(portFile,'utf8').split('\n')[0],{noDefaults:true});
const context=browser.contexts()[0],p=await context.newPage(),errors=[];await p.setViewportSize({width:1600,height:1000});p.on('pageerror',e=>errors.push(String(e)));p.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
const result={errors},frame=()=>p.evaluate(()=>window.__nightDemo.api.state().frames);
try{
 await p.goto('http://127.0.0.1:5189/night-demo/index.html');await p.waitForFunction(()=>window.__nightDemo?.ready,{},{timeout:60000});
 await p.waitForTimeout(1000);let a=await frame();await p.waitForTimeout(1000);let b=await frame();assert.ok(b>a);result.visibleFramesPerSecond=b-a;
 await p.getByRole('button',{name:'暂停动效',exact:true}).click();await p.waitForTimeout(700);a=await frame();await p.waitForTimeout(700);assert.equal(await frame(),a);
 const pose=await p.evaluate(()=>window.__nightDemo.api.getViewPose());await p.mouse.move(660,480);await p.mouse.down();await p.mouse.move(850,520,{steps:15});await p.mouse.up();await p.waitForTimeout(1000);assert.notDeepEqual(await p.evaluate(()=>window.__nightDemo.api.getViewPose()),pose);
 await p.getByRole('button',{name:'全景',exact:true}).click();await p.getByRole('button',{name:'播放动效',exact:true}).click();await p.waitForTimeout(400);a=await frame();await p.waitForTimeout(500);assert.ok(await frame()>a);
 // Use the native visibility signal; disable Playwright's focus emulation override.
 const cdp=await context.newCDPSession(p);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});const cover=await context.newPage();await cover.goto('about:blank');await cover.bringToFront();await p.waitForTimeout(500);
 result.hidden=await p.evaluate(()=>document.hidden);assert.equal(result.hidden,true);a=await frame();await p.waitForTimeout(600);assert.equal(await frame(),a);await cover.close();await p.bringToFront();await p.waitForTimeout(500);assert.ok(await frame()>a);
 assert.equal(errors.length,0);result.passed=true;
}catch(e){result.failure=String(e);process.exitCode=1;console.error(e)}finally{fs.writeFileSync('Codex-Temp/night-demo-v1/browser/motion.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await(await browser.newBrowserCDPSession()).send('Browser.close').catch(()=>{});await browser.close();chrome.kill()}
