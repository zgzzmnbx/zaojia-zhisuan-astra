// Read-only task presentation for the office. Review selection belongs to the host.
import {icon} from '../astra_ui/icons.js';
const completed = new Set([
  '已通过',
  '已完成',
  '已退回',
  '已取消',
  'completed',
  'approved',
  'rejected',
  'returned',
  'cancelled',
  'canceled',
]);
const labels = {
  in_progress: '审核中',
  review: '待复核',
  queued: '待处理',
  completed: '已完成',
  approved: '已通过',
  rejected: '已退回',
  cancelled: '已取消',
  canceled: '已取消',
};
export function taskState(task) {
  const parts = String(task.status || '').split(' · ');
  const platform = task.platformLabel ?? (parts.length >= 3 ? parts[0] : '');
  const person = task.personStatus || (parts.length >= 3 ? parts[1] : parts[0]);
  const round = task.roundStatus || (parts.length >= 3 ? parts[2] : '');
  const raw = ['已取消', 'cancelled', 'canceled'].includes(round) ? round : person;
  const label = labels[raw] || raw || '状态待更新';
  const done = completed.has(raw);
  const tone = /退回|拒绝/.test(label)
    ? 'returned'
    : done
      ? 'closed'
      : /审核中|进行中|处理中/.test(label)
        ? 'working'
        : 'pending';
  return {label, platform, done, tone};
}
// Preserve the earlier office's six sample assignments by identity across directory reordering.
const legacyCases = [
  ['石萌', '某支线工程', '控制价复核', '待复核'],
  ['刘君', '某站场改造', '结算复核', '审核中'],
  ['安冉', '某研发基地', '勘察测量复核', '审核中'],
  ['康亚光', '某数字化项目', '投资复核', '待复核'],
  ['李洪全', '某支线工程', '控制价复核', '审核中'],
  ['王军', '某站场改造', '结算复核', '审核中'],
];
const surveyCases = [
  ['鹿学文','dehua-scope','德化—大田—永安支线','核对调整后的勘察范围','审核中','对照范围调整确认函和技术要求，列出新增、取消的测段。'],
  ['鹿学文','dehua-price','德化—大田—永安支线','复算范围调整后的投标限价','待复核','将确认后的工作量带回控制价计算表，核对调整前后差额。'],
  ['李洪全','tongliang-sections','铜梁江津—遵义—贵阳','核对两标段分界工程量','审核中','对照标段划分表和两份控制价计算表，检查交界处漏计、重复计量。'],
  ['李雨霏','heihe-measurement','黑河—大庆','校对测量工作量与控制价表','审核中','将测量专业工作量测算表与控制价计算表逐项核对，标记计量单位差异。'],
  ['陈希','daqing-survey','大庆—长岭','复核可研勘察工作量','待复核','按采购技术要求核对勘察工作量表，并检查勘察与测量两张表的工作范围。'],
];
export function officeExamples(employees) {
  const matches = name => employees.filter(p => p.name === name || p.accounts?.some(a => a.name === name));
  const examples = [];
  for (const [name,projectName,action,status] of legacyCases) {
    const people = matches(name);
    if (people.length === 1) examples.push({id:'sample:'+people[0].id,employeeId:people[0].id,projectName,title:projectName+action,status,demo:true,example:'legacy'});
  }
  for (const [name,key,project,action,status,description] of surveyCases) {
    const people = matches(name);
    if (people.length === 1) examples.push({id:'survey:'+key,employeeId:people[0].id,projectName:project,title:project+' · '+action,status,description,demo:true,example:'survey'});
  }
  return examples;
}
export function taskPriority(task) {
  if (!task || taskState(task).done) return task ? 4 : 5;
  if (!task.demo) return 0;
  return task.example === 'legacy' ? 3 : task.example === 'survey' ? 2 : 1;
}
export function indexPersonTasks(snapshot) {
  const people = new Map(), seen = new Set();
  const receiptKey=t=>JSON.stringify([t.dispatchId,t.employeeId]);
  const inbox=new Map((snapshot.pendingTasks || []).map(t=>[receiptKey(t),t]));
  for (const original of [...snapshot.tasks,...inbox.values()]) {
    let task=original;
    if (task.dispatchId) {
      const key=receiptKey(task);
      if (seen.has(key)) continue;
      seen.add(key);
      const latest=inbox.get(key);
      if (latest&&latest!==task) {
        if (task.reviewRound && latest.reviewRound>task.reviewRound) task=latest;
        else task={...task,reviewRound:task.reviewRound??latest.reviewRound,createdAt:task.createdAt||latest.createdAt,projectName:task.projectName||latest.projectName};
      }
    }
    if (!people.has(task.employeeId)) people.set(task.employeeId,[]);
    people.get(task.employeeId).push(task);
  }
  for (const tasks of people.values()) tasks.sort((a,b)=>taskPriority(a)-taskPriority(b));
  return people;
}
export const exampleLabel = task => task.example ? '示例' : '演示';
export function displayTitle(title) {
  const original = String(title || '');
  return original.replace(/^(?:【(?:项目例子|测试输入)】\s*)+/u,'').replaceAll('【演示】',' ').trim() || original;
}
export function dutyCountLabel(live) {
  return live.length ? `${live.length} 项待办` : '';
}
export function emptyDutyLabel(snapshot) {
  return snapshot.inboxError || snapshot.receiptError ? '待办暂未刷新' : snapshot.inboxLoading ? '正在读取待办…' : '暂无待办';
}
const node = (tag, cls = '', text = '') => {
  const n = document.createElement(tag);
  n.className = cls;
  n.textContent = text;
  return n;
};
function tag(label, tone) {
  const n = node('span', 'duty-tag', label);
  n.dataset.tone = tone;
  return n;
}
export {node as dutyElement, tag as dutyTag};
export function personTaskSummary(tasks) {
  const live = tasks.filter((t) => !taskState(t).done);
  const current = live.find((t) => !t.demo) ?? live[0];
  return {live, current, latest: current ?? tasks[0]};
}
export function mountDutyFilters(list, label, options, refresh) {
  const group = node('div', 'duty-filters');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', label);
  const buttons = new Map();
  let scope = options[0][0];
  for (const [id, name] of options) {
    const button = node('button', 'btn btn-ghost btn-xs', name);
    button.type = 'button';
    button.dataset.scope = id;
    button.onclick = () => { scope = id; refresh(); };
    group.append(button);
    buttons.set(id, button);
  }
  list.before(group);
  return {
    get scope() { return scope; },
    update(counts) {
      for (const [id, name] of options) {
        const button = buttons.get(id);
        button.setAttribute('aria-pressed', String(scope === id));
        button.textContent = counts[id] == null ? name : name + ' ' + counts[id];
      }
    },
    remove() { group.remove(); },
  };
}

export function directoryWork(person, tasks, scope, query) {
  const {live, current} = personTaskSummary(tasks);
  const examples = tasks.filter(t => t.demo);
  const pool = scope === 'demo' ? examples : tasks;
  const includes = value => String(value || '').toLocaleLowerCase().includes(query);
  const profileMatch = !query || [person.name, person.seatId, person.trade, person.expertise].some(includes);
  const matched = profileMatch ? pool : pool.filter(t => [t.projectName, t.title, taskState(t).label].some(includes));
  const shown = scope === 'demo' || !profileMatch ? personTaskSummary(matched).latest : current;
  const project = displayTitle(shown?.projectName?.trim());
  const title = displayTitle(shown?.title);
  const action = project && title.startsWith(project) ? title.slice(project.length).replace(/^[\s·：:]+/u, '') : title;
  return {person, live, examples, shown, project:project || title, action:project ? action : '',
    closed:tasks.length-live.length, matches:profileMatch || matched.length>0};
}

export function mountPeopleDirectory(list, {select, bindDrag, assign, toggle, pickForReview}) {
  const rows = new Map();
  let snapshot, selectedId;
  const search = node('label','directory-search');
  search.innerHTML = icon('magnifying-glass');
  const input = node('input');
  input.type = 'search'; input.placeholder = '搜姓名、项目或专长';
  input.setAttribute('aria-label','搜索姓名、项目、任务、工位或专长');
  input.addEventListener('input',render);
  search.append(input); list.before(search);
  const filters = mountDutyFilters(list, '筛选人员', [['all','全部'], ['active','有待办'], ['idle','无待办'], ['demo','演示']], render);
  const empty = document.getElementById('people-empty');

  function makeRow(id) {
    const card = node('article','directory-card');
    const button = node('button','btn btn-ghost host-person-row');
    button.type = 'button';
    button.dataset.personId = id;
    const initial = node('span','duty-avatar');
    initial.setAttribute('aria-hidden','true');
    const name = node('strong'), state = tag('', 'pending'), source = tag('', 'demo');
    const identity = node('span','duty-line');
    identity.append(name, state, source);
    const title = node('span','duty-title'), action = node('span','directory-task-action');
    const seat = node('span'), count = node('span'), meta = node('small','duty-extra');
    meta.append(count,seat);
    const skills = node('span','directory-skills');
    const body = node('span','duty-body');
    body.append(identity,meta);
    const grip = node('span','host-drag-grip');
    grip.title = '拖动同事';
    grip.setAttribute('aria-hidden','true');
    button.append(initial, body, grip, title, action, skills);
    button.setAttribute('aria-controls','person-detail-pane');
    button.onclick = () => select(id,button);
    bindDrag(button, id);
    const actions = node('div','directory-actions');
    const add = node('button','btn btn-ghost btn-xs directory-assign');
    add.type='button'; add.innerHTML=icon('plus'); add.append('分配任务');
    add.onclick=()=>assign(id);
    const review = node('button','btn btn-ghost btn-xs directory-review');
    review.type='button';
    review.onclick=()=>{
      if(snapshot.managedHub){pickForReview(id);return;}
      const person=snapshot.employees.find(p=>p.id===id);
      if(person?.draggable)toggle(id,!person.selected);
    };
    actions.append(add,review); card.append(button,actions);
    return {card, button, initial, name, state, source, title, action, skills, count, seat, grip, add, review};
  }

  function render() {
    if (!snapshot) return;
    const query = input.value.trim().toLocaleLowerCase();
    const profiles = snapshot.employees.map(person => directoryWork(person,snapshot.personTasks?.get(person.id) || [],filters.scope,query));
    const incomplete = snapshot.inboxLoading || snapshot.inboxError || snapshot.receiptError;
    const ids = new Set(profiles.map(p => p.person.id));
    for (const [id, row] of rows) if (!ids.has(id)) { row.card.remove(); rows.delete(id); }
    const active = profiles.filter(p => p.live.length).length;
    filters.update({all:profiles.length, active, idle:incomplete ? null : profiles.length-active});
    const focus = list.contains(document.activeElement) ? document.activeElement : null;
    let visible = 0;
    profiles.sort((a,b) => Number(!a.live.length)-Number(!b.live.length) || taskPriority(a.shown)-taskPriority(b.shown));
    profiles.forEach(({person, live, closed, shown, examples, project, action, matches}, index) => {
      if (!rows.has(person.id)) rows.set(person.id, makeRow(person.id));
      const row = rows.get(person.id), button = row.button;
      row.initial.textContent = Array.from((person.name || '').trim())[0] || '·';
      row.name.textContent = person.name;
      const status = shown && taskState(shown);
      row.state.dataset.tone = status?.tone || 'closed';
      row.state.textContent = status?.label || emptyDutyLabel(snapshot);
      row.source.textContent = status?.platform || (shown?.demo ? exampleLabel(shown) : shown?.manual ? '自建' : shown?.adjusted ? '沙盘已调整' : '');
      row.source.hidden = !row.source.textContent;
      row.title.textContent = project; row.title.title=project; row.title.hidden=!project;
      row.action.textContent=action; row.action.title=action; row.action.hidden=!action;
      const skills=[...new Set([person.trade,person.expertise].filter(Boolean))].join(' · ');
      row.skills.textContent=skills; row.skills.title=skills; row.skills.hidden=!skills;
      row.count.textContent = live.length ? dutyCountLabel(live) : closed ? closed + ' 项已结束' : '';
      row.count.hidden = !row.count.textContent;
      row.seat.textContent=person.seatId ? '工位 '+person.seatId.replace(/^SEAT_/,'') : ''; row.seat.hidden=!row.seat.textContent;
      button.draggable = !!person.draggable;
      row.grip.hidden = !button.draggable;
      button.dataset.idle = String(!live.length);
      row.card.classList.toggle('is-chosen', !!person.selected);
      button.setAttribute('aria-pressed', String(person.id === selectedId));
      row.add.setAttribute('aria-label','给'+person.name+'分配任务');
      const pool=person.demoAssignment?'演示复核':'本次复核';
      row.review.textContent=person.selected?'已选入':person.demoAssignment?'选入演示':'选入复核';
      row.review.dataset.selected=String(!!person.selected);
      row.review.setAttribute('aria-label',row.review.textContent+'，'+person.name+'，'+(person.selected?'从'+pool+'移除':'加入'+pool));
      row.review.disabled=!person.draggable;
      row.review.title=row.review.disabled?'请在左侧复核卡选择可用成果和平台':person.selected?'再次点击可移出'+pool:'加入'+pool;
      if(snapshot.managedHub){
        const channels=(snapshot.channels||[]).filter(c=>c.members.some(m=>m.id===person.id&&m.selected));
        row.review.textContent=channels.length?channels.map(c=>c.label).join(' / ')+' 已选':'选择复核平台';
        row.review.dataset.selected=String(channels.length>0);
        row.review.disabled=!snapshot.enabled;
        row.review.title=row.review.disabled?'当前尚无可复核成果':'选择这位同事，再点击右侧平台';
        row.review.setAttribute('aria-label','为'+person.name+'选择复核平台');
      }
      row.card.hidden = !matches || (filters.scope === 'active' && !live.length) || (filters.scope === 'idle' && (incomplete || !!live.length)) || (filters.scope === 'demo' && !examples.length);
      if (!row.card.hidden) visible++;
      const next = list.children[index] || null;
      if (next !== row.card) {
        if (list.moveBefore && row.card.isConnected) list.moveBefore(row.card,next);
        else list.insertBefore(row.card,next);
      }
    });
    if (focus?.isConnected && !focus.closest('[hidden]') && document.activeElement !== focus) focus.focus({preventScroll:true});
    empty.hidden = visible > 0;
    empty.textContent = query ? '没有匹配的人员或任务' : filters.scope === 'idle' ? incomplete ? emptyDutyLabel(snapshot) : '所有同事都有待办' : filters.scope === 'active' ? emptyDutyLabel(snapshot) : filters.scope === 'demo' ? '暂无演示任务' : '暂无人员记录';
  }
  return {
    update(next,id) { snapshot = next; selectedId = id; render(); },
    dispose() { filters.remove(); search.remove(); rows.clear(); list.replaceChildren(); },
  };
}
