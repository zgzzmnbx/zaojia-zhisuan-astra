/** One scene-owned leader between the focused detail card and its real roof anchor. */
export function createFocusConnector(host,request){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.classList.add('sandbox-focus-connector');svg.setAttribute('aria-hidden','true');
 svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;max-width:none;pointer-events:none;overflow:hidden;z-index:1;display:none';
 const halo=document.createElementNS(ns,'path'),line=document.createElementNS(ns,'path'),dot=document.createElementNS(ns,'circle');
 for(const [path,color,width] of [[halo,'var(--paper)',3.5],[line,'var(--blue)',1.5]]){path.setAttribute('fill','none');path.setAttribute('stroke',color);path.setAttribute('stroke-width',String(width));path.setAttribute('stroke-linecap','round');path.setAttribute('opacity',path===halo?'.8':'.7');svg.append(path)}
 dot.setAttribute('r','3.5');dot.setAttribute('fill','var(--blue)');dot.setAttribute('stroke','var(--paper)');dot.setAttribute('stroke-width','1.5');svg.append(dot);host.append(svg);
 let observed=null;const observer=new ResizeObserver(request);
 return {hide(){svg.style.display='none'},update(anchor,card,width,height){
  if(card!==observed){observer.disconnect();observed=card;if(card)observer.observe(card)}
  if(!card||!anchor?.valid||anchor.ax<0||anchor.ax>width||anchor.ay<0||anchor.ay>height){svg.style.display='none';return}
  const left=card.offsetLeft,top=card.offsetTop,right=left+card.offsetWidth,bottom=top+card.offsetHeight;
  const x=Math.max(left,Math.min(right,anchor.ax)),y=Math.max(top,Math.min(bottom,anchor.ay));
  if(Math.hypot(x-anchor.ax,y-anchor.ay)<8){svg.style.display='none';return}
  const d=`M ${x} ${y} L ${anchor.ax} ${anchor.ay}`;
  halo.setAttribute('d',d);line.setAttribute('d',d);dot.setAttribute('cx',String(anchor.ax));dot.setAttribute('cy',String(anchor.ay));svg.dataset.zone=anchor.id;svg.style.display='block';
 },dispose(){observer.disconnect();svg.remove()}};
}
