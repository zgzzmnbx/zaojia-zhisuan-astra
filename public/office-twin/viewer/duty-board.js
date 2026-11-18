// Read-only presentation of the current result and its individual reviewer receipts.
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
const samples = [
  '某支线工程控制价复核',
  '某站场改造结算复核',
  '某研发基地勘察测量复核',
  '某数字化项目投资复核',
];
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
    if (latest?.demo) flags.append(tag('演示', 'demo'));
    if (person.selected) flags.append(tag('已选', 'selected'));
    const text = latest?.title || (snapshot.receiptError ? '任务状态待刷新' : '当前成果暂无任务');
    const line = node('span', 'duty-title', text);
    line.title = text;
    const who = node('span', 'duty-line');
    who.append(name, flags);
    body.append(who, line);
    if (live.length > 1)
      body.append(node('small', 'duty-extra', '另有 ' + (live.length - 1) + ' 项待办'));
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
      if (task.demo) meta.append(tag('演示', 'demo'));
      d.append(node('strong', '', task.title), meta);
      if (task.artifactName && task.artifactName !== task.title) d.append(node('p', '', task.artifactName));
      if (task.comment) d.append(node('p', '', task.comment));
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
    const profiles = snapshot.employees.map((person, index) => {
      let tasks = snapshot.tasks.filter((t) => t.employeeId === person.id && (scope !== 'demo' || t.demo));
      if (scope === 'demo' && !tasks.length && index < samples.length)
        tasks = [{title: samples[index], status: index % 2 ? '待复核' : '审核中', demo: true}];
      return {person, tasks, ...personTaskSummary(tasks)};
    });
    const active = snapshot.employees.filter((p) =>
      snapshot.tasks.some((t) => t.employeeId === p.id && !taskState(t).done),
    ).length;
    controls.get('all').textContent = '全部 ' + profiles.length;
    controls.get('active').textContent = '有任务 ' + active;
    for (const [key, b] of controls) b.setAttribute('aria-pressed', String(key === scope));
    const shown = profiles
      .filter((p) => scope === 'all' || (scope === 'demo' ? p.tasks.length : p.live.length))
      .sort(
        (a, b) =>
          Number(!!b.live.length) - Number(!!a.live.length) || Number(!!b.latest) - Number(!!a.latest),
      );
    const assigned = shown.filter((p) => p.latest),
      unassigned = shown.filter((p) => !p.latest);
    list.replaceChildren(...assigned.map(row));
    if (unassigned.length) {
      const group = node('section', 'duty-quiet'),
        label = node('h4', '', snapshot.receiptError ? '状态待刷新' : '暂无任务');
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
          snapshot.receiptError
            ? '任务状态暂未刷新'
            : scope === 'active'
              ? '当前成果暂无进行中的任务'
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
