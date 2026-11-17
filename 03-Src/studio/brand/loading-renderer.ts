export type LoadingOptions={mode:string;paused:boolean;dark:boolean;active:boolean};
export type LoadingRenderer={update:(options:LoadingOptions)=>void;inspect:()=>unknown;dispose:()=>void};

/** Start the worker immediately; fall back to the existing renderer on unsupported devices. */
export function mountLoadingLogo(host:HTMLElement,onReady:()=>void,onError:()=>void):LoadingRenderer{
 let disposed=false,worker:Worker|null=null,canvas:HTMLCanvasElement|null=null,timeout=0,fallbackStarted=false;
 let fallback:import('./LogoPreview').LogoController|null=null;
 let options:LoadingOptions={mode:'ring',paused:false,dark:false,active:true},stats:unknown=null;
 const effective=()=>({...options,active:options.active&&!document.hidden});
 const update=()=>{
  if(disposed)return;
  if(worker)worker.postMessage({type:'update',options:effective()});
  fallback?.update({...effective(),loading:true,palette:'original',seed:'#228be6',speed:1});
 };
 const stopWorker=()=>{clearTimeout(timeout);worker?.terminate();worker=null;canvas?.remove();canvas=null;};
 const fail=()=>{
  if(disposed||fallbackStarted)return;
  fallbackStarted=true;stopWorker();
  import('./logo-renderer.mjs').then(({mountLogo})=>{
   if(disposed)return;
   try{fallback=mountLogo(host,onError);update();onReady();}catch{onError();}
  }).catch(()=>{if(!disposed)onError();});
 };
 const resize=()=>{
  if(!worker)return;
  const b=host.getBoundingClientRect();if(b.width&&b.height)worker.postMessage({type:'resize',width:b.width,height:b.height,pixelRatio:devicePixelRatio||1});
 };
 const observer=new ResizeObserver(resize);observer.observe(host);
 document.addEventListener('visibilitychange',update);
 try{
  if(!('transferControlToOffscreen' in HTMLCanvasElement.prototype)||typeof Worker==='undefined')throw Error('Offscreen rendering unavailable');
  canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');host.append(canvas);
  const offscreen=canvas.transferControlToOffscreen(),box=host.getBoundingClientRect();
  worker=new Worker(new URL('./loading-logo.worker.mjs',import.meta.url),{type:'module',name:'astra-loading-logo'});
  worker.onmessage=({data})=>{
   if(disposed)return;
   if(data.type==='ready'){clearTimeout(timeout);onReady();}
   else if(data.type==='stats')stats=data.value;
   else if(data.type==='error')fail();
  };
  worker.onerror=event=>{event.preventDefault();fail();};
  worker.postMessage({type:'init',canvas:offscreen,width:Math.max(1,box.width),height:Math.max(1,box.height),pixelRatio:devicePixelRatio||1,options:effective()},[offscreen]);
  timeout=window.setTimeout(fail,15000);
 }catch{fail();}
 return {
  update(next){options=next;update();},
  inspect:()=>fallback?{...fallback.inspect(),backend:'main-thread'}:stats,
  dispose(){disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',update);stopWorker();fallback?.dispose();fallback=null;},
 };
}
