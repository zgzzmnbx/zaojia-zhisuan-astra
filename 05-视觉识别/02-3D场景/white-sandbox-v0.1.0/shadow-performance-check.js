// Browser acceptance for 0.1.8. Pending until run in an allowed preview origin.
async(page)=>{
 const checks=[],state=()=>page.evaluate(()=>window.__whiteSandbox.getState());
 const assert=(ok,name)=>{if(!ok)throw new Error(name);checks.push(name)};
 const theme=page.getByRole('button',{name:'夜航模式',exact:true});
 if((await state()).theme.scheme==='dark')await theme.click();
 await page.getByRole('switch',{name:'场景阴影',exact:true}).check();
 await page.getByRole('switch',{name:'信息流',exact:true}).check();
 await page.waitForFunction(()=>window.__whiteSandbox.getState().shadowDraws>0);
 const start=await state();
 await page.waitForFunction(frame=>window.__whiteSandbox.getState().renderedFrames>=frame+60,start.renderedFrames,{timeout:20000});
 const flowed=await state();
 assert(flowed.flow.distance!==start.flow.distance,'信息流推进了实际画布帧');
 assert(flowed.shadowDraws===start.shadowDraws,'连续六十帧没有重复绘制建筑阴影');
 await page.locator('#orbit').click();const orbit=await state();
 await page.waitForFunction(frame=>window.__whiteSandbox.getState().renderedFrames>=frame+30,orbit.renderedFrames,{timeout:15000});
 const moved=await state();assert(moved.camera.some((v,i)=>Math.abs(v-orbit.camera[i])>.01)&&moved.shadowDraws===orbit.shadowDraws,'环游镜头使用已有阴影缓存');
 await page.locator('#orbit').click();
 await page.getByRole('switch',{name:'场景阴影',exact:true}).uncheck();
 assert(!(await state()).contactShadows.enabled&&!(await state()).shadowMap,'关闭阴影同时关闭固定柔影和投影');
 await page.getByRole('switch',{name:'场景阴影',exact:true}).check();
 await page.waitForFunction(count=>window.__whiteSandbox.getState().shadowDraws>count,moved.shadowDraws);
 const rebuilt=await state();assert(rebuilt.contactShadows.enabled,'恢复阴影后重新生成投影并显示固定柔影');
 await theme.click();await page.waitForFunction(()=>window.__whiteSandbox.getState().bloom.enabled);
 assert(!(await state()).contactShadows.enabled,'夜航沿用既有光晕且不叠加白天柔影');
 await theme.click();await page.getByRole('switch',{name:'信息流',exact:true}).uncheck();
 await page.waitForFunction(()=>!window.__whiteSandbox.getState().framePending);
 return {version:'0.1.8',checks,assertionCount:checks.length,state:await state()};
}
