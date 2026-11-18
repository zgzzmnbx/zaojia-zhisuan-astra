// Standalone exhibition feed uses the same read-only display contract as Astra.
export function mountPorcelainDemo(){
  const namespace='astra-office-selection:v1';
  const people=[
    ['林工','female','bob'],['周工','male','glasses'],['陈工','female','bun'],
    ['许工','male','blue-shirt'],['何工','female','ponytail'],
  ].map(([name,gender,appearance],i)=>({id:'porcelain-demo-'+i,name,gender,appearance,accounts:[],selectable:false}));
  document.body.classList.add('porcelain-preview');
  document.title=new URLSearchParams(location.search).get('style')==='classic'?'H1 办公室 · 原版对照':'H1 办公室 · 白瓷与钴蓝';
  const rail=document.querySelector('#space-cards-panel'),toggle=document.querySelector('#space-card-toggle');
  if(!rail.hidden)toggle.click();
  const bar=document.querySelector('.office-modebar');
  // Reuse the viewer's keyboard-accessible controls inside one floating toolbar.
  bar.append(document.querySelector('#theme-toggle'));
  const title=document.createElement('strong');title.className='porcelain-title';title.textContent='H1 办公室';
  bar.prepend(title);
  const send=(type,details)=>window.postMessage({namespace,type,...details},location.origin);
  send('snapshot',{people,tasks:[],revision:1,context:'porcelain-demo',title:'办公室复核演示',enabled:true});
  const stored=window.matchMedia('(prefers-reduced-motion: reduce)');
  send('motion',{enabled:!stored.matches,delay:5,motion:{speed:38,acceleration:70}});
  const observer=new ResizeObserver(()=>window.dispatchEvent(new CustomEvent('office-host-layout',{detail:{left:0}})));
  observer.observe(rail);
  window.addEventListener('office-disposed',()=>observer.disconnect(),{once:true});
}
