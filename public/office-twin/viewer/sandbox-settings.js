const namespace='astra-office-settings:v1';
const tabNames=['picture','seats','tasks'];

export function createSandboxSettings({workstations,getTasks,onSaved}){
  const dialog=document.querySelector('#office-sandbox-settings');
  const trigger=document.querySelector('#picture-toggle'),close=document.querySelector('#office-pref-close');
  const tabs=[...dialog.querySelectorAll('[role=tab]')],taskPanel=document.querySelector('#office-tasks-panel');
  const controller=new AbortController(),options={signal:controller.signal};
  let opened=false,active='picture',frame=null,taskBusy=false,person='owner',returnTo=null;
  function send(type,data={}){
    frame?.contentWindow?.postMessage({namespace,type,...data},location.origin);
  }
  function syncTheme(){
    const {astraScheme:scheme,astraPalette:palette}=document.documentElement.dataset;
    send('theme',{scheme,palette});
  }
  const theme=new MutationObserver(syncTheme);
  theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-astra-scheme','data-astra-palette']});
  function syncTasks(){if(opened&&frame)send('context',{tasks:getTasks()});}
  function setTab(name){
    if(!tabNames.includes(name)||taskBusy||workstations.isSaving())return;
    if(active==='seats'&&name!=='seats')workstations.deactivate();
    active=name;
    for(const tab of tabs){
      const selected=tab.dataset.pref===active;
      tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden=!selected;
    }
    if(active==='seats')void workstations.activate();
    if(active==='tasks'&&!frame){
      frame=document.createElement('iframe');frame.title='沙盘人员任务编辑器';
      frame.src='/office-tasks.html?person='+encodeURIComponent(person);
      taskPanel.append(frame);
    }
  }
  function open(name=active,personId){
    if(!opened){
      returnTo=document.activeElement;
      opened=true;
      if(dialog.showPopover)dialog.showPopover();else dialog.show();
      trigger.setAttribute('aria-expanded','true');
    }
    if(personId){person=personId;send('person',{person});}
    setTab(name);
    tabs.find(tab=>tab.dataset.pref===active)?.focus({preventScroll:true});
  }
  function dismiss(){
    if(!opened||taskBusy||workstations.isSaving())return;
    opened=false;workstations.deactivate(true);
    frame?.remove();frame=null;taskBusy=false;
    if(dialog.hidePopover)dialog.hidePopover();else dialog.close();
    trigger.setAttribute('aria-expanded','false');
    const focus=returnTo?.isConnected&&returnTo.getClientRects().length&&returnTo!==document.body?returnTo:trigger;
    focus.focus({preventScroll:true});
  }
  trigger.addEventListener('click',()=>opened?dismiss():open(),options);
  close.addEventListener('click',dismiss,options);
  for(const tab of tabs)tab.addEventListener('click',()=>setTab(tab.dataset.pref),options);
  dialog.querySelector('[role=tablist]').addEventListener('keydown',e=>{
    const i=tabs.indexOf(e.target);if(i<0)return;
    const next={ArrowRight:(i+1)%tabs.length,ArrowLeft:(i+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[e.key];
    if(next===undefined||taskBusy||workstations.isSaving())return;
    e.preventDefault();tabs[next].focus();
  },options);
  document.addEventListener('keydown',e=>{
    if(opened&&e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();e.stopPropagation();dismiss();}
  },{...options,capture:true});
  window.addEventListener('message',e=>{
    if(!frame||e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.namespace!==namespace)return;
    if(e.data.type==='ready'){syncTheme();syncTasks();send('person',{person});}
    if(e.data.type==='busy'){taskBusy=!!e.data.busy;close.disabled=taskBusy;tabs.forEach(t=>t.disabled=taskBusy);}
    if(e.data.type==='saved')onSaved(e.data.value);
    if(e.data.type==='close')dismiss();
  },options);
  const query=new URLSearchParams(location.search),initial=query.get('settings');
  if(tabNames.includes(initial))open(initial,query.get('person'));
  return {open,dismiss,syncTasks,dispose(){controller.abort();theme.disconnect();frame?.remove();frame=null;}};
}
