/** Explicit frontend preview only. No workbook fixtures, results or backend calls. */
export const DEBUG_MODE = import.meta.env.MODE === 'frontend-debug';
const KEY = 'astra.frontend-handoff.empty.v1';
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID().replaceAll('-', '');
type Database = {conversations:any[];projects:any[];reviews:any[]};
const empty = ():Database => ({conversations:[],projects:[],reviews:[]});
function read():Database { try{return {...empty(),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return empty()}}
function save(db:Database){localStorage.setItem(KEY,JSON.stringify(db));}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=utf-8','X-Astra-Mode':'frontend-debug'}});
const disabled=(label='此操作')=>reply({detail:`${label}在纯前端调试版中已隔离。未连接后端，也不会上传、调用模型或发送消息。`},501);
async function bodyOf(input:RequestInfo|URL,init?:RequestInit):Promise<any>{const body=init?.body;if(body instanceof FormData)return Object.fromEntries(body.entries());if(typeof body==='string'){try{return JSON.parse(body)}catch{return {}}}if(input instanceof Request){try{return await input.clone().json()}catch{return {}}}return {};}
export async function mockFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href),p=url.pathname,m=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(url.origin!==location.origin)return disabled('外部连接');
 const signal=init?.signal||(input instanceof Request?input.signal:null);if(signal?.aborted)throw new DOMException('已取消','AbortError');
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,m==='GET'?40:220);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('已取消','AbortError'))},{once:true})});
 const b=await bodyOf(input,init),db=read();
 if(p==='/api/health')return reply({service:'zhisuan-astra',isolated:true,mode:'frontend-debug',mock:true});
 if(p==='/api/astra/weknora/capabilities')return reply({available:false,document_count:0,documents:[],reason:{code:'FRONTEND_DEBUG',message:'前端调试：WeKnora 与模型连接已隔离'}});
 if(p==='/api/astra/gork/status')return reply({state:'paused',message:'前端调试：仅保留 Gork 界面动效，未连接机器人或本机控制台。',tracking:false,robot_connected:false});
 if(p==='/api/astra/digital/status')return reply({available:false});
 if(p==='/api/astra/connections')return m==='GET'?reply({models:{},external_enabled:false,note:'连接配置已隔离'}):disabled('保存真实连接');
 if(p==='/api/astra/collaboration/status')return reply({platforms:[{id:'feishu',name:'飞书'},{id:'weact',name:'WeAct'}],note:'前端模拟：可保存本浏览器的复核草稿，不会发给任何人。'});
 if(p==='/api/astra/sample'||p==='/api/inspect')return disabled('表格资料未随交接，识别与计价');
 if(p==='/api/knowledge/libraries')return reply({libraries:[],default_library_ids:[],available:false});
 if(p==='/api/astra/knowledge/ask')return disabled('知识检索与模型回答');
 const base='/api/astra/workspace';
 if(p===base){return reply({projects:db.projects,conversations:db.conversations.map(({state,...c})=>({...c,job_id:state?.job_id||''})),jobs:{}});}
 if(p===base+'/conversations'&&m==='POST'){const c={id:id(),title:'新对话',project_id:b.project_id||'',revision:1,state:{},created_at:now(),updated_at:now()};db.conversations.unshift(c);save(db);return reply(c);}
 if(p===base+'/conversations/search'){const q=(url.searchParams.get('q')||'').toLowerCase();return reply({items:db.conversations.filter(c=>JSON.stringify(c).toLowerCase().includes(q))});}
 const conv=p.match(/^\/api\/astra\/workspace\/conversations\/([^/]+)(\/project)?$/);
 if(conv){const c=db.conversations.find(c=>c.id===conv[1]);if(!c)return reply({detail:'找不到此浏览器中的模拟对话'},404);if(m==='PUT'){if(b.revision!==c.revision)return reply({detail:'模拟对话已被其他窗口更新，请刷新后核对。'},409);Object.assign(c,{state:b.state,title:b.title,revision:c.revision+1,updated_at:now()});save(db);}if(conv[2]&&m==='POST'){c.project_id=b.project_id;c.revision++;save(db);}return reply(c);}
 if(p===base+'/projects'){if(m==='POST'){const project={id:id(),name:b.name||'未命名项目',background:b.background||'',created_at:now(),updated_at:now()};db.projects.push(project);save(db);return reply(project);}return reply({items:db.projects});}
 const proj=p.match(/^\/api\/astra\/workspace\/projects\/([^/]+)$/);if(proj){const project=db.projects.find(x=>x.id===proj[1]);if(!project)return reply({detail:'模拟项目不存在'},404);if(m==='PUT'){Object.assign(project,b,{updated_at:now()});save(db);}return reply(project);}
 if(p===base+'/assets')return m==='GET'?reply({items:[]}):disabled('真实附件上传');
 if(p.startsWith(base+'/assets/'))return disabled('附件读取');
 if(p===base+'/reviews'){if(m==='POST'){const review={...b,id:id(),created_at:now(),status:'draft'};db.reviews.push(review);save(db);return reply(review);}return reply({items:db.reviews.filter(r=>r.conversation_id===url.searchParams.get('conversation_id'))});}
 if(p==='/api/projects/dashboard')return reply({kpis:{total_projects:0,new_this_month:0,completed:0,pending_review:0,high_risk:0,total_runs:0,unclassified_tasks:0,warning_not_run:0},trend:[],trend_granularity:'day',status_distribution:[],source_distribution:[],lifecycle_funnel:[],risk_ranking:[],matching_quality:{standard_hit_rows:0,experience_hint_rows:0,review_rows:0,total_rows:0},llm_usage:{available:false,scope:'frontend_debug',total_requests:0,successful_requests:0,failed_requests:0,historical_requests:0,model_count:0,trend_granularity:'day',trend:[],models:[],tracked_from:'',message:'前端调试版没有真实模型审计数据'},filter_options:{skills:[],sources:[],statuses:[],lifecycle_stages:[]},comparison:{enabled:false,available:false},generated_at:now()});
 if(p==='/api/projects')return reply({items:[],total:0,page:1,page_size:20,pages:0});
 if(p==='/api/astra/runs')return reply({items:[]});
 if(p.startsWith('/api/astra/runs/'))return reply({detail:'未接入业务后端，没有可恢复的任务'},404);
 if(p==='/api/risk/summary')return reply({items:[],available:false,note:'无数据，未运行风险检查'});
 if(p==='/api/fill-assist/candidates')return reply({candidates:[],note:'未接入业务后端，无候选数据'});
 if(p.startsWith('/api/tasks/'))return reply({items:[],note:'未运行任何业务任务'});
 if(p.startsWith('/api/process')||p.startsWith('/api/preview/')||p.startsWith('/api/astra/report/')||p==='/api/risk-report'||p==='/api/experience-warnings/run')return disabled('表格计算、风险与报告');
 if(p==='/api/knowledge-articles')return reply({articles:[],items:[],categories:[],tags:[],total:0,relationships:[]});
 if(p.includes('knowledge-articles'))return reply({nodes:[],links:[],relationships:[],articles:[],items:[],total:0});
 return disabled('该专业业务接口');
}
export function resetDebugState(){localStorage.removeItem(KEY);for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i)!;if(k.startsWith('astra.unsaved.')||k.startsWith('astra.recovery.')||k==='astra.active-conversation')localStorage.removeItem(k);}location.reload();}
