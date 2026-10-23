const modes=new Set(['baked','original']);

/** Two independent renderer owners. A late loader may finish but never reactivate itself. */
export function createModeController({create,onState=()=>{},onError=()=>{},alignFirstVisit=true}) {
  const instances=new Map(),pending=new Map(),poses=new Map();
  const released=new WeakSet();
  let current=null,requested=null,revision=0,active=true,disposed=false;
  function release(instance){if(instance&&!released.has(instance)){released.add(instance);instance.dispose();}}
  function pauseAll(){for(const instance of instances.values())instance.setActive(false);}
  async function get(mode){
    if(!pending.has(mode)){
      const request=Promise.resolve().then(()=>create(mode)).then(async instance=>{
        if(disposed){release(instance);Promise.resolve(instance.ready).catch(()=>{});throw Error('Preview disposed');}
        instances.set(mode,instance);instance.setActive(false);
        await instance.ready;
        if(disposed){release(instance);instances.delete(mode);throw Error('Preview disposed');}
        return instance;
      }).catch(error=>{pending.delete(mode);const instance=instances.get(mode);release(instance);instances.delete(mode);throw error;});
      pending.set(mode,request);
    }
    return pending.get(mode);
  }
  return {
    async switchMode(mode){
      if(!modes.has(mode)||disposed)return false;
      const ticket=++revision,previous=current,previousInstance=instances.get(previous);
      const previousPose=previousInstance?.getViewPose?.();
      if(previousPose)poses.set(previous,previousPose);
      requested=mode;pauseAll();onState({phase:'loading',mode,previous});
      try{
        const instance=await get(mode);
        if(disposed||ticket!==revision)return false;
        const pose=poses.get(mode)??(alignFirstVisit?previousPose:null);
        if(pose)instance.setViewPose?.(pose);
        current=mode;instance.setActive(active);
        onState({phase:'ready',mode,previous,instance});return true;
      }catch(error){
        if(disposed||ticket!==revision)return false;
        // Retain the last successful mode. A failed candidate never replaces it.
        current=previous;requested=previous;instances.get(previous)?.setActive(active);
        onError(error,{mode,previous});return false;
      }
    },
    setActive(value){active=!!value;pauseAll();if(active&&current===requested)instances.get(current)?.setActive(true);},
    get current(){return current;},
    get requested(){return requested;},
    get instance(){return instances.get(current);},
    getInstance(mode){return instances.get(mode);},
    state(){return {current,requested,active,disposed,loaded:[...instances.keys()]};},
    dispose(){if(disposed)return;disposed=true;++revision;pauseAll();for(const instance of instances.values())release(instance);instances.clear();},
  };
}
