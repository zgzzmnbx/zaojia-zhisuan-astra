/** Run once after quiet time, yielding to requests, input and hidden pages.
 * @param {()=>unknown} task
 * @param {{host?:any,doc?:Document,busy?:()=>boolean,delay?:number}} options
 */
export function scheduleIdlePreload(task,{host=window,doc=document,busy=()=>false,delay=3500}={}){
 let disposed=false,timer=0,idle=0,lastInput=0;
 const input=()=>{lastInput=Date.now();};
 const cleanup=()=>{doc.removeEventListener('keydown',input,true);doc.removeEventListener('pointerdown',input,true);host.clearTimeout(timer);if(idle)host.cancelIdleCallback?.(idle);};
 const attempt=()=>{
  if(disposed)return;
  if(doc.hidden||busy()||Date.now()-lastInput<1500){timer=host.setTimeout(queue,1500);return;}
  cleanup();Promise.resolve().then(()=>{if(!disposed)return task();}).catch(()=>{});
 };
 const queue=()=>{if(disposed)return;if(host.requestIdleCallback)idle=host.requestIdleCallback(attempt);else timer=host.setTimeout(attempt,250);};
 doc.addEventListener('keydown',input,true);doc.addEventListener('pointerdown',input,true);
 timer=host.setTimeout(queue,delay);
 return()=>{disposed=true;cleanup();};
}
