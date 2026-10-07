import {useEffect,useRef,useState,type MouseEvent} from 'react';
import './icon-rail.css';
import {api,form,json} from './api';
import {Button,Icon,Modal,Note} from './ui';
import {workspaceApi,useWorkspace,type Asset,type Conversation,type Project} from './useWorkspace';
import {useSidebar} from './useSidebar';

type Workspace=ReturnType<typeof useWorkspace>;
type RailPanel='projects'|'history';
export function RailButton({label,icon,active=false,expanded,controls,disabled=false,onClick}:{label:string;icon:string;active?:boolean;expanded?:boolean;controls?:string;disabled?:boolean;onClick:(event:MouseEvent<HTMLButtonElement>)=>void}){
 return <div className="tooltip tooltip-right rail-tip" data-tip={label}><button type="button" className={`btn btn-ghost btn-square rail-button ${active?'is-active':''}`} aria-label={label} title={label} aria-current={active&&expanded===undefined?'page':undefined} aria-expanded={expanded} aria-controls={controls} disabled={disabled} onClick={onClick}><Icon name={icon}/></button></div>;
}
export function WorkspaceRailPanel({mode,workspace:w,busy,select,showProject,newProject,open,close}:{mode:RailPanel;workspace:Workspace;busy:boolean;select:(id:string)=>void;showProject:(id:string)=>void;newProject:()=>void;open:(view:string)=>void;close:()=>void}){
 return <section className="rail-panel card" id="workspace-rail-panel" aria-label={mode==='projects'?'项目与项目对话':'最近对话'}>
  <header className="rail-panel-heading"><h2>{mode==='projects'?'项目':'最近对话'}</h2><button type="button" className="btn btn-ghost btn-square" data-rail-panel-close aria-label="关闭导航详情" onClick={close}><Icon name="close"/></button></header>
  {mode==='projects'?<><div className="rail-panel-tools"><button type="button" className="btn btn-ghost btn-sm" onClick={()=>open('projects')}><Icon name="grid"/>项目看板</button><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={newProject}><Icon name="plus"/>新建项目</button></div><div className="workspace-scroll">{w.projects.map(p=><details className="workspace-project" key={p.id} open={w.active?.project_id===p.id||undefined}><summary><Icon name="folder"/><span>{p.name}</span></summary><button type="button" className="project-overview" onClick={()=>showProject(p.id)}>项目概览与资料<Icon name="arrow-up-right"/></button>{w.conversations.filter(c=>c.project_id===p.id).map(c=><button type="button" key={c.id} className={`session ${w.active?.id===c.id?'active':''}`} disabled={busy} onClick={()=>select(c.id)}><Icon name="message"/><span>{c.title}</span></button>)}</details>)}{!w.projects.length&&<p className="workspace-empty">用项目归拢对话与资料</p>}</div></>:<div className="workspace-scroll live-history">{w.conversations.slice(0,15).map(c=><button type="button" key={c.id} className={`session ${w.active?.id===c.id?'active':''}`} disabled={busy} onClick={()=>select(c.id)}><Icon name="message"/><span>{c.title}</span></button>)}{!w.conversations.length&&<p className="workspace-empty">还没有对话，点击加号开始。</p>}</div>}
 </section>;
}
export function WorkspaceSidebar({workspace:w,navigation:n,busy,newChat,select,showProject,open,settings,search,newProject,activeView='chat',active=true,settingsActive=false}:{workspace:Workspace;navigation:ReturnType<typeof useSidebar>;busy:boolean;newChat:()=>void;select:(id:string)=>void;showProject:(id:string)=>void;open:(view:string)=>void;settings:()=>void;search:()=>void;newProject:()=>void;activeView?:string;active?:boolean;settingsActive?:boolean}){
 const [panel,setPanel]=useState<RailPanel|null>(null);const origin=useRef<HTMLElement|null>(null);
 function close(){setPanel(null);origin.current?.focus();}
 function toggle(next:RailPanel,target:HTMLElement){origin.current=target;setPanel(previous=>previous===next?null:next);}
 function go(work:()=>void){setPanel(null);work();}
 useEffect(()=>{if(!n.visible||!active)setPanel(null)},[n.visible,active]);
 useEffect(()=>{if(!panel)return;const root=n.sidebarRef.current;root?.querySelector<HTMLButtonElement>('[data-rail-panel-close]')?.focus();const outside=(e:PointerEvent)=>{if(root&&!root.contains(e.target as Node))setPanel(null)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){e.preventDefault();close();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)};},[panel]);
 return <aside className="sidebar icon-rail" id="project-sidebar" ref={n.sidebarRef} hidden={!n.visible} role={n.mobile?'dialog':undefined} aria-modal={n.mobile&&n.sidebar?true:undefined} aria-label="主导航">
  <div className="tooltip tooltip-right rail-tip rail-brand" data-tip={n.mobile?'收起导航':'智算 Astra · 当前对话'}><button type="button" className="btn btn-ghost btn-square rail-button" data-sidebar-close={n.mobile||undefined} aria-label={n.mobile?'收起项目菜单':'返回当前对话'} title={n.mobile?'收起导航':'当前对话'} onClick={()=>n.mobile?n.setSidebar(false):go(()=>open('chat'))}>{n.mobile?<Icon name="close"/>:<span className="brand-mark astra-mark">A</span>}</button></div>
  <nav className="rail-actions menu" aria-label="工作区入口">
   <RailButton label="聊天" icon="message" active={!panel&&activeView==='chat'&&!settingsActive} onClick={()=>go(()=>open('chat'))}/>
   <RailButton label="新对话" icon="plus" disabled={busy||!w.ready} onClick={()=>go(newChat)}/>
   <RailButton label="搜索对话" icon="search" onClick={()=>go(search)}/>
   <RailButton label="项目" icon="folder" active={panel==='projects'} expanded={panel==='projects'} controls="workspace-rail-panel" onClick={e=>toggle('projects',e.currentTarget)}/>
   <RailButton label="最近对话" icon="message" active={panel==='history'||(!panel&&activeView==='chat'&&!settingsActive)} expanded={panel==='history'} controls="workspace-rail-panel" onClick={e=>toggle('history',e.currentTarget)}/>
   <RailButton label="项目看板" icon="grid" active={!panel&&activeView==='projects'} onClick={()=>go(()=>open('projects'))}/>
   <RailButton label="表格" icon="sheet" active={!panel&&activeView==='table'} onClick={()=>go(()=>open('table'))}/>
   <RailButton label="风险" icon="shield" active={!panel&&activeView==='risk'} onClick={()=>go(()=>open('risk'))}/>
   <RailButton label="文字报告" icon="file" active={!panel&&activeView==='report'} onClick={()=>go(()=>open('report'))}/>
   <RailButton label="知识库" icon="book" active={!panel&&activeView==='library'} onClick={()=>go(()=>open('library'))}/>
  </nav>
  <div className="rail-bottom"><RailButton label="设置" icon="settings" active={settingsActive} onClick={()=>go(settings)}/><div className="tooltip tooltip-right rail-tip" data-tip="石萌 · 独立工作空间"><span className="rail-profile" aria-label="石萌，独立工作空间" tabIndex={0}>石</span></div></div>
  {panel&&<WorkspaceRailPanel mode={panel} workspace={w} busy={busy} select={id=>go(()=>select(id))} showProject={id=>go(()=>showProject(id))} newProject={()=>go(newProject)} open={view=>go(()=>open(view))} close={close}/>}
 </aside>;
}

export function SearchConversations({close,select}:{close:()=>void;select:(id:string)=>void}){
  const [q,setQ]=useState(''),[items,setItems]=useState<Conversation[]>([]),[error,setError]=useState('');
  useEffect(()=>{let live=true;const timer=setTimeout(()=>{void api<{items:Conversation[]}>(`${workspaceApi}/conversations/search?q=${encodeURIComponent(q)}`).then(r=>{if(live){setItems(r.items);setError('');}}).catch(e=>{if(live)setError(e.message);});},180);return()=>{live=false;clearTimeout(timer);};},[q]);
  return <Modal title="搜索对话" close={close}><label className="field">标题或对话内容<input autoFocus className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="找回之前讨论过的内容"/></label>{error&&<Note>{error}</Note>}<div className="search-results">{items.map(c=><button key={c.id} onClick={()=>{select(c.id);close();}}><Icon name="message"/><div><strong>{c.title}</strong><p>{c.preview||'还没有消息'}</p></div><Icon name="arrow-right"/></button>)}{!items.length&&!error&&<p className="muted">没有找到匹配的对话。</p>}</div></Modal>;
}

export function ProjectEditor({project,close,saved}:{project?:Project;close:()=>void;saved:(p:Project)=>void}){
  const [name,setName]=useState(project?.name||''),[background,setBackground]=useState(project?.background||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(){setBusy(true);try{const p=await api<Project>(`${workspaceApi}/projects${project?`/${project.id}`:''}`,{...json({name,background}),method:project?'PUT':'POST'});saved(p);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Modal title={project?'项目背景':'新建项目'} close={()=>{if(!busy)close();}}><label className="field">项目名称<input className="input" autoFocus value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></label><label className="field">共享背景<textarea className="textarea" value={background} maxLength={10000} onChange={e=>setBackground(e.target.value)} placeholder="项目范围、工作目标和需要共同遵循的口径"/></label><Note>同项目对话共用这里的背景和资料，各自保留独立的聊天与计算成果。背景不作为价格或系数的裁决依据。</Note>{error&&<p role="alert">{error}</p>}<div className="action-row"><Button primary disabled={busy||!name.trim()} onClick={submit}>{busy?'正在保存':'保存项目'}</Button></div></Modal>;
}

export function Library({workspace:w,projectId,openProject,editProject,newChat,useFile,open}:{workspace:Workspace;projectId?:string;openProject?:(id:string)=>void;editProject?:(p:Project)=>void;newChat?:(id:string)=>void;useFile:(asset:Asset)=>void;open:(view:string)=>void}){
  const [scope,setScope]=useState(projectId?'project':'public'),[selectedProject,setSelectedProject]=useState(projectId||w.active?.project_id||''),[q,setQ]=useState(''),[items,setItems]=useState<Asset[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const input=useRef<HTMLInputElement>(null);const project=w.projects.find(p=>p.id===(projectId||selectedProject));
  const query=new URLSearchParams({scope,project_id:projectId||selectedProject,conversation_id:w.active?.id||''}).toString();
  async function refresh(){try{const r=await api<{items:Asset[]}>(`${workspaceApi}/assets?${query}`);setItems(r.items);setError('');}catch(e){setError((e as Error).message);setItems([]);}}
  useEffect(()=>{void refresh();},[query]);
  async function upload(file:File){setBusy(true);try{await api(`${workspaceApi}/assets`,form({file,scope,project_id:projectId||selectedProject,conversation_id:w.active?.id||''}));await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="panel-content workspace-library">
    {projectId&&project?<><div className="module-heading"><div><span className="eyebrow">PROJECT SPACE</span><h3>{project.name}</h3></div><Button icon="edit" onClick={()=>editProject?.(project)}>编辑</Button></div><p className="project-background">{project.background||'添加项目背景，让这里的每段对话都有共同上下文。'}</p><Button primary icon="plus" onClick={()=>newChat?.(project.id)}>在此项目新建对话</Button><h3 className="section-title">共享资料</h3></>:<><div className="module-heading"><div><span className="eyebrow">YOUR LIBRARY</span><h3>让依据随手可得</h3></div><Icon name="book"/></div><p className="panel-lead">公共资料与项目资料各有归属。原专业知识库和文章网络在下方独立管理。</p><div className="module-tabs" role="group" aria-label="资料范围">{[['public','公共资料'],['project','项目资料'],['conversation','当前可用']].map(([v,t])=><button key={v} className={scope===v?'active':''} onClick={()=>setScope(v)}>{t}</button>)}</div>{scope==='project'&&<label className="field">项目<select className="select" value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}><option value="">选择项目</option>{w.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}</>}
    <div className="library-controls"><input className="input" aria-label="搜索资料" placeholder="按文件名查找" value={q} onChange={e=>setQ(e.target.value)}/><Button primary icon="plus" disabled={busy||(scope==='project'&&!project)} onClick={()=>input.current?.click()}>添加资料</Button></div>
    {error&&!(scope==='project'&&!project)&&<Note>{error}</Note>}
    <div className="library-files">{items.filter(a=>a.name.toLowerCase().includes(q.toLowerCase())).map(a=><article className="library-file" key={a.id}><span className="file-symbol"><Icon name={a.name.endsWith('.xlsx')?'sheet':'file'}/></span><div><strong>{a.name}</strong><small>{Math.ceil(a.size/1024)} KB · {a.public?'公共资料':a.project_id?'项目共享':'本对话'} · 版本 {a.sha256.slice(0,8)}</small></div><div className="file-actions"><a className="btn btn-ghost btn-square" href={`${workspaceApi}/assets/${a.id}`} download={a.name} aria-label={`下载 ${a.name}`}><Icon name="download"/></a>{/\.xlsx$/i.test(a.name)&&<Button disabled={busy||!w.ready||Boolean(a.project_id&&a.project_id!==w.active?.project_id)} onClick={()=>useFile(a)}>用于对话</Button>}</div></article>)}</div>
    {!items.length&&<div className="library-empty"><Icon name="folder"/><p>{scope==='project'&&!project?'选择项目，查看共享资料':'这里还没有资料'}</p><small>支持 Excel、Word、PDF、Markdown、TXT 和 CSV</small></div>}
    <Note>上传保留独立版本；资料不会自动进入计价规则或问答索引。项目文件只能用于本项目对话，公共资料可供所有对话使用。</Note>
    {!projectId&&<><h3 className="section-title">专业知识</h3><div className="module-links">{[['knowledge','book','知识库与问答','原知识库范围、检索模式与引用依据'],['articles','file','造价文章与知识网络','搜索、阅读原文章及冻结关系']].map(([v,i,t,d])=><button key={v} onClick={()=>open(v)}><Icon name={i}/><span><strong>{t}</strong><small>{d}</small></span><Icon name="arrow-right"/></button>)}</div></>}
    <input type="file" ref={input} accept=".xlsx,.docx,.pdf,.md,.txt,.csv" hidden onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0]);e.target.value='';}}/>
  </div>;
}
