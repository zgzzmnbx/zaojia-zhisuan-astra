/** Scene-owned callout, anchored to the roof without shifting either building or card. */
let connectorId=0;
export function createFocusConnector(host,request){
 const ns='http://www.w3.org/2000/svg',make=tag=>document.createElementNS(ns,tag),svg=make('svg');
 svg.classList.add('sandbox-focus-connector');svg.setAttribute('aria-hidden','true');
 svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;max-width:none;pointer-events:none;overflow:hidden;z-index:1;display:none';
 const defs=make('defs'),gradient=make('linearGradient'),gradientId=`sandbox-callout-${++connectorId}`;
 gradient.id=gradientId;gradient.setAttribute('gradientUnits','userSpaceOnUse');
 for(const [offset,opacity] of [['0%','.9'],['55%','.65'],['100%','.3']]){const stop=make('stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color','var(--blue)');stop.setAttribute('stop-opacity',opacity);gradient.append(stop)}
 defs.append(gradient);svg.append(defs);
 const halo=make('path'),line=make('path'),ring=make('circle'),dot=make('circle'),port=make('circle');
 for(const [path,width,opacity] of [[halo,4,'.1'],[line,1.35,'1']]){path.setAttribute('fill','none');path.setAttribute('stroke',`url(#${gradientId})`);path.setAttribute('stroke-width',String(width));path.setAttribute('stroke-linecap','round');path.setAttribute('opacity',opacity);path.setAttribute('vector-effect','non-scaling-stroke');svg.append(path)}
 ring.setAttribute('r','5.5');ring.setAttribute('fill','var(--blue)');ring.setAttribute('fill-opacity','.07');ring.setAttribute('stroke','var(--blue)');ring.setAttribute('stroke-opacity','.45');ring.setAttribute('stroke-width','1');
 dot.setAttribute('r','2.2');dot.setAttribute('fill','var(--blue)');
 port.setAttribute('r','2');port.setAttribute('fill','var(--blue)');port.setAttribute('fill-opacity','.4');
 svg.append(ring,dot,port);host.append(svg);
 let observed=null;const observer=new ResizeObserver(request);
 return {hide(){svg.style.display='none'},update(anchor,card,width,height){
  if(card!==observed){observer.disconnect();observed=card;if(card)observer.observe(card)}
  if(!card||!anchor?.valid||anchor.ax<0||anchor.ax>width||anchor.ay<0||anchor.ay>height){svg.style.display='none';return}
  const left=card.offsetLeft,top=card.offsetTop,right=left+card.offsetWidth,bottom=top+card.offsetHeight;
  const ax=anchor.ax,ay=anchor.ay,nearestX=Math.max(left,Math.min(right,ax)),nearestY=Math.max(top,Math.min(bottom,ay));
  if(Math.hypot(nearestX-ax,nearestY-ay)<8){svg.style.display='none';return}
  let x=nearestX,y=nearestY,c1x=ax,c1y=ay,c2x=x,c2y=y;
  if(ax<left||ax>right){
   const side=ax<left?-1:1,inset=Math.min(48,card.offsetHeight/3);
   y=Math.max(top+inset,Math.min(bottom-inset,ay-38));
   const reach=Math.min(110,Math.max(24,Math.abs(x-ax)*.4));
   c1x=ax;c1y=ay-Math.min(52,Math.max(20,Math.abs(x-ax)*.2));c2x=x+side*reach;c2y=y;
  }else{
   const side=ay<top?-1:1,reach=Math.min(90,Math.max(20,Math.abs(y-ay)*.4));
   x=Math.max(left+24,Math.min(right-24,ax+32));c1x=ax;c1y=ay-side*reach;c2x=x;c2y=y+side*reach;
  }
  const d=`M ${ax} ${ay} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x} ${y}`;
  for(const path of [halo,line])path.setAttribute('d',d);
  for(const circle of [ring,dot]){circle.setAttribute('cx',String(ax));circle.setAttribute('cy',String(ay))}
  port.setAttribute('cx',String(x));port.setAttribute('cy',String(y));
  for(const [key,value] of Object.entries({x1:ax,y1:ay,x2:x,y2:y}))gradient.setAttribute(key,String(value));
  svg.dataset.zone=anchor.id;svg.style.display='block';
 },dispose(){observer.disconnect();svg.remove()}};
}
