import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const version=process.env.PARCEL_DEMO_VERSION||'1.0.2';
const {chromium}=createRequire(process.argv[2])('./'),out=path.resolve('Codex-Temp/parcel-conveyor-v1/browser-'+version);fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAQUE_BROWSER}),context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:'reduce',recordVideo:{dir:path.join(out,'capture'),size:{width:1600,height:1000}}}),page=await context.newPage(),errors=[],requests=[],result={errors,requests};
page.on('pageerror',e=>errors.push(String(e)));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(r.url())});
const read=()=>page.evaluate(()=>__parcelDemo.api.state().parcel.information);
try{
 await page.goto('http://127.0.0.1:5189/parcel-demo/index.html');await page.waitForFunction(()=>__parcelDemo?.ready,null,{timeout:60000});await page.waitForTimeout(2200);
 assert.ok(await page.getByText('Demo '+version,{exact:false}).count());
 let a=await read();result.initial=a;assert.deepEqual(a.order,['import','price','risk','report','review','table','knowledge']);assert.deepEqual(a.shell,{type:'MeshPhysicalMaterial',color:'d5e9f5',opacity:.33,roughness:.25,metalness:.05,transparent:true});for(let i=1;i<a.route.length;i++)assert.deepEqual(a.route[i][0],a.route[i-1][1]);
 await page.screenshot({path:path.join(out,'overview.png')});await page.getByRole('button',{name:'运输近景',exact:true}).click();await page.waitForTimeout(2200);await page.screenshot({path:path.join(out,'closeup.png')});
 await page.getByRole('button',{name:'播放演示',exact:true}).click();await page.waitForTimeout(2200);let b=await read();assert.notEqual(b.shaderDistance,a.shaderDistance);assert.ok(b.clock>a.clock);result.moving=b;await page.screenshot({path:path.join(out,'flow-moving.png')});await page.waitForTimeout(5500);
 await page.getByRole('button',{name:'暂停演示',exact:true}).click();await page.waitForTimeout(300);a=await read();await page.waitForTimeout(500);assert.deepEqual(await read(),a);result.pauseFrozen=true;
 await page.getByRole('button',{name:'模型特写',exact:true}).click();await page.waitForTimeout(2200);await page.screenshot({path:path.join(out,'model.png')});
 await page.getByRole('checkbox',{name:'显示传送带方案',exact:true}).uncheck();await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'hidden.png')});await page.getByRole('checkbox',{name:'显示传送带方案',exact:true}).check();
 assert.equal(errors.length,0);assert.equal(requests.length,0);assert.equal(await page.evaluate(()=>localStorage.length),0);result.passed=true;
}catch(e){result.failure=String(e);process.exitCode=1;console.error(e)}finally{fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify(result,null,2));await context.close();await page.video().saveAs(path.join(out,'information-flow.webm'));await browser.close();console.log(JSON.stringify(result))}
