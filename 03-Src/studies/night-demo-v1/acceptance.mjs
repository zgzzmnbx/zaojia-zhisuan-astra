import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const {chromium}=createRequire(process.argv[2])('./'),out=path.resolve('Codex-Temp/night-demo-v1/browser');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAQUE_BROWSER});const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();
const errors=[],requests=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
const result={errors};
async function capture(name){await page.waitForTimeout(250);const data=await page.evaluate(async()=>{const b=await window.__nightDemo.capture();return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(b)})});const bytes=Buffer.from(data,'base64');fs.writeFileSync(path.join(out,name+'.png'),bytes);return createHash('sha256').update(bytes).digest('hex')}
try{
 await page.goto('http://127.0.0.1:5189/night-demo/index.html');await page.waitForFunction(()=>window.__nightDemo?.ready,{},{timeout:60000});
 result.baselineStorage=await page.evaluate(()=>JSON.stringify(localStorage));
 for(const [view,label] of [['overview','全景'],['tanks','储罐近景'],['pipes','管道近景'],['screen','大屏近景']]){
  await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('button',{name:'当前夜览',exact:true}).click();await capture('before-'+view);
  const pose=await page.evaluate(()=>window.__nightDemo.api.getViewPose());await page.getByRole('button',{name:'候选夜览',exact:true}).click();await capture('after-'+view);assert.deepEqual(await page.evaluate(()=>window.__nightDemo.api.getViewPose()),pose);
 }
 await page.getByRole('button',{name:'全景',exact:true}).click();await page.getByRole('button',{name:'日间检查',exact:true}).click();
 result.dayOn=await capture('day-candidate-on');await page.getByRole('checkbox',{name:'日间保留候选开关'}).uncheck();result.dayOff=await capture('day-candidate-off');assert.equal(result.dayOn,result.dayOff);
 await page.getByRole('button',{name:'候选夜览',exact:true}).click();await page.getByRole('slider',{name:'灯芯亮度'}).fill('30');const low=await capture('core-low');await page.getByRole('button',{name:'恢复候选参数'}).click();const restored=await capture('core-restored');assert.notEqual(low,restored);
 await page.screenshot({path:path.join(out,'demo-ui.png')});
 const before=await page.evaluate(()=>window.__nightDemo.api.state().frames);await page.waitForTimeout(500);const after=await page.evaluate(()=>window.__nightDemo.api.state().frames);assert.equal(before,after,'reduced motion should settle');
 assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),result.baselineStorage);assert.ok(requests.every(r=>r.method==='GET'&&!r.url.includes('/api/')));assert.equal(errors.length,0);
 result.state=await page.evaluate(()=>window.__nightDemo.api.state());result.passed=true;
}catch(e){result.failure=String(e);process.exitCode=1;await page.screenshot({path:path.join(out,'failure.png')});console.error(e)}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,errors,failure:result.failure}));await browser.close()}
