/** One right rail in standalone and embed mode; no host chat duplication. */
export function mountSandboxLayout(root=document) {
  const $=s=>root.querySelector(s), workspace=$('.office-workspace'), rail=$('#space-cards-panel');
  const toggle=$('#space-card-toggle'), controller=new AbortController(), options={signal:controller.signal};
  const header=$('.office-rail-header'),body=$('.office-inspector-body'),detail=$('#person-detail-pane');
  let previous=null;
  const tablist=header.querySelector('[role=tablist]'), railTabs=[...tablist.querySelectorAll('[data-rail-tab]')];
  const nativeTabFocus='focusGroup' in HTMLElement.prototype;
  let selected='people';
  function open(value){workspace.dataset.cardsOpen=String(value);workspace.dataset.informationOpen='false';rail.hidden=!value;toggle.setAttribute('aria-expanded',String(value));toggle.title=value?'收起工作栏':'展开工作栏';toggle.setAttribute('aria-label',toggle.title);}
  function tab(name){
    if(!railTabs.some(b=>b.dataset.railTab===name&&!b.hidden))return;
    selected=name;
    for(const b of railTabs){
      const active=b.dataset.railTab===name;
      b.setAttribute('aria-selected',String(active));b.toggleAttribute('focusgroupstart',active);
      if(!nativeTabFocus)b.tabIndex=active?0:-1;
      b.classList.toggle('btn-primary',active);b.classList.toggle('btn-ghost',!active);
      $('#rail-'+b.dataset.railTab).hidden=!active;
    }
    if(name==='space')$('#tab-floors').click();
    open(true);
  }
  for(const b of railTabs)b.addEventListener('click',()=>{tab(b.dataset.railTab);if(selected==='people')$('#tab-people').click();},options);
  if(!nativeTabFocus){
    tablist.addEventListener('keydown',event=>{
      const visible=railTabs.filter(b=>!b.hidden),i=visible.indexOf(event.target);
      if(i<0)return;
      const end=visible.length-1;
      const next={ArrowRight:(i+1)%visible.length,ArrowLeft:(i+end)%visible.length,Home:0,End:end}[event.key];
      if(next===undefined)return;
      event.preventDefault();
      for(const b of visible)b.tabIndex=b===visible[next]?0:-1;
      visible[next].focus();
    },options);
    tablist.addEventListener('focusout',event=>{
      if(!tablist.contains(event.relatedTarget))for(const b of railTabs)b.tabIndex=b.dataset.railTab===selected?0:-1;
    },options);
  }
  function dismissPerson(restoreFocus=false){window.dispatchEvent(new CustomEvent('office-person-dismiss',{detail:{restoreFocus}}));}
  window.addEventListener('office-person-menu',e=>{
    if(e.detail.open){
      if(!previous){
        const from=e.detail.from;
        previous={hidden:rail.hidden,scroll:body.scrollTop,from,id:from?.closest('[data-person-id]')?.dataset.personId,taskKey:from?.closest('[data-task-key]')?.dataset.taskKey};
      }
      header.hidden=true;body.hidden=true;detail.hidden=false;open(true);
      return;
    }
    if(!previous)return;
    const saved=previous;previous=null;
    detail.hidden=true;header.hidden=false;body.hidden=false;open(!saved.hidden);body.scrollTop=saved.scroll;
    if(e.detail.restoreFocus){
      const card=saved.taskKey?body.querySelector('[data-task-key="'+CSS.escape(saved.taskKey)+'"]'):null;
      const list=card||$('#rail-'+selected);
      const row=saved.id?list?.querySelector('[data-person-id="'+CSS.escape(saved.id)+'"]'):null;
      const target=[saved.from,row,card?.querySelector('summary'),header.querySelector('[aria-selected="true"]'),toggle]
        .find(el=>el?.isConnected&&el!==document.body&&el.getClientRects().length);
      target?.focus({preventScroll:true});
    }
  },options);
  toggle.addEventListener('click',()=>{const next=rail.hidden;if(!detail.hidden)dismissPerson();open(next);},options);
  $('#space-card-close').addEventListener('click',()=>{open(false);toggle.focus();},options);
  rail.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();if(!detail.hidden)dismissPerson(true);else if(root.documentElement.hasAttribute('data-hub-left'))tablist.querySelector('[aria-selected=true]')?.focus();else{open(false);toggle.focus();}}},options);
  window.addEventListener('office-panel',e=>{if(!detail.hidden)dismissPerson();tab(e.detail?.tab);},options);
  const tools=$('#office-tools'),more=$('#office-tools-toggle');
  const bar=$('.office-modebar');
  if(!('focusGroup' in HTMLElement.prototype)){
    const buttons=()=>[...bar.querySelectorAll('button:not(:disabled)')];
    let last=null;
    function syncTabs(){
      const available=buttons();
      if(!available.includes(last))last=available[0];
      for(const b of bar.querySelectorAll('button'))b.tabIndex=b===last?0:-1;
    }
    bar.addEventListener('focusin',e=>{if(e.target.matches('button')){last=e.target;syncTabs();}},options);
    bar.addEventListener('keydown',e=>{
      const available=buttons(),i=available.indexOf(e.target);
      if(i<0||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      const step=(e.key==='ArrowRight'?1:-1)*(getComputedStyle(bar).direction==='rtl'?-1:1);
      const next=e.key==='Home'?0:e.key==='End'?available.length-1:(i+step+available.length)%available.length;
      e.preventDefault();available[next].focus();
    },options);
    const observer=new MutationObserver(syncTabs);
    observer.observe(bar,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
    controller.signal.addEventListener('abort',()=>observer.disconnect(),{once:true});syncTabs();
  }
  const native=typeof tools.togglePopover==='function';
  const opened=()=>native?tools.matches(':popover-open'):!tools.hidden;
  const items=()=>[...tools.querySelectorAll('[role=menuitem]')].filter(n=>!n.disabled&&n.getClientRects().length);
  function position(){
    const r=more.getBoundingClientRect(),w=tools.offsetWidth,h=tools.offsetHeight;
    tools.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';
    tools.style.top=Math.max(8,Math.min(r.bottom+7,innerHeight-h-8))+'px';
  }
  let lastOnOpen=false;
  function openedMenu(){
    more.setAttribute('aria-expanded',String(opened()));if(!opened())return;
    position();const actions=items();actions.forEach(action=>action.tabIndex=-1);
    (lastOnOpen?actions.at(-1):actions[0])?.focus();lastOnOpen=false;
  }
  function show(value,restore=false){
    if(native)tools.togglePopover(value);else{tools.hidden=!value;openedMenu();}
    if(restore)more.focus();
  }
  if(native)tools.addEventListener('toggle',openedMenu,options);
  else {tools.hidden=true;more.addEventListener('click',()=>show(!opened()),options);}
  more.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();lastOnOpen=e.key==='ArrowUp';show(true);}},options);
  tools.addEventListener('keydown',e=>{
    const actions=items(),index=actions.indexOf(document.activeElement);
    if(!actions.length)return;
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();show(false,true);return;}
    if(e.key==='Tab'){show(false,true);return;}
    const next={ArrowDown:(index+1)%actions.length,ArrowUp:(index-1+actions.length)%actions.length,Home:0,End:actions.length-1}[e.key];
    if(next!==undefined){e.preventDefault();actions[next].focus();}
  },options);
  tools.addEventListener('click',e=>{if(e.target.closest('[role=menuitem]'))show(false,true);},{...options,capture:true});
  root.addEventListener('pointerdown',e=>{if(!native&&opened()&&!tools.contains(e.target)&&!more.contains(e.target))show(false);},options);
  window.addEventListener('resize',()=>{if(opened())position();},options);
  window.addEventListener('office-host-layout',()=>{if(opened())position();},options);
  const form=$('#local-note-form'),input=$('#local-note-input'),list=$('#local-notes'),clear=$('#clear-local-notes');
  form.addEventListener('submit',e=>{e.preventDefault();if(!input.value.trim())return;list.querySelector('.office-empty-note')?.remove();const p=root.createElement('p');p.textContent=input.value.trim();list.append(p);input.value='';clear.disabled=false;$('#local-note-status').textContent='已保存本页备注';},options);
  clear.addEventListener('click',()=>{list.replaceChildren();clear.disabled=true;},options);
  tab('people');
  if(new URLSearchParams(location.search).get('desk')==='hub'){
    open(false);
    let leftOpen=false;
    function syncQuick(){
      if(!leftOpen)return;
      const expanded=!!root.querySelector('.hub-quick')?.open;
      toggle.setAttribute('aria-expanded',String(expanded));toggle.title=expanded?'收起快速查看':'快速查看';toggle.setAttribute('aria-label',toggle.title);
    }
    root.addEventListener('toggle',e=>{if(e.target.id==='office-hub-quick')syncQuick();},{...options,capture:true});
    window.addEventListener('office-host-layout',e=>{
      const r=e.detail.hubRect,valid=r&&['left','top','right','bottom'].every(k=>Number.isFinite(r[k]))&&r.right>r.left&&r.bottom>r.top;
      if(valid){
        for(const [name,value] of Object.entries({left:r.left,top:r.top,width:r.right-r.left,height:r.bottom-r.top}))workspace.style.setProperty('--hub-'+name,value+'px');
      }
      document.documentElement.toggleAttribute('data-hub-left',!!valid);
      if(leftOpen===!!valid)return;
      leftOpen=!!valid;
      if(!detail.hidden)dismissPerson();
      open(leftOpen);
      toggle.setAttribute('aria-controls',leftOpen?'office-hub-quick':'space-cards-panel');
      syncQuick();
    },options);
    // The roster stays available in the left hub. The toolbar toggles the compact right lookup.
    toggle.addEventListener('click',e=>{
      if(!leftOpen)return;
      e.stopImmediatePropagation();
      const quick=root.querySelector('.hub-quick');if(quick)quick.open=!quick.open;
    },{...options,capture:true});
  }
  return {dispose(){controller.abort();}};
}
