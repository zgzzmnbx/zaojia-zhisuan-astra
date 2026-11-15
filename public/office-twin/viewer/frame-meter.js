// Count presented viewer frames, never a separate animation loop.
export function createFrameMeter(node){
  let start=null,frames=0,last=null,reading=null,total=0;
  function reset(text='FPS —'){start=last=null;frames=0;reading=null;node.textContent=text;}
  return {
    frame(now){
      total++;
      if(start===null||last!==null&&now-last>1500){start=now;frames=0;}
      last=now;frames++;
      if(now-start>=750){reading=Math.round((frames-1)*1000/(now-start));node.textContent=`${reading} FPS`;start=now;frames=1;}
    },
    idle(){reset('FPS · 静止');},
    suspend(){reset();},
    state:()=>({fps:reading,frames:total}),
  };
}
