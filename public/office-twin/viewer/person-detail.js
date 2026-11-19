import {icon} from '../astra_ui/icons.js';
import {personTaskSummary, taskState, emptyDutyLabel, exampleLabel, displayTitle} from './duty-board.js';
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
    const kind = ended ? 'closed' : 'project';
    const label = ended ? '已结束的任务' : task.projectName || (task.manual ? '自建任务' : '其他待办');
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
  const order = {project:0,closed:1};
  for (const group of [...groups.values()].sort((a,b)=>order[a.kind]-order[b.kind])) {
    if (group.kind==='project' && pendingCount<=3) {
      group.tasks.forEach((task,i)=>queue.append(otherTask(task,JSON.stringify([group.key,task.key || task.id || task.dispatchId || i,task.reviewRound]),true)));
      continue;
    }
    const {box,summary} = disclosure(group.key,'pd-group');
    const name = node('span','pd-group-name',displayTitle(group.label));
    const count = node('span','pd-count',String(group.tasks.length));
    count.setAttribute('aria-label',group.tasks.length+' 项');
    summary.append(glyph(group.kind==='closed'?'check-circle':'folder-open'),name,count,glyph('caret-down'));
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

function detailButton(label, iconName) {
  const button = node('button', 'hub-detail-icon');
  button.type = 'button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.append(glyph(iconName));
  return button;
}

function mountHubPersonCard(pane, actions) {
  const work = pane.querySelector('.pd-work');
  const openProfile = detailButton('查看人物详情', 'info');
  const edit = pane.querySelector('#person-detail-edit');
  edit.before(openProfile);
  const dialog = node('dialog', 'hub-person-dialog');
  dialog.id = 'hub-person-dialog';
  dialog.setAttribute('aria-labelledby', 'hub-person-dialog-title');
  const header = node('header'), title = node('h2');
  title.id = 'hub-person-dialog-title';
  const close = detailButton('关闭人物详情', 'x');
  close.autofocus = true;
  header.append(title, close);
  const content = node('div', 'hub-person-dialog-body');
  const footer = pane.querySelector('.pd-actions');
  pane.querySelector('#person-detail-join').remove();
  pane.querySelector('#person-detail-move').remove();
  edit.append(document.createTextNode('编辑此人任务'));
  edit.classList.add('btn', 'btn-ghost', 'btn-sm');
  footer.prepend(edit);
  dialog.append(header, content, footer);
  document.body.append(dialog);

  let rows = [], emptyText = '', lastTrigger = null, dialogRevision = '';
  function renderDialog() {
    title.textContent = pane.querySelector('#person-detail-name').textContent + ' · 人物详情';
    const overview = node('div', 'hub-person-overview');
    for (const selector of ['.pd-status', '.pd-metadata', '.pd-stats']) {
      overview.append(pane.querySelector(selector).cloneNode(true));
    }
    const items = rows.map(({task, key}) => {
      const card = node('article', 'hub-task-full');
      card.dataset.taskKey = key;
      card.append(node('h3', '', displayTitle(task.title || task.projectName || task.artifactName)), taskBadges(task));
      const timing = taskTiming(task);
      if (timing) card.append(node('p', 'pd-time', timing));
      card.append(taskNotes(task, !displayTitle(task.title).startsWith(displayTitle(task.projectName))));
      return card;
    });
    content.replaceChildren(overview, ...(items.length ? items : [node('p', 'pd-empty', emptyText)]));
  }
  function open(trigger) {
    const key = trigger.dataset.taskKey;
    lastTrigger = trigger;
    dialogRevision = '';
    renderDialog();
    dialog.showModal();
    if (parent !== window) parent.postMessage({namespace:'astra-office-selection:v1',type:'settings-visibility',open:true}, location.origin);
    content.scrollTop = 0;
    if (key) {
      const card = [...content.querySelectorAll('.hub-task-full')].find(item => item.dataset.taskKey === key);
      if (card) {
        card.dataset.focused = 'true';
        card.scrollIntoView({block:'nearest'});
      }
    }
  }
  openProfile.setAttribute('aria-haspopup', 'dialog');
  openProfile.setAttribute('aria-controls', dialog.id);
  openProfile.onclick = () => open(openProfile);
  close.onclick = () => dialog.close();
  edit.onclick = () => dialog.close('edit');
  dialog.addEventListener('close', () => {
    if (parent !== window) parent.postMessage({namespace:'astra-office-selection:v1',type:'settings-visibility',open:false}, location.origin);
    if (dialog.returnValue === 'edit') {
      dialog.returnValue = '';
      actions.edit();
    } else if (!pane.hidden && lastTrigger && !lastTrigger.isConnected) {
      ([...work.querySelectorAll('button')].find(b => b.dataset.taskKey === lastTrigger.dataset.taskKey) || openProfile).focus({preventScroll:true});
    }
    lastTrigger = null;
  });
  function render(tasks, current, empty) {
    const focused = work.contains(document.activeElement) ? document.activeElement.dataset.taskKey : '';
    emptyText = empty;
    rows = tasks.map((task, index) => ({task, key:String(task.key || task.id || task.dispatchId || index)}));
    rows.sort((a,b) => Number(b.task === current) - Number(a.task === current) || Number(taskState(a.task).done) - Number(taskState(b.task).done));
    const cards = rows.map(({task, key}) => {
      const project = displayTitle(task.projectName);
      const fullTitle = displayTitle(task.title || task.artifactName || '未命名任务');
      const card = node('article', 'hub-task-card');
      const heading = node('div', 'hub-task-heading');
      const more = detailButton('查看任务详情 · ' + fullTitle, 'arrow-square-out');
      more.dataset.taskKey = key;
      more.setAttribute('aria-haspopup', 'dialog');
      more.setAttribute('aria-controls', dialog.id);
      more.onclick = () => open(more);
      heading.append(node('h3', '', project || fullTitle), more);
      card.append(heading);
      const action = project && fullTitle.startsWith(project) ? fullTitle.slice(project.length).replace(/^[\s·：:—-]+/u, '') : project && fullTitle;
      if (action) card.append(node('p', 'hub-task-action', action));
      card.append(taskBadges(task));
      return card;
    });
    work.replaceChildren(...(cards.length ? cards : [node('p', 'pd-empty', empty)]));
    if (focused) ([...work.querySelectorAll('button')].find(b => b.dataset.taskKey === focused) || openProfile).focus({preventScroll:true});
  }
  function refreshDialog(workKey) {
    if (!dialog.open) return;
    const revision = JSON.stringify([workKey, pane.querySelector('.hub-person-heading').textContent, pane.querySelector('.pd-metadata').textContent]);
    if (revision === dialogRevision) return;
    dialogRevision = revision;
    const scroll = content.scrollTop, key = content.querySelector('[data-focused]')?.dataset.taskKey;
    renderDialog();
    const selected = [...content.querySelectorAll('.hub-task-full')].find(item => item.dataset.taskKey === key);
    if (selected) selected.dataset.focused = 'true';
    content.scrollTop = scroll;
  }
  return {render, refreshDialog, close:() => { if (dialog.open) dialog.close(); }, destroy:() => dialog.remove()};
}

export function mountPersonDetail(pane, actions) {
  const get = selector => pane.querySelector(selector);
  const back = get('#person-detail-back'), edit = get('#person-detail-edit');
  const join = get('#person-detail-join'), move = get('#person-detail-move'), home = get('#person-detail-home');
  const scroller = get('.pd-scroll'), work = get('.pd-work');
  let personId = null, workKey = '';
  back.onclick = actions.back; edit.onclick = actions.edit; join.onclick = actions.join; move.onclick = actions.move; home.onclick = actions.home;
  move.append(glyph('users-three'),document.createTextNode('移入复核区'));
  const hubCard = pane.classList.contains('hub-person-card') ? mountHubPersonCard(pane, actions) : null;
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
    const stats = get('.pd-stats');
    stats.replaceChildren(...[[live.length,'待办'],[tasks.length-live.length,'已结束']].map(([count,label])=>{
      const cell = node('div','pd-stat');
      cell.append(node('strong','',String(count)),node('span','',label));
      return cell;
    }));
    const nextKey = JSON.stringify([person.id,tasks,empty]);
    if (hubCard) {
      if (nextKey !== workKey) {
        const scroll = same ? scroller.scrollTop : 0;
        hubCard.render(tasks, current, empty);
        workKey = nextKey;
        scroller.scrollTop = scroll;
      }
      home.hidden = !canGoHome;
      hubCard.refreshDialog(workKey);
      return;
    }
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
    clear(){hubCard?.close();personId=null;workKey='';work.replaceChildren();},
    destroy(){hubCard?.close();hubCard?.destroy();for (const button of [back,edit,join,move,home]) button.onclick=null;},
  };
}
