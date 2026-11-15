/** One right rail in standalone and embed mode; no host chat duplication. */
export function mountSandboxLayout(root=document) {
  const $=s=>root.querySelector(s), workspace=$('.office-workspace'), rail=$('#space-cards-panel');
  const toggle=$('#space-card-toggle'), controller=new AbortController(), options={signal:controller.signal};
  let selected='tasks';
  function open(value){workspace.dataset.cardsOpen=String(value);workspace.dataset.informationOpen='false';rail.hidden=!value;toggle.setAttribute('aria-expanded',String(value));toggle.textContent=value?'收起工作栏':'工作栏';}
  function tab(name){if(!['tasks','people','messages','space'].includes(name))return;selected=name;for(const b of root.querySelectorAll('[data-rail-tab]')){const active=b.dataset.railTab===name;b.setAttribute('aria-pressed',String(active));b.classList.toggle('btn-primary',active);b.classList.toggle('btn-ghost',!active);$('#rail-'+b.dataset.railTab).hidden=!active;}if(name==='space')$('#tab-floors').click();open(true);}
  for(const b of root.querySelectorAll('[data-rail-tab]'))b.addEventListener('click',()=>{tab(b.dataset.railTab);if(selected==='people')$('#tab-people').click();},options);
  toggle.addEventListener('click',()=>open(rail.hidden),options);
  $('#space-card-close').addEventListener('click',()=>{open(false);toggle.focus();},options);
  rail.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();open(false);toggle.focus();}},options);
  window.addEventListener('office-panel',e=>tab(e.detail?.tab),options);
  $('#picture-toggle').addEventListener('click',()=>tab('space'),options);
  const form=$('#local-note-form'),input=$('#local-note-input'),list=$('#local-notes'),clear=$('#clear-local-notes');
  form.addEventListener('submit',e=>{e.preventDefault();if(!input.value.trim())return;list.querySelector('.office-empty-note')?.remove();const p=root.createElement('p');p.textContent=input.value.trim();list.append(p);input.value='';clear.disabled=false;$('#local-note-status').textContent='已保存本页备注';},options);
  clear.addEventListener('click',()=>{list.replaceChildren();clear.disabled=true;},options);
  tab('tasks');
  return {dispose(){controller.abort();}};
}
