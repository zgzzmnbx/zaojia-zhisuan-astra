import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const {chromium}=createRequire(process.argv[2])('./'),out=path.resolve('Codex-Temp/parcel-conveyor-v1/browser');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAQUE_BROWSER});
const c=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:'reduce',recordVideo:{dir:path.join(out,'capture'),size:{width:1600,height:1000}}}),p=await c.newPage();
await p.goto('http://127.0.0.1:5189/parcel-demo/index.html');await p.waitForFunction(()=>window.__parcelDemo?.ready,null,{timeout:60000});
await p.getByRole('button',{name:'运输近景',exact:true}).click();await p.getByRole('checkbox',{name:'跟随包裹视角',exact:true}).check();await p.getByRole('slider',{name:'播放速度',exact:true}).fill('2');await p.getByRole('button',{name:'从第一站重播',exact:true}).click();await p.getByRole('button',{name:'播放演示',exact:true}).click();
await p.waitForTimeout(11000);await p.getByRole('button',{name:'沙盘全景',exact:true}).click();await p.waitForTimeout(14000);await p.getByRole('button',{name:'暂停演示',exact:true}).click();await p.waitForTimeout(600);
await c.close();await p.video().saveAs(path.join(out,'parcel-demo.webm'));await browser.close();console.log('recorded real browser video');
