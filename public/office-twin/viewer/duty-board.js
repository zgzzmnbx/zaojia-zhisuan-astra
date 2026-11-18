// Read-only task presentation for the office. Review selection belongs to the host.
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
  ['石萌', '某支线工程控制价复核', '待复核'],
  ['刘君', '某站场改造结算复核', '审核中'],
  ['安冉', '某研发基地勘察测量复核', '审核中'],
  ['康亚光', '某数字化项目投资复核', '待复核'],
  ['李洪全', '某支线工程控制价复核', '审核中'],
  ['王军', '某站场改造结算复核', '审核中'],
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
  for (const [name,title,status] of legacyCases) {
    const people = matches(name);
    if (people.length === 1) examples.push({id:'sample:'+people[0].id,employeeId:people[0].id,title,status,demo:true,example:'legacy'});
  }
  for (const [name,key,project,action,status,description] of surveyCases) {
    const people = matches(name);
    if (people.length === 1) examples.push({id:'survey:'+key,employeeId:people[0].id,title:project+' · '+action,status,description,demo:true,example:'survey'});
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
export function dutyCountLabel(live) {
  const real = live.filter(t=>!t.demo).length, examples = live.length-real;
  return [real && `${real} 项待办`,examples && `${examples} 项示例`].filter(Boolean).join(' · ');
}
export function emptyDutyLabel(snapshot) {
  return snapshot.inboxError || snapshot.receiptError ? '待办暂未刷新' : snapshot.inboxLoading ? '正在读取待办…' : '暂无待办';
}
const node = (tag, cls, text = '') => {
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
export function personTaskSummary(tasks) {
  const live = tasks.filter((t) => !taskState(t).done);
  const current = live.find((t) => !t.demo) ?? live[0];
  return {live, current, latest: current ?? tasks[0]};
}
export function mountDutyBoard(list) {
  const head = node('div', 'duty-heading'),
    title = node('h3', '', '人员任务'),
    filters = node('div', 'duty-filters');
  const controls = new Map(),
    expanded = new Set();
  let scope = 'all',
    snapshot = null;
  head.append(title);
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', '按任务筛选人员');
  list.before(head, filters);
  for (const [key, label] of [
    ['all', '全部'],
    ['active', '有任务'],
    ['demo', '演示'],
  ]) {
    const button = node('button', 'btn btn-ghost btn-xs', label);
    button.type = 'button';
    button.dataset.scope = key;
    button.onclick = () => {
      scope = key;
      render();
    };
    filters.append(button);
    controls.set(key, button);
  }
  function row({person, tasks, live, latest}) {
    const article = node('article', 'duty-person'),
      button = node('button', 'duty-main'),
      avatar = node('span', 'duty-avatar', Array.from(person.name)[0] || '·');
    const body = node('span', 'duty-body'),
      name = node('strong', 'duty-name', person.name);
    const state = latest ? taskState(latest) : null,
      flags = node('span', 'duty-flags');
    if (state) flags.append(tag(state.label, state.tone));
    if (latest?.demo) flags.append(tag(exampleLabel(latest), 'demo'));
    else if(latest?.manual || latest?.adjusted)flags.append(tag(latest.manual?'自建':'沙盘已调整','demo'));
    if (person.selected) flags.append(tag('已选', 'selected'));
    const text = latest?.title || emptyDutyLabel(snapshot);
    const line = node('span', 'duty-title', text);
    line.title = text;
    const who = node('span', 'duty-line');
    who.append(name, flags);
    body.append(who, line);
    if (live.length > 1)
      body.append(node('small', 'duty-extra', dutyCountLabel(live)));
    article.dataset.personId = person.id;
    article.dataset.idle = String(!latest);
    button.type = 'button';
    button.append(avatar, body);
    article.append(button);
    const details = node('div', 'duty-details');
    for (const task of tasks) {
      const d = node('div', 'duty-item'),
        s = taskState(task),
        meta = node('span', 'duty-item-meta');
      meta.append(tag(s.label, s.tone));
      if (s.platform) meta.append(node('small', '', s.platform));
      if (task.demo) meta.append(tag(exampleLabel(task), 'demo'));
      else if(task.manual || task.adjusted)meta.append(tag(task.manual?'自建':'沙盘已调整','demo'));
      d.append(node('strong', '', task.title), meta);
      if (task.artifactName && task.artifactName !== task.title) d.append(node('p', '', task.artifactName));
      if (task.comment) d.append(node('p', '', task.comment));
      if (task.adjusted && task.dispatchId) d.append(node('p','',`原始复核 · ${task.originalStatus} · ${task.originalTitle}`));
      if (task.description) d.append(node('p', '', task.description));
      details.append(d);
    }
    const locate = node('button', 'btn btn-ghost btn-sm duty-locate', '定位同事');
    locate.type = 'button';
    locate.onclick = () => {
      if (!window.officeTwin?.focusPerson(person.id)) locate.textContent = '暂无可定位工位';
    };
    details.append(locate);
    article.append(details);
    function disclose(open) {
      button.setAttribute('aria-expanded', String(open));
      details.hidden = !open;
    }
    disclose(expanded.has(person.id));
    button.onclick = () => {
      if (expanded.has(person.id)) expanded.delete(person.id);
      else expanded.add(person.id);
      disclose(expanded.has(person.id));
    };
    return article;
  }
  function render() {
    if (!snapshot) return;
    const previous = list.contains(document.activeElement)
      ? document.activeElement.closest('article')?.dataset.personId
      : null;
    const onLocate = document.activeElement.classList.contains('duty-locate');
    const profiles = snapshot.employees.map(person => {
      const all = snapshot.personTasks?.get(person.id) || [];
      const tasks = scope === 'demo' ? all.filter(t=>t.demo) : all;
      return {person, tasks, ...personTaskSummary(tasks)};
    });
    const active = snapshot.employees.filter((p) =>
      snapshot.personTasks?.get(p.id)?.some(t => !taskState(t).done),
    ).length;
    controls.get('all').textContent = '全部 ' + profiles.length;
    controls.get('active').textContent = '有任务 ' + active;
    for (const [key, b] of controls) b.setAttribute('aria-pressed', String(key === scope));
    const shown = profiles
      .filter((p) => scope === 'all' || (scope === 'demo' ? p.tasks.length : p.live.length))
      .sort((a,b)=>taskPriority(a.latest)-taskPriority(b.latest));
    const assigned = shown.filter((p) => p.latest),
      unassigned = shown.filter((p) => !p.latest);
    list.replaceChildren(...assigned.map(row));
    if (unassigned.length) {
      const group = node('section', 'duty-quiet'),
        label = node('h4', '', emptyDutyLabel(snapshot));
      label.append(node('span', '', String(unassigned.length)));
      group.append(label);
      const grid = node('div', 'duty-quiet-grid');
      grid.append(...unassigned.map(row));
      group.append(grid);
      list.append(group);
    }
    if (!shown.length)
      list.append(
        node(
          'p',
          'duty-empty',
          snapshot.receiptError || snapshot.inboxError
            ? '任务状态暂未刷新'
            : scope === 'active'
              ? emptyDutyLabel(snapshot)
              : scope === 'demo'
                ? '暂无演示任务'
                : snapshot.title === '正在读取当前成果' ? '正在读取人员与任务…' : '暂无人员记录',
        ),
      );
    if (previous) {
      const same = [...list.querySelectorAll('article')].find((n) => n.dataset.personId === previous);
      same?.querySelector(onLocate ? '.duty-locate' : '.duty-main')?.focus({preventScroll: true});
    }
  }
  return {
    update(next) {
      if (snapshot?.context !== next.context) expanded.clear();
      snapshot = next;
      render();
    },
  };
}
