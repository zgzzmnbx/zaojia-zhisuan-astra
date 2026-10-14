type Options={enabled:boolean;blocked:boolean;delay:number};
type Clock={set:(callback:()=>void,ms:number)=>unknown;clear:(id:unknown)=>void};
/** One cancellable deadline, reset by real input; never accumulate hidden-page time. */
export function createIdleOrbit(change:(running:boolean)=>void,canStart:()=>boolean,clock:Clock){
 let options:Options={enabled:false,blocked:true,delay:15000},timer:unknown,armed=false,running=false,held=false,disposed=false;
 function stop(){if(armed)clock.clear(timer);armed=false;if(running){running=false;change(false)}}
 function reset(){stop();if(disposed||!options.enabled||options.blocked||held)return;armed=true;timer=clock.set(()=>{armed=false;if(disposed||held||options.blocked||!canStart())return;running=true;change(true)},options.delay)}
 return {configure(next:Options){options=next;reset()},activity:reset,hold(value:boolean){held=value;reset()},dispose(){disposed=true;stop()}};
}
