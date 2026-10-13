async(page)=>{
 const url='file:///D:/Codex-Temp/260613-%E3%80%90%E6%99%BA%E7%AE%97Astra%E3%80%91/05-%E8%A7%86%E8%A7%89%E8%AF%86%E5%88%AB/02-3D%E5%9C%BA%E6%99%AF/white-sandbox-v0.1.0/%E7%99%BD%E6%A8%A1%E7%A9%BA%E9%97%B4-%E7%8B%AC%E7%AB%8B%E9%A2%84%E8%A7%88.html';
 await page.goto(url);await page.waitForFunction(()=>document.body.dataset.ready==='true');
 const button=page.getByRole('button',{name:'夜航模式',exact:true});
 if(await button.getAttribute('aria-pressed')!=='true')await button.click();
 await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');
 const state=await page.evaluate(()=>window.__whiteSandbox.getState());
 if(state.theme.scheme!=='dark')throw new Error('Saved night preference was not restored');
 await button.click();await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');
 const restored=await page.evaluate(()=>window.__whiteSandbox.getState());
 if(restored.theme.scheme!=='light')throw new Error('Saved day preference was not restored');
 return {filePreview:true,darkPreferenceReload:true,lightPreferenceReload:true};
}
