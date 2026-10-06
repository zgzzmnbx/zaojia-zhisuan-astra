// UI-only fixtures and contracts. No business engine or network adapter is enabled.
export const agents = [
  { id: 'cost', name: '造价工程师', profession: '勘察测量', status: 'prototype', skill: 'survey-measurement-limit-price', version: '1.0.0', tools: ['mapping', 'table', 'risk', 'workload', 'settlement', 'report', 'knowledge', 'collaboration'] },
  { id: 'document', name: '文档智能体', profession: '文档与规范', status: 'planned', tools: [] },
  { id: 'project', name: '项目智能体', profession: '项目管理', status: 'planned', tools: [] },
];
export const tools = [
  ['mapping','sheet','新建填价与列映射','上传、识别工作表、字段映射、范围与合并值口径'],
  ['table','sheet','结果预览与修改','Sheet、筛选、定位、编辑、重算与成果下载'],
  ['risk','shield','经验池预警与行级复核','三个数字、候选依据、人工确认与风险比选'],
  ['experience','database','经验池导入','历史控制价、字段映射、有效行过滤与导入'],
  ['workload','columns','原始工作量抓取','源表、目标表、术语归并与双文件输出'],
  ['report','file','Word 报告','报告正文、来源、分页预览与交付'],
  ['settlement','check','结算审核','送审数据、规则检查与审核双成果'],
  ['knowledge','book','知识库问答','原问答、WeKnora、对比输出与引用'],
  ['articles','network','文章与知识网络','文章搜索、关系网络与只读阅读'],
  ['memory','database','知识记忆','候选审核、范围、版本、撤销与审计'],
  ['collaboration','users','智能协同','飞书 / WeAct、受众、轮次与送达回执'],
  ['projects','folder','项目看板与历史','项目筛选、历史运行、费用分析与成果'],
  ['map','pin','全国项目地图','地理 / 展示视图、地点证据与待定位'],
  ['digital','monitor','数字化项目助手','独立服务入口、连接状态与恢复'],
  ['trace','route','任务轨迹与上岗证据','任务、Skill、工具、成果、复核和经验血缘'],
  ['skills','spark','专业能力中心','Registry、版本、冻结快照与扩展边界'],
  ['settings','settings','设置与模型','预览、匹配、模型、问答、报告、协同和外观'],
  ['universe','orbit','3D 项目星图','可拖动的任务空间，点击进入专业成果'],
];
export const rows = [
  { id:12, name:'线路工程测量', detail:'1:2000 · 平原', unit:'km', quantity:16.2, price:1850, physical:1, technical:1, kind:'standard' },
  { id:13, name:'线路工程测量', detail:'1:2000 · 丘陵', unit:'km', quantity:8.4, price:2250, physical:1, technical:1, kind:'standard' },
  { id:14, name:'控制测量', detail:'四等控制点', unit:'点', quantity:6, price:860, physical:1, technical:1, kind:'standard' },
  { id:15, name:'工程地质测绘', detail:'1:5000', unit:'km²', quantity:3.2, price:3200, physical:1, technical:1, kind:'standard' },
  { id:16, name:'工程钻探', detail:'土层 · 0–10 m', unit:'m', quantity:120, price:168, physical:1, technical:1, kind:'standard' },
  { id:17, name:'工程钻探', detail:'土层 · 10–20 m', unit:'m', quantity:85, price:198, physical:1, technical:1, kind:'standard' },
  { id:18, name:'穿越段测量', detail:'河流穿越', unit:'km', quantity:1.8, price:3600, physical:1.2, technical:1, kind:'experience' },
  { id:19, name:'站场地形测量', detail:'1:500 · 一般地区', unit:'km²', quantity:0.32, price:8200, physical:1, technical:1, kind:'standard' },
  { id:20, name:'原位测试', detail:'标准贯入', unit:'次', quantity:24, price:95, physical:1, technical:1, kind:'standard' },
  { id:21, name:'土工试验', detail:'常规分析', unit:'组', quantity:18, price:210, physical:1, technical:1, kind:'standard' },
  { id:22, name:'复杂地段测量', detail:'场景要素待确认', unit:'km', quantity:2.6, price:null, physical:null, technical:1, kind:'missing' },
  { id:23, name:'技术工作费', detail:'适用阶段待复核', unit:'项', quantity:1, price:12800, physical:1, technical:1.15, kind:'experience' },
];
export const routes = [
  [/星图|3d|三维/i,'universe'],[/列映射|字段|转换|开始编制|编制控制价/,'mapping'],[/工作量|抓取/,'workload'],[/结算|送审/,'settlement'],[/知识网络|文章/,'articles'],[/记忆|沉淀/,'memory'],[/知识|问答|标准|计价依据|WeKnora/i,'knowledge'],[/报告|word/i,'report'],[/协同|同事|发送|审核进度/,'collaboration'],[/风险|复核|预警/,'risk'],[/经验池|导入经验/,'experience'],[/地图|地点|全国/,'map'],[/数字化/,'digital'],[/项目|历史|看板/,'projects'],[/能力|skill|智能体/i,'skills'],[/轨迹|血缘|上岗/,'trace'],[/设置|模型/,'settings'],[/表格|excel|成果|计算表|填价|匹配/i,'table']
];
export function routePrompt(text) { return routes.find(([pattern]) => pattern.test(text))?.[1] ?? null; }
export function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
export function validNumber(value) { const number = Number(value); return String(value).trim() !== '' && Number.isFinite(number) && number >= 0; }
export function allowedAction(action, state) {
  if (action === 'confirm-field') return state.sourceSelected === true && state.rowId != null && state.field != null;
  // Explicit transport boundary: UI actions never authorize production writes.
  if (['send-external','write-production','call-model'].includes(action)) return false;
  return true;
}
