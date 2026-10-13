async(page)=>{
 await page.getByRole('switch',{name:'信息流',exact:true}).check();
 const download=page.waitForEvent('download');
 await page.evaluate(async()=>{
  const stream=document.querySelector('#scene canvas').captureStream(24),chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:4000000});
  const finished=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=resolve});
  recorder.start();await new Promise(resolve=>setTimeout(resolve,7000));recorder.stop();await finished;
  stream.getTracks().forEach(t=>t.stop());const url=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));
  const a=document.createElement('a');a.href=url;a.download='information-flow.webm';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
 });
 await (await download).saveAs('05-视觉识别/02-3D场景/white-sandbox-v0.1.0/information-flow.webm');
 await page.screenshot({path:'05-视觉识别/02-3D场景/white-sandbox-v0.1.0/preview-information-flow.png'});
 return {recorded:true,state:await page.evaluate(()=>window.__whiteSandbox.getState())};
}
