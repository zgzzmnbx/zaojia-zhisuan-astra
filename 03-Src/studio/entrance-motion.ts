/** Presentation only: one visibility observer, no timers, RAF loops or data writes. */
const cards='.card,.welcome-card,.capability-item,.risk-card,.project-dashboard__metric,.project-dashboard__analysis,.dv-chart-frame,.workspace-project,.asset-card,.review-card,.gork-link-card';
const panels='.summary-artifact,.modal-box,.project-dashboard__drawer,.rail-panel';
const rings='.fs-donut,.cp-ring';
const bars='.fs-column-row,.cp-composition-bar,.cp-risk-track';
const plots='.recharts-wrapper';
const disclosures='.fs-details[open]>.fs-table,.cc-disclosure[open]>div';
const selector=[cards,panels,rings,bars,plots,disclosures].join(',');
const ease='cubic-bezier(.16,1,.3,1)';

export function installEntranceMotion(doc:Document=document){
 const win=doc.defaultView;
 if(!win?.IntersectionObserver||!win.MutationObserver||!win.Element.prototype.animate)return ()=>{};
 const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
 const seen=new WeakSet<Element>(),observed=new Set<Element>(),running=new Map<Animation,Element>();
 let disposed=false;
 function settle(root?:Element){
  for(const [animation,node] of running)if(!root||root===node||root.contains(node)){animation.cancel();running.delete(animation);}
 }
 function animate(node:Element,frames:Keyframe[],duration:number,delay=0){
  const animation=node.animate(frames,{duration,delay,easing:ease,fill:'backwards'});
  animation.id='astra-entrance';running.set(animation,node);
  const release=()=>{running.delete(animation);animation.cancel();};
  animation.finished.then(release,()=>running.delete(animation));
 }
 function reveal(node:Element,delay:number){
  if(seen.has(node)||!node.isConnected||node.closest('[hidden],dialog:not([open]),.aw2-product-frame'))return;
  seen.add(node);
  if(reduced.matches||doc.hidden)return;
  if(node.matches(rings)){
   node.querySelectorAll('circle[stroke-dasharray]').forEach(circle=>animate(circle,[{strokeDasharray:'0 100'},{strokeDasharray:circle.getAttribute('stroke-dasharray')!}],740,delay));
   const center=node.querySelector('.fs-donut-center');if(center)animate(center,[{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'none'}],360,delay+100);
  }else if(node.matches(bars)){
   const fill=node.matches('.fs-column-row')?node.querySelector('.fs-column-track>i'):node.firstElementChild;
   if(fill)animate(fill,[{transform:'scaleX(0)',transformOrigin:'left center'},{transform:'scaleX(1)',transformOrigin:'left center'}],680,delay);
  }else if(node.matches(plots)){
   animate(node,[{opacity:.35,clipPath:'inset(0 100% 0 0)'},{opacity:1,clipPath:'inset(0 0% 0 0)'}],720,delay);
  }else if(node.matches(panels)){
   animate(node,[{opacity:0,transform:'translateY(12px) scale(.985)'},{opacity:1,transform:'none'}],360);
  }else{
   animate(node,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],320,delay);
  }
 }
 const visibility=new win.IntersectionObserver(entries=>{
  let index=0;
  for(const entry of entries){
   if(entry.isIntersecting&&entry.intersectionRect.height>0){reveal(entry.target,Math.min(index++*35,140));}
   else settle(entry.target);
  }
 },{threshold:0.01});
 function collect(root:Element,rearm=false){
  const nodes=[...(root.matches(selector)?[root]:[]),...root.querySelectorAll(selector)];
  for(const node of nodes){
   if(rearm){settle(node);seen.delete(node);visibility.unobserve(node);}
   if(rearm||!observed.has(node)){observed.add(node);visibility.observe(node);}
  }
 }
 function remove(root:Element){
  for(const node of observed)if(root===node||root.contains(node)){settle(node);visibility.unobserve(node);observed.delete(node);}
 }
 const mutations=new win.MutationObserver(records=>{
  if(disposed)return;
  for(const record of records){
   if(record.type==='attributes'){
    const node=record.target as Element;
    // Only an explicit panel/dialog/details opening replays an existing card.
    if(node.hasAttribute('hidden')||(['DIALOG','DETAILS'].includes(node.tagName)&&!node.hasAttribute('open')))settle(node);
    else collect(node,true);
   }else{
    for(const node of record.removedNodes)if(node instanceof win.Element&&!node.isConnected)remove(node);
    for(const node of record.addedNodes)if(node instanceof win.Element)collect(node);
   }
  }
 });
 collect(doc.body);
 mutations.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open']});
 const stop=()=>{if(reduced.matches||doc.hidden)settle();};
 reduced.addEventListener('change',stop);doc.addEventListener('visibilitychange',stop);
 return ()=>{disposed=true;visibility.disconnect();mutations.disconnect();settle();observed.clear();reduced.removeEventListener('change',stop);doc.removeEventListener('visibilitychange',stop);};
}
