/** Resume only after all held inputs and native camera motion have settled. */
export function createGlobeIdleResume(resume:()=>void, allowed:()=>boolean, moving:()=>boolean){
  let timer:ReturnType<typeof setTimeout>|undefined,disposed=false;
  const held=new Set<string>();
  function clear(){clearTimeout(timer);timer=undefined;}
  function activity(){
    clear();
    if(disposed||held.size||!allowed())return;
    timer=setTimeout(()=>{timer=undefined;if(disposed||held.size||!allowed())return;if(moving()){activity();return;}resume();},1000);
  }
  return {
    activity,
    hold(input:string){clear();held.add(input);},
    release(input:string){if(held.delete(input))activity();},
    cancel(){clear();held.clear();},
    dispose(){disposed=true;clear();held.clear();},
  };
}
