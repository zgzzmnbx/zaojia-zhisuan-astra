import {emptyMember,planEndpoint,planNotice} from './task-plan.js';

export function mountAssignment({getState,onSaved,visibility}){
  const dialog=document.createElement('dialog');
  dialog.className='hub-assignment';dialog.setAttribute('aria-labelledby','hub-assign-title');
  dialog.innerHTML='<form><header><h2 id="hub-assign-title">分配任务</h2><button type="button" class="btn btn-ghost btn-sm" aria-label="关闭">×</button></header><p class="hub-assignee"></p><label>任务名称<input name="title" maxlength="200" required autofocus></label><label>所属项目<input name="project" maxlength="200"></label><fieldset><legend>平台通知</legend><div class="hub-notify-options"></div></fieldset><p role="status"></p><footer><button type="button" class="btn btn-sm hub-cancel">取消</button><button type="submit" class="btn btn-primary btn-sm">创建任务</button></footer></form>';
  document.body.append(dialog);
  const form=dialog.querySelector('form'),close=dialog.querySelector('[aria-label="关闭"]');
  const title=form.elements.title,project=form.elements.project,targets=form.querySelector('.hub-notify-options');
  const save=form.querySelector('[type=submit]'),status=form.querySelector('[role=status]');
  let draft=null,saving=false;
  const cancel=form.querySelector('.hub-cancel');
  for(const b of [close,cancel])b.onclick=()=>{if(!saving)dialog.close();};
  dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
  dialog.addEventListener('close',()=>{draft=null;visibility(false);});
  async function request(url,method='GET',value){
    const res=await fetch(url,{method,cache:'no-store',...(value?{headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}:{})});
    const data=await res.json();
    if(!res.ok)throw Error(typeof data.detail==='string'?data.detail:'操作未完成，请重试');
    return data;
  }
  function showOptions(options){
    targets.replaceChildren();
    for(const p of options){
      const label=document.createElement('label'),box=document.createElement('input');
      box.type='checkbox';box.name='notify';box.value=p.profile;box.disabled=!p.targets.length;
      label.append(box,p.label);targets.append(label);
      if(!p.targets.length){label.append(' · 暂不可用');continue;}
      const select=document.createElement('select');select.setAttribute('aria-label',p.label+'通知对象');
      for(const t of p.targets)select.add(new Option(t.label,t.id));
      select.disabled=true;label.after(select);
      box.onchange=()=>{select.disabled=!box.checked;save.textContent=targets.querySelector('input:checked')?'创建并通知':'创建任务';};
    }
  }
  async function open(id){
    if(saving)return;
    const state=getState(),p=state.employees.find(person=>person.id===id);if(!p)return;
    const next={id,name:p.name,context:state.context,task:'manual:'+crypto.randomUUID()};draft=next;
    form.reset();title.setCustomValidity('');project.value=state.projectName||'';save.textContent='创建任务';
    status.textContent='';targets.textContent='正在读取通知对象…';form.querySelector('.hub-assignee').textContent='分配给 '+p.name;
    dialog.showModal();visibility(true);title.focus();
    try{
      const data=await request(planEndpoint+'/notification-options?personId='+encodeURIComponent(id));
      if(next===draft)showOptions(data.platforms);
    }catch{if(next===draft)targets.textContent='平台暂不可用，可继续创建任务';}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();const d=draft;
    if(saving||!d)return;
    if(d.saved){dialog.close();return;}
    if(!title.value.trim()){title.setCustomValidity('请填写任务名称');title.reportValidity();return;}
    if(getState().context!==d.context||!getState().employees.some(p=>p.id===d.id)){status.textContent='当前人员或工作区已变化，请重新分配';return;}
    const chosen=[...targets.querySelectorAll('input:checked')].map(b=>({profile:b.value,destination:b.parentElement.nextElementSibling.value,label:b.parentElement.textContent}));
    saving=true;save.disabled=close.disabled=cancel.disabled=true;form.querySelector('fieldset').disabled=title.disabled=project.disabled=true;
    try{
      const current=await request(planEndpoint),member=current.members[d.id]||emptyMember();
      const previous=member.tasks.find(t=>t.id===d.task);
      const task={id:d.task,title:title.value.trim(),status:'待处理',description:project.value.trim()?'所属项目：'+project.value.trim():''};
      const updated=previous?current:await request(planEndpoint,'PUT',{schemaVersion:1,members:{[d.id]:{...member,tasks:[task,...member.tasks]}}});
      d.saved=true;onSaved(updated);
      try{localStorage.setItem(planNotice,String(updated.revision));}catch{}
      const results=[];
      for(const entry of chosen){
        try{await request(planEndpoint+'/notify','POST',{personId:d.id,taskId:d.task,revision:updated.members[d.id].revision,profile:entry.profile,destination:entry.destination});results.push(entry.label+'已发送');}
        catch(error){results.push(entry.label+' · '+error.message);}
      }
      if(chosen.length){status.textContent='任务已创建。'+results.join('；');save.textContent='完成';}
      else dialog.close();
    }catch(error){status.textContent=error.message;}
    finally{
      saving=false;save.disabled=close.disabled=cancel.disabled=false;
      form.querySelector('fieldset').disabled=title.disabled=project.disabled=!!draft?.saved;
    }
  });
  title.oninput=()=>title.setCustomValidity('');
  return {open(id){form.querySelector('fieldset').disabled=title.disabled=project.disabled=false;return open(id);},dispose(){dialog.remove();}};
}
