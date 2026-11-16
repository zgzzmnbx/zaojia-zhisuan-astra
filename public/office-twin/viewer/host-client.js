// Astra owns all review writes. This adapter receives display snapshots only.
import {assignmentRoute,createDemoAssignments} from './person-assignment.js';
const namespace='astra-office-selection:v1';
const listeners=new Set();
let snapshot={employees:[],tasks:[],messages:[],context:'',revision:0,title:'正在读取当前成果',enabled:false};
let sourceSnapshot=snapshot;const demos=createDemoAssignments();
let started=false,draggingPerson=null,motionSettings={enabled:false,delay:0,motion:{speed:100,acceleration:100}};
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
  draggingPerson=snapshot.employees.find(p=>p.id===id&&p.draggable)||null;
  document.documentElement.classList.toggle('host-dragging',!!draggingPerson);
  if(draggingPerson&&$('#space-cards-panel').hidden)$('#space-card-toggle').click();
  renderDropzone();
  if(!draggingPerson)$('#host-artifact').classList.remove('is-dragover');
}
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
    const row=element('section','','host-task-row');row.append(element('strong',person.name));
    for(const task of tasks){const line=element('div','','host-task-line');line.append(element('span',task.title),element('small',`${task.demo?'演示 · ':''}${task.status}`));row.append(line);}
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
    window.dispatchEvent(new CustomEvent('office-host-layout',{detail:{left}}));return;
  }
  if(event.data.type!=='snapshot')return;
  const data=event.data;
  if(!Array.isArray(data.people)||!Array.isArray(data.tasks)||typeof data.context!=='string')return;
  sourceSnapshot={employees:data.people,messages:[],context:data.context,revision:data.revision,title:String(data.title),enabled:!!data.enabled,receiptError:!!data.receiptError,
    tasks:[...data.tasks,...data.people.map((person,index)=>({id:`sample:${person.id}`,employeeId:person.id,title:samples[index%samples.length],status:index%3===0?'待复核':'审核中',demo:true}))]};
  snapshot=demos.apply(sourceSnapshot);renderTasks();listeners.forEach(fn=>fn('snapshot',snapshot));
}
export const officeClient={
  start(){
    if(started)return;started=true;
    const toolbar=$('.office-modebar');
    for(const [action,label] of [['prepare','复核设置'],['close','返回沙盘']]){
      const button=element('button',label,'btn btn-ghost btn-sm');button.type='button';button.dataset.hostAction=action;
      button.onclick=()=>post('action',{action});toolbar.append(button);
    }
    const artifact=element('section','','host-artifact');artifact.id='host-artifact';
    artifact.append(element('small','当前成果'),Object.assign(element('strong',snapshot.title),{id:'host-artifact-title'}),Object.assign(element('span','尚未选择复核人员'),{id:'host-selection'}));
    const dropzone=element('div','','host-dropzone');dropzone.id='host-dropzone';
    const tags=element('ul','','host-selected-people');tags.id='host-selected-people';tags.hidden=true;tags.setAttribute('aria-label','已选复核人员');tags.setAttribute('aria-live','polite');
    const hint=element('span','把小人拖到这里');hint.id='host-drop-hint';dropzone.append(tags,hint);artifact.append(dropzone);
    artifact.addEventListener('dragover',event=>{if(draggingPerson&&event.dataTransfer.types.includes('text/plain')){event.preventDefault();event.dataTransfer.dropEffect='copy';artifact.classList.add('is-dragover');hint.textContent=`松开，加入 ${draggingPerson.name}`;}});
    artifact.addEventListener('dragleave',event=>{if(!artifact.contains(event.relatedTarget)){artifact.classList.remove('is-dragover');if(draggingPerson)hint.textContent=`把 ${draggingPerson.name} 拖到这里`;}});
    artifact.addEventListener('drop',event=>{event.preventDefault();const id=event.dataTransfer.getData('text/plain');if(draggingPerson?.id===id)togglePerson(id,true);setDraggingPerson(null);});
    $('.office-inspector').prepend(artifact);
    for(const selector of ['[data-rail-tab="messages"]','#task-person-filter','#task-metrics','#task-focus-card','#render-compare','#office-settings-link','.office-business-note','.office-scene-caption','#viewer-version','#review-status','#people-panel>.office-description'])$(selector)?.setAttribute('hidden','');
    $('label[for="task-person-filter"]')?.setAttribute('hidden','');
    document.documentElement.dataset.hostReady='true';
    window.addEventListener('message',receive);post('ready');
  },
  subscribe(fn){listeners.add(fn);fn('snapshot',snapshot);return()=>listeners.delete(fn);},
  getState:()=>snapshot,
  getMotion:()=>motionSettings,
  send:async()=>{throw new Error('请使用 Astra 左侧复核卡发送。');},
  dispose(){window.removeEventListener('message',receive);listeners.clear();},
};
