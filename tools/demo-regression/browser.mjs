// Real browser actions against the isolated deployment. No response mocking.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out=path.resolve(process.argv[2]);
assert.equal(path.basename(path.dirname(out)),'demo-regression');
const cache=path.join(process.env.LOCALAPPDATA||'', 'npm-cache','_npx');
const candidates=[path.resolve('node_modules/playwright/index.mjs'),...(fs.existsSync(cache)?fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules/playwright/index.mjs')):[])];
const installed=candidates.find(p=>fs.existsSync(p));
if(!installed)throw Error('Playwright is not installed locally. Install it once; regression does not download dependencies.');
const {chromium}=await import(pathToFileURL(installed));
const base='http://127.0.0.1:5197';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling']});
const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});
await context.route('**/*',route=>{
 const u=new URL(route.request().url());
 return ['data:','blob:'].includes(u.protocol)||u.origin===base?route.continue():route.abort('blockedbyclient');
});
await context.tracing.start({screenshots:true,snapshots:true,sources:false});
const page=await context.newPage();page.setDefaultTimeout(20000);
const results=[],errors=[];let job,matched,documentResult,knowledge,digital;
const digitalTask='task_d9ba3c6c13ec466c8cafb1544f457436';
page.on('pageerror',e=>errors.push(e.message));
const save=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2));
const btn=(name)=>page.getByRole('button',{name,exact:true});
const request=async(method,url,data)=>{
 const r=await page.request.fetch(base+url,{method,data,headers:{Origin:base}});
 assert.equal(r.status(),200,`${url}: ${r.status()} ${await r.text()}`);return r.json();
};
async function check(id,fn){
 const start=Date.now(),before=errors.length;
 try{
  const detail=await fn();assert.equal(errors.length,before,errors.slice(before).join('\n'));
  results.push({id,layer:'browser',status:'passed',seconds:(Date.now()-start)/1000,detail});
 }catch(e){
  results.push({id,layer:'browser',status:'failed',seconds:(Date.now()-start)/1000,detail:e.message});
  fs.writeFileSync(path.join(out,`browser-${id}-dom.txt`),await page.locator('body').innerText().catch(()=>''));
  for(const [i,f] of page.frames().entries())if(i)fs.writeFileSync(path.join(out,`browser-${id}-frame-${i}.txt`),await f.locator('body').innerText().catch(()=>''));
 }
 await page.screenshot({path:path.join(out,`browser-${id}.png`)}).catch(()=>{});
 save('browser-results.json',results);console.log(`${id}: ${results.at(-1).status}`,results.at(-1).status==='failed'?String(results.at(-1).detail).slice(0,250):'');
}
async function enter(){await page.goto(base);if(await btn('进入系统').count())await btn('进入系统').click({timeout:90000});await btn('系统架构图').waitFor();}
async function checkDemoMatchingSwitch(){
 await btn('设置').click();await btn('演示与调试').click();
 const toggle=page.getByRole('switch',{name:'3.1 标准答案匹配',exact:true});
 await toggle.waitFor();assert.equal(await toggle.isChecked(),true);
 await toggle.uncheck();
 let pending=page.waitForResponse(r=>r.url().endsWith('/api/astra/demo-settings')&&r.request().method()==='PUT');
 await btn('保存设置').click();assert.equal((await pending).status(),200);
 await btn('关闭设置').click();await btn('设置').click();await btn('演示与调试').click();
 assert.equal(await toggle.isChecked(),false);await toggle.check();
 pending=page.waitForResponse(r=>r.url().endsWith('/api/astra/demo-settings')&&r.request().method()==='PUT');
 await btn('保存设置').click();assert.equal((await pending).status(),200);
 await page.screenshot({path:path.join(out,'demo-match-settings.png')});await btn('关闭设置').click();
}
async function send(text){if(await btn('返回对话').isVisible())await btn('返回对话').click();await page.getByRole('textbox',{name:'告诉智算你的任务',exact:true}).fill(text);await btn('发送任务').click();}
async function withResponse(url,action){const [r]=await Promise.all([page.waitForResponse(r=>r.url().includes(url)&&r.request().method()==='POST',{timeout:120000}),action()]);assert.equal(r.status(),200,await r.text());return r.json();}
async function showTable(){await btn('表格').click();await page.getByRole('tab',{name:'表2-通用工程测量费用',exact:true}).click();}
try{
 await enter();
 await check('D01',async()=>{await btn('系统架构图').click();await page.frameLocator('iframe[title="动态架构图（示意）"]').locator('body').waitFor();await btn('关闭系统架构').click();return '架构 iframe 加载且可关闭';});
 await check('D02',async()=>{await btn('新对话').click();await page.getByRole('button',{name:'查看演示项目信息',exact:true}).waitFor({timeout:90000});assert.equal(await page.locator('.sandbox-parked-hit').innerText(),'德化-永安支线');await checkDemoMatchingSwitch();return '新对话、沙盘与历史项目正常；3.1标准答案默认开启、关闭保存及恢复开启通过';});
 await check('D03',async()=>{
  await page.getByRole('button',{name:'导入项目 从接入项目中选择 · 含 V3.1 体验',exact:true}).click();
  let upload;
  const capture=r=>{if(r.url().endsWith('/api/inspect')&&r.method()==='POST')upload=r.postDataBuffer();};
  page.on('request',capture);
  const data=await withResponse('/api/inspect',()=>btn('导入V3.1 勘察测量控制价 · 完整体验').click());
  page.off('request',capture);
  const sample=fs.readFileSync(path.join(out,'app/03-Src/studio/project-import-assets/v31.xlsx'));
  assert.ok(upload?.includes(sample),'Multipart did not contain the exact bundled sample bytes');
  await btn('确认结构并转换').waitFor();assert.equal(data.sheets.length,3);return {sheets:data.sheets.length,uploaded_sha256:createHash('sha256').update(sample).digest('hex')};
 });
 await check('D04',async()=>{const data=await withResponse('/api/process',()=>btn('确认结构并转换').click());job=data.job_id;assert.equal(data.summary.total_data_rows,100);await btn('开始批量匹配').first().waitFor();return {job_id:job,total_rows:data.summary.total_data_rows};});
 await check('D05',async()=>{assert.ok(job);await showTable();await page.locator('.table-scroll table').waitFor();assert.ok(await page.locator('.empty-cell').count());return '表2待填单元格可见';});
 await check('D06',async()=>{
  await showTable();const candidates=await withResponse('/api/astra/row-assist/candidates',()=>btn('第 6 行 AI 填价').click());
  assert.equal(Number(candidates.candidates[0].value),3203);
  // The panel itself must render the returned recommendation, not just API data.
  await page.getByText(/3,?203/).first().waitFor();
  const response=await withResponse('/api/astra/row-assist/ask',()=>btn('重新分析').last().click());
  assert.equal(response.answer_mode,'curated_demo');return {top:3203,mode:response.answer_mode};
 });
 await check('D07',async()=>{assert.ok(job);await page.keyboard.press('Escape');matched=await withResponse('/api/process/batch-match',()=>btn('开始批量匹配').first().click());assert.equal(matched.summary.total_data_rows,100);assert.equal(matched.summary.filled_rows,99);assert.equal(matched.summary.matching_source,'demo_standard_answer');assert.equal(matched.summary.generated_by_model,false);await page.getByText(/演示标准答案 · 未查询计价库/).first().waitFor(); const marker=page.locator('.sandbox-reference-answer-dot:visible').first();await marker.waitFor();assert.equal(await marker.evaluate(el=>getComputedStyle(el).width),'3px');return {total_rows:matched.summary.total_data_rows,filled_rows:matched.summary.filled_rows,matching_source:matched.summary.matching_source};});
 await check('D08',async()=>{assert.ok(matched);await showTable();await page.getByText('50000',{exact:true}).first().waitFor();await page.getByRole('button',{name:/编辑第 6 行 基价/}).waitFor();return '匹配结果在实际表格显示';});
 await check('D09',async()=>{
  await withResponse('/api/experience-warnings/run',()=>btn('检查经验池预警').first().click());
  await btn('查看全部风险与依据').waitFor();
  const risk=await request('GET',`/api/risk/summary?job_id=${job}`);assert.equal(risk.items.length,2);
  await page.getByRole('button',{name:'定位表2-通用工程测量费用第 5 行',exact:true}).click();
  await page.locator('.preview-cell-located').waitFor();return {items:risk.items,located:await page.locator('.preview-cell-located').innerText()};
 });
 await check('D10',async()=>{documentResult=await withResponse('/api/astra/documents/format',()=>btn('生成报告').first().click());await page.getByRole('region',{name:documentResult.name,exact:true}).waitFor();return {name:documentResult.name,id:documentResult.id};});
 await check('D11',async()=>{
  assert.ok(documentResult);await page.getByRole('region',{name:documentResult.name,exact:true}).getByRole('button',{name:'查看报告',exact:true}).click();
  await page.waitForFunction(()=>{const b=document.querySelector('button[aria-label="缩小文档"]');return b&&!b.disabled;},null,{timeout:90000});
  const r=await page.request.get(base+matched.downloads.report);assert.equal(r.status(),200);fs.writeFileSync(path.join(out,'browser-report.docx'),await r.body());return '当前Word预览就绪，实际下载成功';
 });
 await check('D12',async()=>{assert.ok(matched);const r=await page.request.get(base+matched.downloads.excel+'?hide_empty_rows=true&value_filter_field='+encodeURIComponent('数量'));assert.equal(r.status(),200);fs.writeFileSync(path.join(out,'browser-result.xlsx'),await r.body());return '实际任务Excel下载；独立API用例负责逐格标准答案比较';});
 await check('D13',async()=>{await send('同事复核');await page.getByText('选择平台与发送方式',{exact:true}).waitFor();await page.getByRole('button',{name:'确认发送 · 0 平台',exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'确认发送 · 0 平台',exact:true}).isDisabled());return '复核渠道选择与接收人确认流程打开，未选择平台不能发送；实收见M01/M02';});
 await check('D14',async()=>{
  await send('打开项目看板');await page.getByRole('button',{name:/^筛选项目，当前/}).waitFor();const data=await request('GET','/api/projects/dashboard');assert.ok(data.kpis.total_projects>=2);
  await page.getByRole('button',{name:/^筛选项目，当前/}).click();const dialog=page.getByRole('dialog',{name:'筛选条件',exact:true});
  await dialog.getByPlaceholder('搜索项目名称或编号').fill('演示回归-API独立样例');
  const [r]=await Promise.all([page.waitForResponse(r=>r.url().includes('/api/projects/dashboard?')&&r.request().method()==='GET'),dialog.getByRole('button',{name:'应用筛选',exact:true}).click()]);
  assert.equal(r.status(),200);const filtered=await r.json();assert.equal(filtered.kpis.total_projects,1);
  await page.getByRole('button',{name:/^筛选项目，当前/}).click();await dialog.getByRole('button',{name:'重置',exact:true}).click();await dialog.getByRole('button',{name:'应用筛选',exact:true}).click();
  return {total:data.kpis.total_projects,filtered:1};
 });
 await check('D15',async()=>{await send('打开项目地图');const f=page.frameLocator('iframe[title="专业操作工作区"]');await f.getByRole('region',{name:'项目地图主视图',exact:true}).waitFor({timeout:60000});await page.screenshot({path:path.join(out,'browser-map.png')});await send('打开项目鸟瞰');await f.locator('canvas:visible').first().waitFor({timeout:60000});return '专业工作区地域地图与三维画布实际渲染';});
 await check('D16',async()=>{
  const question=JSON.parse(fs.readFileSync(path.join(out,'api-context.json'),'utf8')).question;
  knowledge=await withResponse('/api/astra/knowledge/ask',()=>send('#知识库：'+question));
  assert.equal(knowledge.answer_mode,'curated_demo');assert.ok(knowledge.sources.length);await page.getByText(/最高单价/).last().waitFor();return {mode:knowledge.answer_mode,sources:knowledge.sources.length};
 });
 await check('D17',async()=>{assert.ok(knowledge?.chart);const bars=page.locator('.chat-knowledge-bar');await bars.first().waitFor();assert.equal(await bars.count(),16);assert.ok((await bars.evaluateAll(es=>es.map(e=>Number(e.getAttribute('height'))))).every(h=>h>0));assert.match(await bars.locator('title').allTextContents().then(a=>a.join('\n')),/D1422.*4500/);return knowledge.chart;});
 await check('D18',async()=>{
  await btn('整理为知识候选').last().click();const f=page.frameLocator('iframe[title="专业操作工作区"]');
  const dialog=f.getByRole('dialog',{name:'保存为知识候选',exact:true});
  await dialog.getByLabel(/^知识类型/).selectOption('price_factor');
  await dialog.getByLabel(/^标题/).fill('演示回归：过路过桥费依据');
  await dialog.getByLabel(/^原问题/).fill(knowledge.question||'各管径过路过桥费比较');
  await dialog.getByLabel(/^待确认结论/).fill(knowledge.answer);
  await dialog.getByLabel(/^来源定位/).fill(JSON.stringify(knowledge.sources));
  const saved=await withResponse('/api/knowledge-memory/candidates',()=>dialog.getByRole('button',{name:'创建候选',exact:true}).click());
  assert.ok(['candidate','pending'].includes(saved.item.status));assert.equal(saved.auto_approved,false);
  save('knowledge-candidate.json',saved);
  await f.getByLabel('scope_key',{exact:true}).fill(saved.item.project_key);
  await f.getByRole('button',{name:'查询',exact:true}).click();
  await f.getByRole('button').filter({hasText:'演示回归：过路过桥费依据'}).last().click();
  await f.getByText('确认结论',{exact:true}).waitFor();
  return {id:saved.item.id,status:saved.item.status,auto_approved:saved.auto_approved};
 });
 await check('D19',async()=>{
  await send('打开知识图谱');await page.getByRole('tab',{name:'知识图谱',exact:true}).click();await page.locator('#knowledge-panel-network canvas:visible').first().waitFor();
  const data=await request('GET','/api/knowledge-articles/graph');assert.ok(data.nodes.length&&data.edges.length);
  await btn('展开关系列表').click();const title=data.nodes[0].title;
  await page.getByRole('complementary',{name:'关系列表',exact:true}).getByRole('button').filter({hasText:title}).click();
  const detail=page.getByRole('dialog',{name:'节点详情',exact:true});await detail.getByRole('heading',{name:title,exact:true}).waitFor();
  await detail.locator('.knowledge-node-detail__sources').waitFor();
  const related=detail.getByRole('region',{name:'关联节点',exact:true}).getByRole('button').first();const relatedTitle=await related.innerText();await related.click();
  await detail.getByRole('heading',{name:relatedTitle,exact:true}).waitFor();await detail.locator('.knowledge-node-detail__sources').waitFor();
  return {nodes:data.nodes.length,edges:data.edges.length,opened:title,related:relatedTitle};
 });
 // Digital module cases are in a separate function so an old-project absence
 // cannot hide failures in the host or inflate mainline coverage.
 await check('D22',async()=>{
  if(await btn('返回对话').isVisible())await btn('返回对话').click();
  if(await btn('项目工作台').isVisible())await btn('项目工作台').click();
  await btn('切换到深色模式').click();assert.equal(await page.locator('html').getAttribute('data-astra-scheme'),'dark');await btn('切换到亮色模式').click();assert.equal(await page.locator('html').getAttribute('data-astra-scheme'),'light');
  const input=page.getByRole('textbox',{name:'告诉智算你的任务',exact:true});await input.fill('回归草稿保留');
  for(const mode of ['经典','简约','沙盘']){await page.getByRole('button',{name:mode,exact:true}).click();assert.equal(await input.inputValue(),'回归草稿保留');}
  await input.fill('');return '亮暗主题往返；经典/简约/沙盘保留草稿';
 });
 await check('D23',async()=>{
  const conv=await page.evaluate(()=>localStorage.getItem('astra.active-conversation'));
  const input=page.getByRole('textbox',{name:'告诉智算你的任务',exact:true});await input.fill('刷新恢复验证');
  await page.waitForResponse(r=>r.url().endsWith(`/conversations/${conv}`)&&r.request().method()==='PUT');
  await page.reload();if(await btn('进入系统').count())await btn('进入系统').click({timeout:90000});await input.waitFor();
  assert.equal(await input.inputValue(),'刷新恢复验证');assert.equal(await page.evaluate(()=>localStorage.getItem('astra.active-conversation')),conv);
  const current=await request('GET',`/api/astra/workspace/conversations/${conv}`);assert.equal(current.state.job_id,job);
  await input.fill('');return {restored_job:job,conversation:conv,draft:true};
 });
 await check('D24',async()=>{
  const before=await request('GET','/api/astra/demo-settings');const toggle=btn('演示模式');
  await btn('查看演示项目信息').click();assert.ok(await btn('开启项目').isDisabled());await page.keyboard.press('Escape');
  await Promise.all([page.waitForResponse(r=>r.url().includes('/api/astra/demo-settings')&&r.request().method()==='PUT'),toggle.click()]);
  await toggle.click();await page.waitForFunction(()=>document.querySelector('.demo-mode-button')?.getAttribute('aria-pressed')==='true');
  const after=await request('GET','/api/astra/demo-settings');for(const k of ['enabled','parkedName','parkedStation'])assert.equal(after[k],before[k]);return after;
 });
 await check('D20',async()=>{
  await btn('数字化造价').click();digital=page.frameLocator('iframe[title="数字化造价工作台"]');
  await page.getByRole('combobox',{name:'当前测算项目',exact:true}).selectOption(digitalTask,{timeout:60000});
  await digital.getByRole('button',{name:'定位功能点 添加客户信息',exact:true}).waitFor({timeout:60000});
  await digital.getByRole('button',{name:'定位添加客户信息原文片段P5',exact:true}).click();
  await digital.locator('[data-entry-id].is-active').filter({hasText:'添加客户信息'}).waitFor();
  await digital.getByRole('button',{name:'定位段落 第6行',exact:true}).click();
  assert.ok(await digital.locator('[data-entry-id].is-active').count());
  const state=await request('GET',`/modules/digital-cost/api/digital-cost/v1/tasks/${digitalTask}`);save('digital-before.json',state);
  assert.equal(state.state.content.inputs.assets[0].sha256,'1f6a3a5d2391e262a63e72aeef4b4eff98f8f0d7da91594b8feac1bdb6fd08b9');
  return {task:digitalTask,prepared:true,paragraph_link:'P5 / 第6行',note:'预先人工确认功能点；不代表本轮调用模型识别'};
 });
 await check('D21',async()=>{
  assert.ok(digital);const observations=[];
  // Continue through the host's current-task guide after selecting the prepared
  // project; this completes its asynchronous context handoff to the iframe.
  await btn('核对系数与费用').last().click();
  await digital.getByRole('combobox',{name:'规模计数时机',exact:true}).waitFor({timeout:60000});
  for(const [option,factor] of [['4',1],['3',1.21]]){
   // A calculation publishes a host guide update asynchronously. Wait for
   // its tab transition, then select scale; this does not retry any write.
   for(let attempt=0;attempt<3;attempt++){
    await page.getByRole('tab',{name:'规模',exact:true}).click();
    try{await digital.getByRole('combobox',{name:'规模计数时机',exact:true}).waitFor({timeout:10000});break;}catch(e){if(attempt===2)throw e;}
   }
   await digital.getByRole('combobox',{name:'规模计数时机',exact:true}).selectOption(option,{timeout:60000});
   await digital.getByRole('button',{name:'确认方案并生成费用',exact:true}).click();
   await digital.locator('select').filter({has:digital.locator('option[value="inclusive"]')}).selectOption('inclusive');
   await digital.getByRole('checkbox',{name:'本次没有额外采购或其他费用',exact:true}).check();
   const data=await withResponse('/calculate',()=>digital.getByRole('button',{name:'保存方案并生成费用',exact:true}).click());
   save(`digital-factor-${factor}.json`,data);const snap=data.snapshots.find(s=>s.task_revision===data.state.revision),result=snap?.result;
   assert.ok(result,JSON.stringify(Object.keys(snap)));const g=result.groups[0];
   assert.equal(snap.task_id,digitalTask);assert.equal(snap.task_revision,data.state.revision);
   assert.equal(Number(g.ufp),52);assert.ok(Math.abs(Number(g.hours)-52*factor*.8*9.34)<1e-6);
   const cost=Math.round(52*factor*.8*9.34/176*4.287*10000*100)/100;
   assert.equal(Number(g.base_cost_yuan),cost);observations.push({factor,revision:data.state.revision,ufp:g.ufp,hours:g.hours,cost});
   await page.getByRole('tab',{name:'费用',exact:true}).click();await digital.getByText(new RegExp(cost.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).replaceAll('.','\\.'))).first().waitFor();
  }
  assert.ok(observations[1].revision>observations[0].revision);return observations;
 });

}finally{
 save('browser-console-errors.json',errors);
 await context.tracing.stop({path:path.join(out,'browser-trace.zip')});
 await browser.close();
}
process.exitCode=results.some(x=>x.status==='failed')?1:0;
