import {profile} from './workstation-roster.js';
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
export function createWorkstationSettings({panel,getPeople,onChange,onClose}){
  let config=null,draft=[],current='',saving=false,loading=false,opened=false,epoch=0,draftRevision=0;
  const form=el('form'),header=el('header');
  const all=el('button','查看全部工位','btn btn-ghost btn-sm');all.type='button';all.onclick=()=>publish('all');header.append(all);
  const body=el('div','','workstations-body'),sidebar=el('aside'),list=el('div','','workstations-list');list.setAttribute('aria-label','人员列表');
  sidebar.append(list);
  const fields=el('div','','workstations-fields'),controls={};
  const previewNode=el('div','','workstations-appearance-preview'),preview=createAppearancePreview(previewNode);previewNode.hidden=true;
  for(const [key,label] of [['seatId','工位'],['appearance','人物扮相']]){
    const row=el('div','','workstations-field'),labelNode=el('label',label),input=el('select');
    input.id='workstation-'+key;input.name=key;input.className='select select-bordered';labelNode.htmlFor=input.id;
    if(key==='seatId')input.required=true;
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
      if(key==='appearance')renderColors(person);
      if(key==='seatId')renderList();publish(key==='seatId'?'focus':null);
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
  footer.append(status,cancel,save);form.append(header,body,footer);form.setAttribute('aria-label','人员与工位');panel.append(form);
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
  }
  function select(id){
    current=id;const person=draft.find(p=>p.id===id);fields.hidden=!person;renderList();if(!person)return;
    for(const [key,input] of Object.entries(controls)){input.value=person[key];input.setCustomValidity('');}renderColors(person);publish('focus');
  }
  function busy(value){saving=value;resetColors.disabled=value;for(const input of Object.values(colorInputs))input.disabled=value;for(const input of Object.values(controls))input.disabled=value;save.disabled=value||loading;list.inert=value;}
  async function load(){
    config=await request();onChange(config);return config;
  }
  async function activate(){
    opened=true;
    if(draft.length){select(current);return;}
    if(loading)return;
    const attempt=++epoch;
    loading=true;status.textContent='正在读取工位…';fields.hidden=true;renderList();save.disabled=true;publish();
    try{
      await load();if(attempt!==epoch)return;draft=getPeople().map(profile);draftRevision=config.revision;
      controls.seatId.replaceChildren();
      controls.seatId.append(Object.assign(el('option','选择工位'),{value:''}));
      for(const seat of config.seats)controls.seatId.append(Object.assign(el('option',seat.label),{value:seat.id}));
      current=draft[0]?.id||'';if(opened)select(current);status.textContent=`${draft.length} 人 · ${config.seats.length} 个工位`;
    }catch(error){status.textContent=error.message;}
    finally{if(attempt===epoch){loading=false;save.disabled=!config||fields.hidden;renderList();publish();}}
  }
  function deactivate(reset=false){
    const wasOpen=opened;opened=false;
    if(reset){epoch++;loading=false;draft=[];current='';}
    if(wasOpen){preview.dispose();publish();}
  }
  cancel.onclick=onClose;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(loading||saving||!config)return;
    const used=new Set();
    for(const person of draft){
      let key='',message='';
      if(!person.seatId){key='seatId';message='请选择工位';}
      else if(used.has(person.seatId)){key='seatId';message='该工位已分配给其他人员，请选择另一个工位';}
      if(key){select(person.id);controls[key].setCustomValidity(message);controls[key].reportValidity();status.textContent=message;return;}
      used.add(person.seatId);
    }
    busy(true);status.textContent='正在保存…';
    try{
      config=await request({schemaVersion:1,revision:draftRevision,people:draft.map(profile)});draftRevision=config.revision;
      onChange(config);draft=getPeople().map(profile);select(current);status.textContent='已保存到项目文件';
      try{localStorage.setItem('astra.office.roster-revision',String(config.revision));}catch{}
    }catch(error){status.textContent=error.message;}
    finally{busy(false);save.focus();}
  });
  // Loading failure is retried and surfaced when the settings page is opened.
  load().catch(()=>{});
  return {activate,deactivate,refresh:()=>!draft.length&&!loading&&!saving?load().catch(()=>{}):Promise.resolve(),isSaving:()=>saving,dispose(){deactivate(true);preview.destroy();window.removeEventListener('office-workstation-pick',pickSeat);form.remove();}};
}
