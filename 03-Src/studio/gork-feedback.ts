/** Shared feedback lifetime; visual poses remain the original Gork assets. */
export const GORK_SUCCESS_MS=3_000;
export const GORK_WARNING_MS=10_000;
export type GorkFeedback={success:boolean;warning:boolean};
type Clock={now:()=>number;after:(fn:()=>void,delay:number)=>unknown;cancel:(id:unknown)=>void};
const clock:Clock={now:()=>performance.now(),after:(fn,delay)=>setTimeout(fn,delay),cancel:id=>clearTimeout(id as ReturnType<typeof setTimeout>)};

/** Business feedback belongs to the workspace, shared by input and fullscreen avatars. */
export function createGorkFeedback(notify:(value:GorkFeedback)=>void,time:Clock=clock){
 let pendingSuccess=false,successUntil=0,warningUntil=0,lastWarningKey='',disposed=false,timer:unknown;
 function cancel(){if(timer!==undefined)time.cancel(timer);timer=undefined;}
 function publish(){
  cancel();if(disposed)return;
  const now=time.now();notify({success:pendingSuccess||successUntil>now,warning:warningUntil>now});
  const deadlines=[successUntil,warningUntil].filter(deadline=>deadline>now);
  if(deadlines.length)timer=time.after(publish,Math.min(...deadlines)-now);
 }
 return {
  success(){if(disposed)return;warningUntil=0;successUntil=0;pendingSuccess=true;publish();},
  presented(duration:number){if(disposed||!pendingSuccess)return;pendingSuccess=false;successUntil=time.now()+Math.max(GORK_SUCCESS_MS,Number.isFinite(duration)?duration:0);publish();},
  interruptSuccess(){pendingSuccess=false;successUntil=0;publish();},
  warning(){if(disposed)return;pendingSuccess=false;successUntil=0;warningUntil=time.now()+GORK_WARNING_MS;publish();},
  observeWarning(key:string,present:boolean){
   if(disposed)return;
   if(!present){lastWarningKey='';warningUntil=0;publish();return;}
   if(key===lastWarningKey)return;
   lastWarningKey=key;warningUntil=time.now()+GORK_WARNING_MS;publish();
  },
  reset(){pendingSuccess=false;successUntil=warningUntil=0;lastWarningKey='';publish();},
  dispose(){disposed=true;cancel();},
 };
}
