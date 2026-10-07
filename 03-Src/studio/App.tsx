import {ReviewConversation} from './ReviewConversation';
import {GorkSettings} from './GorkSettings';
import {DocumentPanel} from './DocumentPanel';
import {sourceKey,type DocumentSource,type DocumentState,type FormattedDocument} from './document-types';
import {installEntranceMotion} from './entrance-motion';
import './entrance-motion.css';
import {LegacyStatusButtons,LegacyConnections,type Platform} from '../frontend-debug/legacy-system/disabled';
import {PlatformConnections,PlatformStatusButtons,usePlatformStatus} from './PlatformConnections';
import {UploadedExampleSettings} from './UploadedExampleSettings';
import {ComposerCompanion} from './ComposerCompanion';
import {ComposerQuickMenu} from './ComposerQuickMenu';
import {quickUnavailable} from './quick-actions';
import {FloatingGork} from './FloatingGork';
import UploadedExample,{type ExampleRequest,type ExampleTab} from '../frontend-debug/uploaded-example/disabled';
import {ContentViewTabs,dataTabDestination,type DataTab} from './workbench/ContentViewTabs';
import {ProjectViewTabs,type ProjectTab} from './workbench/ProjectViewTabs';
import {ContentActions} from './workbench/ContentActions';
import {usePresentation} from './workbench/usePresentation';
import {RetainedContentPane,captureContentScroll} from './workbench/RetainedContentPane';
import {useWorkbenchLayout} from './workbench/useWorkbenchLayout';
import {CurrentProjectCard} from './workbench/CurrentProjectCard';
import {currentProjectSnapshot,type ResultScope} from './workbench/current-project';
import './workbench/workbench-layout.css';
import './workbench/four-surface.css';
import {DEBUG_MODE} from '../frontend-debug/mock-adapter';
import {debugText} from '../frontend-debug/bootstrap';
import {GorkConsole} from './GorkConsole';
import {useAppearance} from './appearance';
import {AppearanceControls,ThemeButton} from './AppearanceControls';
import {lazy,Suspense,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {DigitalAssistant} from './DigitalAssistant';
import {CapabilityHub} from './CapabilityHub';
import {ProfessionalPanel,isProfessional,professionalTitles,type ProfessionalReceipt,type KnowledgeSeed} from './ProfessionalPanel';
import {Prose} from './Prose';
import {readWeKnora} from './weknora-stream';
import {useWeKnora} from './useWeKnora';
import {WelcomeScreen,readSkipWelcome} from './WelcomeScreen';
import {gorkActivity} from './gork-motion';
import {useWorkspace,workspaceApi,type Asset,type Conversation,type Project,type Snapshot} from './useWorkspace';
import {WorkspaceSidebar,SearchConversations,ProjectEditor,Library} from './WorkspaceUI';
import {Architecture,ArticleLibrary,KnowledgePanel,CollaborationPanel,type Evidence,type KnowledgeOptions} from './MigratedModules';
import './workspace.css';
import {createRoot} from 'react-dom/client';
import {api,form,json} from './api';
import {prepareSheets,editableValue} from './workbook';
import {Button,Gork,Icon,Modal,Note,Universe} from './ui';
import {Mapping,Risks,ReportPanel,Projects} from './panels';
import type {Action,ConversationCard as Card,Inspection,Message,Report,Result,Risk,Run,SelectedCell,SheetConfig,View} from './types';
import {Workbook,readPreviewPreferences} from './table/Workbook';
import '../style.css';
import '../astra.css';
import './studio.css';
import './appearance.css';
import {useSidebar} from './useSidebar';
import {ConversationCard,WorkingCard} from './ConversationCard';
import {actionUnavailable,artifactCard,capabilitiesCard,editCard,errorCard,inputCard,resultCard,reviewCard,sourceCard} from './conversation-cards';

const ProjectDashboard=lazy(()=>import('./project-dashboard/ProjectDashboard'));
const titles:Record<View,string>={document:'公文转换',connections:'飞书与 WeAct 连接情况',example:'表格演示',insights:'当前项目状态',universe:'能力星图（示意）',mapping:'输入结构与列映射',table:'控制价计算表',risk:'风险与人工复核',report:'成果报告',sources:'当前行的依据',projects:'项目看板',tools:'专业能力中心',trace:'任务轨迹',library:'资料库',project:'项目资料',architecture:'系统架构',knowledge:'知识与引用',articles:'文章与知识网络',collaboration:'智能协同',...professionalTitles,digital:'数字化项目助手',gork:'Gork 机器人联动'} as Record<View,string>;



function App(){
  useEffect(()=>installEntranceMotion(document),[]);
  const [professionalWarm,setProfessionalWarm]=useState(false);
  const [knowledgeSeed,setKnowledgeSeed]=useState<KnowledgeSeed|null>(null);
  function professionalBusy(label:string){busyRef.current=!!label;setBusy(label);}
  async function professionalReceipt(receipt:ProfessionalReceipt){
    const context=conversationContext.current;
    let completedResult:Result|null=null;
    if(receipt.jobId&&/^[a-f0-9]{32}$/.test(receipt.jobId)&&!['/api/settlement-audit/review','/api/workload-capture/run','/api/experience-pool/import'].includes(receipt.path)){
      try{const updated=await api<Result>(`/api/astra/runs/${receipt.jobId}`);if(context!==conversationContext.current)return;acceptResult(updated);if(receipt.path==='/api/process/batch-match'&&updated.summary.matching_status==='completed')completedResult=updated;}catch(e){add((e as Error).message,undefined,'assistant',true);return;}
    }
    if(context!==conversationContext.current)return;
    setGorkCompletion(n=>n+1);
    const downloads=Object.entries(receipt.downloads||{}).filter(([,url])=>/^\/api\/(?:settlement-audit|workload-capture)\/(?:download|current-download)\/[a-f0-9]{32}\/[a-z]+$/.test(url)).map(([kind,url])=>({label:({excel:'下载审核表',report:'下载审核报告',result:'下载审核明细',workload:'下载标注工作量',target:'下载抓取计算表'} as Record<string,string>)[kind]||'下载成果',action:'download:'+url}));
    add(receipt.title,[...downloads,{label:'查看专业详情',action:receipt.view,primary:true},...(receipt.jobId===result?.job_id?[{label:'查看计算表',action:'table'}]:[])],'assistant',false,completedResult?resultCard(completedResult):{kind:'result',title:receipt.title,caption:'专业操作 · 实际返回',icon:'check',status:'已返回',note:'请在右侧核对处理结果、待复核项和完整成果。'});
  }

  const [mappingExpanded,setMappingExpanded]=useState(false);
  const [architectureOpening,setArchitectureOpening]=useState(0);
  const [dashboardWarm,setDashboardWarm]=useState(false);
  const [dashboardTab,setDashboardTab]=useState<'board'|'runs'>('board');
  const [welcomeVisible,setWelcomeVisible]=useState(()=>!readSkipWelcome());
  function showWelcome(){setSettings(false);setConnectionsOpen(false);setSidebar(false);setSearchOpen(false);setWelcomeVisible(true);}
  function enterWorkspace(next?:string){setWelcomeVisible(false);if(next){open(next);if(next==='knowledge')setChatMode('knowledge');}requestAnimationFrame(()=>{if(prompt.current?.offsetParent)prompt.current.focus();else document.querySelector<HTMLButtonElement>('[aria-label="聊天"]')?.focus();});}
  async function welcomeNewChat(){await newConversation();enterWorkspace('chat');}
  const weknora=useWeKnora();
  const qaRequest=useRef<{id:string;controller:AbortController;local?:AbortController}|null>(null);
  const qaSessions=useRef<Record<string,string>>({});
  const [qaRunning,setQaRunning]=useState(false);
  useEffect(()=>()=>{qaRequest.current?.controller.abort();qaRequest.current?.local?.abort();},[]);
  const [previewPreferences,setPreviewPreferences]=useState(readPreviewPreferences);
  const previewRefreshAttempt=useRef('');
  const [messages,setMessages]=useState<Message[]>([]);const [draft,setDraft]=useState('');
  const presentation=usePresentation(()=>{captureContentScroll(artifactScroll.current);if(scroll.current?.getClientRects().length)chatScrollMemory.current.set(conversationContext.current,scroll.current.scrollTop);});
  const view=presentation.state.content||'universe';const visible=presentation.state.mode==='content'||presentation.state.mode==='fullscreen';const expanded=presentation.state.mode==='fullscreen';
  const isDashboard=['projects','map','showcase'].includes(view);
  const activeProjectTab:ProjectTab=view==='map'||view==='showcase'?view:dashboardTab;
  function selectProjectTab(tab:ProjectTab){if(tab==='board'||tab==='runs'){setDashboardTab(tab);open('projects');}else open(tab);}
  const layout=useWorkbenchLayout(presentation);
  const [exampleRequest,setExampleRequest]=useState<ExampleRequest|null>(null);
  const [exampleSourceDetails,setExampleSourceDetails]=useState(false);
  function openDataTab(tab:DataTab){const target=dataTabDestination(tab,DEBUG_MODE&&!!exampleRequest,!!result,view);if(target.view==='example'){setExampleRequest(r=>r?{...r,tab:target.tab!}:r);open('example');}else open(target.view);}
  function showUploadedExample(tab:ExampleTab){if(!DEBUG_MODE)return;setExampleRequest(r=>({id:(r?.id||0)+1,tab}));open('example');}

  const [inputConversationId,setInputConversationId]=useState('');
  const [resultScope,setResultScope]=useState<ResultScope|null>(null);
  const [riskJobId,setRiskJobId]=useState('');
  const [conversationDetails,setConversationDetails]=useState(false);
  const [connectionPlatform,setConnectionPlatform]=useState<Platform>('default');
  const [connectionsOpen,setConnectionsOpen]=useState(false);
  const platformConnection=usePlatformStatus(!DEBUG_MODE&&!welcomeVisible);
  const associateNewProject=useRef<string|null>(null);
  const [projectAssociating,setProjectAssociating]=useState(false);
  const {palette,dark,setPalette,setDark,reset:resetAppearance,error:appearanceError}=useAppearance();const [appearanceOpen,setAppearanceOpen]=useState(false);const navigation=useSidebar();const {sidebar,setSidebar}=navigation;const [busy,setBusy]=useState('');const busyRef=useRef(false);
  const [operationError,setOperationError]=useState('');
  const [robotSettings,setRobotSettings]=useState(false),[gorkIssue,setGorkIssue]=useState(false);
  const [composing,setComposing]=useState(false),[gorkCompletion,setGorkCompletion]=useState(0);
  const [connected,setConnected]=useState(false);const [file,setFile]=useState<File|null>(null);const [sheets,setSheets]=useState<SheetConfig[]>([]);
  const [project,setProject]=useState('');const [result,setResult]=useState<Result|null>(null);const [runs,setRuns]=useState<Run[]>([]);
  const [sheetIndex,setSheetIndex]=useState(0);const [risks,setRisks]=useState<Risk[]>([]);const [report,setReport]=useState<Report|null>(null);
  const [needsRecalculate,setNeedsRecalculate]=useState(false);const [locatedRow,setLocatedRow]=useState<number>();
  const [selection,setSelection]=useState<SelectedCell|null>(null);const [cellValue,setCellValue]=useState('');const [editNote,setEditNote]=useState('');
  const [sources,setSources]=useState<any>(null);const [settings,setSettings]=useState(false);const [timeline,setTimeline]=useState<any[]>([]);
  const artifactScroll=useRef<HTMLDivElement>(null);
  const input=useRef<HTMLInputElement>(null);const scroll=useRef<HTMLDivElement>(null);const chatFollow=useRef(true);const chatScrollMemory=useRef(new Map<string,number>());const prompt=useRef<HTMLTextAreaElement>(null);
  const loadedJob=useRef('');const conversationContext=useRef<string>(crypto.randomUUID());
  const [inputFileId,setInputFileId]=useState('');
  const [searchOpen,setSearchOpen]=useState(false),[projectEditor,setProjectEditor]=useState<Project|true|null>(null),[projectId,setProjectId]=useState(''),[conversationEditor,setConversationEditor]=useState(false),[conversationTitle,setConversationTitle]=useState('');
  const [chatMode,setChatMode]=useState<'task'|'knowledge'>('task');
  const [knowledgeOptions,setKnowledgeOptions]=useState<KnowledgeOptions>({library_ids:null,retrieval_mode:'classic'}),[evidence,setEvidence]=useState<Evidence|null>(null);
  const [selectedDocument,setSelectedDocument]=useState<DocumentSource|null>(null);
  const [documents,setDocuments]=useState<Record<string,DocumentState>>({});
  const [documentEngine,setDocumentEngine]=useState({ready:false,error:'正在检查公文引擎…'});
  const snapshot:Snapshot={selectedDocument,documents,messages,draft,locatedRow,context:conversationContext.current,inputFileId,project,sheets,job_id:result?.job_id||'',view,visible,sheetIndex,panelProjectId:projectId,chatMode,knowledgeOptions};
  const workspace=useWorkspace(snapshot,async(state,conversation)=>{
    captureContentScroll(artifactScroll.current);if(scroll.current?.getClientRects().length)chatScrollMemory.current.set(conversationContext.current,scroll.current.scrollTop);
    const data=state.job_id?await api<Result>(`/api/astra/runs/${state.job_id}`):null;
    let attachment:File|null=null;
    if(state.inputFileId){const response=await fetch(`${workspaceApi}/assets/${state.inputFileId}?conversation_id=${conversation.id}`);if(!response.ok)throw new Error('当前对话的资料文件无法恢复，请检查独立工作区');const assets=await api<{items:Asset[]}>(`${workspaceApi}/assets?scope=conversation&conversation_id=${conversation.id}`);const asset=assets.items.find(a=>a.id===state.inputFileId);if(asset)attachment=new File([await response.blob()],asset.name);}
    conversationContext.current=state.context||crypto.randomUUID();chatFollow.current=!chatScrollMemory.current.has(conversationContext.current);loadedJob.current='';previewRefreshAttempt.current='';
    setGorkIssue(false);setOperationError('');setResult(null);setResultScope(null);setRiskJobId('');setNeedsRecalculate(false);if(data)acceptResult(data,false,conversation);
    setSelectedDocument(state.selectedDocument||null);setDocuments(state.documents||{});
    setMappingExpanded(false);setMessages(state.messages||[]);setDraft(state.draft||'');setFile(attachment);setInputConversationId(attachment?conversation.id:'');setInputFileId(state.inputFileId||'');setSheets(state.sheets||[]);setProject(state.project||'');
    setRisks([]);setReport(null);setSources(null);setTimeline([]);setSelection(null);setEvidence([...state.messages||[]].reverse().find(m=>m.evidence)?.evidence||null);setChatMode(state.chatMode||'task');setKnowledgeOptions(state.knowledgeOptions||{library_ids:null,retrieval_mode:'classic'});setProjectId(state.panelProjectId||'');setLocatedRow(state.locatedRow);setSheetIndex(state.sheetIndex||0);
    presentation.enter(conversation.project_id||null,conversation.id);setSidebar(false);
    if(data&&state.view==='risk')void refreshRisk(data.job_id);if(data&&state.view==='report')void refreshReport(data.job_id);
  });
  const currentProject=currentProjectSnapshot({ready:workspace.ready,active:workspace.active,projects:workspace.projects,conversations:workspace.conversations,result,resultScope,risks,riskJobId,filename:file?.name||'',inputScope:{conversationId:inputConversationId,projectName:project},debug:DEBUG_MODE});
  function showInsights(){presentation.showSummary();setSidebar(false);}
  async function associateProject(id:string){if(busyRef.current||!workspace.ready)return;setProjectAssociating(true);try{await perform('正在关联当前项目',async()=>{await workspace.assign(id);presentation.showSummary();});}finally{setProjectAssociating(false);}}
  async function projectSaved(p:Project){
    const target=associateNewProject.current;associateNewProject.current=null;setProjectEditor(null);
    if(target&&workspace.currentConversation()?.id===target){setProjectAssociating(true);try{await perform('正在关联当前项目',async()=>{await workspace.refresh();if(workspace.currentConversation()?.id!==target){setProjectId(p.id);open('project');return;}await workspace.assign(p.id);presentation.showSummary();});}finally{setProjectAssociating(false);}}
    else{await workspace.refresh();void showProjectInsights(p.id);}
  }
  async function showProjectInsights(id:string){
    if(workspace.active?.project_id===id){showInsights();return;}
    const target=workspace.conversations.find(c=>c.project_id===id);
    if(target){await perform('正在切换项目',async()=>{await workspace.select(target.id);presentation.showSummary();});}
    else{setProjectId(id);open('project');}
  }
  async function changeConversation(id:string){await perform('正在打开对话',()=>workspace.select(id));}
  async function newConversation(id?:string){await perform('正在新建对话',()=>workspace.create(id));}
  async function storedFile(asset:Asset){try{const response=await fetch(`${workspaceApi}/assets/${asset.id}?conversation_id=${workspace.active?.id}`);if(!response.ok)throw new Error('资料不在当前对话可用范围内');await inspectFile(new File([await response.blob()],asset.name),asset.id);}catch(e){add((e as Error).message,undefined,'assistant',true);}}
  async function persistInput(f:File){if(!workspace.active)throw new Error('请等待对话载入');return api<Asset>(`${workspaceApi}/assets`,form({file:f,scope:'conversation',conversation_id:workspace.active.id}));}
  async function askKnowledge(question:string,alreadyAdded=false){
    if(busyRef.current||!workspace.ready)return;
    if(!alreadyAdded)add(question,undefined,'user');
    const mode=knowledgeOptions.engine||'local',context=conversationContext.current,conversation=workspace.active?.id||context;
    await perform(mode==='compare'?'正在分别检索两路知识依据':'正在检索知识依据',async()=>{
      const id=crypto.randomUUID(),controller=new AbortController(),local=new AbortController();
      qaRequest.current={id,controller,local};setQaRunning(true);
      const receive=(data:Evidence,enhanced:boolean)=>{
        if(controller.signal.aborted||local.signal.aborted||conversationContext.current!==context)return;
        data={...data,question};setEvidence(data);presentation.resultAvailable('knowledge');
        const caption=enhanced?'WeKnora · 引用范围已核验':data.answer_mode==='curated_demo'?'原系统预设解答':['evidence_only','evidence_fallback'].includes(data.answer_mode)?'本地检索 · 原文依据':data.answer_mode==='general_model_fallback'?'原模型 · 通用回答（无知识库依据）':'原知识问答 · 模型综合';
        const message:Message={id:crypto.randomUUID(),role:'assistant',text:data.answer,context,evidence:data,card:{kind:'source',title:mode==='compare'?`${enhanced?'WeKnora':'原知识问答'} · 对比结果`:'本次回答的引用依据',caption,icon:'book',status:data.sources.length?`${data.sources.length} 条引用`:'依据不足',items:data.sources.slice(0,3).map((item:any)=>({title:item.title||item.title_path||item.source_name||item.source||'知识来源',detail:(item.snippet||item.excerpt||item.content||item.text||'打开右侧核对来源').slice(0,160),icon:'book'})),note:'用于理解依据，不自动改写价格与系数。'},actions:[{label:'核对全部引用',action:'knowledge-result',primary:true}]};setMessages(m=>[...m,message]);
      };
      const runLocal=async()=>{
        const response=await fetch('/api/astra/knowledge/ask',{...json({question,library_ids:knowledgeOptions.library_ids??undefined,retrieval_mode:knowledgeOptions.retrieval_mode,...(result?{job_id:result.job_id}:{}),project_key:workspace.active?.project_id||''}),signal:local.signal});
        const data=await response.json();if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'原知识问答暂不可用');
        receive({...data,sources:data.sources||[]},false);
      };
      const runEnhanced=async()=>{
        if(!weknora.status.available)throw new Error(weknora.status.reason?.message||'WeKnora 未连接');
        const response=await fetch('/api/astra/weknora/ask-stream',{...json({question,engine_mode:'enhanced',library_ids:['cost-aiw'],context_type:'general',row_context:null,request_id:id,...(qaSessions.current[conversation]?{conversation_id:qaSessions.current[conversation]}:{})}),signal:controller.signal});
        const reply=await readWeKnora(response,controller.signal,()=>{});
        if(controller.signal.aborted||conversationContext.current!==context)return;
        qaSessions.current[conversation]=reply.conversation_id;
        receive({answer:reply.answer,sources:reply.citations,answer_mode:'weknora',evidence_status:reply.evidence_status,elapsed_ms:reply.elapsed_ms},true);
      };
      try{
        const jobs: [string,()=>Promise<void>][] = mode==='compare' ? [['原知识问答',runLocal],['WeKnora',runEnhanced]] : mode==='weknora' ? [['WeKnora',runEnhanced]] : [['原知识问答',runLocal]];
        const outcomes=await Promise.allSettled(jobs.map(([,run])=>run()));
        if(!controller.signal.aborted&&!local.signal.aborted&&context===conversationContext.current){if(outcomes.some(r=>r.status==='fulfilled'))setGorkCompletion(n=>n+1);if(outcomes.some(r=>r.status==='rejected'))setOperationError('知识回答未全部完成');}
        outcomes.forEach((reply,index)=>{if(reply.status==='rejected'&&!controller.signal.aborted&&!local.signal.aborted&&context===conversationContext.current){add(`${jobs[index][0]}：${reply.reason instanceof Error?reply.reason.message:'本次请求未完成'}`,undefined,'assistant',true);if(jobs[index][0]==='WeKnora')delete qaSessions.current[conversation];}});
        if(controller.signal.aborted&&context===conversationContext.current)add('本次请求已停止。已完成的回答保留，未完成内容不进入对话。');
      }finally{if(qaRequest.current?.id===id)qaRequest.current=null;setQaRunning(false);}
    });
  }
  function stopKnowledge(){const active=qaRequest.current;if(!active)return;active.controller.abort();active.local?.abort();void api(`/api/astra/weknora/requests/${active.id}/cancel`,json({})).catch(()=>{});}
  async function presentArticle(id:string){await perform('正在读取原文章',async()=>{const data=await api<any>(`/api/knowledge-articles/${encodeURIComponent(id)}`);add(`一起看看《${data.article.title}》。`,undefined,'assistant',false,{kind:'source',title:data.article.title,caption:'原文章阅读 · 未调用模型',icon:'book',status:'只读',facts:[{label:'分类',value:data.article.category}],disclosure:{label:'阅读完整正文',lines:data.article.body.split('\n')},note:'文章展示不触发问答、知识记忆或价格裁决。'});});}
  const summary=result?.summary;const completed=summary?.matching_status==='completed';
  const gorkState=gorkActivity(busy,operationError||(gorkIssue?'发现待复核事项':''),composing);
  const gorkSuspended=welcomeVisible||!layout.chatActive||settings||robotSettings||connectionsOpen||searchOpen||conversationEditor||!!selection||!!projectEditor;
  const pendingFeeFocus=useRef('');
  const add=(text:string,actions?:Action[],role:'user'|'assistant'='assistant',error=false,card?:Card)=>{const message:Message={id:crypto.randomUUID(),text:debugText(text),actions,role,error,card:card||(error?errorCard(text):undefined),job:loadedJob.current,context:conversationContext.current};pendingFeeFocus.current=card?.fees?message.id:'';setMessages(m=>[...m,message]);};
  const listRuns=async()=>{const data=await api<{items:Run[]}>('/api/astra/runs');setRuns(data.items);};
  useEffect(()=>{api<{isolated:boolean;service:string}>('/api/health').then(h=>{if(h.service!=='zhisuan-astra'||!h.isolated)throw new Error('当前地址不是独立 Astra 服务');setConnected(true);return listRuns();}).catch(e=>add(e.message,undefined,'assistant',true));},[]);

  useEffect(()=>{
    const host=scroll.current;
    if(layout.chatActive&&host){
      const feeCard=pendingFeeFocus.current?host.querySelector<HTMLElement>(`[data-message-id="${pendingFeeFocus.current}"]`):null;
      if(feeCard){host.scrollTo({top:host.scrollTop+feeCard.getBoundingClientRect().top-host.getBoundingClientRect().top-12,behavior:'instant'});chatFollow.current=false;}
      else if(chatFollow.current)host.scrollTo({top:messages.length?host.scrollHeight:0,behavior:'instant'});
    }
    pendingFeeFocus.current='';
  },[messages,busy]);
  useLayoutEffect(()=>{if(layout.chatActive&&scroll.current){const saved=chatScrollMemory.current.get(conversationContext.current);if(saved!==undefined)scroll.current.scrollTop=saved;}},[presentation.state.mode,presentation.state.conversationId,layout.chatActive]);
  useEffect(()=>{const handle=(e:KeyboardEvent)=>{if(welcomeVisible)return;if(e.key==='Escape'){if(document.querySelector('dialog[open]'))return;if(sidebar){setSidebar(false);return;}if(expanded)presentation.returnToSplit();else if(presentation.state.mode==='content')presentation.closeContent();else if(presentation.state.mode==='summary')presentation.closeSummary();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(true);}};document.addEventListener('keydown',handle);return()=>document.removeEventListener('keydown',handle);},[sidebar,welcomeVisible,presentation.state.mode]);


  const reportDocument:DocumentSource|null=result?.downloads.report?{kind:'report',source_id:result.job_id,revision:JSON.stringify([result.task_tracking?.task.artifact_version,result.summary.output_report,result.summary.report_text]),name:result.summary.output_report?.split(/[\\/]/).pop()||'造价报告.docx'}:null;
  const activeDocumentSource=visible?(view==='report'?reportDocument:view==='document'?selectedDocument:null):null;
  function documentFor(source:DocumentSource|null):DocumentState|null{if(!source)return null;const saved=documents[sourceKey(source)];return saved&&saved.source.revision===source.revision?saved:{source};}
  async function openDocumentFile(next:File,assetId?:string){await perform('正在打开文稿',async()=>{
    const context=conversationContext.current;const id=assetId||(await persistInput(next)).id;if(context!==conversationContext.current)return;
    setSelectedDocument({kind:'asset',source_id:id,name:next.name});add(`打开文稿：${next.name}`,undefined,'user');open('document');
  });}
  async function formatDocument(key:string){
    if(DEBUG_MODE){add('公文转换需要本地服务，调试版不生成正式文档。');return;}
    if(!documentEngine.ready){add(documentEngine.error,undefined,'assistant',true);return;}
    const source=activeDocumentSource;if(!source||sourceKey(source)!==key)return;
    const context=conversationContext.current,conversation=workspace.active?.id;if(!conversation)return;
    await perform('正在转换公文',async()=>{
      await workspace.flush();
      const query=new URLSearchParams({kind:source.kind,source_id:source.source_id,conversation_id:conversation});
      const info=await api<{sha256:string}>(`/api/astra/documents/source?${query}`);
      const output=await api<FormattedDocument>('/api/astra/documents/format',json({...source,conversation_id:conversation,sha256:info.sha256}));
      if(context!==conversationContext.current||workspace.currentConversation()?.id!==conversation)return;
      setDocuments(all=>({...all,[key]:{source,output,showOriginal:false}}));setGorkCompletion(n=>n+1);
      add('公文版已生成，原文保留。',undefined,'assistant',false,{kind:'artifact',title:output.name,caption:'公文转换',icon:'file',status:output.warnings.length?'待核对':'已生成',note:output.warnings.join('；')||undefined});
    });
  }
  useEffect(()=>{
    if(!activeDocumentSource||DEBUG_MODE)return;const abort=new AbortController();
    void fetch('/api/astra/documents/status',{signal:abort.signal}).then(async response=>{
      if(response.status===404)throw Error('请重启本地服务以启用公文转换');
      const status=await response.json();if(!response.ok||!status.available)throw Error(status.detail||'公文引擎未就绪');
      if(!abort.signal.aborted)setDocumentEngine({ready:true,error:''});
    }).catch(error=>{if(!abort.signal.aborted)setDocumentEngine({ready:false,error:error.message});});
    return()=>abort.abort();
  },[activeDocumentSource?.source_id,activeDocumentSource?.kind]);
  useEffect(()=>{
    if(!activeDocumentSource||!layout.chatActive)return;
    const frame=requestAnimationFrame(()=>{if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;});
    return()=>cancelAnimationFrame(frame);
  },[activeDocumentSource?.source_id,activeDocumentSource?.kind,layout.chatActive]);

  async function perform(label:string,work:()=>Promise<void>){if(busyRef.current||!workspace.ready)return;busyRef.current=true;setBusy(label);setOperationError('');setGorkIssue(false);try{await work();}catch(e){const message=e instanceof Error?e.message:'操作失败，请检查服务状态后重试。';setOperationError(message);add(message,undefined,'assistant',true);}finally{setBusy('');busyRef.current=false;}}
  function prepareReview(kind:'setup'|'progress'='setup'){
    if(busyRef.current||!workspace.ready)return;
    presentation.prepareInput();setSidebar(false);
    if(!result||result.summary.matching_status!=='completed'||!result.downloads.excel){add('请先完成批量匹配并生成 Excel 成果，再发起同事复核。');return;}
    if(needsRecalculate&&kind==='setup'){add('当前成果有待重算修改，请先刷新公式并核对成果，再发起复核。');return;}
    const current=result,version=current.task_tracking?.task.artifact_version||0;
    const existing=messages.find(m=>m.review?.kind===kind&&!m.review.closed&&m.review.jobId===current.job_id&&m.review.version===version&&m.context===conversationContext.current);
    const message:Message=existing||{id:crypto.randomUUID(),role:'assistant',text:kind==='setup'?'请确认发送平台、复核人员和截止时间。':'当前成果的复核进度。',context:conversationContext.current,job:current.job_id,review:{kind,jobId:current.job_id,fileName:current.summary.output_excel||file?.name||'当前 Excel 成果',projectName:project||current.project_name||'',reviewRows:current.summary.review_rows,version}};
    pendingFeeFocus.current=message.id;setMessages(old=>[...old.filter(m=>m.id!==message.id),message]);
  }
  function open(next:string){if(next==='collaboration'){prepareReview();return;}if(next==='review-progress'){prepareReview('progress');return;}if(next==='mapping'&&file&&!result){setMappingExpanded(true);presentation.prepareInput();setSidebar(false);requestAnimationFrame(()=>document.querySelector('.mapping-inline')?.scrollIntoView({block:'nearest'}));return;}if(next==='word')next='report';if(next==='settings'){setSettings(true);return;}if(next==='insights'){showInsights();return;}if(isProfessional(next))setProfessionalWarm(true);if(next==='chat'){presentation.chat();setSidebar(false);return;}if(next in titles){if(next==='architecture')setArchitectureOpening(n=>n+1);presentation.open(next as View);setSidebar(false);if(next==='risk'&&result)void refreshRisk(result.job_id);if(next==='report'&&result)void refreshReport(result.job_id);if(next==='projects'){setDashboardWarm(true);}if(next==='projects')void listRuns().catch(e=>add(e.message,undefined,'assistant',true));if(next==='trace')void loadTimeline();}else{presentation.open('tools');add('这项能力已经列入完整迁移清单，当前版本尚未接通。右侧可以查看接入状态。');}}
  async function refreshRisk(job:string){try{const data=await api<{items:Risk[]}>(`/api/risk/summary?job_id=${job}`);if(loadedJob.current===job){setRisks(data.items);setRiskJobId(job);}}catch(e){add((e as Error).message,undefined,'assistant',true);}}
  async function refreshReport(job:string){try{const data=await api<Report>(`/api/astra/report/${job}`);if(loadedJob.current===job)setReport(data);}catch(e){if(loadedJob.current===job){setReport(null);add((e as Error).message,undefined,'assistant',true);}}}
  async function loadTimeline(){const id=result?.task_tracking?.task?.task_id;if(!id){setTimeline([]);return;}try{const data=await api<{items:any[]}>(`/api/tasks/${id}/timeline`);setTimeline(data.items.filter(i=>!i.is_placeholder));}catch(e){add((e as Error).message,undefined,'assistant',true);}}
  function acceptResult(data:Result,fromPreview=false,owner?:Conversation){const current=owner||workspace.currentConversation();setResultScope(current?{conversationId:current.id,projectId:current.project_id,jobId:data.job_id}:null);if(loadedJob.current!==data.job_id)setRiskJobId('');if(!fromPreview)previewRefreshAttempt.current='';const sameJob=loadedJob.current===data.job_id;loadedJob.current=data.job_id;if(!sameJob){setLocatedRow(undefined);const previews=data.summary.table_preview.sheets||[data.summary.table_preview];const index=previews.findIndex(s=>/^表[234]/.test(s.sheet_name));setSheetIndex(Math.max(0,index));}setResult(previous=>previous?.job_id===data.job_id?{...previous,...data}:data);setNeedsRecalculate(previous=>data.needs_recalculate??(sameJob&&previous));setReport(null);}
  async function refreshPreviewHeaders(headerRows:Record<string,number>){
    if(!result||busyRef.current)return false;
    const job=result.job_id;let success=false;
    await perform('读取工作表预览',async()=>{
      const data=await api<Result>('/api/preview/refresh',json({job_id:job,header_rows:headerRows}));
      if(loadedJob.current!==job)return;
      acceptResult(data,true);success=true;
    });
    return success;
  }
  useEffect(()=>{
    if(!result||busy||view!=='table')return;
    const previews=result.summary.table_preview.sheets||[result.summary.table_preview];
    const changed=previews.some(s=>previewPreferences.headerRows[s.sheet_name]&&s.header_row!==previewPreferences.headerRows[s.sheet_name]);
    const key=result.job_id+JSON.stringify(previewPreferences.headerRows);
    if(changed&&previewRefreshAttempt.current!==key){previewRefreshAttempt.current=key;void refreshPreviewHeaders(previewPreferences.headerRows);}
  },[result,busy,view,previewPreferences.headerRows]);
  async function inspectFile(next:File,existingAssetId?:string){if(/\.(docx?|md|markdown)$/i.test(next.name)){await openDocumentFile(next,existingAssetId);return;}const token=presentation.interactionToken();await perform('识别工作表与专业字段',async()=>{
    if(!next.name.toLowerCase().endsWith('.xlsx'))throw new Error('请选择 .xlsx 文件');
    if(next.size>30*1024*1024)throw new Error('文件超过 30 MB 上限');
    const data=await api<Inspection>('/api/inspect',form({file:next}));const assetId=existingAssetId||(await persistInput(next)).id;setInputFileId(assetId);
    conversationContext.current=crypto.randomUUID();loadedJob.current='';
    setInputConversationId(workspace.currentConversation()?.id||'');setFile(next);setProject(next.name.replace(/\.xlsx$/i,''));setResult(null);setReport(null);setRisks([]);setSources(null);setSheetIndex(0);setNeedsRecalculate(false);
    const prepared=prepareSheets(data.sheets);setSheets(prepared);setMappingExpanded(false);if(token===presentation.interactionToken())presentation.prepareInput();
    add(`请帮我编制这份控制价：${next.name}`,undefined,'user');
    add('资料已读取。我们先确认结构，再交给专业规则匹配。',[{label:'确认结构并转换',action:'convert',primary:true},{label:'核对字段',action:'mapping'}],'assistant',false,inputCard(next.name,prepared));
  });}
  async function sample(){const token=presentation.interactionToken();await perform(DEBUG_MODE?'载入合成前端样例':'载入 V3.1 正式样本副本',async()=>{
    const response=await fetch('/api/astra/sample');if(!response.ok)throw new Error('样本暂不可用');
    const next=new File([await response.blob()],DEBUG_MODE?'合成调试样例.xlsx':'【项目例子】【测试输入】可行性研究勘察测量控制价计算 -v3.1【演示】 .xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const data=await api<Inspection>('/api/inspect',form({file:next}));setInputFileId((await persistInput(next)).id);
    conversationContext.current=crypto.randomUUID();loadedJob.current='';
    setInputConversationId(workspace.currentConversation()?.id||'');setFile(next);setProject(DEBUG_MODE?'合成调试项目（非业务资料）':'V3.1 勘察测量控制价');setResult(null);setRisks([]);setReport(null);setSources(null);setSheetIndex(0);setNeedsRecalculate(false);
    const prepared=prepareSheets(data.sheets);setSheets(prepared);setMappingExpanded(false);if(token===presentation.interactionToken())presentation.prepareInput();
    add(DEBUG_MODE?'用合成样例走一遍前端交互流程。':'用 V3.1 正式样本走一遍编制流程。',undefined,'user');
    add('样本副本已就位。这次会实际运行规则，生成 Excel 和 Word 成果。',[{label:'确认结构并转换',action:'convert',primary:true},{label:'核对字段',action:'mapping'}],'assistant',false,inputCard(next.name,prepared));
  });}
  async function inspectHeader(name:string,row:number){if(!file)return;await perform('重新识别表头与字段',async()=>{if(!Number.isInteger(row)||row<1)throw new Error('表头行必须是大于 0 的整数');const data=await api<Inspection&{headers:string[];columns:SheetConfig['columns']} >('/api/inspect',form({file,sheet_name:name,header_row:String(row)}));setSheets(current=>current.map(s=>s.sheet_name===name?{...s,header_row:row,headers:data.headers,columns:data.columns,column_mapping:{...data.suggested_mapping}}:s));add(`已重新读取「${name}」第 ${row} 行表头，请核对卡片内更新后的字段映射。`);});}
  async function convert(){if(result){add('当前文件已完成转换，可继续批量匹配或查看成果。',[{label:completed?'查看表格':'批量匹配',action:completed?'table':'match',primary:true}]);return;}if(!file){add('先添加一份控制价 Excel，我来识别表格。',[{label:'添加 Excel',action:'attach',primary:true}]);return;}await perform('转换为待匹配预览',async()=>{if(!sheets.some(s=>s.enabled))throw new Error('至少选择一个工作表');if(sheets.some(s=>s.enabled&&(!Number.isInteger(s.header_row)||s.header_row<1)))throw new Error('表头行必须是大于 0 的整数');const data=await api<Result>('/api/process',form({file,project_name:project.trim(),sheet_configs:JSON.stringify(sheets.map(s=>({...s,output_match_report:true,merge_vertical_cells:true,merge_horizontal_cells:true}))),defer_matching:'true',matching_mode:'mechanical',only_match_rows_with_value:'true',match_value_filter_field:'数量',task_name:'最高投标限价编制',source_type:'web'}));acceptResult(data);presentation.resultAvailable('table');setGorkCompletion(n=>n+1);add('结构已经准备好，确认后即可开始匹配。',[{label:'开始批量匹配',action:'match',primary:true},{label:'查看表格',action:'table'}],'assistant',false,resultCard(data));await listRuns();});}
  async function match(){if(!result){add('请先添加 Excel 并确认结构，转换后即可开始匹配。',[{label:'添加 Excel',action:'attach',primary:true}]);return;}if(completed){add('当前任务已完成匹配，可继续复核或查看成果。',[{label:'查看表格',action:'table'}]);return;}const job=result.job_id,token=presentation.interactionToken();await perform('正在匹配价格与双系数',async()=>{const data=await api<Result>('/api/process/batch-match',json({job_id:job}));if(loadedJob.current!==job)return;acceptResult(data);setGorkCompletion(n=>n+1);add('匹配完成，计算表和报告已生成。接下来一起核对风险。',[{label:'检查经验池预警',action:'warning',primary:true},{label:'查看成果',action:'report'}],'assistant',false,resultCard(data));presentation.resultAvailable('table');if(token===presentation.interactionToken()&&layout.wide){presentation.showSummary();requestAnimationFrame(()=>{const panel=document.querySelector('.summary-body');if(panel)panel.scrollTop=0;});}await listRuns();});}
  async function warning(){if(!result||!completed){add('请先完成批量匹配，再进行经验池预警。');return;}const job=result.job_id;await perform('比对经验池与风险阈值',async()=>{const data=await api<Result>('/api/experience-warnings/run',form({job_id:job}));if(loadedJob.current!==job)return;acceptResult(data);const risk=await api<{items:Risk[]}>(`/api/risk/summary?job_id=${job}`);setRisks(risk.items);setRiskJobId(job);setGorkIssue(risk.items.length>0);if(!risk.items.length)setGorkCompletion(n=>n+1);presentation.resultAvailable('risk');add(risk.items.length?'检查完成。你可以从卡片直接定位需要关注的行。':'检查完成，当前没有返回风险事项。',[{label:'查看全部风险与依据',action:'risk',primary:true},{label:'查看报告',action:'report'}],'assistant',false,reviewCard(risk.items));});}
  async function generateRisk(){if(!result||!completed)return;const job=result.job_id;await perform('补充风险报告',async()=>{const data=await api<{risk_report_mode:string}>('/api/risk-report',form({job_id:job}));await refreshReport(job);presentation.resultAvailable('report');add(data.risk_report_mode==='demo_preset'?'V3.1 样本内置的演示风险正文已写入实际 Word。此步骤采用原系统演示旁路，未调用模型。':'风险正文已写入当前 Word。',[{label:'查看当前报告',action:'report'}],'assistant',false,artifactCard({...result,needs_recalculate:needsRecalculate}));});}
  async function recalculate(){if(!result){add('请先完成文件转换与匹配，再重算公式。');return;}const job=result.job_id;await perform('刷新公式与 Word 报告',async()=>{const data=await api<Result>('/api/preview/recalculate',json({job_id:job}));acceptResult(data);add(data.formula_recalculated?'Excel 公式已重算，预览和 Word 报告已刷新。':'预览与报告已刷新，但本机 Excel 公式重算不可用。请在 Excel 中打开成果刷新公式后再交付。',[{label:'查看报告',action:'report'}],'assistant',false,artifactCard(data,data.formula_recalculated?'公式、预览与报告已同步刷新。':'公式尚未完成重算，请在 Excel 中刷新公式后交付。'));});}
  async function inspectRow(cell:SelectedCell){if(!result)return;const token=presentation.interactionToken();const job=result.job_id;await perform('读取当前行的来源',async()=>{const data=await api<any>('/api/fill-assist/candidates',json({job_id:job,sheet_name:cell.sheet,row_number:cell.row}));setSources({...data,cell});if(token===presentation.interactionToken())open('sources');add('已为你展开这一行的依据。',[{label:'返回计算表',action:'locate',target:{sheet:cell.sheet,row:cell.row}}],'assistant',false,sourceCard(cell,data.candidates?.length||0));});}
  async function saveCell(){if(!selection||!result)return;const cell=selection;const job=result.job_id;await perform('保存人工修改与留痕',async()=>{const data=await api<Result>('/api/preview/cell',json({job_id:job,sheet_name:cell.sheet,row_number:cell.row,column_number:cell.column,value:editableValue(cellValue),edit_note:editNote,actor:'Astra 本机用户',recalculate:false}));acceptResult(data);setSelection(null);setGorkCompletion(n=>n+1);add('你的修改已经保存并留痕。',[{label:'重算公式与报告',action:'recalculate',primary:true},{label:'继续核对表格',action:'table'}],'assistant',false,editCard(cell,editableValue(cellValue),editNote));});}
  async function restore(run:Run,target:'preview'|'report'|'conversation'='preview',loadResult?:()=>Promise<Result>){let succeeded=false;const token=presentation.interactionToken();await perform('恢复独立任务成果',async()=>{
    const data=await (loadResult?loadResult():api<Result>(`/api/astra/runs/${run.job_id}`));
    const restoredName=data.project_name||run.name;
    const owner=workspace.jobs[data.job_id];
    if(owner&&workspace.conversations.find(c=>c.id===owner)?.job_id===data.job_id){await workspace.select(owner);acceptResult(data);if(token===presentation.interactionToken())open(target==='conversation'?'chat':target==='report'?'report':'table');setSidebar(false);if(target==='report')await refreshReport(data.job_id);succeeded=true;return;}

    if(owner)await workspace.select(owner);else await workspace.create();
    conversationContext.current=crypto.randomUUID();acceptResult(data);setProject(restoredName);setSidebar(false);setFile(null);setInputFileId('');setSheets([]);setRisks([]);setSources(null);setTimeline([]);if(token===presentation.interactionToken())open(target==='conversation'?'chat':target==='report'?'report':'table');if(target==='report')await refreshReport(data.job_id);
    const pending=data.summary.matching_status!=='completed';
    add(owner?`已打开本段对话中「${restoredName}」的实际成果，可以继续核对。`:`已恢复「${restoredName}」的实际成果，可从这里接着做。这是恢复提示，原聊天未保存。`,data.needs_recalculate?[{label:'重算公式与报告',action:'recalculate',primary:true}]:pending?[{label:'开始批量匹配',action:'match',primary:true}]:[{label:data.summary.warning_summary?.executed?'查看风险与依据':'检查经验池预警',action:data.summary.warning_summary?.executed?'risk':'warning',primary:true}],'assistant',false,resultCard(data,true));succeeded=true;
  });return succeeded;}
  async function openDashboardRun(projectId:string,runId:string,target:'preview'|'report'|'conversation'){
    if(busyRef.current||!workspace.ready)throw new Error('当前任务仍在处理中，请稍后再打开历史成果。');
    if(!await restore({job_id:'',name:'历史任务',status:'',updated_at:'',rows:0,input_filename:''},target,()=>api<Result>(`/api/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(runId)}/result`)))throw new Error('成果暂未恢复，请检查对话中的错误提示后重试。');
  }
  function newTask(){if(!busyRef.current)void newConversation();}
  function action(name:string){if(name.startsWith('format-document:')){void formatDocument(name.slice(16));return;}if(name.startsWith('download:')){const url=name.slice(9);if(/^\/api\/(?:settlement-audit|workload-capture)\/(?:download|current-download)\/[a-f0-9]{32}\/[a-z]+$/.test(url))window.open(url,'_blank','noopener');return;}if(name==='attach'){input.current?.click();return;}if(name==='convert'){void convert();return;}if(name==='match'){void match();return;}if(name==='warning'){void warning();return;}if(name==='risk-report'){void generateRisk();return;}if(name==='recalculate'){void recalculate();return;}if(name==='sample'){void sample();return;}if(name==='mapping'&&!file){input.current?.click();return;}open(name);}
  function offerContent(next:View,explicit=false){if(explicit)open(next);add(`可以打开${titles[next]}查看。`,[{label:'打开'+titles[next],action:next,primary:true}]);}
  function send(){const text=draft.trim();const explicitOpen=/^(请|帮我)?\s*(打开|查看|显示|进入|切换|展示|回到)/.test(text);if(!text||busyRef.current||!workspace.ready)return;chatFollow.current=true;setDraft('');add(text,undefined,'user');if(chatMode==='knowledge'||/^#知识|^#知识库/.test(text)){void askKnowledge(text,true);return;}if(/协同设置|飞书设置|weact设置/i.test(text)){open('collaboration-settings');return;}if(/复核进度|审核进度|复核状态|审核状态/.test(text)){prepareReview('progress');return;}if(/(飞书|weact|同事).*复核|发送.*复核|复核.*(飞书|weact|同事)/i.test(text)){prepareReview();return;}if(/公文|文稿排版/.test(text)){open('document');return;}const intents:[RegExp,View][]=[[/Gork|机器人|任务哨兵|任务追踪/i,'gork'],[/工作量|抓取/,'workload'],[/导入.*经验|经验池导入/,'experience'],[/结算|送审/,'settlement'],[/记忆|候选知识/,'memory'],[/展示地图/,'showcase'],[/地图|地点|地理/,'map'],[/能力治理|上岗|Skill/i,'skills'],[/AI.*增强|智能.*编制|字段确认/,'advanced'],[/费用.*图|分析图表/,'analysis'],[/分页|Word 预览/i,'word'],[/配置|设置/,'configuration'],[/派发|回执|通讯录/,'dispatch'],[/双路|对比回答/,'knowledge'],[/数字化项目/,'digital']];const intent=intents.find(([pattern])=>pattern.test(text));if(intent){if(explicitOpen)open(intent[1]);add(`${titles[intent[1]]}可以从下面的入口打开。`,[{label:'打开专业详情',action:intent[1],primary:true}],'assistant',false,{kind:'confirmation',title:titles[intent[1]],caption:'专业工具',icon:'grid',status:'等待操作'});return;}if(/架构图|系统架构/.test(text)){offerContent('architecture',explicitOpen);return;}if(/智能协同|协同|飞书|WeAct/i.test(text)){offerContent('collaboration',explicitOpen);return;}if(/知识网络|文章库/.test(text)){offerContent('articles',explicitOpen);return;}if(/知识库|资料库/.test(text)){offerContent('knowledge',explicitOpen);return;}if(/^(开始)?批量匹配[。！!\s]*$/.test(text)){void match();return;}if(/^(查看|显示|打开).*(风险|预警|复核)/.test(text)){open('risk');return;}if(/预警|检查风险|复核/.test(text)){if(result)void warning();else add('先添加 Excel，完成转换和匹配后，我会根据实际结果检查风险。',[{label:'添加 Excel',action:'attach',primary:true}]);return;}if(/重算/.test(text)){void recalculate();return;}if(/转换/.test(text)){void convert();return;}if(/报告|导出|下载/.test(text)){if(completed){if(explicitOpen)open('report');add('成果已就绪，可以从下面的入口打开。',[{label:'补充风险报告',action:'risk-report'}],'assistant',false,artifactCard({...result!,needs_recalculate:needsRecalculate}));}else add('请先完成批量匹配，才能生成正式成果。',[{label:result?'批量匹配':'添加 Excel',action:result?'match':'attach',primary:true}]);return;}if(/表格|计算表/.test(text)){offerContent('table',explicitOpen);return;}if(/星图|3d/i.test(text)){offerContent('universe',explicitOpen);return;}if(DEBUG_MODE&&/项目/.test(text)&&!/看板|历史|资料|新建/.test(text)){if(explicitOpen)showInsights();add('项目信息只显示当前会话所属项目。',[{label:'查看项目信息',action:'insights'}]);return;}if(/项目|历史|看板/.test(text)){if(explicitOpen)open('projects');add('可以从入口查看项目看板，或从历史成果继续工作。',[{label:'查看项目看板',action:'projects',primary:true}],'assistant',false,{kind:'confirmation',title:'项目看板',caption:'项目与历史成果',icon:'folder',status:'已打开',note:'统计来自本工作区的真实业务记录。'});return;}add('你可以通过这些已接通的能力，在对话中推进编制。',[{label:result?(completed?'检查经验池预警':'开始批量匹配'):file?'确认结构并转换':'添加 Excel',action:result?(completed?'warning':'match'):file?'convert':'attach',primary:true},{label:'查看全部能力',action:'tools'}],'assistant',false,capabilitiesCard);}

  function unavailable(message:Message,a:Action){if(a.action.startsWith('format-document:')&&(!activeDocumentSource||a.action.slice(16)!==sourceKey(activeDocumentSource)))return '请先打开这份文稿';return actionUnavailable(message,a,{context:conversationContext.current,result,busy:!!busy,needsRecalculate});}
  function locate(sheet:string,row:number){
    if(!result)return;const previews=result.summary.table_preview.sheets||[result.summary.table_preview];
    const index=previews.findIndex(s=>s.sheet_name===sheet);if(index<0){add('当前预览未包含该工作表，请在完整 Excel 中查看。');return;}
    setSheetIndex(index);setLocatedRow(row);open('table');
  }
  function prepareKnowledgeCandidate(message:Message){
    const answer=message.evidence;if(!answer||busyRef.current)return;
    const question=answer.question||messages.slice(0,messages.findIndex(m=>m.id===message.id)).reverse().find(m=>m.role==='user')?.text||'知识问答';
    const references=(answer.sources||[]).map((item:any)=>item.title||item.title_path||item.source_name||item.source||item.source_file||'知识引用').join('；');
    const excerpts=(answer.sources||[]).map((item:any)=>item.snippet||item.excerpt||item.content||item.text||'').filter(Boolean).join('\n\n');
    setKnowledgeSeed({id:crypto.randomUUID(),context:conversationContext.current,title:question.slice(0,120),question,conclusion:['evidence_only','evidence_fallback'].includes(answer.answer_mode)?excerpts:message.text,sourceReference:references,evidenceSummary:excerpts.slice(0,4000),sourceType:'knowledge_answer',jobId:message.job||''});open('memory');
  }
  function messageAction(message:Message,a:Action){if(unavailable(message,a)||busyRef.current)return;if(a.action==='knowledge-result'&&message.evidence){setEvidence(message.evidence);open('knowledge');return;}if(a.action==='locate'&&a.target){locate(a.target.sheet,a.target.row);return;}action(a.action);}

  useEffect(()=>{if(isProfessional(view))setProfessionalWarm(true);},[view]);
  function summaryContent(){return <CurrentProjectCard project={currentProject} ready={workspace.ready} openBoard={()=>open('projects')} openData={()=>{if(currentProject?.workspaceProjectId){setProjectId(currentProject.workspaceProjectId);open('project');}else open('library');}} openInput={()=>open('mapping')} openTable={()=>open('table')} openRisks={()=>open('risk')} assign={id=>void associateProject(id)} newProject={()=>{associateNewProject.current=workspace.currentConversation()?.id||null;setProjectEditor(true);}} projects={workspace.projects} busy={!!busy} contextKey={workspace.active?.id}/>;}
  const details=(panelView:View=view)=>{const contentActive=visible&&presentation.state.content===panelView;const view=panelView;

    if(view==='example')return null;
    if(view==='connections')return DEBUG_MODE?<LegacyConnections selected={connectionPlatform} select={setConnectionPlatform}/>:<PlatformConnections selected={connectionPlatform} select={setConnectionPlatform} {...platformConnection}/>;

    if(view==='report'||view==='document')return <div className="result-tab-panel document-tab-panel" id={view==='report'?'result-panel-report':undefined} role={view==='report'?'tabpanel':undefined} aria-labelledby={view==='report'?'result-tab-report':undefined}><DocumentPanel document={documentFor(view==='report'?reportDocument:selectedDocument)} conversation={workspace.active?.id||''} busy={!!busy} upload={()=>input.current?.click()} selectOriginal={value=>{const source=view==='report'?reportDocument:selectedDocument;if(source)setDocuments(all=>({...all,[sourceKey(source)]:{...all[sourceKey(source)],source,showOriginal:value}}));}}/></div>;
    if(isProfessional(view))return null;
    if(view==='gork')return <GorkConsole/>;
    if(view==='digital')return <DigitalAssistant dark={dark}/>;
    if(view==='architecture')return <Architecture key={architectureOpening} active={contentActive&&!welcomeVisible} dark={dark}/>;
    if(view==='articles')return <ArticleLibrary present={id=>void presentArticle(id)}/>;
    if(view==='knowledge')return <KnowledgePanel options={knowledgeOptions} setOptions={v=>{setKnowledgeOptions(v);setChatMode('knowledge');}} evidence={evidence} ask={q=>void askKnowledge(q)} busy={!!busy||!workspace.ready} weknora={weknora.status} refreshWeKnora={weknora.refresh}/>;
    if(view==='collaboration')return <><div className="module-actions"><Button onClick={()=>open('dispatch')}>派发、平台配置与复核回执</Button></div><CollaborationPanel key={workspace.active?.id} conversation={workspace.active?.id||''} job={result?.job_id||''} busy={!!busy} flush={workspace.flush} prepared={()=>add('复核草稿已保存。平台尚未连接，未发起发送。',undefined,'assistant',false,{kind:'confirmation',title:'复核草稿已保存',caption:'智能协同 · 本地准备',icon:'users',status:'未发送',note:'接收人尚待平台身份核验，没有送达回执。'})}/></>;
    if(view==='library'||view==='project')return <Library key={view+projectId} workspace={workspace} projectId={view==='project'?projectId:undefined} editProject={setProjectEditor} newChat={id=>void newConversation(id)} useFile={a=>void storedFile(a)} open={open}/>;

    if(view==='universe')return <Universe open={open}/>;
    if(view==='tools')return <CapabilityHub open={open}/>;
    if(view==='projects')return null;
    if(view==='mapping'&&file)return <Mapping sheets={sheets} setSheets={setSheets} filename={file.name} project={project} setProject={setProject} busy={!!busy} convert={convert} inspectHeader={inspectHeader}/>;
    if(DEBUG_MODE&&!result&&['table','risk','report'].includes(view))return <div className="empty-state result-tab-panel" id={`result-panel-${view}`} role="tabpanel" aria-labelledby={`result-tab-${view}`}><Icon name="sheet"/><h3>尚未载入表格内容</h3><p>在设置的“表格演示”中加载你的附件后，可切换表格、风险和文字报告。</p><Button primary onClick={()=>setSettings(true)}>打开设置 · 表格演示</Button></div>;
    if(!result)return <div className="empty-state"><Icon name="sheet"/><h3>从一份资料开始</h3><p>添加 Excel 后，这里会显示当前任务的专业细节。</p><Button primary onClick={()=>input.current?.click()} disabled={!!busy}>添加 Excel</Button></div>;
    if(view==='table')return <div className="result-tab-panel" id="result-panel-table" role="tabpanel" aria-labelledby="result-tab-table"><Workbook preferences={previewPreferences} setPreferences={setPreviewPreferences} refreshHeaders={refreshPreviewHeaders} result={result} sheetIndex={sheetIndex} setSheetIndex={index=>{if(index!==sheetIndex)setLocatedRow(undefined);setSheetIndex(index);}} busy={!!busy} match={match} recalculate={recalculate} needsRecalculate={needsRecalculate} selectedRow={locatedRow} edit={c=>{setOperationError('');setSelection(c);setCellValue(String(c.value??''));setEditNote('');}} inspect={inspectRow}/></div>;
    if(view==='risk')return <div className="result-tab-panel" id="result-panel-risk" role="tabpanel" aria-labelledby="result-tab-risk"><div className="module-actions"><Button onClick={()=>open('experience')}>预警图表、阈值与经验池</Button></div><Risks items={risks} busy={!!busy} warning={warning} hasRun={Boolean(summary?.warning_summary?.executed)} locate={r=>{const sheets=result.summary.table_preview.sheets||[result.summary.table_preview];const i=sheets.findIndex(s=>s.sheet_name===r.sheet_name);if(i>=0)setSheetIndex(i);setLocatedRow(r.excel_row);open('table');add(`已定位「${r.sheet_name}」第 ${r.excel_row} 行，可双击单元格修改，或点击书本查看依据。`);}}/></div>;

    if(view==='sources')return <div className="panel-content"><h3>{sources?`${sources.cell.sheet} · 第 ${sources.cell.row} 行`:'逐行核对来源'}</h3>{!sources?<div className="empty-state"><p>在计算表右侧点击书本按钮，查看当前行的来源。</p><Button onClick={()=>open('table')}>打开计算表</Button></div>:<><p className="panel-lead">标准规则、经验提示和候选建议分别核对。此处为原系统返回的来源信息。</p>{sources.trace?.map((t:any,i:number)=><div key={i} className="source-item"><span className="source-num">{String(i+1).padStart(2,'0')}</span><div><h3>{t.title||t.label||t.field||'来源记录'}</h3><p>{t.text||t.message||t.description||t.basis}</p><small>{t.source}</small></div></div>)}<h3 className="candidate-heading">基价辅助候选 · 尚未采用</h3>{sources.candidates?.slice(0,10).map((c:any)=><article className="candidate-card" key={c.id}><span className="badge badge-ghost">{c.source_label}</span><strong>{c.value}</strong><p>{c.reason}</p><small>{c.basis}</small></article>)}<Button onClick={()=>open('analysis')}>打开逐字段辅助填价</Button><Note>候选不会自动写入，请在专业表格中逐字段核对来源并确认。</Note><Button onClick={()=>open('table')}>返回计算表</Button></>}</div>;
    if(view==='trace')return <div className="panel-content"><h3>真实任务事件</h3><p className="panel-lead">只展示业务后端已经记录的事件，不模拟执行进度。</p>{timeline.length?timeline.map((t,i)=><article className="source-item" key={i}><span className="source-num">{i+1}</span><div><h3>{t.title||t.event_type}</h3><p>{t.detail||t.summary||t.message||({completed:'已完成',failed:'失败',running:'执行中'} as Record<string,string>)[t.status]||t.status}</p><small>{t.occurred_at||t.created_at}</small></div></article>):<Note>当前任务暂无可展示的业务事件。</Note>}</div>;
    return null;
  };

  const contentCaption=view==='document'?'':['architecture','articles','library','project','knowledge','tools','universe','projects','gork','insights','example'].includes(view)?({example:'只读节选 · 演示非正式审核',insights:'仅当前会话所属项目 · 可放大或收起',gork:'控制台连接与任务追踪',projects:'本工作区的真实项目与任务',architecture:'原图与动态展示',articles:'原文章与已整理关系',library:'公共与项目资料',project:'项目内对话共用',knowledge:'检索原文与引用依据',tools:'专业工具与迁移状态',universe:'能力关系 · 示意'} as any)[view]:result?`当前任务 ${result.job_id.slice(0,8)} · 独立成果`:'与对话共享当前任务';
  return <>{welcomeVisible&&<WelcomeScreen ready={workspace.ready} busy={!!busy} dark={dark} toggleTheme={()=>setDark(!dark)} openAppearance={()=>setAppearanceOpen(true)} currentTitle={workspace.active?.title} hasWork={!!(messages.length||draft||file)} error={workspace.error} enter={()=>enterWorkspace()} newChat={()=>void welcomeNewChat()} open={enterWorkspace}/>}<div className={`app-shell live-shell ${sidebar?'sidebar-open':''} ${!navigation.mobile&&navigation.collapsed?'sidebar-collapsed':''}`} id="shell" hidden={welcomeVisible}><WorkspaceSidebar workspace={workspace} navigation={navigation} activeView={visible?(view==='example'?(exampleRequest?.tab==='risks'?'risk':exampleRequest?.tab||'table'):view):'chat'} active={!welcomeVisible} settingsActive={settings} busy={!!busy} newChat={newTask} select={id=>void changeConversation(id)} showProject={id=>showProjectInsights(id)} open={next=>['table','risk','report'].includes(next)?openDataTab(next as DataTab):open(next)} settings={()=>setSettings(true)} search={()=>setSearchOpen(true)} newProject={()=>setProjectEditor(true)}/><button type="button" className="sidebar-backdrop" hidden={!navigation.mobile||!sidebar} tabIndex={-1} aria-label="关闭项目菜单遮罩" onClick={()=>setSidebar(false)}/><main className="main" inert={navigation.mobile&&sidebar}><header className="topbar four-surface-topbar"><div className="current-project-title"><button type="button" ref={navigation.toggleRef} className="btn btn-ghost btn-square sidebar-toggle" aria-controls="project-sidebar" aria-expanded={navigation.visible} aria-label={navigation.visible?'收起项目菜单':'展开项目菜单'} onClick={navigation.toggle}><Icon name={navigation.visible?'sidebar-close':'sidebar-open'}/></button><strong>{workspace.projects.find(p=>p.id===workspace.active?.project_id)?.name||'当前对话'}</strong></div><div className="top-actions"><button type="button" className={`btn btn-sm project-info-toggle ${presentation.state.mode==='summary'?'btn-primary':'btn-ghost'}`} aria-pressed={presentation.state.mode==='summary'} aria-controls="astra-summary" onClick={presentation.toggleSummary}><Icon name="folder"/>项目信息</button>{DEBUG_MODE?<LegacyStatusButtons open={id=>{setConnectionPlatform(id);setConnectionsOpen(true);}}/>:<PlatformStatusButtons snapshot={platformConnection.snapshot} open={id=>{setConnectionPlatform(id);setConnectionsOpen(true);}}/>}<div className="tooltip tooltip-bottom header-icon-tip header-architecture" data-tip="系统架构图"><button type="button" className="btn btn-ghost btn-square header-icon-action" aria-label="系统架构图" title="系统架构图" onClick={()=>open('architecture')}><Icon name="network"/></button></div><div className="tooltip tooltip-bottom header-icon-tip header-welcome" data-tip="返回欢迎页"><button type="button" className="btn btn-ghost btn-square header-icon-action" aria-label="返回欢迎页" title="返回欢迎页" onClick={showWelcome}><Icon name="spark"/></button></div><div className="tooltip tooltip-bottom header-icon-tip header-appearance" data-tip="外观与主题"><ThemeButton className="header-icon-action" label="外观与主题" expanded={appearanceOpen} open={()=>setAppearanceOpen(true)}/></div></div></header><div ref={layout.ref} style={layout.style} className={`workbench adjustable-workbench four-surface mode-${presentation.state.mode} ${presentation.state.mode==='chat'?'no-artifact':''} ${expanded?'expanded':''} ${layout.dragging?'is-resizing':''} ${layout.floating?'surface-floating':'surface-split'} ${layout.summaryFallback?'summary-fallback':''}`}>
<section id="astra-conversation" className={`conversation ${!messages.length?'home-scene':''}`} aria-label="智算任务对话"><div className="conversation-heading"><div className="conversation-identity"><div className="conversation-name"><h1>{DEBUG_MODE&&<span className="badge badge-outline conversation-demo-badge">模拟</span>}<span title={workspace.active?.title||'当前对话'}>{(workspace.active?.title||'当前对话').replace(/^【模拟】\s*/,'')}</span></h1></div></div><div className="conversation-header-actions"><button className="context-mode save-state" title={workspace.error||workspace.status} onClick={()=>void workspace.flush().catch(()=>{})}>{workspace.status}</button><button type="button" className="btn btn-ghost btn-square" aria-label={conversationDetails?'收起任务详情':'展开任务详情'} title="任务详情" aria-expanded={conversationDetails} aria-controls="conversation-task-details" onClick={()=>setConversationDetails(v=>!v)}><Icon name="info"/></button><button className="btn btn-ghost btn-square" aria-label="对话名称与归属" disabled={!!busy||!workspace.ready} onClick={()=>{setConversationTitle(workspace.active?.title||'');setConversationEditor(true);}}><Icon name="edit"/></button></div></div><div className="context-line compact-task-details" id="conversation-task-details" hidden={!conversationDetails}><span>智算 · Gork{busy?' · 正在处理':' · 与你一起工作'}</span><span className="badge skill-badge"><Icon name="spark"/>勘察测量</span><span>{result?`任务 ${result.job_id.slice(0,8)}`:'等待资料'}</span></div><div className="messages" ref={scroll} onScroll={e=>{const n=e.currentTarget;chatFollow.current=n.scrollHeight-n.scrollTop-n.clientHeight<60;chatScrollMemory.current.set(conversationContext.current,n.scrollTop);}} aria-live="polite">{(workspace.error||workspace.recovery)&&<div className="workspace-error" role="alert">{workspace.error||'已保留冲突前的本机草稿，请导出后核对。'}<Button onClick={workspace.exportDraft}>导出本机草稿</Button><Button onClick={()=>workspace.active?void workspace.flush().catch(()=>{}):window.location.reload()}>{workspace.active?'重试保存':'重新载入'}</Button></div>}{!messages.length?<div className="welcome"><h1>您好，我是造价智算智能体。</h1><div className="welcome-grid"><button className="welcome-card" onClick={()=>input.current?.click()} disabled={!!busy}><Icon name="sheet"/><strong>编制控制价<Icon name="arrow-up-right"/></strong><small>{DEBUG_MODE?'真实上传已隔离':'上传 Excel，开始真实编制'}</small></button><button className="welcome-card" onClick={()=>void sample()} disabled={!!busy}><Icon name="route"/><strong>体验完整流程<Icon name="arrow-up-right"/></strong><small>{DEBUG_MODE?'使用合成样例 · 不运行引擎':'使用 V3.1 正式验收样本'}</small></button><button className="welcome-card" onClick={()=>open('projects')}><Icon name="folder"/><strong>继续已有任务<Icon name="arrow-up-right"/></strong><small>恢复表格与当前成果</small></button><button className="welcome-card" onClick={()=>open('tools')}><Icon name="grid"/><strong>查看专业能力<Icon name="arrow-up-right"/></strong><small>工具与设置</small></button></div></div>:messages.map(m=>m.role==='user'?<div className="chat chat-end" key={m.id}><div className="chat-bubble">{m.text}</div></div>:<article className={`assistant-message ${m.error?'message-error':''}`} key={m.id} data-message-id={m.id}><div className="assistant-author">智算<small>Gork</small></div><div className="assistant-copy">{!m.error&&(m.evidence?<Prose text={m.text}/>:<p>{m.text}</p>)}{m.evidence?.sources?.length>0&&!m.error&&<Button disabled={!!busy} onClick={()=>prepareKnowledgeCandidate(m)}>整理为知识候选</Button>}{m.review?(m.review.closed?<span className="badge badge-ghost">已关闭复核设置 · 不触发发送</span>:m.context===conversationContext.current&&m.review.jobId===result?.job_id&&m.review.version===(result?.task_tracking?.task.artifact_version||0)&&(m.review.kind==='progress'||!needsRecalculate)?<ReviewConversation key={m.id} request={m.review} busy={!!busy} onBusy={label=>{if(m.context===conversationContext.current)professionalBusy(label);}} onSettings={()=>open('collaboration-settings')} onClose={()=>{if(m.review?.kind==='progress'){prepareReview();return;}setMessages(old=>old.map(item=>item.id===m.id?{...item,review:{...item.review!,closed:true}}:item));}}/>:<div className="notice"><span>成果已变化，请重新准备复核。</span><Button disabled={!!busy} onClick={()=>prepareReview(m.review?.kind)}>重新准备</Button></div>):m.card?<ConversationCard message={m} inputSettings={m.card.kind==='input'&&m.context===conversationContext.current&&file&&!result?<Mapping compact expanded={mappingExpanded} setExpanded={setMappingExpanded} sheets={sheets} setSheets={setSheets} filename={file.name} project={project} setProject={setProject} busy={!!busy} convert={convert} inspectHeader={inspectHeader}/>:undefined} onAction={a=>messageAction(m,a)} unavailable={a=>unavailable(m,a)}/>:m.actions&&<div className="conversation-actions">{m.actions.map(a=><Button key={a.action} primary={a.primary} disabled={!!unavailable(m,a)} title={unavailable(m,a)} onClick={()=>messageAction(m,a)}>{a.label}</Button>)}</div>}</div></article>)}{!DEBUG_MODE&&activeDocumentSource&&!documentFor(activeDocumentSource)?.output&&<section className="card document-offer" aria-label="当前文稿公文转换"><Icon name="file"/><div><strong title={activeDocumentSource.name}>{activeDocumentSource.name}</strong><span>{documentEngine.ready?'可转换为公文格式':documentEngine.error}</span></div><button className="btn btn-primary btn-sm" disabled={!!busy||!workspace.ready||!documentEngine.ready} onClick={()=>void formatDocument(sourceKey(activeDocumentSource))}>转换为公文</button></section>}{busy&&<WorkingCard label={busy} showAvatar={false}/>}</div><div className="composer-wrap"><ComposerQuickMenu context={conversationContext.current} active={!welcomeVisible&&layout.chatActive} state={{ready:workspace.ready,busy:!!busy,connected,hasResult:!!result,completed}} run={id=>{if(quickUnavailable(id,{ready:workspace.ready,busy:busyRef.current,connected,hasResult:!!result,completed}))return;if(['table','risk','report'].includes(id))openDataTab(id as DataTab);else action(id);}}/><form className="composer" onSubmit={e=>{e.preventDefault();send();}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy&&e.dataTransfer.files[0])void inspectFile(e.dataTransfer.files[0]);}}><div className="composer-input-row"><ComposerCompanion suspended={gorkSuspended} state={gorkState} completion={gorkCompletion}/><textarea ref={prompt} className="textarea" disabled={!workspace.ready||projectAssociating} aria-label="告诉智算你的任务" onFocus={()=>setComposing(true)} onBlur={()=>setComposing(false)} placeholder={busy?'可以先写下下一步需求…':'描述你的需求，或添加文件…'} rows={2} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}}/></div><div className={`composer-toolbar ${chatMode==='knowledge'?'with-knowledge':''}`}><div className="composer-tools"><button type="button" className="btn btn-ghost btn-square" aria-label="添加文件" disabled={!!busy||!connected||!workspace.ready} onClick={()=>input.current?.click()}><Icon name="plus"/></button><button type="button" className="btn btn-ghost skill-selector" onClick={()=>open('tools')}><Icon name="spark"/>专业工具<Icon name="chevron"/></button><span className="tool-divider"/><select className="chat-mode" aria-label="对话模式" disabled={!!busy} value={chatMode} onChange={e=>setChatMode(e.target.value as 'task'|'knowledge')}><option value="task">任务协作</option><option value="knowledge">知识问答</option></select></div>{chatMode==='knowledge'&&<div className="composer-knowledge"><Icon name="book"/><select className="chat-mode" aria-label="问答引擎" disabled={!!busy} value={knowledgeOptions.engine||'local'} onChange={e=>setKnowledgeOptions({...knowledgeOptions,engine:e.target.value as 'local'|'weknora'|'compare'})}><option value="local">原知识问答</option><option value="weknora" disabled={!weknora.status.available}>WeKnora{weknora.status.available?'':' · 未连接'}</option><option value="compare" disabled={!weknora.status.available}>双路对比{weknora.status.available?'':' · 待连接'}</option></select><button type="button" className="text-button" onClick={()=>open('knowledge')}>范围与引用</button></div>}{qaRunning?<button type="button" className="btn btn-outline stop-answer" onClick={stopKnowledge}><Icon name="stop"/>停止回答</button>:<button className="btn btn-primary btn-square send" type="submit" disabled={!!busy||!workspace.ready||!draft.trim()} aria-label="发送任务"><Icon name="arrow-up"/></button>}</div></form><div className="composer-note"><span className="enter-hint">Enter 发送</span></div></div></section><aside id="astra-summary" className="artifact summary-artifact" hidden={presentation.state.mode!=='summary'} aria-label="当前项目信息摘要"><header className="artifact-heading summary-heading"><h2>项目信息</h2><button type="button" className="btn btn-ghost btn-square" aria-label="关闭项目信息" title="关闭项目信息" onClick={presentation.closeSummary}><Icon name="close"/></button></header><div className="artifact-body summary-body">{summaryContent()}</div></aside><div className="workbench-separator" hidden={!layout.split} {...layout.separator}><span/><span className="separator-hint">拖动或方向键调整</span></div><section id="astra-preview" className={`artifact content-artifact ${view==='table'&&result?'artifact-table':''}`} aria-label="专业成果区" hidden={!visible}><header className={`artifact-heading ${isDashboard?'dashboard-preview-heading':view==='example'||['table','risk','report'].includes(view)?'data-preview-heading':''}`} aria-label={titles[view]}><div className="artifact-title">{isDashboard?<ProjectViewTabs active={activeProjectTab} select={selectProjectTab}/>:<>{view==='example'||['table','risk','report'].includes(view)?<><ContentViewTabs active={view==='example'?(exampleRequest?.tab==='risks'?'risk':exampleRequest?.tab||'table'):view as DataTab} example={view==='example'} select={openDataTab}/>{DEBUG_MODE&&<span className="badge badge-outline preview-demo-badge" title={view==='example'?'演示附件未随交接 · 无正式审核结论':'前端模拟数据 · 演示非正式审核'}>演示{view==='example'?' · 只读':''}</span>}</>:<><span className="artifact-mark"><Icon name={({table:'sheet',universe:'orbit',knowledge:'book',articles:'network',architecture:'network',library:'book',project:'folder',collaboration:'users'} as Record<string,string>)[view]||'file'}/></span><div><h2 title={titles[view]}>{titles[view]}</h2><small title={contentCaption}>{contentCaption}</small></div></>}</>}</div><div className="content-heading-actions">{view==='example'&&<button type="button" className="btn btn-ghost btn-square content-file-info" aria-label="文件说明" title="表格演示 · 文件说明" aria-expanded={exampleSourceDetails} aria-controls="example-source-note" onClick={()=>setExampleSourceDetails(value=>!value)}><Icon name="info"/></button>}{result&&['table','risk','report'].includes(view)&&<button type="button" className="btn btn-ghost btn-square" aria-label="查看依据" title="查看依据" onClick={()=>open('sources')}><Icon name="book"/></button>}<ContentActions fullscreen={expanded} onFullscreen={presentation.fullscreen} onReturn={presentation.returnToSplit} onClose={presentation.closeContent}/></div></header><div className="artifact-body retained-content-body" ref={artifactScroll} id={isDashboard?"astra-dashboard-panel":undefined} role={isDashboard?"tabpanel":undefined} aria-labelledby={isDashboard?`dashboard-tab-${activeProjectTab}`:undefined}>
{DEBUG_MODE&&exampleRequest&&<RetainedContentPane scope={conversationContext.current} view="example" variant={expanded?'fullscreen':'content'} active={visible&&view==='example'}><div className="uploaded-example-host"><UploadedExample sourceDetails={exampleSourceDetails} request={exampleRequest} onTabChange={tab=>setExampleRequest(r=>r?{...r,tab}:r)} active={visible&&!welcomeVisible&&view==='example'}/></div></RetainedContentPane>}
{dashboardWarm&&<RetainedContentPane scope={conversationContext.current} view="projects" variant={expanded?'fullscreen':'content'} active={visible&&view==='projects'}><div className="astra-dashboard-host"><Suspense fallback={<div className="empty-state" role="status">正在载入项目看板…</div>}><ProjectDashboard key={presentation.state.context} active={visible&&!welcomeVisible&&view==='projects'&&dashboardTab==='board'} apiBase="" onOpenRun={openDashboardRun}/></Suspense>{dashboardTab==='runs'&&<Projects runs={runs} restore={restore} busy={!!busy}/>}</div></RetainedContentPane>}
{professionalWarm&&<RetainedContentPane scope={conversationContext.current} view={isProfessional(view)?view:'professional'} variant={expanded?'fullscreen':'content'} active={visible&&isProfessional(view)}><ProfessionalPanel key={conversationContext.current} view={view} context={conversationContext.current} jobId={result?.job_id||''} inputFile={file} sheets={sheets} knowledgeSeed={knowledgeSeed} palette={palette} dark={dark} active={visible&&isProfessional(view)&&!welcomeVisible} onBusy={professionalBusy} onNavigate={open} onOpenRun={openDashboardRun} onReceipt={r=>void professionalReceipt(r)}/></RetainedContentPane>}
{presentation.state.visited.filter(v=>!['projects','example','insights'].includes(v)&&!isProfessional(v)).map(v=><RetainedContentPane key={conversationContext.current+':'+v} scope={conversationContext.current} view={v} variant={expanded?'fullscreen':'content'} active={visible&&view===v}>{(['table','risk','report','document','sources','mapping','library','project','knowledge','architecture'].includes(v)||visible&&view===v)?details(v):null}</RetainedContentPane>)}
</div><footer className="artifact-footer" hidden={isDashboard||view==='report'||view==='document'}><button className="text-button" onClick={()=>open('tools')}>全部工具<Icon name="arrow-right"/></button></footer></section></div></main></div><FloatingGork active={!welcomeVisible&&visible&&!layout.chatActive&&!robotSettings} state={gorkState} completion={gorkCompletion}/><input ref={input} type="file" accept=".xlsx,.doc,.docx,.md,.markdown" hidden onChange={e=>{if(e.target.files?.[0])void inspectFile(e.target.files[0]);e.target.value='';}}/>{searchOpen&&<SearchConversations close={()=>setSearchOpen(false)} select={id=>void changeConversation(id)}/>}{projectEditor&&<ProjectEditor project={projectEditor===true?undefined:projectEditor} close={()=>{associateNewProject.current=null;setProjectEditor(null);}} saved={p=>void projectSaved(p)}/>}{conversationEditor&&<Modal title="对话名称与归属" close={()=>setConversationEditor(false)}><label className="field">对话名称<input className="input" value={conversationTitle} onChange={e=>setConversationTitle(e.target.value)} maxLength={120}/></label><Button primary disabled={!!busy||!conversationTitle.trim()} onClick={()=>void perform('正在保存对话名称',async()=>{await workspace.rename(conversationTitle);setConversationEditor(false);})}>保存名称</Button>{!workspace.active?.project_id&&workspace.projects.length>0&&<label className="field">归入项目（附件会成为项目共享资料）<select className="select" defaultValue="" disabled={!!busy} onChange={e=>{if(e.target.value)void perform('正在归入项目',async()=>{await workspace.assign(e.target.value);setConversationEditor(false);});}}><option value="">选择项目</option>{workspace.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}{workspace.active?.project_id&&<Note>此对话属于 {workspace.projects.find(p=>p.id===workspace.active?.project_id)?.name}，共用该项目资料。</Note>}</Modal>}{selection&&<Modal title={`第 ${selection.row} 行 · ${selection.header||'单元格'}`} close={()=>{if(!busy)setSelection(null);}}><p className="muted">{selection.sheet} · 只修改当前输出副本</p>{operationError&&<p className="edit-error" role="alert">{operationError}</p>}<label className="field">单元格值<input autoFocus className="input" aria-label="单元格值" value={cellValue} onChange={e=>setCellValue(e.target.value)} disabled={!!busy}/></label><label className="field">修改依据<textarea className="textarea" value={editNote} onChange={e=>setEditNote(e.target.value)} placeholder="填写来源或调整原因，随修改一起留痕" disabled={!!busy}/></label><Note>公式、受保护单元格及系统说明列由后端校验，不能强行覆盖。</Note><div className="action-row"><Button onClick={()=>setSelection(null)} disabled={!!busy}>取消</Button><Button primary disabled={!!busy||!editNote.trim()} onClick={saveCell}>确认保存并留痕</Button></div></Modal>}{appearanceOpen&&<Modal title="外观与主题" close={()=>setAppearanceOpen(false)}><AppearanceControls palette={palette} dark={dark} setPalette={setPalette} setDark={setDark} reset={resetAppearance} error={appearanceError}/></Modal>}{connectionsOpen&&<Modal title="连接状态" close={()=>setConnectionsOpen(false)}>{DEBUG_MODE?<LegacyConnections selected={connectionPlatform} select={setConnectionPlatform}/>:<PlatformConnections selected={connectionPlatform} select={setConnectionPlatform} {...platformConnection}/>}</Modal>}{robotSettings&&<Modal title="Go 机器人设置" close={()=>{setRobotSettings(false);setSettings(true);}}><GorkSettings/></Modal>}{settings&&<Modal title="智算Astra · 设置" close={()=>setSettings(false)}><section className="workspace-settings-links"><h3>工作区</h3><div><button type="button" className="btn btn-outline" onClick={()=>{setSettings(false);open('configuration');}}>专业设置</button><button type="button" className="btn btn-outline" onClick={()=>{setSettings(false);open('collaboration-settings');}}>协同设置</button></div></section>{DEBUG_MODE&&<UploadedExampleSettings activeTab={view==='example'&&visible?exampleRequest?.tab:undefined} open={tab=>{setSettings(false);showUploadedExample(tab);}}/>}<div className="settings-agent"><Gork size={60} still/><div><h3>智算 · Gork</h3><p>勘察测量控制价编制</p></div><button type="button" className="btn btn-ghost btn-sm robot-settings-entry" onClick={()=>{setSettings(false);setRobotSettings(true);}}>Go 机器人设置<Icon name="arrow-right"/></button></div><AppearanceControls palette={palette} dark={dark} setPalette={setPalette} setDark={setDark} reset={resetAppearance} error={appearanceError}/><div className="settings-row"><span>Gork 机器人任务联动</span><button className="btn btn-ghost btn-sm" onClick={()=>{setSettings(false);open('gork');}}>查看联动状态<Icon name="arrow-right"/></button></div><div className="settings-row"><span>对话编制默认方式</span><span className="badge badge-success">机械规则 · 本地离线</span></div><Note>模型、WeKnora 与协同需配置连接。</Note><a hidden={DEBUG_MODE} href="/design.html" className="text-button" target="_blank" rel="noreferrer">查看第一版完整设计样例<Icon name="arrow-up-right"/></a></Modal>}</>;
}

createRoot(document.getElementById('root')!).render(<App/>);
