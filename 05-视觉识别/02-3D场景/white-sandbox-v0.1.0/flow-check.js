async(page)=>{
 const checks=[],state=()=>page.evaluate(()=>window.__whiteSandbox.getState());
 const assert=(ok,name)=>{if(!ok)throw new Error(name);checks.push(name)};
 const control=page.getByRole('switch',{name:'信息流',exact:true});
 assert((await state()).flow.playing,'默认信息流开启');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!window.__whiteSandbox.getState().flow.playing);
 assert(!(await state()).flow.playing,'未手动覆盖时遵循减少动效设置');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>window.__whiteSandbox.getState().flow.playing);
 const initial=await state();
 assert(initial.flow.order.join(',')==='import,price,risk,knowledge,report,review,table','七建筑按编号依次连接');
 assert(initial.flow.segments===6&&initial.flow.stopDistances.every((d,i,a)=>!i||d>a[i-1]),'六段连续管线的站点距离严格递增');
 const before=initial.flow.shaderDistance;
 await page.waitForTimeout(450);
 assert((await state()).flow.shaderDistance!==before,'实际 shader 信号随时间推进');
 const image1=await page.locator('#scene canvas').screenshot();await page.waitForTimeout(350);const image2=await page.locator('#scene canvas').screenshot();
 assert(!image1.equals(image2),'真实画布帧发生流动变化');
 await page.getByRole('textbox',{name:'向智算提问'}).fill('保留这份信息流草稿');
 await control.uncheck();await page.waitForFunction(()=>!window.__whiteSandbox.getState().framePending);
 const paused=await state();await page.waitForTimeout(350);
 assert((await state()).flow.shaderDistance===paused.flow.shaderDistance,'暂停后信号位置不变且停止空闲帧');
 await page.getByRole('button',{name:'进入风险复核',exact:true}).click();await page.waitForFunction(()=>!window.__whiteSandbox.getState().framePending);
 assert(!(await state()).flow.playing&&(await state()).flow.distance===paused.flow.distance,'选择建筑不重启暂停的信号');
 await control.focus();await page.keyboard.press('Space');await page.waitForTimeout(250);
 assert((await state()).flow.playing&&(await state()).draft==='保留这份信息流草稿','键盘恢复信号且保留草稿');
 // Headless Chromium keeps background tabs visible: exercise the page lifecycle
 // handler with a controlled visibility event, and identify this as simulated.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
 const hidden=await state();await page.waitForTimeout(400);
 assert(!(await state()).framePending&&(await state()).flow.distance===hidden.flow.distance,'受控隐藏事件停止信息流计算');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
 await page.waitForTimeout(80);const resumed=await state();
 assert(resumed.flow.playing,'受控恢复事件保留用户选定的播放状态');
 assert(((resumed.flow.distance-hidden.flow.distance+14)%14)<1.5,'后台时间不被补算成信号跳跃');
 await control.uncheck();await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.__whiteSandbox.getState().framePending);
 await page.getByRole('textbox',{name:'向智算提问'}).fill('');
 return {checks,assertionCount:checks.length,state:await state()};
}
