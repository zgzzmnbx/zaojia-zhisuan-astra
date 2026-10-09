import './style.css';
import './astra.css';
import { icon, paintIcons } from './icons.js';
import { agents, tools, rows as initialRows, routePrompt, escapeHtml as esc, validNumber, allowedAction } from './core.js';
import { panels } from './panels.js';
import { mountGorks } from './gork.js';

const $ = selector => document.querySelector(selector);
const state = { view: 'universe', scene:'home', rows: structuredClone(initialRows), reviews:new Set(), messages:[], draft:'', sheet:'通用工程测量', filter:false, selected:18, attachment:null, mode:'AI 增强', pending:null, disposed3d:null, renderVersion:0, dark:false, memoryStatus:'待确认', revision:1 };
const names = Object.fromEntries(tools.map(t => [t[0],t[2]]));
Object.assign(names,{table:'控制价计算表',risk:'风险与人工复核',report:'风险报告',sources:'计价依据与来源',universe:'项目星图',mapping:'表格结构与列映射'});
const badge = (text,kind='ghost') => `<span class="badge badge-${kind}">${text}</span>`;
const btn = (text,attrs='',kind='outline',glyph='') => { const classes=attrs.match(/class="([^"]*)"/)?.[1]||'';return `<button class="btn btn-${kind} ${classes}" ${attrs.replace(/class="[^"]*"/,'')}>${glyph?icon(glyph):''}${text}</button>`; };
const notice = text => `<div class="notice">${icon('info')}<span>${text}</span></div>`;
const field = (name,content) => `<label class="field">${name}${content}</label>`;
const select = (label,options,extra='') => `<select class="select" aria-label="${label}" ${extra}>${options.map(v=>`<option>${v}</option>`).join('')}</select>`;
function pendingCount(){return state.rows.filter(r=>r.kind!=='standard'&&!state.reviews.has(r.id)).length;}
function toast(text){const el=$('#toast');el.innerHTML=`<div class="alert">${icon('info')}<span>${esc(text)}</span></div>`;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,4300);}
function modal(title,body){$('#dialog-title').textContent=title;$('#dialog-content').innerHTML=body;paintIcons($('#dialog'));$('#dialog').showModal();}
function closeModal(){$('#dialog').close();}
function userMessage(text,attachment=''){return `<div class="chat chat-end"><div class="chat-bubble">${esc(text)}${attachment?`<div class="file-chip">${icon('sheet')}<div><strong>${esc(attachment)}</strong><small>仅本地文件名预览 · 未上传</small></div></div>`:''}</div></div>`;}
function assistantMessage(html){return `<article class="assistant-message"><div class="assistant-author"><span class="agent-symbol gork-message-avatar"><canvas data-gork="idle" width="32" height="32" aria-label="Gork，Astra 的化身"></canvas></span>Astra<small>造价工程师</small></div><div class="assistant-copy">${html}</div></article>`;}
function addMessages(user,html){state.messages.push(userMessage(user),assistantMessage(html));renderMessages(true);}
function renderMessages(scroll=false){$('#messages').innerHTML=state.messages.join('');paintIcons($('#messages'));mountGorks();if(scroll)$('#messages').scrollTop=$('#messages').scrollHeight;}
function reviewCard(){return `<div class="task-card"><div class="task-card-head"><span>${icon('route')}控制价编制计划</span>${badge('示例回放')}</div><div class="task-steps"><div class="task-step">${icon('circlecheck')}识别表格与专业字段<small>12 条示例</small></div><div class="task-step">${icon('circlecheck')}匹配基价与双系数<small>可信资产</small></div><div class="task-step waiting">${icon('clock')}确认疑难项与风险<small>${pendingCount()} 项待复核</small></div><div class="task-step waiting">${icon('file')}形成 Excel 与 Word 成果<small>待复核后</small></div></div><div class="task-card-foot"><span>当前停在人工确认，不自动采纳推断。</span>${btn('打开计算表','data-view="table"','ghost','arrow-up-right')}</div></div>`;}
function setScene(scene){state.scene=scene;state.messages=[];document.querySelectorAll('[data-scene]').forEach(el=>el.classList.toggle('active',el.dataset.scene===scene));$('#workbench').classList.remove('expanded');
  $('.conversation').classList.toggle('home-scene',scene==='home');
  if(scene==='home'){
    $('#conversation-title').textContent='从一个目标，开始协作';$('#context-line').innerHTML=`<span class="badge skill-badge">${icon('spark')}造价工程师</span><span>勘察测量专业 · UI 原型</span>`;
    state.messages=[`<div class="welcome"><div class="gork-welcome"><canvas data-gork="idle" width="90" height="90" aria-label="Gork 欢迎你"></canvas><span>我是智算，随时待命。<small>Gork · 你的 Astra 化身</small></span></div><div class="welcome-kicker"><span class="status-dot"></span>ASTRA WORKSPACE <span>01 / 造价</span></div><h1>把复杂的造价工作，<br><span>交给一次对话。</span></h1><p>带上你的资料，说出要完成的事。<br>我会组织专业工具，把每一步依据和成果留给你。</p><div class="welcome-grid">${[['sheet','编制控制价','从 Excel 到可复核的成果','review'],['shield','审核结算','核对规则，保留问题依据','settlement'],['book','查找计价依据','连接知识、标准与经验','knowledge'],['columns','提取工作量','让源表和目标表准确对应','workload']].map(([i,t,d,s])=>`<button class="welcome-card" data-scene="${s}">${icon(i)}<strong>${t}${icon('arrow-up-right')}</strong><small>${d}</small></button>`).join('')}</div><div class="welcome-foot">${icon('shield')}由专业规则约束 · 关键决策由你确认</div><div class="welcome-path"><span>01 说出目标</span><i></i><span>02 协作执行</span><i></i><span>03 交付成果</span></div></div>`];
    showView('universe');$('#suggestions').innerHTML=btn('体验一次完整编制','data-scene="review"','ghost','arrow-up-right')+btn('浏览全部能力','data-action="catalog"','ghost','grid');
  }else if(scene==='new'){
    $('#conversation-title').textContent='新建任务';$('#context-line').innerHTML=`<span class="badge skill-badge">${icon('spark')}勘察测量</span><span>等待输入资料</span>`;
    state.messages=[assistantMessage(`<h3>这次，我们要完成什么？</h3><p class="muted">选择一份 Excel，或先描述目标。我会把执行计划和需要你确认的信息放在这里。</p><div class="action-row">${btn('添加 Excel','data-action="attach"','primary','plus')}${btn('使用演示任务','data-scene="review"','outline','arrow-right')}</div>`)];hideArtifact();
  }else{
    $('#conversation-title').textContent=scene==='review'?'最高投标限价编制':(names[scene]||'专业任务');$('#context-line').innerHTML=`<span class="badge skill-badge">${icon('spark')}勘察测量</span><span>任务 ZS-026 · 示例</span><button data-view="trace" class="text-button">查看轨迹${icon('arrow-right')}</button>`;
    if(scene==='review'){
      state.messages=[`<div class="day-label">今天 · 示例任务</div>`,userMessage('帮我编制这份勘察测量控制价，检查风险，并准备可交付的报告。','西部管道-勘察测量控制价.xlsx'),assistantMessage(`<p>好的。我会按<strong>勘察测量</strong>专业能力处理，先核对表格，再匹配价格与系数。需要判断的内容会留给你确认。</p>${reviewCard()}<div class="review-callout"><strong>${pendingCount()} 个地方，需要你的专业判断</strong><p>第 18 行为经验提示；第 22 行缺少适用条件；第 23 行的技术系数需要核实。可以逐项查看来源。</p></div><div class="action-row">${btn('开始复核','data-view="risk"','primary','shield')}${btn('查看匹配依据','data-view="sources"','outline')}</div>`)];showView('table');
    }else {state.messages=[userMessage(({report:'准备风险报告与交付文件',knowledge:'帮我查找这项工作的计价依据',settlement:'检查这份送审结算',workload:'从原始资料中抓取工作量'})[scene]||`打开${names[scene]}`),assistantMessage(responseFor(scene))];showView(scene);}
    $('#suggestions').innerHTML=btn('查看待复核项','data-prompt="查看待复核项"','ghost','arrow-up-right')+btn('生成风险报告','data-prompt="生成风险报告"','ghost','arrow-up-right')+btn('更多操作','data-action="catalog"','ghost','dots');
  }renderMessages();paintIcons();}
function responseFor(view){const answers={table:'计算表已在右侧展开。点击任意一行可以查看该行的价格、双系数和来源；也可以把这行带入对话。',risk:'这份示例中有 3 项需要复核。我会分别展示基价、实物系数和技术系数的来源，等待你的明确选择。',report:'右侧是风险报告版式预览。仍有待复核项时，报告会如实保留问题，不会把待确认内容写成定论。',knowledge:'可以选择原知识库问答、WeKnora 增强或对比输出。引用和原文片段与回答放在一起，方便核对。',workload:'工作量抓取是独立预处理。请分别确认源表、目标表和字段映射，之后再进入填价任务。',settlement:'结算审核以送审文件和可信规则为基础。右侧保留问题定位、人工复核与审核表 / 报告双成果入口。',collaboration:'先准备复核范围、成果版本和受众，再确认发送。当前仅演示协同设置，没有连接飞书或 WeAct。',memory:'知识记忆需要区分通用、项目和任务范围。候选经确认后才可作为依据，项目价格与系数始终保留人工审核。',universe:'这是同一项目的任务星图。拖动可旋转视角，点击节点或下方按钮可以打开相应成果。星图使用示例关系，不代表实际地理数据。'};return `<p>${answers[view]||`${names[view]||'专业信息'}已在右侧展开，可继续在对话中发出任务。`}</p><button class="artifact-link" data-view="${view}">${icon(tools.find(t=>t[0]===view)?.[1]||'file')}<span><strong>${names[view]||'专业信息'}</strong><small>同一任务 · 示例工作区</small></span>${icon('arrow-up-right')}</button>`;}
function hideArtifact(){$('#workbench').classList.add('no-artifact');$('#workbench').classList.remove('expanded');$('#reopen').hidden=false;state.disposed3d?.();state.disposed3d=null;}
async function showView(view){
  if(view==='settings'){settings();return;}if(view==='skills'){skills();return;}
  state.disposed3d?.();state.disposed3d=null;const renderVersion=++state.renderVersion;state.view=view;
  $('#workbench').classList.remove('no-artifact');$('#reopen').hidden=true;$('#shell').classList.remove('sidebar-open');$('#artifact-title').textContent=names[view]||'专业工作区';$('#artifact-subtitle').textContent=view==='universe'?'一个空间，连接任务、知识与成果':'西部管道 · ZS-026 · 示例工作区';
  $('.artifact-tabs').hidden=!['table','risk','report','sources'].includes(view);document.querySelectorAll('.artifact-tabs .tab').forEach(el=>{el.classList.toggle('tab-active',el.dataset.view===view);el.setAttribute('aria-selected',String(el.dataset.view===view));});$('#risk-count').textContent=pendingCount();
  const ctx={state,esc,icon,btn,badge,notice,field,select,pendingCount};
  $('#artifact-body').innerHTML=panels[view]?panels[view](ctx):`<div class="panel-content">${notice('该工作区尚未加入原型。')}</div>`;
  paintIcons($('#artifact-body'));
  if(view==='universe'){
    try{const module=await import('./universe.js');if(renderVersion!==state.renderVersion||$('#workbench').classList.contains('no-artifact'))return;state.disposed3d=module.mountUniverse($('#universe-canvas'),v=>{showView(v);addMessages(`打开${names[v]}`,responseFor(v));});}
    catch(error){const el=$('#universe-canvas');if(el)el.innerHTML=`<div class="fallback-orbit"><div></div><span>ASTRA</span></div><p class="fallback-label">3D 不可用 · 下方节点仍可使用</p>`;}
  }
}
function catalog(){modal('所有专业能力，都在这里',`<p class="muted">选择一个工具，或直接在对话里说出需求。所有界面均为独立原型。</p><div class="tool-grid">${tools.map(([id,i,title,desc])=>`<button class="tool-tile" data-tool="${id}">${icon(i)}<strong>${title}</strong><small>${desc}</small></button>`).join('')}</div>`);}
function skills(){modal('选择你的专业智能体',`<p class="muted">一个工作室，承载不同专业。每个智能体绑定自己的工具、知识、规则和成果类型。</p>${agents.map(agent=>`<div class="agent-card"><span class="agent-symbol">${icon(agent.id==='cost'?'spark':agent.id==='document'?'file':'folder')}</span><div><h3>${agent.name}</h3><small>${agent.profession} · ${agent.id==='cost'?'专业能力 v1.0.0':'等待独立专业资料'}</small></div>${badge(agent.id==='cost'?'当前示例':'规划中',agent.id==='cost'?'success':'ghost')}</div>`).join('')}<div class="notice">${icon('info')}<span>当前仅造价工程师有交互原型。扩展智能体由独立配置注册；规划项不会创建业务任务。</span></div><details class="collapse collapse-arrow"><summary class="collapse-title">当前专业能力与冻结快照</summary><div class="collapse-content">survey-measurement-limit-price / v1.0.0<br>结构化计价库、规则资产、经验池、知识来源与报告模板属于同一任务快照。切换智能体仅作用于新任务。</div></details>`);}
function settings(){modal('工作室设置',`<div class="field-grid">${field('界面主题',select('界面主题',['石墨深色','专业浅色'],'id="setting-theme"'))}${field('执行模式',select('设置执行模式',['AI 增强','机械模式'],'id="setting-mode"'))}${field('表格预览行数',select('表格预览行数',['50 行','100 行','200 行']))}${field('知识问答路径',select('知识问答路径',['原知识库问答','WeKnora 增强','对比输出']))}</div>${['列映射与合并单元格','预警阈值与有效行过滤','模型连接与调用记录','报告模板与分页','协同平台与通知规则','任务与知识记忆范围'].map((t,i)=>`<details class="collapse collapse-arrow"><summary class="collapse-title">${t}</summary><div class="collapse-content">${['跨行合并：每行继承；跨列合并：仅首列有值。字段映射在每次任务中确认。','默认低风险 5%、高风险 20%；指定列为空、0 或公式结果为 0 时不纳入预警。','模型服务未连接。本原型不采集密钥，不产生模型调用。','保留正式 Word 模板和自动续页；本原型展示版式草稿。','飞书与 WeAct 分开配置，发送前确认受众；当前没有外部连接。','通用 / 项目 / 任务范围严格区分，项目身份完全匹配。候选确认、撤销和审计保持独立。'][i]}</div></details>`).join('')}<div class="action-row">${btn('关闭','data-action="close-dialog"')}${btn('应用预览设置','data-action="save-settings"','primary')}</div>`);$('#setting-theme').value=state.dark?'石墨深色':'专业浅色';$('#setting-mode').value=state.mode;}
function rowDetail(id){state.selected=id;const row=state.rows.find(r=>r.id===id);if(!row)return;modal(`第 ${id} 行 · ${row.name}`,`${notice('示例单价仅用于界面设计，不作为真实计价依据。')}<div class="review-meta"><span>${row.detail}</span><span>数量 ${row.quantity} ${row.unit}</span>${badge(row.kind==='standard'?'示例命中':'待复核',row.kind==='standard'?'success':'warning')}</div><div class="field-grid">${[['基价 / 单价','price'],['实物工作费调整系数','physical'],['技术工作费调整系数','technical']].map(([label,key])=>field(label,`<input class="input" aria-label="${label}" type="number" min="0" step="any" data-edit="${key}" value="${row[key]??''}" placeholder="待复核" />`)).join('')}</div><details open class="collapse collapse-arrow"><summary class="collapse-title">可信来源与确认口径</summary><div class="collapse-content">当前是设计示例。真实接入后，此处展示资产版本、命中行和规则说明。三个字段须分别核对；不因一项确认自动批准其余字段。</div></details><div class="action-row">${btn('带入对话',`data-context-row="${id}"`,'outline','message')}${btn('保存示例编辑',`data-save-row="${id}"`,'primary')}</div>`);}
function confirmRow(id){const row=state.rows.find(r=>r.id===id);state.selected=id;modal(`核对第 ${id} 行的来源`,`${notice('演示人工确认交互。此操作只改变当前原型内存，刷新即恢复。')}<h3>${row.name}</h3><p class="muted">逐个核实影响计价的字段，选择可信来源后才可确认。</p><div class="field-grid">${field('本次确认字段',select('本次确认字段',['基价 / 单价','实物工作费调整系数','技术工作费调整系数'],'id="confirm-field"'))}${field('来源选择',select('来源选择',['请选择来源','示例可信资产 A','保持待复核'],'id="confirm-source"'))}</div>${row.kind==='missing'?notice('本行适用条件不足，当前只能保留待复核或补充资料。'):''}<label class="check-line"><input type="checkbox" class="checkbox" id="ack-source" />我已核对该字段的来源与适用条件</label><div class="action-row">${btn('保留待复核','data-action="close-dialog"')}${btn('确认这一字段',`data-confirm-row="${id}"`,'primary')}</div>`);}
function downloadPreview(){const payload={type:'智算Astra-UI示例',warning:'此文件不是正式Excel或Word业务成果',task:'ZS-026',revision:state.revision,rows:state.rows};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='造价智算-示例成果数据.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出示例 JSON；正式 Excel / Word 导出待业务接入。');}
function beginConversation(){if(state.scene==='home'||state.scene==='new'){state.messages=[];state.scene='working';$('.conversation').classList.remove('home-scene');$('#conversation-title').textContent='与 Astra 协作';$('#context-line').innerHTML='<span class="badge skill-badge">勘察测量</span><span>当前对话 · UI 示例</span>';}}
function sendPrompt(text){const prompt=text.trim();if(!prompt)return;$('#prompt').value='';state.draft='';beginConversation();const view=routePrompt(prompt);if(!view){addMessages(prompt,`<p>当前是 UI 交互原型，我还没有连接模型。这句话尚未匹配到演示任务。</p><p class="muted">可以试试“查看待复核项”“打开计算表”“生成风险报告”或“打开项目星图”。</p>${btn('查看全部能力','data-action="catalog"','outline')}`);return;}addMessages(prompt,responseFor(view));showView(view);}
function attachFile(file){if(!file)return;if(!file.name.toLowerCase().endsWith('.xlsx')){toast('请选择 .xlsx 文件；原型不解析文件内容。');return;}state.attachment={name:file.name,size:file.size};$('#attachment-preview').hidden=false;$('#attachment-preview').innerHTML=`<span>${icon('sheet')}${esc(file.name)} · 仅名称预览</span>${btn('移除','data-action="remove-attachment"','ghost')}`;toast('附件保留在当前页面，未读取内容，也未上传。');}
function setTheme(dark){state.dark=dark;document.body.toggleAttribute('data-dark',dark);document.documentElement.dataset.theme=dark?'dark':'light';$('[data-action="theme"]').innerHTML=icon(dark?'sun':'moon');}
function design(){modal('造价智算 · 设计方向',`<p><strong>会话是主线，专业成果按需展开。</strong>左侧保留任务、附件和决策，右侧承载宽表、风险、来源、报告与 3D 概览。</p><div class="tool-grid"><div class="tool-tile"><strong>专业可信</strong><small>价格与双系数各自可追溯，关键建议由人工确认。</small></div><div class="tool-tile"><strong>面向扩展</strong><small>智能体配置、动作目录、消息流与成果渲染器分层。</small></div></div><p style="margin-top:18px">视觉使用 daisyUI + Tailwind；交互参考 assistant-ui、CopilotKit、Open Canvas。当前没有安装这些参考框架，也没有接入正式业务。</p><p><a href="https://github.com/assistant-ui/assistant-ui" target="_blank" rel="noreferrer">assistant-ui</a> · <a href="https://github.com/CopilotKit/CopilotKit" target="_blank" rel="noreferrer">CopilotKit</a> · <a href="https://github.com/langchain-ai/open-canvas" target="_blank" rel="noreferrer">Open Canvas（已归档）</a></p>`);}

document.addEventListener('click',event=>{
  const target=event.target.closest('button,a[data-action]');if(!target)return;
  if(target.matches('a[data-action]'))event.preventDefault();
  if(target.dataset.scene){setScene(target.dataset.scene);return;}
  if(target.dataset.view){showView(target.dataset.view);return;}
  if(target.dataset.tool){closeModal();beginConversation();addMessages(`打开${names[target.dataset.tool]||target.dataset.tool}`,responseFor(target.dataset.tool));showView(target.dataset.tool);return;}
  if(target.dataset.prompt){sendPrompt(target.dataset.prompt);return;}
  if(target.dataset.row){rowDetail(Number(target.dataset.row));return;}
  if(target.dataset.review){confirmRow(Number(target.dataset.review));return;}
  if(target.dataset.contextRow){const id=Number(target.dataset.contextRow);closeModal();addMessages(`请解释第 ${id} 行的来源与待复核原因`,`<p>已引用第 ${id} 行「${esc(state.rows.find(r=>r.id===id).name)}」。真实接入后，这段对话只使用当前行和同一任务的证据。</p>${btn('查看该行',`data-row="${id}"`,'outline')}`);return;}
  if(target.dataset.saveRow){const values=[...document.querySelectorAll('[data-edit]')];if(values.some(el=>el.value!==''&&!validNumber(el.value))){toast('请输入大于或等于 0 的有效数字。');return;}const row=state.rows.find(r=>r.id===Number(target.dataset.saveRow));for(const input of values)row[input.dataset.edit]=input.value===''?null:Number(input.value);for(const key of ['price','physical','technical'])delete row[`confirmed_${key}`];state.reviews.delete(row.id);state.revision++;closeModal();showView('table');toast('示例编辑已保留在当前页面，正式文件未改动。');return;}
  if(target.dataset.confirmRow){const id=Number(target.dataset.confirmRow);const source=$('#confirm-source').value;const name=$('#confirm-field').value;if(source!=='示例可信资产 A'||!$('#ack-source').checked||!allowedAction('confirm-field',{sourceSelected:source==='示例可信资产 A',rowId:id,field:name})){toast('请先选择来源并核对适用条件；也可以保留待复核。');return;}if(id===22){toast('缺少适用条件，本行继续保持待复核。');return;}const key=({ '基价 / 单价':'price','实物工作费调整系数':'physical','技术工作费调整系数':'technical'})[name];state.rows.find(r=>r.id===id)[`confirmed_${key}`]=true;const row=state.rows.find(r=>r.id===id);if(['price','physical','technical'].every(k=>row[`confirmed_${k}`]))state.reviews.add(id);closeModal();showView('risk');addMessages(`确认第 ${id} 行的${name}`,`<p>已记录该字段的示例确认。其他字段维持原状态。该操作不会写入正式计算表。</p>`);return;}
  if(target.dataset.sheet){state.sheet=target.dataset.sheet;showView('table');return;}
  if(target.dataset.tab){state[target.dataset.tab]=target.dataset.value;showView(state.view);return;}
  const action=target.dataset.action;
  switch(action){
    case 'home':setScene('home');break;case 'new':setScene('new');break;case 'catalog':catalog();break;case 'skill':skills();break;case 'settings':settings();break;case 'design':design();break;
    case 'theme':setTheme(!state.dark);break;case 'sidebar':$('#shell').classList.toggle('sidebar-open');break;case 'close-dialog':closeModal();break;case 'close-artifact':hideArtifact();break;
    case 'expand':$('#workbench').classList.toggle('expanded');target.setAttribute('aria-label',$('#workbench').classList.contains('expanded')?'恢复对话与成果':'放大成果区');break;
    case 'attach':$('#file-input').click();break;case 'remove-attachment':state.attachment=null;$('#attachment-preview').hidden=true;$('#file-input').value='';break;
    case 'save-settings':setTheme($('#setting-theme').value==='石墨深色');state.mode=$('#setting-mode').value;$('#mode').value=state.mode;closeModal();toast('已应用本页预览设置，正式配置未修改。');break;
    case 'filter':state.filter=!state.filter;showView('table');break;case 'download':downloadPreview();break;
    case 'run-warning':state.warningRun=true;showView('risk');addMessages('运行经验池预警',`<p>已打开示例预警结果：低风险 2 项，高风险 1 项。真实预警应由按钮手动触发，不加入首次转换链路。</p>`);break;
    case 'recalculate':toast('当前是固定示例，未执行正式公式重算。真实接入将调用原有重算链路。');break;
    case 'convert':modal('确认执行计划',`${notice('只切换原型状态，不会处理所选文件。')}<ul class="steps plan-steps"><li class="step step-primary">识别</li><li class="step">匹配</li><li class="step">复核</li><li class="step">成果</li></ul><p>已选择勘察测量专业与 ${esc(state.mode)}。正式接入时，表结构确认后先生成待匹配预览，再由明确操作执行批量匹配。</p><div class="action-row">${btn('取消','data-action="close-dialog"')}${btn('查看示例结果','data-action="simulate-result"','primary')}</div>`);break;
    case 'simulate-result':closeModal();setScene('review');break;
    case 'prepare-review':modal('确认复核发送内容',`${notice('当前没有连接任何消息平台，点击仅展示待发送确认页。')}<p>平台：${esc($('#review-platform')?.value||'飞书')}<br>受众：${esc($('#review-person')?.value||'示例复核人')}<br>成果：ZS-026 · 示例版本 ${state.revision}<br>范围：基价、实物系数、技术系数与风险提示。</p><div class="action-row">${btn('返回修改','data-action="close-dialog"')}${btn('结束发送演示','data-action="finish-review"','primary')}</div>`);break;
    case 'finish-review':closeModal();toast('发送演示结束；未发送消息，不生成虚假送达回执。');break;
    case 'memory-confirm':state.memoryStatus='已确认（示例）';showView('memory');toast('示例候选已确认，仅在当前页面内存中保留。');break;
    case 'memory-revoke':state.memoryStatus='已撤销（示例）';showView('memory');break;
    case 'retry-digital':toast('原型没有连接独立服务。生产接入时保留服务不可用、重试与独立打开。');break;
    case 'source':modal('来源片段 · 示例',`${notice('以下只演示证据卡片结构，不引述真实标准条文。')}<h3>可信资产 → 记录 → 当前业务行</h3><p>专业要素、单位、适用条件、资产版本、匹配方式与三个字段的来源分别展示。标准依据优先于经验提示；来源不足时保留待复核。</p>${btn('引用到对话','data-action="cite"','primary','message')}`);break;
    case 'cite':closeModal();addMessages('引用这条依据',`<p>已将示例来源卡加入当前对话。真实接入时，此处包含可核验的资产、版本和引用片段。</p>`);break;
    case 'search-knowledge':{const q=$('#knowledge-query')?.value||'计价依据';addMessages(q,`<p>这是知识检索交互预览。当前查询：${esc(q)}。</p><p>尚未连接原检索或 WeKnora 服务，因此不会生成假引用或模型答案。</p>${btn('查看来源结构','data-view="sources"')}`);showView('sources');break;}
    case 'capture-workload':toast('已检查演示字段映射。正式抓取与两份 Excel 输出待业务接入。');break;
    case 'import-experience':toast('演示导入计划已准备；正式经验池和模板均未改动。');break;
    case 'audit-settlement':state.auditRun=true;showView('settlement');break;
    case 'save-snapshot':downloadPreview();break;
  }
});
document.addEventListener('change',event=>{if(event.target.id==='sheet-select'){state.sheet=event.target.value;showView('table');}if(event.target.id==='mode'){state.mode=event.target.value;toast(`已切换预览模式：${state.mode}`);}if(event.target.id==='project-filter'){state.projectFilter=event.target.value;showView('projects');}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){$('#shell').classList.remove('sidebar-open');}if((event.ctrlKey||event.metaKey)&&event.key==='k'){event.preventDefault();catalog();}});
$('#composer').addEventListener('submit',event=>{event.preventDefault();sendPrompt($('#prompt').value);});
$('#prompt').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();sendPrompt(event.target.value);}});
$('#prompt').addEventListener('input',event=>state.draft=event.target.value);
$('#file-input').addEventListener('change',event=>attachFile(event.target.files[0]));
$('#composer').addEventListener('dragover',event=>{event.preventDefault();$('#composer').classList.add('drop-hover');});
$('#composer').addEventListener('dragleave',()=>$('#composer').classList.remove('drop-hover'));
$('#composer').addEventListener('drop',event=>{event.preventDefault();$('#composer').classList.remove('drop-hover');attachFile(event.dataTransfer.files[0]);});
window.addEventListener('pagehide',()=>state.disposed3d?.());
setTheme(true);paintIcons();setScene('home');
