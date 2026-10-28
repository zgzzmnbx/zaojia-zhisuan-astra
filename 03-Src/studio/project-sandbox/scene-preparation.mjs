/** Finite idle preparation, suspended in background tabs and cancellable on teardown. */
export function createScenePreparation({host=window,doc=document}={}){
 let disposed=false,pending=null;
 function pause(){
  return new Promise(resolve=>{
   if(disposed){resolve(false);return;}
   let idle=0,timer=0;
   const cleanup=()=>{host.clearTimeout(timer);if(idle)host.cancelIdleCallback?.(idle);doc.removeEventListener('visibilitychange',visible);pending=null;};
   const done=value=>{cleanup();resolve(value)};
   const attempt=()=>{idle=timer=0;if(disposed)done(false);else if(!doc.hidden)done(true)};
   const queue=()=>{if(doc.hidden||idle||timer)return;if(host.requestIdleCallback)idle=host.requestIdleCallback(attempt,{timeout:1000});else timer=host.setTimeout(attempt,16)};
   const visible=()=>{if(doc.hidden){host.clearTimeout(timer);timer=0;if(idle)host.cancelIdleCallback?.(idle);idle=0}else queue()};
   pending=()=>done(false);doc.addEventListener('visibilitychange',visible);queue();
  });
 }
 return {
  async run(steps){for(const step of steps){if(!await pause())return false;await step();if(disposed)return false}return true},
  dispose(){disposed=true;pending?.()},
 };
}
