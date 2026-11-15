import {officeClient} from './office-client.js';
import {getOfficePeople} from './office-settings-store.js';

const time=value=>value?new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
const STATUS = {queued:'待处理',in_progress:'进行中',review:'待复核',completed:'已完成'};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function mountEventWorkbench() {
  const $=s=>document.querySelector(s), aborter=new AbortController(), opts={signal:aborter.signal};
  let snapshot={employees:[],tasks:[],messages:[]}, local=[], selected=null, filter='', noticeTimer, busy=false, connection='connecting';
  const person=id=>local.find(p=>p.id===id)||snapshot.employees.find(p=>p.id===id)||{id,name:id};
  function focus(id) {
    const success=window.officeTwin?.focusPerson(id);
    $('#task-action-status').textContent=success?'':`${person(id).name}暂无可定位工位；任务和消息已保留。`;
    return success;
  }
  function openTab(tab){window.dispatchEvent(new CustomEvent('office-panel',{detail:{tab}}));}
  function selectTask(task){selected=task;focus(task.employeeId);openTab('tasks');renderFocus();}
  function renderFocus(){
    const card=$('#task-focus-card');card.replaceChildren();card.hidden=!selected;if(!selected)return;
    const p=person(selected.employeeId);
    card.append(el('h3',selected.title),el('p',`${p.name} · ${STATUS[selected.status]}`),el('p',`来源 ${selected.source} · v${selected.revision} · ${time(selected.updatedAt)}`,'office-muted'));
    const locate=el('button','定位同事','btn btn-ghost btn-sm');locate.type='button';locate.onclick=()=>focus(selected.employeeId);card.append(locate);
    card.append(el('p','复核候选在“人员”中选择，尚未连接 Astra 派发。','office-muted'));
  }
  function render() {
    const select=$('#task-person-filter');select.replaceChildren();const all=el('option','全部同事');all.value='';select.append(all);
    for(const p of snapshot.employees){const option=el('option',person(p.id).name);option.value=p.id;select.append(option);}select.value=filter;
    const demo=$('#demo-employee'),previous=demo.value;demo.replaceChildren();for(const p of snapshot.employees){const o=el('option',person(p.id).name);o.value=p.id;demo.append(o);}demo.value=previous||snapshot.employees[0]?.id||'';
    const tasks=snapshot.tasks.filter(t=>!filter||t.employeeId===filter),list=$('#task-list'),metrics=$('#task-metrics');list.replaceChildren();metrics.replaceChildren();
    for(const [label,items] of [['待处理',tasks.filter(t=>t.status==='queued')],['进行中',tasks.filter(t=>['in_progress','review'].includes(t.status))],['已完成',tasks.filter(t=>t.status==='completed')]]){const metric=el('div',undefined,'task-metric');metric.append(el('strong',String(items.length)),el('span',label));metrics.append(metric);}
    if(!tasks.length)list.append(el('p','暂无接入任务，可在“消息”中接收演示事件。','office-description'));
    for(const task of tasks){const b=el('button',undefined,'task-card');b.type='button';b.dataset.source=task.source;b.dataset.taskId=task.taskId;b.title=`来源 ${task.source} · 更新 ${time(task.updatedAt)}`;b.append(el('strong',task.title),el('span',`${person(task.employeeId).name} · ${STATUS[task.status]}`,'task-card-meta'));
      if(Number.isInteger(task.progress)){const progress=el('progress');progress.max=100;progress.value=task.progress;progress.setAttribute('aria-label',`${task.title}进度 ${task.progress}%`);b.append(progress);}else b.append(el('small','进度未提供','office-muted'));
      b.onclick=()=>selectTask(task);list.append(b);
    }
    if(selected)selected=snapshot.tasks.find(t=>t.source===selected.source&&t.taskId===selected.taskId)||null;renderFocus();
    const messages=$('#incoming-messages');messages.replaceChildren();$('#message-count').textContent=String(snapshot.messages.filter(m=>!m.acknowledged).length);
    if(!snapshot.messages.length)messages.append(el('p','暂无接入消息','office-description'));
    for(const m of snapshot.messages){const article=el('article',undefined,'office-incoming-message');article.dataset.seq=String(m.seq);article.append(el('h3',m.title),el('p',m.body),el('small',`${person(m.employeeId).name} · ${m.source} · ${time(m.occurredAt)}`,'office-muted'));
      const actions=el('div',undefined,'event-demo-actions'),locate=el('button','定位同事','btn btn-sm btn-ghost');locate.type='button';locate.onclick=()=>{if(!focus(m.employeeId))$('#demo-result').textContent='该员工没有有效工位，消息仍保留在这里。';};actions.append(locate);
      const ack=el('button',m.acknowledged?'提醒已确认':'确认提醒','btn btn-sm btn-ghost');ack.type='button';ack.disabled=m.acknowledged;ack.onclick=async()=>{ack.disabled=true;try{await officeClient.acknowledge(m.seq);}catch(e){ack.disabled=false;$('#demo-result').textContent=e.message;}};actions.append(ack);article.append(actions);messages.append(article);
    }
  }
  async function demo(type) {
    if(busy)return;busy=true;buttons();
    const id=crypto.randomUUID();
    const event={schemaVersion:1,eventId:id,source:'office-demo',employeeId:$('#demo-employee').value,type,occurredAt:new Date().toISOString(),data:type==='task.assigned'?{taskId:'task-'+id,title:'演示：办公楼工程量复核',status:'queued',revision:1,progress:0}:{title:'演示：收到协作消息',body:'请查看新到的造价资料。本消息仅用于办公室联调。'}};
    try{await officeClient.send(event);$('#demo-result').textContent='已通过 API 接收并保存';}catch(e){$('#demo-result').textContent=e.message;}finally{busy=false;buttons();}
  }
  function buttons(){for(const id of ['demo-task','demo-message'])$('#'+id).disabled=busy||connection!=='live';}
  $('#demo-task').addEventListener('click',()=>demo('task.assigned'),opts);$('#demo-message').addEventListener('click',()=>demo('message.received'),opts);
  $('#task-person-filter').addEventListener('change',e=>{filter=e.target.value;render();},opts);
  const unsubscribe=officeClient.subscribe((kind,value)=>{
    if(kind==='snapshot'){snapshot=value;render();}
    if(kind==='connection'){connection=value;$('#event-connection').textContent={connecting:'连接本机事件服务…',live:'演示 API 已连接',reconnecting:'事件连接中断，正在重连',disposed:'事件服务已断开'}[value];buttons();}
    if(kind==='event'){
      const e=value.event,p=person(e.employeeId),notice=$('#event-notice');notice.hidden=false;
      notice.textContent=`${p.name} · ${e.type==='message.received'?'收到消息':e.type==='task.updated'?'任务已更新':'收到任务'}：${e.data.title}`;
      clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice.hidden=true;},7000);
    }
  });
  getOfficePeople().then(rows=>{if(!aborter.signal.aborted){local=rows;render();}}).catch(()=>{});
  return {dispose(){aborter.abort();unsubscribe();clearTimeout(noticeTimer);}};
}
