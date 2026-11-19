import {icon} from '../astra_ui/icons.js';
import {displayTitle, dutyElement as el, dutyTag, exampleLabel, mountDutyFilters, taskPriority, taskState} from './duty-board.js';

function groupStatus(receipts) {
  const states = receipts.map(r => r.state);
  const first = states[0];
  if (states.every(s => s.label === first.label && s.done === first.done)) return first;
  const done = states.every(s => s.done);
  if (states.some(s => s.tone === 'returned')) return {label:'有退回', tone:'returned', done};
  return done ? {label:'已结束', tone:'closed', done} : {label:'进行中', tone:'working', done};
}

// Group an actual dispatch and round, never unrelated work that happens to share a title.
export function officeTaskGroups(snapshot) {
  const groups = new Map(), people = new Map(snapshot.employees.map(p => [p.id, p]));
  const tasksByPerson = snapshot.personTasks || new Map();
  const rounds = new Map();
  for (const tasks of tasksByPerson.values()) {
    for (const t of tasks) if (t.dispatchId && t.reviewRound) {
      if (!rounds.has(t.dispatchId)) rounds.set(t.dispatchId, new Set());
      rounds.get(t.dispatchId).add(t.reviewRound);
    }
  }
  for (const [personId, tasks] of tasksByPerson) {
    const person = people.get(personId);
    tasks.forEach((task, index) => {
      const known = rounds.get(task.dispatchId);
      const round = task.reviewRound ?? (known?.size === 1 ? known.values().next().value : 0);
      let identity;
      if (task.dispatchId) identity = ['review', task.dispatchId, round];
      else if (task.demo && !task.example && task.id === 'assignment:' + personId) identity = ['assignment', snapshot.context];
      else identity = ['personal', personId, task.id ?? index];
      const key = JSON.stringify(identity);
      if (!groups.has(key)) groups.set(key,{key, round, receipts:[]});
      groups.get(key).receipts.push({
        personId, name:person?.name || task.employeeName || (personId ? '人员待确认' : '待分派'),
        canLocate:!!person, task, state:taskState(task),
      });
    });
  }
  const result = [];
  for (const group of groups.values()) {
    const {receipts} = group;
    const task = (receipts.find(r => !r.task.adjusted) || receipts[0]).task;
    const fullTitle = task.title || task.projectName || task.artifactName || '未命名任务';
    const project = displayTitle(task.projectName?.trim() || receipts.find(r => r.task.projectName?.trim())?.task.projectName);
    const label = displayTitle(fullTitle);
    const suffix = project && label.startsWith(project) ? label.slice(project.length) : '';
    const action = /^[\s·：:]/u.test(suffix) || suffix === '填价成果复核' ? suffix.replace(/^[\s·：:]+/u,'').trim() : '';
    result.push({...group, title:action || label, fullTitle, project, state:groupStatus(receipts),
      priority:Math.min(...receipts.map(r => taskPriority(r.task))),
      created:Math.max(...receipts.map(r => Date.parse(r.task.createdAt) || 0))});
  }
  return result.sort((a,b) => Number(a.state.done)-Number(b.state.done) || a.priority-b.priority || b.created-a.created);
}

function glyph(name) {
  const mark = el('span','office-ledger-icon');
  mark.setAttribute('aria-hidden','true');
  mark.innerHTML = icon(name);
  return mark;
}

function receiptList(group, focusPerson) {
  const content = el('div','office-ledger-receipts');
  if (group.title !== group.project) content.append(el('p','office-ledger-action',group.title));
  const sources = new Set(group.receipts.map(r => r.state.platform || (r.task.demo ? exampleLabel(r.task) : r.task.manual ? '自建' : '')).filter(Boolean));
  const meta = [...sources];
  if (group.round) meta.push('第 ' + group.round + ' 轮');
  if (group.receipts.length > 1) meta.push(group.receipts.filter(r => r.state.done).length + '/' + group.receipts.length + ' 人已结束');
  if (meta.length) content.append(el('p','office-ledger-meta',meta.join(' · ')));
  for (const r of group.receipts) {
    const receipt = el('div','office-ledger-receipt');
    const line = el('div','office-ledger-person');
    const name = el(r.canLocate ? 'button' : 'span','office-ledger-name',r.name);
    if (r.canLocate) {
      name.type = 'button';
      name.dataset.personId = r.personId;
      name.setAttribute('aria-label','查看' + r.name + '的人员详情');
      name.onclick = () => focusPerson(r.personId);
    }
    line.append(name, dutyTag(r.state.label,r.state.tone));
    receipt.append(line);
    if (r.task.title && r.task.title !== group.fullTitle) receipt.append(el('p','office-ledger-note',r.task.title));
    for (const note of new Set([r.task.description,r.task.comment].filter(Boolean))) receipt.append(el('p','office-ledger-note',note));
    if (r.task.adjusted && r.task.dispatchId) {
      receipt.append(el('p','office-ledger-note',['原始复核',r.task.originalStatus,r.task.originalTitle].filter(Boolean).join(' · ')));
    }
    content.append(receipt);
  }
  for (const file of new Set(group.receipts.map(r => r.task.artifactName).filter(Boolean))) {
    const line = el('p','office-ledger-file');
    line.append(glyph('file-text'),el('span','',file));
    content.append(line);
  }
  if (group.created && group.receipts[0].task.dispatchId) {
    const time = el('time','office-ledger-file','派发于 ' + dispatchTime.format(group.created));
    time.dateTime = new Date(group.created).toISOString();
    content.append(time);
  }
  return content;
}
const dispatchTime = new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

function taskCard(group, focusPerson) {
  const card = el('details','office-ledger-card'), summary = el('summary','office-ledger-summary');
  card.dataset.taskKey = group.key;
  card.append(summary);
  let current, signature, content;
  function populate() {
    if (!card.open || content) return;
    content = receiptList(current,focusPerson);
    card.append(content);
  }
  card.addEventListener('toggle',populate);
  function update(next) {
    const key = JSON.stringify(next);
    if (key === signature) return;
    current = next;
    signature = key;
    const who = el('span','office-ledger-who');
    who.append(glyph('users-three'), el('span','',next.receipts.map(r => r.name).join('、')));
    summary.replaceChildren(el('strong','office-ledger-title',next.project || '未关联项目'),
      dutyTag(next.state.label,next.state.tone),who,glyph('caret-down'));
    const focused = content?.contains(document.activeElement) ? document.activeElement.dataset.personId : undefined;
    content?.remove(); content = null;
    populate();
    if (focused) (content?.querySelector('[data-person-id="'+CSS.escape(focused)+'"]') || summary).focus({preventScroll:true});
  }
  update(group);
  return {card, update};
}

export function mountTaskBoard(list, focusPerson) {
  const cards = new Map();
  let tasks = [], snapshot = {};
  const filters = mountDutyFilters(list,'按任务状态筛选',[['all','全部'],['active','待办'],['closed','已结束']],render);
  const empty = el('p','duty-empty');
  list.after(empty);
  function render() {
    const active = tasks.filter(t => !t.state.done).length;
    filters.update({all:tasks.length, active, closed:tasks.length-active});
    const keys = new Set(tasks.map(t => t.key));
    for (const [key,item] of cards) if (!keys.has(key)) { item.card.remove(); cards.delete(key); }
    let visible = 0;
    tasks.forEach((group,index) => {
      let item = cards.get(group.key);
      if (item) item.update(group);
      else { item = taskCard(group,focusPerson); cards.set(group.key,item); }
      const next = list.children[index] || null;
      if (item.card !== next) {
        if (list.moveBefore && item.card.isConnected) list.moveBefore(item.card,next);
        else list.insertBefore(item.card,next);
      }
      item.card.hidden = (filters.scope === 'active' && group.state.done) || (filters.scope === 'closed' && !group.state.done);
      if (!item.card.hidden) visible++;
    });
    empty.hidden = visible > 0;
    empty.textContent = snapshot.inboxError || snapshot.receiptError ? '任务暂未完整刷新' : snapshot.inboxLoading ? '正在读取任务…'
      : filters.scope === 'closed' ? '暂无已结束任务' : filters.scope === 'active' ? '暂无待办' : '暂无任务';
  }
  return {update(next) { snapshot = next; tasks = officeTaskGroups(next); render(); }};
}
