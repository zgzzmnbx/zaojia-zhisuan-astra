import {icon} from '../astra_ui/icons.js';
import {personTaskSummary, taskState, emptyDutyLabel, exampleLabel} from './duty-board.js';
import {genderLabel} from './workstation-roster.js';

function node(tag, cls, text = '') {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  element.textContent = text;
  return element;
}
function glyph(name) {
  const box = node('span', 'pd-icon');
  box.innerHTML = icon(name);
  return box;
}
function chip(label, tone) {
  const item = node('span', 'duty-tag', label);
  item.dataset.tone = tone;
  return item;
}
function displayTitle(title) {
  const original = String(title || '');
  return original.replace(/^(?:【(?:项目例子|测试输入)】\s*)+/u,'').replaceAll('【演示】',' ').trim() || original;
}
function taskBadges(task) {
  const row = node('div', 'pd-tags');
  const state = taskState(task);
  row.append(chip(state.label, state.tone));
  if (state.platform) row.append(chip(state.platform, 'platform'));
  if (task.demo) row.append(chip(exampleLabel(task), 'demo'));
  else if (task.title?.includes('【演示】')) row.append(chip('演示项目','demo'));
  if (task.manual) row.append(chip('自建', 'demo'));
  if (task.adjusted) row.append(chip('沙盘已调整', 'demo'));
  return row;
}
const dateFormat = new Intl.DateTimeFormat('zh-CN', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false});
function taskTiming(task) {
  const time = Date.parse(task.createdAt);
  return [task.reviewRound ? '第 ' + task.reviewRound + ' 轮' : '', Number.isFinite(time) ? dateFormat.format(time) : ''].filter(Boolean).join(' · ');
}
function taskNotes(task, showProject) {
  const notes = node('div', 'pd-task-notes');
  if (displayTitle(task.title) !== task.title) notes.append(node('p','pd-original',task.title));
  if (showProject && task.projectName && task.projectName !== task.title) notes.append(node('p','pd-project',task.projectName));
  if (task.artifactName && task.artifactName !== task.title) {
    const file = node('p','pd-file');
    file.append(glyph('file-text'),node('span','',task.artifactName));
    notes.append(file);
  }
  for (const value of new Set([task.description, task.comment].filter(Boolean))) notes.append(node('p','',value));
  if (task.adjusted && task.dispatchId) notes.append(node('p','pd-original',['原始复核',task.originalStatus,task.originalTitle].filter(Boolean).join(' · ')));
  return notes;
}
function disclosure(key, cls) {
  const box = node('details', cls);
  box.dataset.pdKey = key;
  const summary = node('summary');
  box.append(summary);
  return {box,summary};
}
function otherTask(task, key, showProject) {
  const {box,summary} = disclosure(key,'pd-entry');
  const words = node('span','pd-entry-title',displayTitle(task.title));
  const timing = taskTiming(task);
  if (timing) words.append(node('small','pd-time',timing));
  summary.append(words,taskBadges(task),glyph('caret-down'));
  const notes = taskNotes(task,showProject);
  if (!notes.childElementCount) {
    const plain = node('div','pd-entry pd-plain');
    plain.append(words,summary.querySelector('.pd-tags'));
    return plain;
  }
  box.append(notes);
  return box;
}
function featured(task, empty) {
  const section = node('section','pd-current');
  const label = node('h3','pd-kicker','当前任务');
  label.prepend(glyph('clipboard-text'));
  section.append(label);
  if (!task) { section.append(node('p','pd-empty',empty)); return section; }
  section.append(node('h4','pd-current-title',displayTitle(task.title)),taskBadges(task));
  const timing = taskTiming(task);
  if (timing) section.append(node('p','pd-time',timing));
  const notes = taskNotes(task,true);
  if (notes.childElementCount) {
    const {box,summary} = disclosure('current:'+(task.key || task.id || task.dispatchId || task.title),'pd-current-more');
    summary.append(document.createTextNode('任务详情'),glyph('caret-down'));
    box.append(notes); section.append(box);
  }
  return section;
}
function groupedQueue(tasks, current) {
  const groups = new Map();
  for (const task of tasks) {
    if (task === current) continue;
    const ended = taskState(task).done;
    const kind = ended ? 'closed' : task.demo ? 'sample' : 'project';
    const label = ended ? '已结束的任务' : task.demo ? '沙盘示例' : task.projectName || (task.manual ? '自建任务' : '其他待办');
    const key = JSON.stringify([kind,label]);
    if (!groups.has(key)) groups.set(key,{key,kind,label,tasks:[]});
    groups.get(key).tasks.push(task);
  }
  const queue = node('section','pd-queue');
  if (!groups.size) return queue;
  const head = node('h3','pd-section-head','其余任务');
  head.append(node('span','pd-total',String(tasks.length - (current ? 1 : 0))));
  queue.append(head);
  const pendingCount = [...groups.values()].filter(g=>g.kind==='project').reduce((n,g)=>n+g.tasks.length,0);
  const order = {project:0,sample:1,closed:2};
  for (const group of [...groups.values()].sort((a,b)=>order[a.kind]-order[b.kind])) {
    if (group.kind==='project' && pendingCount<=3) {
      group.tasks.forEach((task,i)=>queue.append(otherTask(task,JSON.stringify([group.key,task.key || task.id || task.dispatchId || i,task.reviewRound]),true)));
      continue;
    }
    const {box,summary} = disclosure(group.key,'pd-group');
    const name = node('span','pd-group-name',displayTitle(group.label));
    const count = node('span','pd-count',String(group.tasks.length));
    count.setAttribute('aria-label',group.tasks.length+' 项');
    summary.append(glyph(group.kind==='closed'?'check-circle':group.kind==='sample'?'stack':'folder-open'),name,count,glyph('caret-down'));
    const contents = node('div','pd-entries');
    // Long histories stay cheap until requested. Keys and the scroll anchor survive live refreshes.
    const populate = () => {
      if (contents.childElementCount) return;
      group.tasks.forEach((task,i) => {
        const key = task.key || task.id || task.dispatchId || String(i);
        contents.append(otherTask(task,JSON.stringify([group.key,key,task.reviewRound]),group.kind!=='project'));
      });
    };
    box.addEventListener('toggle',()=>{if (box.open) populate();});
    box.append(contents); queue.append(box);
    box.populateEntries = populate;
  }
  return queue;
}

export function mountPersonDetail(pane, actions) {
  const get = selector => pane.querySelector(selector);
  const back = get('#person-detail-back'), edit = get('#person-detail-edit');
  const join = get('#person-detail-join'), move = get('#person-detail-move'), home = get('#person-detail-home');
  const scroller = get('.pd-scroll'), work = get('.pd-work');
  let personId = null, workKey = '';
  back.onclick = actions.back; edit.onclick = actions.edit; join.onclick = actions.join; move.onclick = actions.move; home.onclick = actions.home;
  move.append(glyph('users-three'),document.createTextNode('移入复核区'));
  function update({person, seatId, tasks, business, inMeeting, canMove, canGoHome}) {
    const same = personId === person.id;
    personId = person.id;
    const {live,current} = personTaskSummary(tasks);
    const empty = emptyDutyLabel(business);
    get('#person-detail-name').textContent = person.name;
    const status = get('.pd-status');
    const taskLabel = current ? taskState(current) : null;
    const statusChip = chip(inMeeting ? '在复核区' : taskLabel?.label || empty, inMeeting ? 'working' : taskLabel?.tone || 'closed');
    statusChip.classList.add('pd-presence');
    status.replaceChildren(statusChip);
    if (person.selected) status.append(chip('已选复核','selected'));
    const seat = get('.pd-seat');
    seat.replaceChildren(glyph('map-pin'),document.createTextNode('9F · '+(seatId?.replace(/^SEAT_/,'') || '工位未分配')));
    const profile = get('.pd-profile'), labels = [];
    if (person.gender && person.gender!=='unspecified') labels.push(['性别',genderLabel(person.gender)]);
    if (person.trade) labels.push(['工种',person.trade]);
    if (person.expertise) labels.push(['擅长审核',person.expertise]);
    profile.replaceChildren(...labels.map(([label,value])=>{
      const line = node('span','pd-attribute');
      line.append(node('span','',label),document.createTextNode(value));
      return line;
    }));
    profile.hidden = !labels.length;
    const real = live.filter(t=>!t.demo).length;
    const stats = get('.pd-stats');
    stats.replaceChildren(...[[real,'待办'],[live.length-real,'示例'],[tasks.length-live.length,'已结束']].map(([count,label])=>{
      const cell = node('div','pd-stat');
      cell.append(node('strong','',String(count)),node('span','',label));
      return cell;
    }));
    const nextKey = JSON.stringify([person.id,tasks,empty]);
    if (nextKey !== workKey) {
      const open = new Set(same ? [...work.querySelectorAll('details[open]')].map(d=>d.dataset.pdKey) : []);
      const focusKey = same && work.contains(document.activeElement) ? document.activeElement.closest('details')?.dataset.pdKey : null;
      const scroll = same ? scroller.scrollTop : 0;
      workKey = nextKey;
      work.replaceChildren(featured(current,empty),groupedQueue(tasks,current));
      for (const d of work.querySelectorAll('.pd-group')) if (open.has(d.dataset.pdKey)) d.populateEntries();
      for (const d of work.querySelectorAll('details')) {
        d.open = open.has(d.dataset.pdKey);
        if (focusKey === d.dataset.pdKey) d.firstElementChild.focus({preventScroll:true});
      }
      scroller.scrollTop = scroll;
    }
    join.disabled = !person.draggable;
    join.title = join.disabled ? '请在 Astra 复核卡中确认当前成果与复核平台' : '';
    join.replaceChildren(glyph(person.selected?'user-check':'user'),document.createTextNode(person.selected?'移出本次复核':person.demoAssignment?'加入演示复核':'加入本次复核'));
    move.disabled = !canMove || inMeeting;
    move.hidden = inMeeting;
    home.hidden = !canGoHome;
  }
  return {
    update,
    focus:()=>back.focus({preventScroll:true}),
    clear(){personId=null;workKey='';work.replaceChildren();},
    destroy(){for (const button of [back,edit,join,move,home]) button.onclick=null;},
  };
}
