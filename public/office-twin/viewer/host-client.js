// Astra owns all review writes. This adapter receives display snapshots only.
import {workstationRoster} from './workstation-roster.js';
import {createWorkstationSettings} from './workstation-settings.js';
import {assignmentRoute,createDemoAssignments} from './person-assignment.js';
const namespace='astra-office-selection:v1';
const listeners=new Set();
let snapshot={employees:[],tasks:[],messages:[],context:'',revision:0,title:'正在读取当前成果',enabled:false};
let sourceSnapshot=snapshot;const demos=createDemoAssignments();
let started=false,draggingPerson=null,motionSettings={enabled:false,delay:0,motion:{speed:100,acceleration:100}};
let dragStart=null,chatRect=null,completedNativeDrag=null;
let artifactObserver=null,workstations=null,workstationConfig=null,hostSnapshot=null;
function applyHostSnapshot(){
  if(!hostSnapshot)return;
  sourceSnapshot={...hostSnapshot,employees:workstationRoster(hostSnapshot.employees,workstationConfig)};
  snapshot=demos.apply(sourceSnapshot);renderTasks();listeners.forEach(fn=>fn('snapshot',snapshot));
}
const samples=['某支线工程控制价复核','某站场改造结算复核','某研发基地勘察测量复核','某数字化项目投资复核'];
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
  tags.replaceChildren();
  for(const person of selected){
    const tag=element('li','','host-selected-person');tag.dataset.personId=person.id;
    tag.append(element('span',person.name,'host-selected-name'));
    if(person.demoAssignment)tag.append(element('small','演示'));
    tags.append(tag);
  }
  tags.hidden=!selected.length;
  hint.textContent=draggingPerson?`把 ${draggingPerson.name} 拖到这里`:'把小人拖到这里';
  hint.hidden=selected.length>0&&!draggingPerson;
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
  const list=$('#task-list');list.replaceChildren();
  for(const person of snapshot.employees) {
    const tasks=snapshot.tasks.filter(t=>t.employeeId===person.id);
    const row=element('article','','host-task-row');row.append(element('strong',person.name));
    for(const task of tasks){const line=element('div','','host-task-line');line.append(element('span',task.title),element('small',`${task.demo?'演示 · ':''}${task.status}`));row.append(line);}
    if(!tasks.length)row.append(element('small','暂无审核任务','host-idle-status'));
    list.append(row);
  }
  $('#event-connection').textContent=snapshot.receiptError?'任务状态暂未刷新，请在左侧重试':'';
  $('#event-connection').closest('footer').hidden=!snapshot.receiptError;
}
function receive(event) {
  if(event.source!==parent||event.origin==='null'||event.origin!==location.origin||event.data?.namespace!==namespace)return;
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
    tasks:[...data.tasks,...data.people.flatMap((person,index)=>
      data.tasks.some(t=>t.employeeId===person.id)||(index>0&&index>=data.people.length-2)?[]:
      [{id:`sample:${person.id}`,employeeId:person.id,title:samples[index%samples.length],status:index%3===0?'待复核':'审核中',demo:true}])]};
  applyHostSnapshot();
}
export const officeClient={
  start(){
    if(started)return;started=true;
    const toolbar=$('.office-modebar');
    workstations=createWorkstationSettings({toolbar,getPeople:()=>snapshot.employees,onChange:config=>{workstationConfig=config;applyHostSnapshot();}});
    for(const [action,label] of [['prepare','复核设置'],['close','返回沙盘']]){
      const button=element('button',label,'btn btn-ghost btn-sm');button.type='button';button.dataset.hostAction=action;
      button.onclick=()=>post('action',{action});toolbar.append(button);
    }
    const artifact=element('article','','host-artifact');artifact.id='host-artifact';
    artifact.append(element('small','当前成果'),Object.assign(element('strong',snapshot.title),{id:'host-artifact-title'}),Object.assign(element('span','尚未选择复核人员'),{id:'host-selection'}));
    const dropzone=element('div','','host-dropzone');dropzone.id='host-dropzone';
    const tags=element('ul','','host-selected-people');tags.id='host-selected-people';tags.hidden=true;tags.setAttribute('aria-label','已选复核人员');tags.setAttribute('aria-live','polite');
    const hint=element('span','把小人拖到这里');hint.id='host-drop-hint';dropzone.append(tags,hint);artifact.append(dropzone);
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
    for(const selector of ['[data-rail-tab="messages"]','#task-person-filter','#task-metrics','#task-focus-card','#render-compare','#office-settings-link','.office-business-note','.office-scene-caption','#viewer-version','#review-status','#people-panel>.office-description'])$(selector)?.setAttribute('hidden','');
    $('label[for="task-person-filter"]')?.setAttribute('hidden','');
    document.documentElement.dataset.hostReady='true';
    window.addEventListener('message',receive);post('ready');
  },
  subscribe(fn){listeners.add(fn);fn('snapshot',snapshot);return()=>listeners.delete(fn);},
  getState:()=>snapshot,
  getMotion:()=>motionSettings,
  send:async()=>{throw new Error('请使用 Astra 左侧复核卡发送。');},
  dispose(){window.removeEventListener('message',receive);artifactObserver?.disconnect();workstations?.dispose();listeners.clear();},
};
