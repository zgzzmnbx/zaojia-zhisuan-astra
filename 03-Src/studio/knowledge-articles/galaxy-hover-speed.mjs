// A visible-frame clock avoids timers surviving a paused or destroyed galaxy.
export function createGalaxyHoverSpeed() {
  let hovered=false, grace=0, factor=1;
  return {
    get factor(){return factor;},
    hover(value){
      if(hovered && !value)grace=.4;
      hovered=!!value;
      if(hovered)grace=0;
    },
    step(delta){
      let dt=Number.isFinite(delta)?Math.max(0,delta):0;
      if(!hovered && grace>0){
        const held=Math.min(grace,dt);
        factor=.3+(factor-.3)*Math.exp(-held/.16);
        grace=Math.max(0,grace-held);dt-=held;
      }
      const target=hovered ? .3 : 1;
      if(dt>0)factor=target+(factor-target)*Math.exp(-dt/(hovered ? .16 : .28));
      if(Math.abs(factor-target)<.0005)factor=target;
      return factor;
    },
    reset(){hovered=false;grace=0;factor=1;},
  };
}
