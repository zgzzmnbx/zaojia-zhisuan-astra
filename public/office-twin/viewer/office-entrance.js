// Presentation only. Count displayed time; hidden/loading time never skips a stage.
export function createOfficeEntrance(enabled=false) {
  let phase=enabled?'waiting':'complete',elapsed=0,last=null;
  const running=()=>!['complete','cancelled','waiting'].includes(phase);
  return {
    state:()=>({phase,elapsed,running:running()}),
    start(){if(!enabled)return;phase='building';elapsed=0;last=null;},
    suspend(){last=null;},
    cancel(){phase='cancelled';elapsed=0;last=null;},
    step(now,moving,reduced=false){
      if(!running())return null;
      const delta=last===null?0:Math.max(0,Math.min(100,now-last));last=now;
      if(reduced){phase='complete';return 'exploded';}
      if(moving)return null;
      elapsed+=delta;
      if(phase==='building'&&elapsed>=850){phase='exploded';elapsed=0;return 'exploded';}
      if(phase==='exploded'){phase='complete';elapsed=0;}
      return null;
    },
  };
}
