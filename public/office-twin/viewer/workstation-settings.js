import {profile,genderLabel} from './workstation-roster.js';
import {icon} from '../astra_ui/icons.js';
import {colorFields,personColorDefaults,normalizePersonColors} from './people/person-colors.js';
import {appearances} from './people/appearances.js';
import {createAppearancePreview} from './people/appearance-preview.js';
let editState={open:false,seatId:'',people:[]};
export const getWorkstationEditState=()=>editState;
const endpoint='/api/astra/office-workstations';
const el=(tag,text='',className='')=>Object.assign(document.createElement(tag),{textContent:text,className});
async function request(payload){
  const response=await fetch(endpoint,payload?{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'工位设置读取失败，请重试');
  return data;
}
export function createWorkstationSettings({toolbar,getPeople,onChange}){
  let config=null,draft=[],current='',saving=false,loading=false,opened=false,epoch=0;
  const open=el('button','工位设置','btn btn-ghost btn-sm');open.type='button';open.setAttribute('role','menuitem');open.tabIndex=-1;open.insertAdjacentHTML('afterbegin',icon('squares-four'));toolbar.append(open);
  const dialog=el('dialog','','office-workstations');dialog.id='office-workstations';dialog.setAttribute('popover','manual');dialog.setAttribute('aria-labelledby','workstations-title');
  const form=el('form'),header=el('header'),title=el('h2','工位设置');title.id='workstations-title';
  const close=el('button','×','btn btn-ghost btn-square');close.type='button';close.setAttribute('aria-label','关闭工位设置');const all=el('button','全部工位','btn btn-ghost btn-sm');all.type='button';all.onclick=()=>publish('all');header.append(title,all,close);
  const body=el('div','','workstations-body'),sidebar=el('aside'),list=el('div','','workstations-list');list.setAttribute('aria-label','人员列表');
  const add=el('button','＋ 添加人员','btn btn-ghost');add.type='button';sidebar.append(list,add);
  const fields=el('div','','workstations-fields'),controls={};
  const previewNode=el('div','','workstations-appearance-preview'),preview=createAppearancePreview(previewNode);previewNode.hidden=true;
  for(const [key,label,limit] of [['name','姓名',40],['gender','性别'],['appearance','人物扮相'],['trade','工种',80],['expertise','擅长审核',240],['seatId','工位']]){
    const row=el('div','','workstations-field'),labelNode=el('label',label),input=el(['gender','seatId','appearance'].includes(key)?'select':'input');
    input.id=`workstation-${key}`;input.name=key;input.className=input.tagName==='SELECT'?'select select-bordered':'input input-bordered';labelNode.htmlFor=input.id;
    if(limit)input.maxLength=limit;
    if(key==='name'||key==='seatId')input.required=true;
    if(key==='name')input.autofocus=true;
    if(key==='gender')for(const value of ['unspecified','male','female']){const option=el('option',genderLabel(value));option.value=value;input.append(option);}
    if(key==='appearance'){
      const hidden=document.createElement('optgroup');hidden.label='隐藏款';
      for(const {id,label,wing} of appearances){
        const option=el('option',label);option.value=id;(wing?hidden:input).append(option);
      }
      input.append(hidden);
    }
    input.addEventListener('input',()=>{
      const person=draft.find(p=>p.id===current);if(!person)return;
      person[key]=input.value;status.textContent='有未保存的修改';input.setCustomValidity('');
      if(key==='appearance'||key==='gender')renderColors(person);
      if(key==='name'||key==='seatId')renderList();publish(key==='seatId'?'focus':null);
    });
    row.append(labelNode,input);fields.append(row);controls[key]=input;
    if(key==='appearance'){input.title='单独设置后使用此卡通扮相；跟随画面风格则沿用全局人物风格';fields.append(previewNode);}
  }
  const colorsPanel=el('div','','workstations-colors'),colorInputs={};
  for(const [key,label] of colorFields){
    const row=el('label','','workstations-color'),input=el('input');input.type='color';input.name=key;input.setAttribute('aria-label',label);
    input.addEventListener('input',()=>{
      const person=draft.find(p=>p.id===current);if(!person||saving)return;
      person.colors={...normalizePersonColors(person.colors),[key]:input.value.toUpperCase()};
      status.textContent='有未保存的修改';showPreview(person);
    });
    row.append(el('span',label),input);colorsPanel.append(row);colorInputs[key]=input;
  }
  const resetColors=el('button','恢复扮相配色','btn btn-ghost btn-sm');resetColors.type='button';
  resetColors.onclick=()=>{const person=draft.find(p=>p.id===current);if(!person||saving)return;person.colors={};renderColors(person);status.textContent='有未保存的修改';};
  colorsPanel.append(resetColors);previewNode.after(colorsPanel);
  function previewStyle(){try{return localStorage.getItem('astra.office.people-style.v1')||'classic';}catch{return 'classic';}}
  function showPreview(person){preview.show(person,{index:draft.indexOf(person),style:previewStyle()});}
  function renderColors(person){
    const colors={...personColorDefaults(person,draft.indexOf(person),previewStyle()),...normalizePersonColors(person.colors)};
    for(const [key,input] of Object.entries(colorInputs))input.value=colors[key];showPreview(person);
  }
  body.append(sidebar,fields);
  const footer=el('footer'),status=el('span','','workstations-status');status.setAttribute('role','status');
  const cancel=el('button','取消','btn btn-ghost');cancel.type='button';
  const save=el('button','保存设置','btn btn-primary');save.type='submit';save.title='保存到项目 config/office-workstations.json';
  footer.append(status,cancel,save);form.append(header,body,footer);form.setAttribute('aria-labelledby',title.id);dialog.append(form);document.body.append(dialog);
  function publish(action=null){
    editState={open:opened,seatId:draft.find(p=>p.id===current)?.seatId||'',people:draft.map(p=>({id:p.id,name:p.name,seatId:p.seatId})),action};
    document.body.dataset.workstationsOpen=String(opened);
    window.dispatchEvent(new CustomEvent('office-workstations-change',{detail:editState}));
  }
  function pickSeat(event){
    if(!opened||loading||saving)return;
    const seatId=event.detail?.seatId,person=draft.find(p=>p.id===current);
    if(!person||!config?.seats.some(s=>s.id===seatId))return;
    const occupied=draft.find(p=>p.id!==current&&p.seatId===seatId);
    if(occupied){status.textContent=`${seatId.replace('SEAT_','')} 已分配给 ${occupied.name||'其他人员'}`;return;}
    person.seatId=seatId;controls.seatId.value=seatId;controls.seatId.setCustomValidity('');renderList();status.textContent='有未保存的修改';publish();
  }
  window.addEventListener('office-workstation-pick',pickSeat);
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
    for(const [key,input] of Object.entries(controls)){input.value=person[key];input.setCustomValidity('');}renderColors(person);publish('focus');
  }
  function busy(value){saving=value;resetColors.disabled=value;for(const input of Object.values(colorInputs))input.disabled=value;for(const input of Object.values(controls))input.disabled=value;save.disabled=value||loading;add.disabled=value||loading||!config||draft.length>=config.seats.length;list.inert=value;}
  async function load(){
    config=await request();onChange(config);return config;
  }
  open.onclick=async()=>{
    if(opened)return;const attempt=++epoch;opened=true;config=null;
    loading=true;status.textContent='正在读取工位…';fields.hidden=true;draft=[];renderList();save.disabled=true;if(dialog.showPopover)dialog.showPopover();else dialog.show();publish();
    try{
      await load();if(attempt!==epoch||!opened)return;draft=getPeople().map(profile);
      controls.seatId.replaceChildren();
      controls.seatId.append(Object.assign(el('option','选择工位'),{value:''}));
      for(const seat of config.seats)controls.seatId.append(Object.assign(el('option',seat.label),{value:seat.id}));
      select(draft[0]?.id||'');status.textContent=`${draft.length} 人 · ${config.seats.length} 个工位`;controls.name.focus();
    }catch(error){status.textContent=error.message;}
    finally{if(attempt===epoch){loading=false;save.disabled=!config||fields.hidden;renderList();publish();}}
  };
  add.onclick=()=>{
    const used=new Set(draft.map(p=>p.seatId)),seat=config.seats.find(s=>!used.has(s.id));if(!seat)return;
    const person={id:`local:${crypto.randomUUID()}`,name:'',gender:'unspecified',appearance:'inherit',trade:'',expertise:'',seatId:seat.id};
    draft.push(person);select(person.id);status.textContent='有未保存的修改';save.disabled=false;controls.name.focus();
  };
  function dismiss(){if(saving)return;opened=false;epoch++;loading=false;preview.dispose();if(dialog.hidePopover)dialog.hidePopover();else dialog.close();publish();}
  close.onclick=dismiss;cancel.onclick=dismiss;
  const escape=event=>{if(opened&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();dismiss();}};
  window.addEventListener('keydown',escape,true);
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
  return {dispose(){opened=false;epoch++;preview.destroy();publish();window.removeEventListener('office-workstation-pick',pickSeat);window.removeEventListener('keydown',escape,true);dialog.remove();open.remove();}};
}
