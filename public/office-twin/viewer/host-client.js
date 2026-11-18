// Astra owns all review writes. This adapter receives display snapshots only.
import {workstationRoster} from './workstation-roster.js';
import {createWorkstationSettings} from './workstation-settings.js';
import {assignmentRoute,createDemoAssignments} from './person-assignment.js';
import {bindSelectedPersonDrag,canRemoveSelectedPerson} from './selected-person-drag.js';
import {mountDutyBoard} from './duty-board.js';
import {icon} from '../astra_ui/icons.js';
const namespace='astra-office-selection:v1';
const listeners=new Set();
let snapshot={employees:[],tasks:[],messages:[],context:'',revision:0,title:'正在读取当前成果',enabled:false};
let sourceSnapshot=snapshot;const demos=createDemoAssignments();
let started=false,draggingPerson=null,motionSettings={enabled:false,delay:0,motion:{speed:100,acceleration:100}};
let dragStart=null,chatRect=null,completedNativeDrag=null;
let artifactObserver=null,workstations=null,workstationConfig=null,selectedDrag=null,dutyBoard=null;
// A directly opened office uses saved workstation profiles. The parent owns review selection.
let hostSnapshot=null;
function applyHostSnapshot(){
  if(!hostSnapshot)return;
  sourceSnapshot={...hostSnapshot,employees:workstationRoster(hostSnapshot.employees,workstationConfig)};
  snapshot=demos.apply(sourceSnapshot);renderTasks();listeners.forEach(fn=>fn('snapshot',snapshot));
}
const $=selector=>document.querySelector(selector);
export function element(tag,text,className='') {
  const node=document.createElement(tag);node.textContent=text;node.className=className;return node;
}
function post(type,data={}){parent.postMessage({namespace,type,...data},location.origin);}
export function togglePerson(id,selected) {
  const route=assignmentRoute(snapshot,id);if(!route)return;
  if(route==='demo'){demos.set(id,selected);snapshot=demos.apply(sourceSnapshot);renderTasks();listeners.forEach(fn=>fn('snapshot',snapshot));return;}
  post('toggle',{context:snapshot.context,revision:snapshot.revision,employeeId:id,selected});
}
export function setDraggingPerson(id) {
  completedNativeDrag=null;
  draggingPerson=snapshot.employees.find(p=>p.id===id&&p.draggable)||null;
  dragStart=draggingPerson?{context:snapshot.context,revision:snapshot.revision,employeeId:id,name:draggingPerson.name}:null;
  post('person-drag',dragStart||{});
  document.documentElement.classList.toggle('host-dragging',!!draggingPerson);
  renderDropzone();
  if(!draggingPerson)$('#host-artifact').classList.remove('is-dragover');
}
export function endPersonDrag(dropEffect){
  // Native dragend can run before the parent's already-queued drop message.
  const accepted=dropEffect==='copy'?dragStart:null;
  setDraggingPerson(null);
  if(accepted)completedNativeDrag={...accepted,expires:performance.now()+1000};
}
export function overHostChat(x,y){return !!chatRect&&x>=chatRect.left&&x<=chatRect.right&&y>=chatRect.top&&y<=chatRect.bottom;}
export function moveHostDrag(x,y){if(dragStart)post('person-drag-position',{...dragStart,x,y});}
export function notifyHostDrop(id){const person=snapshot.employees.find(p=>p.id===id);if(person)post('person-drop-result',{context:snapshot.context,revision:snapshot.revision,employeeId:id,name:person.name,demo:!!person.demoAssignment});}
function renderDropzone() {
  const selected=snapshot.employees.filter(p=>p.selected),tags=$('#host-selected-people'),hint=$('#host-drop-hint');
  const focusIndex=[...tags.querySelectorAll('button')].indexOf(document.activeElement);
  selectedDrag?.cancel();
  tags.replaceChildren();
  for(const person of selected){
    const tag=element('li','','host-selected-person');tag.dataset.personId=person.id;
    tag.append(element('span',person.name,'host-selected-name'));
    if(person.demoAssignment)tag.append(element('small','演示'));
    const remove=element('button','×','btn btn-ghost btn-square btn-xs host-selected-remove');remove.type='button';
    remove.title=`取消选择 ${person.name}`;remove.setAttribute('aria-label',remove.title);
    const start={id:person.id,context:snapshot.context,revision:snapshot.revision};
    remove.disabled=!canRemoveSelectedPerson(start,snapshot);tag.classList.toggle('can-remove',!remove.disabled);
    remove.addEventListener('click',event=>{event.stopPropagation();if(canRemoveSelectedPerson(start,snapshot))togglePerson(person.id,false);});
    tag.append(remove);
    tags.append(tag);
  }
  tags.hidden=!selected.length;
  hint.textContent=draggingPerson?`把 ${draggingPerson.name} 拖到这里`:'把小人拖到这里';
  hint.hidden=selected.length>0&&!draggingPerson;
  if(focusIndex>=0){const buttons=tags.querySelectorAll('button');(buttons[Math.min(focusIndex,buttons.length-1)]||$('#host-dropzone')).focus({preventScroll:true});}
}
function renderTasks() {
  $('#host-artifact-title').textContent=snapshot.title;
  const selected=snapshot.employees.filter(p=>p.selected);
  const real=selected.filter(p=>!p.demoAssignment),demo=selected.filter(p=>p.demoAssignment);
  $('#host-selection').textContent=selected.length?[real.length?`已选 ${real.map(p=>p.name).join('、')}`:'',demo.length?`演示 ${demo.map(p=>p.name).join('、')}`:''].filter(Boolean).join('；'):'尚未选择复核人员';
  $('#host-artifact').classList.toggle('has-selection',selected.length>0);
  $('#host-artifact').setAttribute('aria-label',`当前成果，${snapshot.title}，${$('#host-selection').textContent}`);
  $('#host-selection').hidden=selected.length>0;
  renderDropzone();
  dutyBoard?.update(snapshot);
  $('#event-connection').textContent=snapshot.receiptError?'任务状态暂未刷新，请在左侧重试':'';
  $('#event-connection').closest('footer').hidden=!snapshot.receiptError;
}
function receive(event) {
  if(window.parent===window||event.source!==parent||event.origin==='null'||event.origin!==location.origin||event.data?.namespace!==namespace)return;
  if(event.data.type==='motion'){motionSettings=event.data;window.dispatchEvent(new CustomEvent('office-host-motion',{detail:motionSettings}));return;}
  if(event.data.type==='layout'){
    const left=Number(event.data.left);if(!Number.isFinite(left)||left<0)return;
    document.documentElement.style.setProperty('--host-chat-width',`${left}px`);
    const bottomInset=Number(event.data.bottomInset);
    document.documentElement.style.setProperty('--host-bottom-inset',`${Number.isFinite(bottomInset)?Math.max(0,bottomInset):0}px`);
    const r=event.data.chatRect;chatRect=r&&['left','top','right','bottom'].every(k=>Number.isFinite(r[k]))?r:null;
    window.dispatchEvent(new CustomEvent('office-host-layout',{detail:{left}}));return;
  }
  if(['chat-drop','chat-pointer'].includes(event.data.type)){
    const data=event.data,start=dragStart||(data.type==='chat-drop'&&completedNativeDrag?.expires>performance.now()?completedNativeDrag:null);
    if(!start||data.employeeId!==start.employeeId||data.context!==snapshot.context||data.revision!==snapshot.revision||start.context!==snapshot.context||start.revision!==snapshot.revision)return;
    if(data.type==='chat-pointer'){window.dispatchEvent(new CustomEvent('office-chat-pointer',{detail:data}));return;}
    const id=start.employeeId;togglePerson(id,true);setDraggingPerson(null);notifyHostDrop(id);return;
  }
  if(event.data.type!=='snapshot')return;
  const data=event.data;
  if(!Array.isArray(data.people)||!Array.isArray(data.tasks)||typeof data.context!=='string')return;
  hostSnapshot={employees:data.people,messages:[],context:data.context,revision:data.revision,title:String(data.title),enabled:!!data.enabled,receiptError:!!data.receiptError,
    tasks:data.tasks};
  applyHostSnapshot();
}
export const officeClient={
  start(){
    if(started)return;started=true;
    if(window.parent===window)hostSnapshot={...snapshot,title:'办公室',enabled:false};
    const toolbar=$('#office-tools');
    dutyBoard=mountDutyBoard($('#task-list'));
    workstations=createWorkstationSettings({toolbar,getPeople:()=>snapshot.employees,onChange:config=>{workstationConfig=config;applyHostSnapshot();}});
    for(const [action,label] of [['prepare','复核设置'],['close','返回沙盘']]){
      const button=element('button',label,'btn btn-ghost btn-sm');button.type='button';button.dataset.hostAction=action;
      button.setAttribute('role','menuitem');button.tabIndex=-1;
      button.insertAdjacentHTML('afterbegin',icon(action==='prepare'?'list-checks':'arrow-line-left'));
      button.onclick=()=>post('action',{action});toolbar.append(button);
    }
    const artifact=element('article','','host-artifact');artifact.id='host-artifact';
    const artifactLabel=element('small','当前成果','duty-artifact-label');
    artifactLabel.insertAdjacentHTML('afterbegin',icon('file-text'));
    artifact.append(artifactLabel,Object.assign(element('strong',snapshot.title),{id:'host-artifact-title'}),Object.assign(element('span','尚未选择复核人员'),{id:'host-selection'}));
    const dropzone=element('div','','host-dropzone');dropzone.id='host-dropzone';dropzone.tabIndex=-1;
    const tags=element('ul','','host-selected-people');tags.id='host-selected-people';tags.hidden=true;tags.setAttribute('aria-label','已选复核人员');tags.setAttribute('aria-live','polite');
    const hint=element('span','把小人拖到这里');hint.id='host-drop-hint';dropzone.append(tags,hint);artifact.append(dropzone);
    selectedDrag=bindSelectedPersonDrag({tags,zone:dropzone,getSnapshot:()=>snapshot,remove:id=>togglePerson(id,false)});
    const acceptDrag=event=>{if(draggingPerson&&event.dataTransfer.types.includes('text/plain')){event.preventDefault();event.dataTransfer.dropEffect='copy';artifact.classList.add('is-dragover');hint.textContent=`松开，加入 ${draggingPerson.name}`;}};
    artifact.addEventListener('dragenter',acceptDrag);artifact.addEventListener('dragover',acceptDrag);
    artifact.addEventListener('dragleave',event=>{if(!artifact.contains(event.relatedTarget)){artifact.classList.remove('is-dragover');if(draggingPerson)hint.textContent=`把 ${draggingPerson.name} 拖到这里`;}});
    artifact.addEventListener('drop',event=>{event.preventDefault();const id=event.dataTransfer.getData('text/plain');if(draggingPerson?.id===id)togglePerson(id,true);setDraggingPerson(null);});
    const rail=$('.office-inspector'),browser=element('article','','host-browser-card');
    browser.setAttribute('aria-label','任务、人员与空间');
    while(rail.firstChild)browser.append(rail.firstChild);
    rail.append(browser);
    const workspace=rail.parentElement;
    workspace.insertBefore(artifact,rail);
    artifactObserver=new ResizeObserver(()=>{
      workspace.style.setProperty('--host-artifact-height',`${artifact.getBoundingClientRect().height}px`);
    });
    artifactObserver.observe(artifact);
    for(const selector of ['[data-rail-tab="messages"]','#task-person-filter','#task-metrics','#task-focus-card','#office-settings-link','.office-business-note','.office-scene-caption','#viewer-version','#review-status','#people-panel>.office-description'])$(selector)?.setAttribute('hidden','');
    $('label[for="task-person-filter"]')?.setAttribute('hidden','');
    document.documentElement.dataset.hostReady='true';
    renderTasks();window.addEventListener('message',receive);post('ready');
  },
  subscribe(fn){listeners.add(fn);fn('snapshot',snapshot);return()=>listeners.delete(fn);},
  getState:()=>snapshot,
  getMotion:()=>motionSettings,
  send:async()=>{throw new Error('请使用 Astra 左侧复核卡发送。');},
  dispose(){window.removeEventListener('message',receive);selectedDrag?.dispose();artifactObserver?.disconnect();workstations?.dispose();listeners.clear();},
};
