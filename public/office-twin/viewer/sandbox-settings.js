const namespace='astra-office-settings:v1';
const adminTabs=['profiles','tasks','chat'];
export function createSandboxSettings({workstations,getTasks,onSaved}){
  const side=document.querySelector('#office-sandbox-settings'),admin=document.querySelector('#office-admin-settings');
  const manage=document.querySelector('#picture-toggle'),preview=document.querySelector('#office-preview-toggle');
  const tabs=[...side.querySelectorAll('[role=tab]')],controller=new AbortController(),opts={signal:controller.signal};
  let active='picture',frame=null,busy=false,returnTo=null,destination={tab:'tasks',person:''};
  const sideOpen=()=>side.hasAttribute('open')||side.matches(':popover-open');
  function send(type,data={}){frame?.contentWindow?.postMessage({namespace,type,...data},location.origin);}
  function syncTheme(){const {astraScheme:scheme,astraPalette:palette}=document.documentElement.dataset;send('theme',{scheme,palette});}
  function syncTasks(){if(frame)send('context',{tasks:getTasks()});}
  const theme=new MutationObserver(syncTheme);theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-astra-scheme','data-astra-palette']});
  function changeVisibility(){
    window.dispatchEvent(new Event('office-admin-visibility'));
    if(parent!==window)parent.postMessage({namespace:'astra-office-selection:v1',type:'settings-visibility',open:admin.open},location.origin);
  }
  function closeSide(){
    if(!sideOpen())return;
    if(side.hidePopover)side.hidePopover();else side.close();
    workstations.deactivate(true);preview.setAttribute('aria-expanded','false');
  }
  function closeAdmin(){
    if(!admin.open)return;
    admin.close();manage.setAttribute('aria-expanded','false');changeVisibility();
  }
  function dismiss(){
    if(busy||workstations.isSaving())return;
    const button=admin.open?manage:preview;
    closeSide();closeAdmin();(returnTo?.isConnected&&returnTo.getClientRects().length&&returnTo!==document.body?returnTo:button).focus({preventScroll:true});
  }
  function setTab(name){
    if(workstations.isSaving())return;
    if(active==='seats'&&name!=='seats')workstations.deactivate();
    active=name;
    for(const t of tabs){
      const selected=t.dataset.pref===name;t.tabIndex=selected?0:-1;t.setAttribute('aria-selected',String(selected));
      document.getElementById(t.getAttribute('aria-controls')).hidden=!selected;
    }
    if(name==='seats')void workstations.activate();
  }
  function open(name,personId){
    if(busy||workstations.isSaving())return;
    if(!sideOpen()&&!admin.open)returnTo=document.activeElement;
    if(name==='picture'||name==='seats'||name==='camera'){
      closeAdmin();if(!sideOpen()){if(side.showPopover)side.showPopover();else side.show();}
      preview.setAttribute('aria-expanded','true');
      if(name==='camera'){
        setTab('picture');
        const controls=side.querySelector('#office-camera-controls');controls.open=true;controls.querySelector('summary').focus();
      }else{setTab(name);tabs.find(t=>t.dataset.pref===name)?.focus();}
      return;
    }
    closeSide();
    if(adminTabs.includes(name))destination={tab:name,person:personId||''};
    if(!frame){
      frame=document.createElement('iframe');frame.title='办公室沙盘设置';const url=new URL('/office-settings.html',location.origin);
      url.searchParams.set('tab',destination.tab);if(destination.person)url.searchParams.set('person',destination.person);
      frame.src=url.href;admin.append(frame);
    }else if(adminTabs.includes(name))send('navigate',destination);
    if(!admin.open){admin.showModal();changeVisibility();}
    manage.setAttribute('aria-expanded','true');frame.focus();
  }
  manage.addEventListener('click',()=>open(),opts);preview.addEventListener('click',()=>sideOpen()?dismiss():open(active),opts);
  document.querySelector('#office-pref-close').addEventListener('click',dismiss,opts);
  for(const t of tabs)t.addEventListener('click',()=>setTab(t.dataset.pref),opts);
  side.querySelector('[role=tablist]').addEventListener('keydown',e=>{
    const i=tabs.indexOf(e.target);if(i<0)return;
    const next={ArrowRight:(i+1)%tabs.length,ArrowLeft:(i+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[e.key];
    if(next===undefined||workstations.isSaving())return;e.preventDefault();setTab(tabs[next].dataset.pref);tabs[next].focus();
  },opts);
  side.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dismiss();}},opts);
  admin.addEventListener('cancel',e=>{e.preventDefault();dismiss();},opts);
  admin.addEventListener('click',e=>{
    if(e.target!==admin)return;
    const bounds=admin.getBoundingClientRect();
    if(e.clientX<bounds.left||e.clientX>bounds.right||e.clientY<bounds.top||e.clientY>bounds.bottom)dismiss();
  },opts);
  window.addEventListener('message',e=>{
    if(!frame||e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.namespace!==namespace)return;
    const d=e.data;
    switch(d.type){
      case 'ready':syncTheme();syncTasks();send('navigate',destination);break;
      case 'busy':busy=!!d.busy;break;
      case 'saved':onSaved(d.value);break;
      case 'roster-saved':void workstations.refresh();break;
      case 'chat-saved':window.dispatchEvent(new Event('office-chat-saved'));break;
      case 'camera':window.dispatchEvent(new CustomEvent('office-camera-preference',{detail:d.value}));break;
      case 'preview':if(['seats','picture','camera'].includes(d.name))open(d.name);break;
      case 'close':dismiss();break;
    }
  },opts);
  window.addEventListener('storage',e=>{if(e.key==='astra.office.roster-revision')void workstations.refresh();},opts);
  const query=new URLSearchParams(location.search),initial=query.get('settings');
  if([...adminTabs,'picture','seats','camera'].includes(initial))open(initial,query.get('person'));
  return {open,dismiss,syncTasks,dispose(){controller.abort();theme.disconnect();closeAdmin();closeSide();frame?.remove();}};
}
