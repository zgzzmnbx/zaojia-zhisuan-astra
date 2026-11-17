import {profile,genderLabel} from './workstation-roster.js';
const endpoint='/api/astra/office-workstations';
const el=(tag,text='',className='')=>Object.assign(document.createElement(tag),{textContent:text,className});
async function request(payload){
  const response=await fetch(endpoint,payload?{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'工位设置读取失败，请重试');
  return data;
}
export function createWorkstationSettings({toolbar,getPeople,onChange}){
  let config=null,draft=[],current='',saving=false,loading=false;
  const open=el('button','工位设置','btn btn-ghost btn-sm');open.type='button';toolbar.append(open);
  const dialog=el('dialog','','office-workstations');dialog.setAttribute('aria-labelledby','workstations-title');
  const form=el('form'),header=el('header'),title=el('h2','工位设置');title.id='workstations-title';
  const close=el('button','×','btn btn-ghost btn-square');close.type='button';close.setAttribute('aria-label','关闭工位设置');header.append(title,close);
  const body=el('div','','workstations-body'),sidebar=el('aside'),list=el('div','','workstations-list');list.setAttribute('aria-label','人员列表');
  const add=el('button','＋ 添加人员','btn btn-ghost');add.type='button';sidebar.append(list,add);
  const fields=el('div','','workstations-fields'),controls={};
  for(const [key,label,limit] of [['name','姓名',40],['gender','性别'],['trade','工种',80],['expertise','擅长审核',240],['seatId','工位']]){
    const row=el('div','','workstations-field'),labelNode=el('label',label),input=el(['gender','seatId'].includes(key)?'select':'input');
    input.id=`workstation-${key}`;input.name=key;input.className=input.tagName==='SELECT'?'select select-bordered':'input input-bordered';labelNode.htmlFor=input.id;
    if(limit)input.maxLength=limit;
    if(key==='name'||key==='seatId')input.required=true;
    if(key==='name')input.autofocus=true;
    if(key==='gender')for(const value of ['unspecified','male','female']){const option=el('option',genderLabel(value));option.value=value;input.append(option);}
    input.addEventListener('input',()=>{
      const person=draft.find(p=>p.id===current);if(!person)return;
      person[key]=input.value;status.textContent='有未保存的修改';input.setCustomValidity('');
      if(key==='name'||key==='seatId')renderList();
    });
    row.append(labelNode,input);fields.append(row);controls[key]=input;
  }
  body.append(sidebar,fields);
  const footer=el('footer'),status=el('span','','workstations-status');status.setAttribute('role','status');
  const cancel=el('button','取消','btn btn-ghost');cancel.type='button';
  const save=el('button','保存设置','btn btn-primary');save.type='submit';save.title='保存到项目 config/office-workstations.json';
  footer.append(status,cancel,save);form.append(header,body,footer);form.setAttribute('aria-labelledby',title.id);dialog.append(form);document.body.append(dialog);
  function renderList(){
    list.replaceChildren();
    for(const person of draft){
      const button=el('button','','workstations-person');button.type='button';button.setAttribute('aria-pressed',String(person.id===current));
      button.append(el('strong',person.name||'新人员'),el('small',person.seatId.replace('SEAT_','')||'未分配'));
      button.onclick=()=>select(person.id);list.append(button);
    }
    add.disabled=loading||saving||!config||draft.length>=config.seats.length;
  }
  function select(id){
    current=id;const person=draft.find(p=>p.id===id);fields.hidden=!person;renderList();if(!person)return;
    for(const [key,input] of Object.entries(controls)){input.value=person[key];input.setCustomValidity('');}
  }
  function busy(value){saving=value;for(const input of Object.values(controls))input.disabled=value;save.disabled=value||loading;add.disabled=value||loading||!config||draft.length>=config.seats.length;list.inert=value;}
  async function load(){
    config=await request();onChange(config);return config;
  }
  open.onclick=async()=>{
    if(dialog.open)return;
    loading=true;status.textContent='正在读取工位…';fields.hidden=true;draft=[];renderList();save.disabled=true;dialog.showModal();
    try{
      await load();draft=getPeople().map(profile);
      controls.seatId.replaceChildren();
      controls.seatId.append(Object.assign(el('option','选择工位'),{value:''}));
      for(const seat of config.seats)controls.seatId.append(Object.assign(el('option',seat.label),{value:seat.id}));
      select(draft[0]?.id||'');status.textContent=`${draft.length} 人 · ${config.seats.length} 个工位`;controls.name.focus();
    }catch(error){status.textContent=error.message;}
    finally{loading=false;save.disabled=!config||fields.hidden;renderList();}
  };
  add.onclick=()=>{
    const used=new Set(draft.map(p=>p.seatId)),seat=config.seats.find(s=>!used.has(s.id));if(!seat)return;
    const person={id:`local:${crypto.randomUUID()}`,name:'',gender:'unspecified',trade:'',expertise:'',seatId:seat.id};
    draft.push(person);select(person.id);status.textContent='有未保存的修改';save.disabled=false;controls.name.focus();
  };
  function dismiss(){if(saving)return;dialog.close();}
  close.onclick=dismiss;cancel.onclick=dismiss;
  dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(loading||saving||!config)return;
    const used=new Set();
    for(const person of draft){
      let key='',message='';
      if(!person.name.trim()){key='name';message='请输入姓名';}
      else if(!person.seatId){key='seatId';message='请选择工位';}
      else if(used.has(person.seatId)){key='seatId';message='该工位已分配给其他人员，请选择另一个工位';}
      if(key){select(person.id);controls[key].setCustomValidity(message);controls[key].reportValidity();status.textContent=message;return;}
      used.add(person.seatId);
    }
    busy(true);status.textContent='正在保存…';
    try{
      config=await request({schemaVersion:1,revision:config.revision,people:draft.map(profile)});
      onChange(config);draft=getPeople().map(profile);select(current);status.textContent='已保存到项目文件';
    }catch(error){status.textContent=error.message;}
    finally{busy(false);save.focus();}
  });
  // Loading failure is retried and surfaced when the settings page is opened.
  load().catch(()=>{});
  return {dispose(){dialog.remove();open.remove();}};
}
