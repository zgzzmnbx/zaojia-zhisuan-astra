// Astra owns all review writes. This adapter receives display snapshots only.
const namespace='astra-office-selection:v1';
const listeners=new Set();
let snapshot={employees:[],tasks:[],messages:[],context:'',revision:0,title:'正在读取当前成果',enabled:false};
let started=false;
const samples=['某支线工程控制价复核','某站场改造结算复核','某研发基地勘察测量复核','某数字化项目投资复核'];
const $=selector=>document.querySelector(selector);
export function element(tag,text,className='') {
  const node=document.createElement(tag);node.textContent=text;node.className=className;return node;
}
function post(type,data={}){parent.postMessage({namespace,type,...data},location.origin);}
export function togglePerson(id,selected) {
  if(!snapshot.employees.some(p=>p.id===id&&p.selectable))return;
  post('toggle',{context:snapshot.context,revision:snapshot.revision,employeeId:id,selected});
}
function renderTasks() {
  $('#host-artifact-title').textContent=snapshot.title;
  const selected=snapshot.employees.filter(p=>p.selected);
  $('#host-selection').textContent=selected.length?`已选 ${selected.map(p=>p.name).join('、')}`:'点击人物或拖入头像选人';
  $('#host-artifact').classList.toggle('has-selection',selected.length>0);
  $('#host-artifact').setAttribute('aria-label',`当前成果，${snapshot.title}，${$('#host-selection').textContent}`);
  const list=$('#task-list');list.replaceChildren();
  for(const person of snapshot.employees) {
    const tasks=snapshot.tasks.filter(t=>t.employeeId===person.id);
    const row=element('section','','host-task-row');row.append(element('strong',person.name));
    for(const task of tasks){const line=element('div','','host-task-line');line.append(element('span',task.title),element('small',`${task.demo?'演示 · ':''}${task.status}`));row.append(line);}
    list.append(row);
  }
  $('#event-connection').textContent=snapshot.receiptError?'任务状态暂未刷新，请在左侧重试':snapshot.enabled?'工位示意 · 选人同步至左侧复核卡':'工位示意 · 准备成果后选人';
}
function receive(event) {
  if(event.source!==parent||event.origin==='null'||event.origin!==location.origin||event.data?.namespace!==namespace)return;
  if(event.data.type==='layout'){
    const left=Number(event.data.left);if(!Number.isFinite(left)||left<0)return;
    document.documentElement.style.setProperty('--host-chat-width',`${left}px`);
    window.dispatchEvent(new CustomEvent('office-host-layout',{detail:{left}}));return;
  }
  if(event.data.type!=='snapshot')return;
  const data=event.data;
  if(!Array.isArray(data.people)||!Array.isArray(data.tasks)||typeof data.context!=='string')return;
  snapshot={employees:data.people,messages:[],context:data.context,revision:data.revision,title:String(data.title),enabled:!!data.enabled,receiptError:!!data.receiptError,
    tasks:[...data.tasks,...data.people.map((person,index)=>({id:`sample:${person.id}`,employeeId:person.id,title:samples[index%samples.length],status:index%3===0?'待复核':'审核中',demo:true}))]};
  renderTasks();listeners.forEach(fn=>fn('snapshot',snapshot));
}
export const officeClient={
  start(){
    if(started)return;started=true;
    const artifact=element('section','','host-artifact');artifact.id='host-artifact';
    artifact.append(element('small','当前成果'),Object.assign(element('strong',snapshot.title),{id:'host-artifact-title'}),Object.assign(element('span','点击人物或拖入头像选人'),{id:'host-selection'}));
    artifact.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('text/plain')){event.preventDefault();event.dataTransfer.dropEffect='copy';artifact.classList.add('is-dragover');}});
    artifact.addEventListener('dragleave',()=>artifact.classList.remove('is-dragover'));
    artifact.addEventListener('drop',event=>{event.preventDefault();artifact.classList.remove('is-dragover');togglePerson(event.dataTransfer.getData('text/plain'),true);});
    $('.office-inspector').prepend(artifact);
    for(const selector of ['[data-rail-tab="messages"]','#task-person-filter','#task-metrics','#task-focus-card','#render-compare','#office-settings-link','.office-business-note','.office-scene-caption','#viewer-version'])$(selector)?.setAttribute('hidden','');
    $('label[for="task-person-filter"]')?.setAttribute('hidden','');
    document.documentElement.dataset.hostReady='true';
    window.addEventListener('message',receive);post('ready');
  },
  subscribe(fn){listeners.add(fn);fn('snapshot',snapshot);return()=>listeners.delete(fn);},
  getState:()=>snapshot,
  send:async()=>{throw new Error('请使用 Astra 左侧复核卡发送。');},
  dispose(){window.removeEventListener('message',receive);listeners.clear();},
};
