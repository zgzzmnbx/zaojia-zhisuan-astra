import {defaults,readSettings,saveSettings,resetSettings,validateSettings,announceSettings,availableSeats,allocationConflicts} from './office-settings-store.js';
const $=s=>document.querySelector(s),status=$('#settings-status');let layout,draft,dirty=false;
function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function field(title,input){const label=el('label',title);label.append(input);return label;}
function input(value,max){const e=el('input');e.value=value;e.maxLength=max;e.required=true;e.className='input input-bordered';return e;}
function setDirty(){dirty=true;message('有未保存的修改；点击“保存设置”后生效。');}
function seatsFor(room){return availableSeats(layout).filter(s=>s.room_id===room);}
function roomLabel(id){return draft.roomNames[id]||layout.rooms.find(r=>r.id===id)?.label||id;}
function refreshOccupancy(){for(const row of document.querySelectorAll('.person-editor')){const person=draft.people.find(p=>p.id===row.dataset.personId);for(const option of row.querySelectorAll('select[data-seat] option')){const occupant=draft.people.find(p=>p.id!==person.id&&p.seat===option.value);if(option.disabled)continue;option.textContent=option.value+(occupant?' · 已分配给 '+occupant.name:'');}row.querySelector('button').setAttribute('aria-label','移除'+person.name);}}
function render(){
 $('#office-name').value=draft.officeName;$('#people-editors').replaceChildren();$('#room-editors').replaceChildren();$('#room-count').textContent=String(layout.rooms.length);
 if(!draft.people.length)$('#people-editors').append(el('p','暂未添加同事。可新增并选择工位。','empty-people'));
 for(const person of draft.people){
  const row=el('div',undefined,'person-editor');row.dataset.personId=person.id;
  const name=input(person.name,40),role=input(person.role,40);name.setAttribute('aria-label',`${person.id} 姓名`);role.setAttribute('aria-label',`${person.id} 岗位`);
  name.addEventListener('input',()=>{person.name=name.value;refreshOccupancy();setDirty();});role.addEventListener('input',()=>{person.role=role.value;setDirty();});
  const room=el('select'),seat=el('select');room.setAttribute('aria-label',`${person.id} 房间`);seat.setAttribute('aria-label',`${person.id} 工位`);seat.dataset.seat='true';
  for(const r of layout.rooms.filter(r=>seatsFor(r.id).length)){const o=el('option',`${roomLabel(r.id)} (${r.id})`);o.value=r.id;room.append(o);}
  const prior=layout.workstations.find(w=>w.seat_id===person.seat);if(prior?.assignable===false){const o=el('option','原工位已停用 · 请选择房间重新分配');o.value='';o.disabled=true;room.prepend(o);room.value='';row.append(el('p',`${person.name}：${person.seat} 已停用，姓名保留，需重新分配。`,'allocation-warning'));}else room.value=prior?.room_id||room.options[0]?.value;
  function fillSeats(){seat.replaceChildren();if(prior?.assignable===false&&!room.value){const o=el('option',`${person.seat} · 已停用，不可分配`);o.value=person.seat;o.disabled=true;seat.append(o);}for(const w of seatsFor(room.value)){const occupied=draft.people.find(p=>p.id!==person.id&&p.seat===w.seat_id);const o=el('option',`${w.seat_id}${occupied?' · 已分配给 '+occupied.name:''}`);o.value=w.seat_id;seat.append(o);}seat.value=person.seat;}
  fillSeats();room.addEventListener('change',()=>{const candidates=seatsFor(room.value);person.seat=(candidates.find(w=>!draft.people.some(p=>p.id!==person.id&&p.seat===w.seat_id))||candidates[0]).seat_id;fillSeats();refreshOccupancy();setDirty();});seat.addEventListener('change',()=>{person.seat=seat.value;refreshOccupancy();setDirty();});
  const remove=el('button','移除','btn btn-ghost btn-sm');remove.type='button';remove.setAttribute('aria-label',`移除${person.name}`);remove.onclick=()=>{draft.people=draft.people.filter(p=>p.id!==person.id);render();setDirty();};
  row.append(field('姓名',name),field('岗位',role),field('房间',room),field('工位',seat),remove);$('#people-editors').append(row);
 }
 for(const room of layout.rooms.filter(r=>!r.merged_into)){const name=input(draft.roomNames[room.id]||room.label,60);name.dataset.roomId=room.id;name.setAttribute('aria-label',`${room.id} 名称`);name.addEventListener('input',()=>{draft.roomNames[room.id]=name.value;setDirty();});$('#room-editors').append(field(room.id,name));}
 $('#add-person').disabled=!availableSeats(layout).some(w=>!draft.people.some(p=>p.seat===w.seat_id));
}
$('#office-name').addEventListener('input',e=>{draft.officeName=e.target.value;setDirty();});
$('#add-person').onclick=()=>{const seat=availableSeats(layout).find(w=>!draft.people.some(p=>p.seat===w.seat_id));if(!seat)return;draft.people.push({id:`local-${crypto.randomUUID()}`,name:'新同事',role:'同事',seat:seat.seat_id});render();setDirty();};
$('#settings-form').addEventListener('submit',e=>{e.preventDefault();try{draft=saveSettings(draft,layout);dirty=false;announceSettings(draft);render();message('已保存到本浏览器。返回沙盘即可读取最新名称和工位；未上传到任何后台。');}catch(error){message(`未保存：${error.message}`,true);}});
$('#reset-settings').onclick=()=>{if(!confirm('恢复6位演示同事及默认办公室/房间名称？本浏览器已保存配置将被移除。'))return;try{draft=resetSettings();dirty=false;announceSettings(draft);render();message('已恢复演示默认值；仅清除了本浏览器的办公室配置。'+(allocationConflicts(draft,layout).length?' 原演示工位已停用，请为标记人员重新分配。':''));}catch(error){message(`未重置：${error.message}`,true);}};
$('#export-settings').onclick=()=>{try{const config=validateSettings(draft,layout,{allowInactive:true});const blob=new Blob([JSON.stringify(config,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='OfficeRoom-local-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('已导出当前表单配置。配置包含你填写的姓名和工位，请妥善保存。');}catch(error){message(`未导出：${error.message}`,true);}};
$('#import-settings').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100000)throw Error('配置文件不得超过100KB');const config=validateSettings(JSON.parse(await file.text()),layout,{allowInactive:true});draft=config;render();setDirty();message(allocationConflicts(draft,layout).length?'已载入，姓名已保留；含停用工位，请重新分配后保存。':'已载入配置预览；核对后点击保存才会写入本浏览器。');}catch(error){message(`未导入：${error.message}`,true);}finally{e.target.value='';}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
try{const r=await fetch(new URL('../data/office_layout.json',import.meta.url));if(!r.ok)throw Error(`HTTP ${r.status}`);layout=await r.json();const result=readSettings(layout);draft=result.config;render();for(const id of ['save-settings','export-settings','import-settings','reset-settings'])$('#'+id).disabled=false;message(result.error||`已读取${layout.rooms.length}个房间、${availableSeats(layout).length}个可分配工位（另有${layout.workstations.length-availableSeats(layout).length}个保留ID的停用工位）。${result.saved?'显示本浏览器已保存配置。':'当前为演示默认配置。'}`,!!result.error);}catch(error){message(`设置暂不可用：${error.message}。请通过本地HTTP服务打开。`,true);}
