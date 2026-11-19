import {icon} from '../astra_ui/icons.js';
import {officeTaskGroups} from './task-board.js';
import {taskState} from './duty-board.js';
import {mountAssignment} from './hub-assignment.js';

export const managedHub=typeof location!=='undefined'&&new URLSearchParams(location.search).get('desk')==='hub';

function node(tag,text='',className=''){
  const el=document.createElement(tag);
  el.className=className;el.textContent=text;
  if(tag==='button')el.type='button';
  return el;
}
function mark(name){
  const el=node('span','','hub-icon');el.setAttribute('aria-hidden','true');el.innerHTML=icon(name);return el;
}

export function mountWorkHub({artifact,getState,getDrag,post,onSaved}){
  let picked='',context='',quickTab='people';
  const dock=node('section','','hub-dock'),notice=node('p','','hub-notice'),routes=new Map();
  notice.setAttribute('role','status');
  const confirm=node('button','统一确认复核','btn btn-primary btn-sm hub-confirm');
  confirm.onclick=()=>post('action',{action:'prepare'});
  const quick=node('details','','hub-quick'),summary=node('summary','快速查看'),filters=node('div','','hub-quick-filters'),list=node('div','','hub-quick-list');
  quick.id='office-hub-quick';
  const assignment=mountAssignment({getState,onSaved,visibility:open=>post('settings-visibility',{open})});
  quick.append(summary,filters,list);
  const names={default:'飞书复核',weact_cost:'WeAct 复核',task:'派任务'};
  function describe(text){notice.textContent=text;}
  function place(route,id,selected=true){
    const state=getState(),p=state.employees.find(person=>person.id===id);
    if(!p){describe('请先点选或拖入一位同事');return;}
    if(route==='task'){assignment.open(id);return;}
    const channel=state.channels?.find(c=>c.id===route);
    if(!channel||channel.reason){describe(channel?.reason||'请先打开当前成果的复核卡');return;}
    const members=channel.members.filter(m=>m.id===id);
    if(members.length!==1){describe(p.name+' 不在该平台当前可选名单中');return;}
    if(members[0].selected===selected){describe(selected?'已在该平台名单中':'已移出名单');return;}
    if(selected&&channel.members.filter(m=>m.selected).length>=10){describe('每个平台最多选择 10 人');return;}
    post('channel-toggle',{context:state.context,revision:state.revision,profileId:route,employeeId:id,selected});
    describe('');
  }
  function accept(route,start){
    const state=getState();
    if(!start||start.context!==state.context||start.revision!==state.revision){describe('成果或名单已更新，请重新拖入');return;}
    place(route,start.employeeId);
  }
  for(const [key,title] of Object.entries(names)){
    const zone=node('div','','hub-zone');zone.dataset.officeRoute=key;
    const button=node('button','','hub-target'),label=node('strong',title),meta=node('small');
    button.append(mark(key==='task'?'list-checks':key==='default'?'paper-plane-tilt':'chat-circle-dots'),label,meta);
    button.setAttribute('aria-label',title);button.onclick=()=>place(key,picked);
    const chips=node('div','','hub-chips');
    zone.append(button,chips);dock.append(zone);routes.set(key,{meta,chips,button,zone});
    zone.addEventListener('dragover',e=>{if(getDrag()){e.preventDefault();e.dataTransfer.dropEffect='copy';zone.classList.add('hub-over');}});
    zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('hub-over');});
    zone.addEventListener('drop',e=>{
      e.preventDefault();e.stopPropagation();zone.classList.remove('hub-over');
      const start=getDrag();if(start?.employeeId===e.dataTransfer.getData('text/plain'))accept(key,start);
    });
  }
  function renderQuick(){
    if(!quick.open)return;
    const state=getState();list.replaceChildren();
    for(const b of filters.children)b.setAttribute('aria-pressed',String(b.dataset.tab===quickTab));
    if(quickTab==='people'){
      for(const p of state.employees){
        const row=node('button','','hub-quick-row'),n=(state.personTasks?.get(p.id)||[]).filter(t=>!taskState(t).done).length;
        row.append(node('span',p.name),node('small',n?n+' 项待办':'无待办'));row.onclick=()=>window.officeTwin?.focusPerson(p.id);list.append(row);
      }
    }else for(const g of officeTaskGroups(state)){
      const row=node('div','','hub-quick-row');row.append(node('strong',g.project||g.title),node('small',g.receipts.map(r=>r.name).join('、')+' · '+g.state.label));list.append(row);
    }
    if(!list.childElementCount)list.append(node('small',quickTab==='people'?'暂无人员':'暂无任务'));
  }
  for(const [id,title] of [['people','人员'],['tasks','任务']]){
    const b=node('button',title);b.dataset.tab=id;b.onclick=()=>{quickTab=id;renderQuick();};filters.append(b);
  }
  quick.addEventListener('toggle',renderQuick);
  function render(){
    const state=getState();
    if(context!==state.context){context=state.context;picked='';describe('');quick.open=false;}
    const who=state.employees.find(p=>p.id===picked);
    let count=0;
    for(const [key,{meta,chips,button}] of routes){
      if(key==='task'){meta.textContent=who?'给 '+who.name+' 分配':'个人待办';continue;}
      const channel=state.channels?.find(c=>c.id===key),members=channel?.members.filter(m=>m.selected)||[];
      count+=members.length;meta.textContent=channel?.reason||(!channel?'待准备':members.length+' 人');
      button.title=channel?.reason||(who?'选入 '+who.name:'拖入人员，或先点姓名再选平台');
      const signature=JSON.stringify([channel?.reason,members]);
      if(chips.dataset.state===signature)continue;
      chips.dataset.state=signature;chips.replaceChildren();
      for(const m of members){
        const label=state.employees.find(p=>p.id===m.id)?.name||m.name;
        const b=node('button',label+' ×','hub-chip');b.disabled=!!channel.reason;
        b.setAttribute('aria-label','从'+names[key]+'移除'+label);b.onclick=()=>place(key,m.id,false);chips.append(b);
      }
    }
    confirm.textContent=count?'统一确认复核 · '+count:'打开复核卡';
    renderQuick();
  }
  function choose(e){if(e.detail.open){picked=e.detail.id;describe('');render();}}
  function pickForReview(id){
    picked=id;render();
    describe('已选 '+(getState().employees.find(p=>p.id===id)?.name||'同事')+'，请选择复核平台');
    routes.get('default').button.focus({preventScroll:true});
  }
  window.addEventListener('office-person-menu',choose);
  dock.append(notice,confirm,quick);artifact.append(dock);artifact.dataset.managedDock='true';
  return {render,accept,pickForReview,assign:assignment.open,dispose(){window.removeEventListener('office-person-menu',choose);assignment.dispose();dock.remove();}};
}
