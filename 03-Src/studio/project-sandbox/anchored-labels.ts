type Anchor={id:string;ax:number;ay:number;width:number;height:number;valid:boolean};
/** Labels follow their roof projection exactly, even when it is outside the viewport. */
export function createAnchoredLabels(){
 let alpha=1;
 return {update(items:Anchor[],deltaMs:number,focused:boolean,zoomRatio:number,returning=false,reduced=false){
  const t=Math.max(0,Math.min(1,(zoomRatio-1.2)/.65));
  const target=focused||returning?0:1-t*t*(3-2*t);
  const step=Math.max(0,Math.min(50,deltaMs))/(target<alpha?320:650);
  alpha=reduced?target:alpha+Math.sign(target-alpha)*Math.min(Math.abs(target-alpha),step);
  return {placements:items.map(p=>({...p,x:p.ax-p.width/2,y:p.ay-p.height-18,alpha,hidden:!p.valid||alpha===0,interactive:p.valid&&target>.15&&alpha>.15})),pending:Math.abs(alpha-target)>.0001,reflows:0};
 }};
}
