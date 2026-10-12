/** Presentation only: one visibility observer, no timers, RAF loops or data writes. */
const cards='.card,.welcome-card,.capability-item,.risk-card,.project-dashboard__metric,.project-dashboard__analysis,.dv-chart-frame,.workspace-project,.asset-card,.review-card,.gork-link-card';
const reviewCards='.inline-review-progress,.inline-review-setup,.review-progress-receipt';
const reviewParts='.inline-review-progress__summary>div,.inline-review-progress__platform,.inline-review-setup__step-card';
const reviewValues='[data-review-motion-value]';
const reviewTracks='.inline-review-progress__track';
const panels='.summary-artifact,.modal-box,.project-dashboard__drawer,.rail-panel';
const rings='.fs-donut,.cp-ring';
const bars='.fs-column-row,.cp-composition-bar,.cp-risk-track,.rr-animated-track';
const plots='.recharts-wrapper';
const verticalCharts='.chat-knowledge-chart-scroll,.pricing-histogram';
const disclosures='.fs-details[open]>.fs-table,.cc-disclosure[open]>div,.mapping-fields[open]>.field-grid,.cp-context-details[open]';
const icons='.cc-symbol,.cp-project-icon,.welcome-card>.astra-icon';
const selector=[cards,panels,rings,bars,plots,verticalCharts,disclosures,icons,reviewCards,reviewParts,reviewValues,reviewTracks].join(',');
const ease='cubic-bezier(.16,1,.3,1)';

export function installEntranceMotion(doc:Document=document){
 const win=doc.defaultView;
 if(!win?.IntersectionObserver||!win.MutationObserver||!win.Element.prototype.animate)return ()=>{};
 const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
 const seen=new WeakSet<Element>(),observed=new Set<Element>(),running=new Map<Animation,{node:Element;owner:Element}>();
 const visible=new Set<Element>();
 let disposed=false;
 function settle(root?:Element){
  for(const [animation,{node,owner}] of running)if(!root||root===node||root.contains(node)){
   // An entrance interrupted by auto-scroll must be allowed to play when visible again.
   seen.delete(owner);animation.cancel();running.delete(animation);
  }
 }
 function animate(node:Element,frames:Keyframe[],duration:number,delay=0,owner=node,id='astra-entrance'){
  const animation=node.animate(frames,{duration,delay,easing:ease,fill:'backwards'});
  animation.id=id;running.set(animation,{node,owner});
  const release=()=>{running.delete(animation);animation.cancel();};
  animation.finished.then(release,()=>running.delete(animation));
 }
 function reveal(node:Element,delay:number){
  if(seen.has(node)||!node.isConnected||node.closest('[hidden],dialog:not([open]),.aw2-product-frame'))return;
  // Responsive charts may mount an empty wrapper before their measured SVG.
  // Keep it eligible until the actual geometry arrives.
  if(node.matches(plots)&&!node.querySelector('.recharts-pie,.recharts-bar,.recharts-area,.recharts-line,.recharts-radar'))return;
  seen.add(node);
  if(doc.hidden){seen.delete(node);return;}
  if(node.matches(reviewValues))return;
  if(reduced.matches){animate(node,[{opacity:.55},{opacity:1}],180);return;}
  if(node.matches(reviewTracks)){
   node.querySelectorAll('i').forEach(fill=>animate(fill,[{transform:'scaleX(0)',transformOrigin:'left'},{transform:'scaleX(1)',transformOrigin:'left'}],1000,160,node));
  }else if(node.matches(reviewCards)){
   animate(node,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],500);
  }else if(node.matches(reviewParts)){
   const order=Array.from(node.parentElement?.children||[]).indexOf(node);
   animate(node,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],460,90+Math.min(order,3)*65);
  }else if(node.matches(rings)){
   node.querySelectorAll('circle[stroke-dasharray]').forEach(circle=>animate(circle,[{strokeDasharray:'0 100'},{strokeDasharray:circle.getAttribute('stroke-dasharray')!}],1100,delay+100,node));
   const center=node.querySelector('.fs-donut-center');if(center)animate(center,[{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'none'}],600,delay+180,node);
  }else if(node.matches(bars)){
   const fill=node.matches('.fs-column-row')?node.querySelector('.fs-column-track>i'):node.firstElementChild;
   if(fill)animate(fill,[{transform:'scaleX(0)',transformOrigin:'left center'},{transform:'scaleX(1)',transformOrigin:'left center'}],1000,delay+100,node);
  }else if(node.matches(verticalCharts)){
   node.querySelectorAll('.chat-knowledge-bar,.pricing-histogram i').forEach((fill,index)=>{
    const stagger=delay+Math.min(index*35,420);
    animate(fill,[{transform:'scaleY(0)',transformOrigin:'center bottom',transformBox:'fill-box'},{transform:'scaleY(1)',transformOrigin:'center bottom',transformBox:'fill-box'}],900,stagger,node);
    const label=fill.parentElement?.querySelector('.chat-knowledge-value,.pricing-histogram span');
    if(label)animate(label,[{opacity:0},{opacity:1}],400,stagger+200,node);
   });
  }else if(node.matches(plots)){
   // Clipping the observed wrapper makes its intersection empty and restarts
   // the entrance every frame. Reveal the SVG while observing stable geometry.
   const surface=node.querySelector(':scope > svg.recharts-surface');
   const pies=node.querySelectorAll('.recharts-pie');
   if(pies.length){
    pies.forEach(pie=>animate(pie,[{opacity:0,transform:'scale(.86) rotate(-12deg)',transformOrigin:'center',transformBox:'fill-box'},{opacity:1,transform:'scale(1) rotate(0deg)',transformOrigin:'center',transformBox:'fill-box'}],1000,delay,node));
   }else if(surface)animate(surface,[{opacity:.35,clipPath:'inset(0 100% 0 0)'},{opacity:1,clipPath:'inset(0 0% 0 0)'}],900,delay,node);
  }else if(node.matches(icons)){
   animate(node,[{opacity:0,transform:'scale(.65) rotate(-12deg)'},{opacity:1,transform:'scale(1.08) rotate(3deg)',offset:.65},{opacity:1,transform:'none'}],650,delay+100);
  }else if(node.matches(panels)){
   animate(node,[{opacity:0,transform:'translateY(22px) scale(.97)'},{opacity:1,transform:'none'}],560);
  }else{
   animate(node,[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'none'}],520,delay);
  }
 }
 const visibility=new win.IntersectionObserver(entries=>{
  let index=0;
  for(const entry of entries){
   if(entry.isIntersecting&&entry.intersectionRect.height>0){visible.add(entry.target);reveal(entry.target,Math.min(index++*35,140));}
   else {visible.delete(entry.target);settle(entry.target);}
  }
 },{threshold:0.01});
 function collect(root:Element,rearm=false){
  const nodes=[...(root.matches(selector)?[root]:[]),...root.querySelectorAll(selector)];
  // Observe the stable track, not its zero-width fills, to avoid cancelling a 0% tween.
  for(const node of nodes){
   if(node.matches(reviewValues)&&node.parentElement?.matches(reviewTracks))continue;
   if(rearm){settle(node);seen.delete(node);visibility.unobserve(node);}
   if(rearm||!observed.has(node)){observed.add(node);visibility.observe(node);}
  }
 }
 function remove(root:Element){
  for(const node of observed)if(root===node||root.contains(node)){settle(node);visibility.unobserve(node);observed.delete(node);visible.delete(node);}
 }
 const mutations=new win.MutationObserver(records=>{
  if(disposed)return;
  for(const record of records){
   if(record.type==='attributes'){
    const node=record.target as Element;
    if(record.attributeName==='data-review-motion-value'){
     const owner=node.parentElement?.matches(reviewTracks)?node.parentElement:node;
     if(record.oldValue===null||record.oldValue===node.getAttribute('data-review-motion-value')||!seen.has(owner)||!visible.has(owner)||doc.hidden||reduced.matches||node.closest('[hidden],dialog:not([open])'))continue;
     for(const [animation,entry] of running)if(entry.node===node){animation.cancel();running.delete(animation);}
     if(node.parentElement?.matches(reviewTracks)){
      animate(node,[{width:record.oldValue},{width:node.getAttribute('data-review-motion-value')!}],700,0,owner,'astra-review-update');
     }else{
      animate(node,[{backgroundColor:'var(--astra-soft)',boxShadow:'0 0 0 3px var(--astra-line)'},{backgroundColor:win.getComputedStyle(node).backgroundColor,boxShadow:'0 0 0 0 transparent'}],700,0,owner,'astra-review-update');
     }
     continue;
    }
    // Only an explicit panel/dialog/details opening replays an existing card.
    if(node.hasAttribute('hidden')||(['DIALOG','DETAILS'].includes(node.tagName)&&!node.hasAttribute('open')))settle(node);
    else collect(node,true);
   }else{
    for(const node of record.removedNodes)if(node instanceof win.Element&&!node.isConnected)remove(node);
    for(const node of record.addedNodes)if(node instanceof win.Element){
     collect(node);
     const plot=node.closest(plots);
     if(plot&&visible.has(plot))reveal(plot,0);
    }
   }
  }
 });
 collect(doc.body);
 mutations.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['hidden','open','data-review-motion-value']});
 const stop=()=>{if(reduced.matches||doc.hidden)settle();};
 reduced.addEventListener('change',stop);doc.addEventListener('visibilitychange',stop);
 return ()=>{disposed=true;visibility.disconnect();mutations.disconnect();settle();observed.clear();visible.clear();reduced.removeEventListener('change',stop);doc.removeEventListener('visibilitychange',stop);};
}
