import {WorkbenchModeSwitch} from './project-sandbox/WorkbenchModeSwitch';
import type {WorkbenchStyle} from './project-sandbox/workbench-preference';
import {GorkConnection} from './GorkConnection';
import {RuntimeConsole} from './RuntimeConsole';
import {useRuntimeConsole} from './useRuntimeConsole';
import {scheduleIdlePreload} from './idle-preload.mjs';
import {warmMapResources} from '../map-resources';
import {warmGlobeResources} from '../globe-resources';
import {viewIconName} from '../icon-catalog.js';
import {ComposerKnowledgeQuestions} from './ComposerKnowledgeQuestions';
import {MappingPanel} from './MappingPanel';
import {KnowledgeCitationPanel} from './KnowledgeCitationPanel';
import {KnowledgeAnswer} from './KnowledgeAnswer';
import {agentComposerSpaceCompletion,prefixedKnowledgeQuestion,knowledgeQuestionPrompt,knowledgeAnswerEngine,recommendedKnowledgeScope,waitForKnowledgePresentation,PRESET_KNOWLEDGE_LOADING,isPresetKnowledgeQuestion} from './knowledge-shortcut';
import {SettingsDialog} from './SettingsDialog';
import {settingsSectionForRoute,type SettingsSection} from './settings-sections';
import {ReviewConversation} from './ReviewConversation';
import {GorkSettings} from './GorkSettings';
import {DocumentPanel} from './DocumentPanel';
import {GongwenCard} from './GongwenCard';
import {riskMarkdownSource as reportMarkdownSource,reportProgressCard,type RiskReportReply} from './risk-document';
import {sourceKey,type DocumentSource,type DocumentState,type FormattedDocument,type GongwenDraft} from './document-types';
import {installEntranceMotion} from './entrance-motion';
import './entrance-motion.css';
import {LegacyStatusButtons,LegacyConnections,type Platform} from '../frontend-debug/legacy-system/disabled';
import {PlatformConnections,PlatformStatusButtons,usePlatformStatus} from './PlatformConnections';
import {UploadedExampleSettings} from './UploadedExampleSettings';
import {ComposerCompanion} from './ComposerCompanion';
import {ComposerQuickMenu} from './ComposerQuickMenu';
import {quickUnavailable,quickPrompt} from './quick-actions';
import {resolveCommand} from './commands';
import {readBusiness,businessForm} from './business-settings';
import {BusinessSettings} from './BusinessSettings';
import {QuickSettings,readQuick} from './QuickSettings';
import {RowAssist,type RowContext} from './RowAssist';
import {BatchMatchError,requestBatchMatch} from '../professional/batchMatchRequest';
import {FloatingGork} from './FloatingGork';
import UploadedExample,{type ExampleRequest,type ExampleTab} from '../frontend-debug/uploaded-example/disabled';
import {ContentViewTabs,dataTabDestination,type DataTab} from './workbench/ContentViewTabs';
import {ProjectViewTabs,type ProjectTab} from './workbench/ProjectViewTabs';
import {ContentActions} from './workbench/ContentActions';
import {usePresentation} from './workbench/usePresentation';
import {RetainedContentPane,captureContentScroll} from './workbench/RetainedContentPane';
import {useWorkbenchLayout} from './workbench/useWorkbenchLayout';
import {useWorkbenchStyle} from './project-sandbox/workbench-preference';
import './project-sandbox/project-sandbox.css';
const ProjectSandbox=lazy(()=>import('./project-sandbox/ProjectSandbox'));
import {SandboxProjectOverview} from './project-sandbox/SandboxProjectOverview';
import {SandboxFloatingCards} from './project-sandbox/SandboxFloatingCards';
import {CurrentProjectCard} from './workbench/CurrentProjectCard';
import {currentProjectSnapshot,type ResultScope} from './workbench/current-project';
import './workbench/workbench-layout.css';
import './workbench/four-surface.css';
import './workbench/project-summary-surface.css';
import {DEBUG_MODE} from '../frontend-debug/mock-adapter';
import {debugText} from '../frontend-debug/bootstrap';
import {GorkConsole} from './GorkConsole';
import {useAppearance} from './appearance';
import {AppearanceControls,ThemeButton,ThemeModeButton} from './AppearanceControls';
import {lazy,Suspense,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {DigitalFilePicker} from '../modules/digital_cost/DigitalFilePicker';
import {guideReply,type DigitalState,type DigitalSession,type DigitalCommand} from '../modules/digital_cost/guide';
import {DigitalAssistant} from '../modules/digital_cost/DigitalAssistant';
import {CapabilityHub} from './CapabilityHub';
import {ProfessionalPanel,isProfessional,professionalTitles,type ProfessionalReceipt,type KnowledgeSeed} from './ProfessionalPanel';
import {Prose} from './Prose';
import type {KnowledgeTab} from './KnowledgeWorkspace';
import ModelSettings from './ModelSettings';
import {KnowledgeSettings} from './KnowledgeSettings';
import {readWeKnora} from './weknora-stream';
import {useWeKnora} from './useWeKnora';
import {WelcomeScreen,readSkipWelcome} from './WelcomeScreen';
import {gorkActivity} from './gork-motion';
import {useGorkFeedback} from './useGorkFeedback';
import {useWorkspace,workspaceApi,type Asset,type Conversation,type Project,type Snapshot} from './useWorkspace';
import {WorkspaceSidebar,SearchConversations,ProjectEditor,Library} from './WorkspaceUI';
import {findImportProject,projectImportCard,readImportProjectFile} from './project-imports';
import {ArchitectureWindow} from './SystemArchitecture';
import {KnowledgeWorkspace,KnowledgeTabs,CollaborationPanel,type Evidence,type KnowledgeOptions} from './MigratedModules';
import './workspace.css';
import {createRoot} from 'react-dom/client';
import {api,form,json} from './api';
import {prepareSheets,editableValue} from './workbook';
import {Button,Icon,Modal,Note,Universe} from './ui';
import {Mapping,Risks,ReportPanel,Projects} from './panels';
import type {Action,ConversationCard as Card,Inspection,Message,Report,Result,Risk,Run,SelectedCell,SheetConfig,View} from './types';
import {Workbook,readPreviewPreferences} from './table/Workbook';
import {riskColumn,hasPreviewRow,riskActionTarget,type CellLocation} from './table/risk-location';
import '../style.css';
import '../astra.css';
import './studio.css';
import './appearance.css';
import {useSidebar} from './useSidebar';
import {TaskProgress} from './TaskProgress';
import {ConversationCard,WorkingCard} from './ConversationCard';
import {actionUnavailable,artifactCard,capabilitiesCard,editCard,errorCard,inputCard,resultCard,reviewCard,sourceCard} from './conversation-cards';

const LogoSettings=lazy(()=>import('./LogoSettings'));
const ProjectDashboard=lazy(()=>import('./project-dashboard/ProjectDashboard'));
const titles:Record<View,string>={document:'公文转换',connections:'飞书与 WeAct 连接情况',example:'表格演示',insights:'当前项目状态',universe:'能力星图（示意）',mapping:'输入结构与列映射',table:'控制价计算表',risk:'风险与人工复核',report:'成果报告',sources:'当前行的依据',projects:'项目看板',tools:'专业能力中心',trace:'任务轨迹',library:'资料库',project:'项目资料',architecture:'系统架构',knowledge:'知识工作区',articles:'知识工作区',collaboration:'智能协同',...professionalTitles,digital:'数字化造价',gork:'Gork 机器人联动'} as Record<View,string>;



function App(){
  useEffect(()=>installEntranceMotion(document),[]);
  const [professionalWarm,setProfessionalWarm]=useState(false);
  const [digitalHeaderTarget,setDigitalHeaderTarget]=useState<HTMLDivElement|null>(null);
  const [mapPrewarm,setMapPrewarm]=useState(false);
  const [rowAssist,setRowAssist]=useState<string|null>(null),[rowContext,setRowContext]=useState<RowContext|null>(null);
  const startingRowAssist=useRef(false);
  const [businessRevision,setBusinessRevision]=useState(0);
  const [quickPreferences,setQuickPreferences]=useState(readQuick);
  const [batchUncertainJob,setBatchUncertainJob]=useState('');
  useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key==='astra.quick-settings.v1')setQuickPreferences(readQuick());};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
  const [knowledgeSeed,setKnowledgeSeed]=useState<KnowledgeSeed|null>(null);
  function professionalBusy(label:string){if(label&&!busyRef.current)gorkFeedback.interruptSuccess();busyRef.current=!!label;setBusy(label);}
  async function professionalReceipt(receipt:ProfessionalReceipt){
    const context=conversationContext.current;
    let completedResult:Result|null=null;let warningFound=false;
    if(receipt.jobId&&/^[a-f0-9]{32}$/.test(receipt.jobId)&&!['/api/settlement-audit/review','/api/workload-capture/run','/api/experience-pool/import'].includes(receipt.path)){
      try{const updated=await api<Result>(`/api/astra/runs/${receipt.jobId}`);if(context!==conversationContext.current)return;acceptResult(updated);warningFound=Number(updated.summary.warning_summary?.warning_rows||0)>0;if(receipt.path==='/api/process/batch-match'&&updated.summary.matching_status==='completed')completedResult=updated;}catch(e){add((e as Error).message,undefined,'assistant',true);return;}
    }
    if(context!==conversationContext.current)return;
    if(receipt.path==='/api/experience-warnings/run'&&warningFound)gorkFeedback.warning();else gorkFeedback.success();
    const downloads=Object.entries(receipt.downloads||{}).filter(([,url])=>/^\/api\/(?:settlement-audit|workload-capture)\/(?:download|current-download)\/[a-f0-9]{32}\/[a-z]+$/.test(url)).map(([kind,url])=>({label:({excel:'下载审核表',report:'下载审核报告',result:'下载审核明细',workload:'下载标注工作量',target:'下载抓取计算表'} as Record<string,string>)[kind]||'下载成果',action:'download:'+url}));
    add(receipt.title,[...downloads,{label:'查看专业详情',action:receipt.view,primary:true},...(receipt.jobId===result?.job_id?[{label:'查看计算表',action:'table'}]:[])],'assistant',false,completedResult?resultCard(completedResult):{kind:'result',title:receipt.title,caption:'专业操作 · 实际返回',icon:'check',status:'已返回',note:'请在右侧核对处理结果、待复核项和完整成果。'});
  }

  const [mappingExpanded,setMappingExpanded]=useState(false);
  const [mappingOpen,setMappingOpen]=useState(false),[mappingSheet,setMappingSheet]=useState(0);
  const mappingReturnFocus=useRef<HTMLElement|null>(null);
  function showMapping(expand=false){mappingReturnFocus.current=document.activeElement as HTMLElement;setCitationMessage(null);setMappingOpen(true);if(expand)setMappingExpanded(true);presentation.showSummary();setSidebar(false);}
  function closeMapping(){setMappingOpen(false);presentation.closeSummary();requestAnimationFrame(()=>mappingReturnFocus.current?.isConnected&&mappingReturnFocus.current.focus({preventScroll:true}));}
  const [architectureOpening,setArchitectureOpening]=useState(0);
  const [architectureOpen,setArchitectureOpen]=useState(false);
  const [architectureDark,setArchitectureDark]=useState(true);
  const [knowledgeTab,setKnowledgeTab]=useState<KnowledgeTab>('ask'),[knowledgeRevision,setKnowledgeRevision]=useState(0);
  const [dashboardWarm,setDashboardWarm]=useState(false);
  const [dashboardTab,setDashboardTab]=useState<'board'|'runs'>('board');
  const [welcomeVisible,setWelcomeVisible]=useState(()=>!readSkipWelcome());
  const [sandboxWarm,setSandboxWarm]=useState(readSkipWelcome);
  function showWelcome(){setArchitectureOpen(false);setSettings(false);setConnectionsOpen(false);setSidebar(false);setSearchOpen(false);setWelcomeVisible(true);}
  function enterWorkspace(next?:string){setSandboxWarm(true);setWelcomeVisible(false);if(next){open(next);if(next==='knowledge')setChatMode('knowledge');}requestAnimationFrame(()=>{if(prompt.current?.offsetParent)prompt.current.focus();else document.querySelector<HTMLButtonElement>('[aria-label="聊天"]')?.focus();});}
  async function welcomeNewChat(){
    if(busyRef.current||!workspace.ready)throw new Error('工作空间尚未就绪，请稍后重试。');
    busyRef.current=true;setBusy('正在新建任务');gorkFeedback.interruptSuccess();
    try{await workspace.create();setConversationCollapsed(false);enterWorkspace('chat');}
    finally{busyRef.current=false;setBusy('');}
  }
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
  const isDashboard=['projects','map','aerial'].includes(view);
  const isKnowledge=['knowledge','articles'].includes(view);
  function selectKnowledgeTab(tab:KnowledgeTab){setKnowledgeTab(tab);presentation.open('knowledge');if(tab==='network')presentation.fullscreen();}
  const activeProjectTab:ProjectTab=view==='map'||view==='aerial'?view:dashboardTab;
  function selectProjectTab(tab:ProjectTab){if(tab==='board'||tab==='runs'){setDashboardTab(tab);open('projects');}else open(tab);}

  const [exampleRequest,setExampleRequest]=useState<ExampleRequest|null>(null);
  const [exampleSourceDetails,setExampleSourceDetails]=useState(false);
  function openDataTab(tab:DataTab){const target=dataTabDestination(tab,DEBUG_MODE&&!!exampleRequest,!!result,view);if(target.view==='example'){setExampleRequest(r=>r?{...r,tab:target.tab!}:r);open('example');}else open(target.view);}
  function showUploadedExample(tab:ExampleTab){if(!DEBUG_MODE)return;setExampleRequest(r=>({id:(r?.id||0)+1,tab}));open('example');}

  const [inputConversationId,setInputConversationId]=useState('');
  const [resultScope,setResultScope]=useState<ResultScope|null>(null);
  const [riskJobId,setRiskJobId]=useState('');
  const [riskRead,setRiskRead]=useState({job:'',loading:false,error:''});
  const riskRequest=useRef<AbortController|null>(null);
  const [conversationDetails,setConversationDetails]=useState(false);
  const [connectionPlatform,setConnectionPlatform]=useState<Platform>('default');
  const [connectionsOpen,setConnectionsOpen]=useState(false);
  const platformConnection=usePlatformStatus(!DEBUG_MODE&&!welcomeVisible);
  const associateNewProject=useRef<string|null>(null);
  const [projectAssociating,setProjectAssociating]=useState(false);
  const architecturePresentation=architectureOpen&&!welcomeVisible;
  const [weknoraGraphVisible,setWeKnoraGraphVisible]=useState(false);
  const networkPresentation=visible&&(view==='aerial'||view==='knowledge'&&(knowledgeTab==='network'||knowledgeTab==='weknora'&&weknoraGraphVisible))&&!welcomeVisible;
  const [networkDark,setNetworkDark]=useState(true);
  useEffect(()=>{if(!networkPresentation)setNetworkDark(true);},[networkPresentation]);
  const {palette,dark,sandboxRoofLabels,setSandboxRoofLabels,sandboxAutoOrbit,sandboxOrbitDelay,setSandboxAutoOrbit,setSandboxOrbitDelay,sandboxChatBackground,sandboxChatTransparency,setSandboxChatBackground,setSandboxChatTransparency,setPalette,setDark:setPreferredDark,reset:resetAppearance,error:appearanceError}=useAppearance(architecturePresentation?architectureDark:networkPresentation?networkDark:undefined);
  function setDark(value:boolean){if(networkPresentation&&!architecturePresentation){setNetworkDark(value);return;}setPreferredDark(value);if(architecturePresentation)setArchitectureDark(value);}
  const [appearanceOpen,setAppearanceOpen]=useState(false);const navigationState=useSidebar();const navigation={...navigationState,collapsed:false,visible:!navigationState.mobile||navigationState.visible};const {sidebar,setSidebar}=navigation;const [busy,setBusy]=useState('');const busyRef=useRef(false);
  useEffect(()=>scheduleIdlePreload(()=>Promise.allSettled([warmMapResources(),warmGlobeResources()]),{busy:()=>busyRef.current}),[]);
  const [operationError,setOperationError]=useState('');
  const [sandboxCancelVersion,setSandboxCancelVersion]=useState(0);
  const gorkFeedback=useGorkFeedback();
  const [settingsSection,setSettingsSection]=useState<SettingsSection>('appearance');
  const [settingsWorking,setSettingsWorking]=useState('');
  const [composing,setComposing]=useState(false);
  const [connected,setConnected]=useState(false);const [file,setFile]=useState<File|null>(null);const [sheets,setSheets]=useState<SheetConfig[]>([]);
  const [project,setProject]=useState('');const [result,setResult]=useState<Result|null>(null);const [runs,setRuns]=useState<Run[]>([]);
  const [sheetIndex,setSheetIndex]=useState(0);const [risks,setRisks]=useState<Risk[]>([]);const [report,setReport]=useState<Report|null>(null);
  const [needsRecalculate,setNeedsRecalculate]=useState(false);const [locatedRow,setLocatedRow]=useState<number>();const [locatedCell,setLocatedCell]=useState<CellLocation>();const locationRequest=useRef(0);
  const [selection,setSelection]=useState<SelectedCell|null>(null);const [cellValue,setCellValue]=useState('');const [editNote,setEditNote]=useState('');
  useEffect(()=>{if(presentation.state.mode!=='summary')setMappingOpen(false);},[presentation.state.mode]);
  const [citationMessage,setCitationMessage]=useState<Message|null>(null);
  const citationReturnFocus=useRef<HTMLElement|null>(null);
  function closeCitations(){setCitationMessage(null);presentation.closeSummary();requestAnimationFrame(()=>citationReturnFocus.current?.isConnected&&citationReturnFocus.current.focus({preventScroll:true}));}
  function showCitations(message:Message){setMappingOpen(false);citationReturnFocus.current=document.activeElement as HTMLElement;setCitationMessage(message);presentation.showSummary();}
  useEffect(()=>{if(presentation.state.mode!=='summary')setCitationMessage(null);},[presentation.state.mode]);
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
  const [riskDocument,setRiskDocument]=useState<DocumentSource|null>(null);
  const [gongwenOpen,setGongwenOpen]=useState(false);
  const [gongwenSource,setGongwenSource]=useState<DocumentSource|null>(null);
  const gongwenUpload=useRef<HTMLInputElement>(null);
  const [documentEngine,setDocumentEngine]=useState({ready:false,error:'正在检查公文引擎…'});
  const snapshot:Snapshot={riskDocument,gongwenOpen,gongwenSource,batchUncertainJob,selectedDocument,documents,messages,draft,locatedRow,context:conversationContext.current,inputFileId,project,sheets,job_id:result?.job_id||'',view,visible,sheetIndex,panelProjectId:projectId,chatMode,knowledgeOptions};
  const workspace=useWorkspace(snapshot,async(state,conversation)=>{
    captureContentScroll(artifactScroll.current);if(scroll.current?.getClientRects().length)chatScrollMemory.current.set(conversationContext.current,scroll.current.scrollTop);
    const data=state.job_id?await api<Result>(`/api/astra/runs/${state.job_id}`):null;
    let attachment:File|null=null;
    if(state.inputFileId){const response=await fetch(`${workspaceApi}/assets/${state.inputFileId}?conversation_id=${conversation.id}`);if(!response.ok)throw new Error('当前对话的资料文件无法恢复，请检查独立工作区');const assets=await api<{items:Asset[]}>(`${workspaceApi}/assets?scope=conversation&conversation_id=${conversation.id}`);const asset=assets.items.find(a=>a.id===state.inputFileId);if(asset)attachment=new File([await response.blob()],asset.name);}
    conversationContext.current=state.context||crypto.randomUUID();chatFollow.current=!chatScrollMemory.current.has(conversationContext.current);loadedJob.current='';previewRefreshAttempt.current='';
    gorkFeedback.reset();setOperationError('');setResult(null);setResultScope(null);setRiskJobId('');setNeedsRecalculate(false);if(data)acceptResult(data,false,conversation);
    setSelectedDocument(state.selectedDocument||null);setDocuments(state.documents||{});setRiskDocument(state.riskDocument||null);setGongwenOpen(!!state.gongwenOpen);setGongwenSource(state.gongwenSource||null);
    setMappingExpanded(false);setMessages(state.messages||[]);setDraft(state.draft||'');setFile(attachment);setInputConversationId(attachment?conversation.id:'');setInputFileId(state.inputFileId||'');setSheets(state.sheets||[]);setProject(state.project||'');
    setMappingOpen(false);setMappingSheet(0);setCitationMessage(null);setRisks([]);setReport(null);setSources(null);setTimeline([]);setSelection(null);setRowAssist(null);setRowContext(null);setBatchUncertainJob(data?.summary.matching_status==='completed'?'':state.batchUncertainJob||'');setEvidence([...state.messages||[]].reverse().find(m=>m.evidence)?.evidence||null);setChatMode(state.chatMode||'task');setKnowledgeOptions(state.knowledgeOptions||{library_ids:null,retrieval_mode:'classic'});setProjectId(state.panelProjectId||'');setLocatedRow(state.locatedRow);setLocatedCell(undefined);setSheetIndex(state.sheetIndex||0);
    presentation.enter(conversation.project_id||null,conversation.id);setSidebar(false);
    if(data&&state.view==='risk')void refreshRisk(data.job_id);if(data&&state.view==='report')void refreshReport(data.job_id);
  });
  const currentProjectName=workspace.projects.find(p=>p.id===workspace.active?.project_id)?.name;
  const currentProject=currentProjectSnapshot({ready:workspace.ready,active:workspace.active,projects:workspace.projects,conversations:workspace.conversations,result,resultScope,risks,riskJobId,filename:file?.name||'',inputScope:{conversationId:inputConversationId,projectName:project},debug:DEBUG_MODE});
  useEffect(()=>{
    if(workspace.ready&&result?.summary.warning_summary?.executed&&loadedJob.current===result.job_id)void refreshRisk(result.job_id,true);
    return()=>{riskRequest.current?.abort();};
  },[workspace.ready,workspace.active?.id,result?.job_id,result?.summary.warning_summary?.executed]);
  const workbenchStyle=useWorkbenchStyle(presentation.state.context);
  const [summaryOverride,setSummaryOverride]=useState(false),[conversationCollapsed,setConversationCollapsed]=useState(false);
  const homeAvailable=!visible&&!mappingOpen&&!citationMessage&&!summaryOverride;
  const simpleHome=homeAvailable&&workbenchStyle.style==='simple';
  useEffect(()=>{if(!welcomeVisible||!workspace.ready||sandboxWarm)return;return scheduleIdlePreload(()=>setSandboxWarm(true),{busy:()=>busyRef.current,delay:500})},[welcomeVisible,workspace.ready,sandboxWarm]);
  const sandboxVisible=homeAvailable&&workbenchStyle.style!=='simple';
  // Mount on first use, then retain the same paused V11 scene across workspace views.
  const [sandboxRetained,setSandboxRetained]=useState(false);
  useEffect(()=>{if(sandboxVisible&&(!welcomeVisible||sandboxWarm))setSandboxRetained(true)},[sandboxVisible,welcomeVisible,sandboxWarm]);
  const sandboxMounted=workspace.ready&&((sandboxVisible&&(!welcomeVisible||sandboxWarm))||sandboxRetained);
  const sandboxHome=sandboxVisible&&workbenchStyle.style==='sandbox',classicHome=sandboxVisible&&workbenchStyle.style==='classic';
  const layout=useWorkbenchLayout(presentation,sandboxHome,conversationCollapsed,classicHome,simpleHome);
  function toggleConversation(){if(layout.chatActive){setConversationCollapsed(true);}else{setConversationCollapsed(false);if(presentation.state.mode==='fullscreen')presentation.returnToSplit();else if(!layout.wide&&!sandboxHome&&!classicHome)presentation.chat();}}
  useEffect(()=>{setSummaryOverride(false)},[workspace.active?.id,visible]);
  function returnWorkbench(){setSummaryOverride(false);setMappingOpen(false);setCitationMessage(null);presentation.chat();setSidebar(false);}
  function showSandbox(){workbenchStyle.setStyle('sandbox');returnWorkbench();}
  function changeWorkbenchMode(mode:WorkbenchStyle){workbenchStyle.setStyle(mode);returnWorkbench();}
  const previousWorkbenchMode=useRef(workbenchStyle.style);
  useEffect(()=>{if(previousWorkbenchMode.current===workbenchStyle.style)return;previousWorkbenchMode.current=workbenchStyle.style;const frame=requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[aria-label="工作台视图"] button[aria-pressed="true"]')?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame)},[workbenchStyle.style]);
  const runtimeConsole=useRuntimeConsole(busy,!!operationError||!!workspace.error,workspace.ready);
  function showInsights(){setSummaryOverride(true);setMappingOpen(false);setCitationMessage(null);presentation.showSummary();setSidebar(false);}
  async function associateProject(id:string){if(busyRef.current||!workspace.ready)return;setProjectAssociating(true);try{await perform('正在关联当前项目',async()=>{await workspace.assign(id);presentation.showSummary();});}finally{setProjectAssociating(false);}}
  async function projectSaved(p:Project){
    const target=associateNewProject.current;associateNewProject.current=null;setProjectEditor(null);
    if(target&&workspace.currentConversation()?.id===target){setProjectAssociating(true);try{await perform('正在关联当前项目',async()=>{await workspace.refresh();if(workspace.currentConversation()?.id!==target){setProjectId(p.id);open('project');return;}await workspace.assign(p.id);presentation.showSummary();});}finally{setProjectAssociating(false);}}
    else{await workspace.refresh();void showProjectInsights(p.id);}
  }
  async function showProjectInsights(id:string){
    if(workspace.active?.project_id===id){setSummaryOverride(false);setMappingOpen(false);setCitationMessage(null);presentation.chat();return;}
    const target=workspace.conversations.find(c=>c.project_id===id);
    if(target){await perform('正在切换项目',async()=>{await workspace.select(target.id);presentation.showSummary();});}
    else if(workbenchStyle.styleFor('project:'+id)==='sandbox'){await newConversation(id);}
    else{setProjectId(id);open('project');}
  }
  async function changeConversation(id:string){await perform('正在打开对话',()=>workspace.select(id));}
  async function newConversation(id?:string){await perform('正在新建对话',()=>workspace.create(id));}
  async function storedFile(asset:Asset){try{const response=await fetch(`${workspaceApi}/assets/${asset.id}?conversation_id=${workspace.active?.id}`);if(!response.ok)throw new Error('资料不在当前对话可用范围内');await inspectFile(new File([await response.blob()],asset.name),asset.id);}catch(e){add((e as Error).message,undefined,'assistant',true);}}
  async function persistInput(f:File){if(!workspace.active)throw new Error('请等待对话载入');return api<Asset>(`${workspaceApi}/assets`,form({file:f,scope:'conversation',conversation_id:workspace.active.id}));}
  async function askKnowledge(question:string,alreadyAdded=false,forceKnowledge=false){
    if(busyRef.current||!workspace.ready)return;
    if(!alreadyAdded)add(question,undefined,'user');
    const mode=knowledgeAnswerEngine(question,knowledgeOptions.engine),context=conversationContext.current,conversation=workspace.active?.id||context;
    await perform(mode==='compare'?'正在分别检索两路知识依据':PRESET_KNOWLEDGE_LOADING,async()=>{
      const id=crypto.randomUUID(),controller=new AbortController(),local=new AbortController();
      qaRequest.current={id,controller,local};setQaRunning(true);
      const pending=new Set(mode==='compare'?['原知识问答','WeKnora']:[mode==='weknora'?'WeKnora':'原知识问答']);
      const updatePending=()=>{if(!controller.signal.aborted&&!local.signal.aborted&&conversationContext.current===context&&pending.size)setBusy(`正在等待${[...pending].join('、')}返回回答`);};
      const receive=(data:Evidence,enhanced:boolean)=>{
        if(controller.signal.aborted||local.signal.aborted||conversationContext.current!==context)return;
        data={...data,question};setEvidence(data);presentation.resultAvailable('knowledge');
        const caption=enhanced?'WeKnora · 引用范围已核验':data.answer_mode==='curated_demo'?'原系统预设解答':['evidence_only','evidence_fallback'].includes(data.answer_mode)?'本地检索 · 原文依据':data.answer_mode==='general_model_fallback'?'原模型 · 通用回答（无知识库依据）':'原知识问答 · 模型综合';
        const message:Message={id:crypto.randomUUID(),role:'assistant',text:data.answer,context,evidence:data,card:{kind:'source',title:mode==='compare'?`${enhanced?'WeKnora':'原知识问答'} · 对比结果`:'本次回答的引用依据',caption,icon:'book',status:data.sources.length?`${data.sources.length} 条引用`:'依据不足',items:data.sources.slice(0,3).map((item:any)=>({title:item.title||item.title_path||item.source_name||item.source||'知识来源',detail:(item.snippet||item.excerpt||item.content||item.text||'打开右侧核对来源').slice(0,160),icon:'book'})),note:'用于理解依据，不自动改写价格与系数。'},actions:[...(data.model_configured===false?[{label:'配置问答模型',action:'configuration',primary:true}]:[]),{label:'核对全部引用',action:'knowledge-result',primary:data.model_configured!==false}]};setMessages(m=>[...m,message]);
      };
      const runLocal=async()=>{
        const [data]=await Promise.all([
          fetch('/api/astra/knowledge/ask',{...json({question,force_knowledge:forceKnowledge,library_ids:knowledgeOptions.library_ids??undefined,retrieval_mode:knowledgeOptions.retrieval_mode,...(result?{job_id:result.job_id}:{}),project_key:workspace.active?.project_id||''}),signal:local.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'原知识问答暂不可用');return data;}),
          waitForKnowledgePresentation(question,local.signal),
        ]);
        receive({...data,sources:data.sources||[]},false);
      };
      const runEnhanced=async()=>{
        if(!weknora.status.available)throw new Error(weknora.status.reason?.message||'WeKnora 未连接');
        const response=await fetch('/api/astra/weknora/ask-stream',{...json({question,engine_mode:'enhanced',library_ids:['cost-aiw'],context_type:'general',row_context:null,request_id:id,...(qaSessions.current[conversation]?{conversation_id:qaSessions.current[conversation]}:{})}),signal:controller.signal});
        const reply=await readWeKnora(response,controller.signal,()=>{if(!controller.signal.aborted&&conversationContext.current===context&&!isPresetKnowledgeQuestion(question))updatePending();});
        if(controller.signal.aborted||conversationContext.current!==context)return;
        qaSessions.current[conversation]=reply.conversation_id;
        receive({answer:reply.answer,sources:reply.citations,answer_mode:'weknora',evidence_status:reply.evidence_status,elapsed_ms:reply.elapsed_ms},true);
      };
      try{
        const jobs: [string,()=>Promise<void>][] = mode==='compare' ? [['原知识问答',runLocal],['WeKnora',runEnhanced]] : mode==='weknora' ? [['WeKnora',runEnhanced]] : [['原知识问答',runLocal]];
        const outcomes=await Promise.allSettled(jobs.map(async([name,run])=>{try{return await run();}finally{pending.delete(name);updatePending();}}));
        if(!controller.signal.aborted&&!local.signal.aborted&&context===conversationContext.current){if(outcomes.some(r=>r.status==='fulfilled'))gorkFeedback.success();if(outcomes.some(r=>r.status==='rejected'))setOperationError('知识回答未全部完成');}
        outcomes.forEach((reply,index)=>{if(reply.status==='rejected'&&!controller.signal.aborted&&!local.signal.aborted&&context===conversationContext.current){add(`${jobs[index][0]}：${reply.reason instanceof Error?reply.reason.message:'本次请求未完成'}`,undefined,'assistant',true);if(jobs[index][0]==='WeKnora')delete qaSessions.current[conversation];}});
        if(controller.signal.aborted&&context===conversationContext.current)add('本次请求已停止。已完成的回答保留，未完成内容不进入对话。');
      }finally{if(qaRequest.current?.id===id)qaRequest.current=null;setQaRunning(false);}
    });
  }
  function stopKnowledge(){const active=qaRequest.current;if(!active)return;setSandboxCancelVersion(v=>v+1);active.controller.abort();active.local?.abort();void api(`/api/astra/weknora/requests/${active.id}/cancel`,json({})).catch(()=>{});}
  async function presentArticle(id:string){await perform('正在读取原文章',async()=>{const data=await api<any>(`/api/knowledge-articles/${encodeURIComponent(id)}`);add(`一起看看《${data.article.title}》。`,undefined,'assistant',false,{kind:'source',title:data.article.title,caption:'原文章阅读 · 未调用模型',icon:'book',status:'只读',facts:[{label:'分类',value:data.article.category}],disclosure:{label:'阅读完整正文',lines:data.article.body.split('\n')},note:'文章展示不触发问答、知识记忆或价格裁决。'});});}
  const summary=result?.summary;const completed=summary?.matching_status==='completed';
  const onGorkPresented=(state:string,duration:number)=>{if(state==='happy')gorkFeedback.presented(duration);};
  useEffect(()=>{if(operationError||welcomeVisible||settings||architecturePresentation)gorkFeedback.interruptSuccess();},[operationError,welcomeVisible,settings,architecturePresentation,gorkFeedback.value.success]);
  const gorkState=gorkActivity(busy,operationError,composing||!!draft.trim(),gorkFeedback.value);
  const gorkSuspended=welcomeVisible||!layout.chatActive||settings||connectionsOpen||searchOpen||conversationEditor||!!selection||!!projectEditor;
  const pendingFeeFocus=useRef('');
  const add=(text:string,actions?:Action[],role:'user'|'assistant'='assistant',error=false,card?:Card)=>{const message:Message={id:crypto.randomUUID(),text:debugText(text),actions,role,error,card:card||(error?errorCard(text):undefined),job:loadedJob.current,context:conversationContext.current};pendingFeeFocus.current=card?.fees?message.id:'';setMessages(m=>[...m,message]);};
  const listRuns=async()=>{const data=await api<{items:Run[]}>('/api/astra/runs');setRuns(data.items);};
  useEffect(()=>{api<{isolated:boolean;service:string;capabilities?:string[]}>('/api/health').then(h=>{if(h.service!=='zhisuan-astra'||!h.isolated)throw new Error('当前地址不是独立 Astra 服务');if(!DEBUG_MODE&&!['batch-match-recovery-v1','row-assist-v1','business-settings-v1'].every(capability=>h.capabilities?.includes(capability)))throw new Error('当前宿主缺少本轮能力，请正常重启 Astra 服务');setConnected(true);return listRuns();}).catch(e=>add(e.message,undefined,'assistant',true));},[]);

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
  useEffect(()=>{const handle=(e:KeyboardEvent)=>{if(welcomeVisible)return;if(e.key==='Escape'){if(document.querySelector('dialog[open]'))return;if(sidebar){setSidebar(false);return;}if(expanded)presentation.returnToSplit();else if(presentation.state.mode==='content')presentation.closeContent();else if(presentation.state.mode==='summary'){if(mappingOpen)closeMapping();else if(citationMessage)closeCitations();else {setSummaryOverride(false);presentation.closeSummary();}}}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(true);}};document.addEventListener('keydown',handle);return()=>document.removeEventListener('keydown',handle);},[sidebar,welcomeVisible,presentation.state.mode,citationMessage,mappingOpen]);


  const reportDocument:DocumentSource|null=result?.downloads.report?(riskDocument?.source_id===result.job_id&&(!report?.sha256||report.job_id!==result.job_id||riskDocument.reportRevision===report.sha256)?riskDocument:{kind:'report',source_id:result.job_id,revision:report?.job_id===result.job_id&&report.sha256?report.sha256:JSON.stringify([result.task_tracking?.task.artifact_version,result.summary.output_report,result.summary.report_text]),name:result.summary.output_report?.split(/[\\/]/).pop()||'造价报告.docx'}):null;
  const activeDocumentSource=visible?(view==='report'?reportDocument:view==='document'?selectedDocument:null):null;
  useEffect(()=>{if(gongwenSource&&gongwenSource.kind!=='asset'&&reportDocument?.source_id===gongwenSource.source_id&&reportDocument.revision!==gongwenSource.revision)setGongwenSource(reportDocument);},[reportDocument?.source_id,reportDocument?.revision,gongwenSource?.source_id]);
  function documentFor(source:DocumentSource|null):DocumentState|null{if(!source)return null;const saved=documents[sourceKey(source)];return saved&&saved.source.revision===source.revision?saved:{source};}
  function beginGongwen(source:DocumentSource|null=activeDocumentSource||reportDocument||selectedDocument){
    if(DEBUG_MODE){add('公文转换需要本地服务，调试版不生成正式文档。');return;}
    setGongwenSource(source);setGongwenOpen(true);setSidebar(false);
    if(source){if(source.kind==='asset')setSelectedDocument(source);presentation.open(source.kind!=='asset'?'report':'document');}
    else presentation.prepareInput();
    presentation.returnToSplit();chatFollow.current=true;
    requestAnimationFrame(()=>{scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'instant'});});
  }
  async function openDocumentFile(next:File,assetId?:string){await perform('正在打开文稿',async()=>{
    const context=conversationContext.current;const id=assetId||(await persistInput(next)).id;if(context!==conversationContext.current)return;
    const source:DocumentSource={kind:'asset',source_id:id,name:next.name};
    setSelectedDocument(source);beginGongwen(source);
  });}
  async function pasteGongwen(text:string){
    if(!text.trim())return;
    await openDocumentFile(new File([text],'公文正文.md',{type:'text/markdown'}));
  }
  async function formatDocument(key:string,formatDraft?:GongwenDraft){
    if(!formatDraft){beginGongwen();return;}
    const source=gongwenSource;if(!source||sourceKey(source)!==key)return;
    const context=conversationContext.current,conversation=workspace.active?.id;if(!conversation)return;
    const confirmed_title=formatDraft.titleMode==='manual'?'manual':formatDraft.titleMode==='none'?'none':formatDraft.titleMode==='suggested'?formatDraft.prepared.suggested:formatDraft.selected;
    let failed:unknown=null;
    await perform('正在转换公文',async()=>{try{
      await workspace.flush();
      if(context!==conversationContext.current||workspace.currentConversation()?.id!==conversation)return;
      const output=await api<FormattedDocument>('/api/astra/documents/format',json({...source,conversation_id:conversation,sha256:formatDraft.prepared.sha256,prepared_id:formatDraft.prepared.id,options:{...formatDraft.options,confirmed_title,...(formatDraft.titleMode==='manual'?{title:formatDraft.manualTitle.trim()}:{})}}));
      if(context!==conversationContext.current||workspace.currentConversation()?.id!==conversation)return;
      setDocuments(all=>({...all,[key]:{source,output,formatDraft,showOriginal:false}}));gorkFeedback.success();
      presentation.open(source.kind!=='asset'?'report':'document');presentation.returnToSplit();
      add('公文版已生成，原报告保留。',undefined,'assistant',false,{kind:'artifact',title:output.name,caption:'公文转换',icon:'file',status:output.warnings.length?'待核对':'已生成',note:output.warnings.join('；')||undefined});
    }catch(error){failed=error;throw error;}});
    if(failed)throw failed;
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

  async function perform(label:string,work:()=>Promise<void>){if(busyRef.current||!workspace.ready)return;gorkFeedback.interruptSuccess();busyRef.current=true;setBusy(label);setOperationError('');try{await work();}catch(e){const message=e instanceof Error?e.message:'操作失败，请检查服务状态后重试。';setOperationError(message);add(message,undefined,'assistant',true);}finally{setBusy('');busyRef.current=false;}}
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

  const [digitalImport,setDigitalImport]=useState<{context:string;session:DigitalSession}|null>(null);
  const [digitalPicker,setDigitalPicker]=useState(false),[digitalCommand,setDigitalCommand]=useState<DigitalCommand|null>(null);
  const lastDigital=[...messages].reverse().find(m=>m.digital&&m.context===conversationContext.current)?.digital;
  const digitalSession:DigitalSession|undefined=digitalImport?.context===conversationContext.current?digitalImport.session:lastDigital?{id:lastDigital.sessionId,taskId:lastDigital.taskId}:undefined;
  const digitalLatest=useRef({context:conversationContext.current,session:digitalSession});digitalLatest.current={context:conversationContext.current,session:digitalSession};
  useEffect(()=>{setDigitalPicker(false);setDigitalCommand(null);},[workspace.active?.id]);
  function beginDigital(){
    if(!workspace.ready||busyRef.current)return;
    setConversationCollapsed(false);presentation.returnToSplit();
    if(digitalSession){open('digital');add('我们继续这份数字化项目测算。你可以在右侧核对当前进展，或选择另一份需求重新开始。',[{label:'继续当前任务',action:'digital-resume',primary:true},{label:'选择另一份文档',action:'digital-upload'}]);}
    else add('我们来做数字化项目造价。先把项目需求给我，我会陪你完成原文阅读、功能点分析、系数核对和费用测算。',[{label:'上传项目需求',action:'digital-upload',primary:true}]);
  }
  function digitalEvent(state:DigitalState,scope:string,sessionId:string){
    const active=digitalLatest.current;
    if(active.context!==scope||active.session?.id!==sessionId||(active.session.taskId&&state.taskId!==active.session.taskId))return;
    if(!state.files.length&&!state.error)return;
    if(state.files.length)setDigitalImport(old=>old?.context===scope&&old.session.id===sessionId&&!old.session.taskId?{context:scope,session:{id:sessionId,taskId:state.taskId}}:old);
    const reply=guideReply(state);
    if(state.busy&&!['queued','running'].includes(state.run))return;
    setMessages(old=>{
      const previous=[...old].reverse().find(m=>m.digital&&m.context===scope)?.digital;
      if(previous?.key===reply.key){const last=[...old].reverse().find(m=>m.digital===previous);if(!last||last.text===reply.text)return old;return old.map(m=>m.id===last.id?{...m,text:reply.text,actions:reply.actions,digital:{...previous,revision:state.revision}}:m);}
      return [...old,{id:crypto.randomUUID(),role:'assistant',text:reply.text,actions:reply.actions,context:scope,digital:{taskId:state.taskId,key:reply.key,sessionId,revision:state.revision}}];
    });
  }
  function digitalAction(name:string){
    if(name==='digital'){beginDigital();return;}
    if(name==='digital-upload'){setDigitalPicker(true);return;}
    open('digital');setConversationCollapsed(false);presentation.returnToSplit();
    if(name!=='digital-resume')setDigitalCommand({id:crypto.randomUUID(),action:name.slice(8)});
  }
  function openSettings(section:SettingsSection='appearance'){setSettingsSection(section);setSettings(true);}
  function open(next:string,fullscreen=false){setSummaryOverride(false);setMappingOpen(false);setCitationMessage(null);if(next==='network'){selectKnowledgeTab('network');setSidebar(false);return;}if(next==='architecture'){setArchitectureOpening(n=>n+1);setArchitectureDark(true);setArchitectureOpen(true);setSidebar(false);return;}if(next==='articles'||next==='knowledgebase'||next==='originalqa'||next==='network'){setKnowledgeTab(next==='network'?'network':next==='articles'?'articles':'ask');next='knowledge';}else if(next==='knowledge')setKnowledgeTab('ask');const setting=settingsSectionForRoute(next);if(setting){openSettings(setting);return;}if(next==='collaboration'){prepareReview();return;}if(next==='review-progress'){prepareReview('progress');return;}if(next==='mapping'&&file&&!result){showMapping(true);return;}if(next==='document'){beginGongwen(null);return;}if(next==='word')next='report';if(next==='insights'){showInsights();return;}if(isProfessional(next))setProfessionalWarm(true);if(next==='chat'){presentation.chat();setSidebar(false);return;}if(next in titles){presentation.open(next as View);if(next==='aerial'||fullscreen)presentation.fullscreen();setSidebar(false);if(next==='risk'&&result)void refreshRisk(result.job_id);if(next==='report'&&result)void refreshReport(result.job_id);if(next==='projects'){setDashboardWarm(true);}if(next==='projects')void listRuns().catch(e=>add(e.message,undefined,'assistant',true));if(next==='trace')void loadTimeline();}else{presentation.open('tools');add('这项能力已经列入完整迁移清单，当前版本尚未接通。右侧可以查看接入状态。');}}
  async function refreshRisk(job:string,silent=false){
    riskRequest.current?.abort();const controller=new AbortController();riskRequest.current=controller;
    const context=conversationContext.current;let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},15000);
    const current=()=>riskRequest.current===controller&&loadedJob.current===job&&conversationContext.current===context;
    setRiskRead({job,loading:true,error:''});
    try{const data=await api<{items:Risk[]}>(`/api/risk/summary?job_id=${job}`,{signal:controller.signal});if(current()&&!controller.signal.aborted){setRisks(data.items);setRiskJobId(job);setRiskRead({job,loading:false,error:''});}}
    catch(e){if(current()&&(!controller.signal.aborted||timedOut)){const message=timedOut?'风险读取超时，请重试':(e as Error).message;setRiskRead({job,loading:false,error:message});if(!silent)add(message,undefined,'assistant',true);}}
    finally{clearTimeout(timer);}
  }
  async function refreshReport(job:string){try{const data=await api<Report>(`/api/astra/report/${job}`);if(loadedJob.current===job)setReport(data);return data;}catch(e){if(loadedJob.current===job){setReport(null);add((e as Error).message,undefined,'assistant',true);}return null;}}
  async function loadTimeline(){const id=result?.task_tracking?.task?.task_id;if(!id){setTimeline([]);return;}try{const data=await api<{items:any[]}>(`/api/tasks/${id}/timeline`);setTimeline(data.items.filter(i=>!i.is_placeholder));}catch(e){add((e as Error).message,undefined,'assistant',true);}}
  function acceptResult(data:Result,fromPreview=false,owner?:Conversation){if(!owner&&!fromPreview){const warnings=data.summary.warning_summary;const warningCount=warnings?.executed?Number(warnings.warning_rows||0):0;const reviewCount=Number(data.summary.review_rows||0);gorkFeedback.observeWarning([data.job_id,warningCount,reviewCount].join(':'),warningCount>0||reviewCount>0);}const current=owner||workspace.currentConversation();setResultScope(current?{conversationId:current.id,projectId:current.project_id,jobId:data.job_id}:null);if(loadedJob.current!==data.job_id)setRiskJobId('');if(!fromPreview)previewRefreshAttempt.current='';const sameJob=loadedJob.current===data.job_id;loadedJob.current=data.job_id;if(!sameJob){setLocatedRow(undefined);setLocatedCell(undefined);const previews=data.summary.table_preview.sheets||[data.summary.table_preview];const index=previews.findIndex(s=>/^表[234]/.test(s.sheet_name));setSheetIndex(Math.max(0,index));}setResult(previous=>previous?.job_id===data.job_id?{...previous,...data}:data);setNeedsRecalculate(previous=>data.needs_recalculate??(sameJob&&previous));setReport(null);}
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
    const prepared=prepareSheets(data.sheets);setSheets(prepared);setMappingExpanded(false);setMappingSheet(0);setMappingOpen(false);if(!sandboxVisible&&token===presentation.interactionToken())showMapping();
    add(`请帮我编制这份控制价：${next.name}`,undefined,'user');
    add('资料已读取。我们先确认结构，再交给专业规则匹配。',[{label:'确认结构并转换',action:'convert',primary:true},{label:'核对字段',action:'mapping'}],'assistant',false,inputCard(next.name,prepared));
  });}
  function showProjectImports(){
    if(busyRef.current||!workspace.ready)return;
    chatFollow.current=true;presentation.chat();
    add('导入项目',undefined,'user');
    add('请选择要导入的项目。',undefined,'assistant',false,projectImportCard());
  }
  async function sample(importId='v31'){
    const selected=findImportProject(importId);if(!selected)return;
    const token=presentation.interactionToken(),owner=workspace.currentConversation()?.id;
    await perform('导入项目并识别工作表',async()=>{
      const next=await readImportProjectFile(importId);
      const data=await api<Inspection>('/api/inspect',form({file:next}));
      if(workspace.currentConversation()?.id!==owner)throw new Error('对话已切换，请在当前对话重新导入。');
      const asset=await persistInput(next);setInputFileId(asset.id);
      conversationContext.current=crypto.randomUUID();loadedJob.current='';
      setInputConversationId(owner||'');setFile(next);setProject(importId==='v31'?'V3.1 勘察测量控制价':selected.name);setResult(null);setRisks([]);setReport(null);setSources(null);setSheetIndex(0);setNeedsRecalculate(false);
      const prepared=prepareSheets(data.sheets);setSheets(prepared);setMappingExpanded(false);setMappingSheet(0);setMappingOpen(false);if(!sandboxVisible&&token===presentation.interactionToken())showMapping();
      add(`导入项目：${selected.name}`,undefined,'user');
      add('项目文件已上传，工作表已识别。请确认结构后继续编制。',[{label:'确认结构并转换',action:'convert',primary:true},{label:'核对字段',action:'mapping'}],'assistant',false,inputCard(next.name,prepared));
    });
  }
  async function inspectHeader(name:string,row:number){if(!file)return;await perform('重新识别表头与字段',async()=>{if(!Number.isInteger(row)||row<1)throw new Error('表头行必须是大于 0 的整数');const data=await api<Inspection&{headers:string[];columns:SheetConfig['columns']} >('/api/inspect',form({file,sheet_name:name,header_row:String(row)}));setSheets(current=>current.map(s=>s.sheet_name===name?{...s,header_row:row,headers:data.headers,columns:data.columns,column_mapping:{...data.suggested_mapping}}:s));add(`已重新读取「${name}」第 ${row} 行表头，请核对卡片内更新后的字段映射。`);});}
  async function convert(){if(result){add('当前文件已完成转换，可继续批量匹配或查看成果。',[{label:completed?'查看表格':'批量匹配',action:completed?'table':'match',primary:true}]);return;}if(!file){add('先添加一份控制价 Excel，我来识别表格。',[{label:'添加 Excel',action:'attach',primary:true}]);return;}await perform('转换为待匹配预览',async()=>{if(!sheets.some(s=>s.enabled))throw new Error('至少选择一个工作表');if(sheets.some(s=>s.enabled&&(!Number.isInteger(s.header_row)||s.header_row<1)))throw new Error('表头行必须是大于 0 的整数');const settings=await readBusiness();const effective=businessForm(settings);const data=await api<Result>('/api/process',form({file,project_name:project.trim(),sheet_configs:JSON.stringify(sheets.map(s=>({...s,...Object.fromEntries(Object.entries(effective).map(([key,value])=>[key,value==='true'?true:value==='false'?false:value]))}))),defer_matching:'true',...effective,task_name:'最高投标限价编制',source_type:'web'}));data.process_options={matching_mode:settings.matchingMode,only_match_rows_with_value:settings.onlyMatchRowsWithValue,match_value_filter_field:settings.matchValueFilterField};acceptResult(data);setMappingOpen(false);presentation.resultAvailable('table');gorkFeedback.success();add('结构已经准备好，确认后即可开始匹配。',[{label:settings.matchingMode==='ai_enhanced'?'核对 AI 字段':'开始批量匹配',action:settings.matchingMode==='ai_enhanced'?'advanced':'match',primary:true},{label:'查看表格',action:'table'}],'assistant',false,resultCard(data));await listRuns();});}
  async function recoverMatch(){if(!result)return;const job=result.job_id,context=conversationContext.current;await perform('核对后台匹配结果',async()=>{
    const state=await api<{status:string;result?:Result;message?:string}>(`/api/process/${job}/batch-match-status`);
    if(context!==conversationContext.current||loadedJob.current!==job)return;
    if(state.status==='completed'&&state.result?.job_id===job){acceptResult(state.result);setBatchUncertainJob('');add('已恢复后台完成的原成果，未重新提交匹配。',[{label:'查看成果',action:'table'}],'assistant',false,resultCard(state.result));return;}
    if(['pending','failed','interrupted'].includes(state.status)){setBatchUncertainJob('');add(state.message||'后台确认本次未完成，可以明确重新发起匹配。',[{label:'重新批量匹配',action:'match'}]);return;}
    setBatchUncertainJob(job);add('后台仍在运行或结果尚未确认，请稍后核对，勿重复提交。',[{label:'核对匹配结果',action:'recover-match'}]);
  });}
  async function match(){
    if(!result){add('请先添加 Excel 并确认结构，转换后即可开始匹配。',[{label:'添加 Excel',action:'attach',primary:true}]);return;}
    if(completed){add('当前任务已完成匹配，可继续复核或查看成果。',[{label:'查看表格',action:'table'}]);return;}
    if(batchUncertainJob===result.job_id){void recoverMatch();return;}
    const job=result.job_id,context=conversationContext.current,token=presentation.interactionToken();
    await perform('正在匹配价格与双系数',async()=>{
      const state=await api<{status:string;result?:Result}>(`/api/process/${job}/batch-match-status`);
      if(context!==conversationContext.current||loadedJob.current!==job)return;
      if(state.status==='completed'&&state.result?.job_id===job){acceptResult(state.result);return;}
      if(!['pending','failed','interrupted'].includes(state.status)){setBatchUncertainJob(job);add('后台匹配尚未确认，请核对原任务。',[{label:'核对匹配结果',action:'recover-match'}]);return;}
      const current=await api<Result>(`/api/astra/runs/${job}`);
      if(context!==conversationContext.current||loadedJob.current!==job)return;
      if(current.ai_matching?.requested_mode==='ai_enhanced'&&['awaiting_analysis','analyzing','awaiting_confirmation'].includes(current.ai_matching.ai_stage||'')){acceptResult(current);add('请先在专业编制中核对 AI 映射和候选，逐字段确认后再匹配。',[{label:'核对 AI 字段',action:'advanced',primary:true}]);return;}
      setBatchUncertainJob(job);await workspace.flush();
      try{
        const data=await requestBatchMatch<Result>('',job,previewPreferences.headerRows);
        if(context!==conversationContext.current||loadedJob.current!==job)return;
        acceptResult(data);setBatchUncertainJob('');gorkFeedback.success();add('匹配完成，计算表和报告已生成。接下来一起核对风险。',[{label:'检查经验池预警',action:'warning',primary:true},{label:'查看成果',action:'table'}],'assistant',false,resultCard(data));presentation.resultAvailable('table');
        if(token===presentation.interactionToken()&&layout.wide){presentation.showSummary();requestAnimationFrame(()=>{const panel=document.querySelector('.summary-body');if(panel)panel.scrollTop=0;});}await listRuns();
      }catch(error){
        if(context!==conversationContext.current||loadedJob.current!==job)return;
        if(error instanceof BatchMatchError&&error.outcome==='unknown'){add(error.message,[{label:'核对匹配结果',action:'recover-match'}],'assistant',true);return;}
        setBatchUncertainJob('');throw error;
      }
    });
  }
  async function warning(){if(!result||!completed){add('请先完成批量匹配，再进行经验池预警。');return;}const job=result.job_id;await perform('比对经验池与风险阈值',async()=>{const data=await api<Result>('/api/experience-warnings/run',form({job_id:job}));if(loadedJob.current!==job)return;acceptResult(data);const risk=await api<{items:Risk[]}>(`/api/risk/summary?job_id=${job}`);setRisks(risk.items);setRiskJobId(job);if(risk.items.length)gorkFeedback.warning();else gorkFeedback.success();presentation.resultAvailable('risk');add(risk.items.length?'检查完成。你可以从卡片直接定位需要关注的行。':'检查完成，当前没有返回风险事项。',[{label:'查看全部风险与依据',action:'risk',primary:true},{label:'生成报告',action:'risk-report'}],'assistant',false,reviewCard(risk.items));});}
  async function modelForm(){const model=await api<{provider:string;model:string;baseUrl:string}>('/api/astra/connections/model');return {provider:model.provider,model:model.model,base_url:model.baseUrl};}
  async function generateRisk(){
    if(!result||!completed)return;
    const job=result.job_id,context=conversationContext.current,conversation=workspace.active?.id;
    if(!conversation)return;
    await perform('正在生成文字报告',async()=>{
      await workspace.flush();
      const progressId=crypto.randomUUID();let stage=0;
      setMessages(old=>[...old,{id:progressId,role:'assistant',text:'',job,context,card:reportProgressCard(stage)}]);
      const progress=(next:number)=>{stage=next;setBusy(['正在生成文字报告','正在整理 Markdown','正在转换公文格式','正在保存报告成果'][next]||'');setMessages(old=>old.map(m=>m.id===progressId?{...m,card:reportProgressCard(stage)}:m));};
      try{
      const data=await api<RiskReportReply>('/api/risk-report',form({job_id:job,...await modelForm()}));
      if(context!==conversationContext.current||loadedJob.current!==job)return;
      progress(1);
      const reportInfo=await refreshReport(job);
      if(context!==conversationContext.current||loadedJob.current!==job)return;
      const source={...reportMarkdownSource(job,data),reportRevision:reportInfo?.sha256};
      setRiskDocument(source);
      progress(2);
      const prepared=await api<import('./document-types').GongwenPrepared>('/api/astra/documents/prepare',json({...source,conversation_id:conversation,sha256:source.revision}));
      if(context!==conversationContext.current||loadedJob.current!==job)return;
      const output=await api<FormattedDocument>('/api/astra/documents/format',json({...source,conversation_id:conversation,sha256:prepared.sha256,prepared_id:prepared.id,options:{...prepared.defaults,confirmed_title:'none'}}));
      if(context!==conversationContext.current||loadedJob.current!==job||workspace.currentConversation()?.id!==conversation)return;
      progress(3);
      const formatDraft:GongwenDraft={prepared,options:prepared.defaults,titleMode:'none',selected:'',manualTitle:''};
      setDocuments(all=>({...all,[sourceKey(source)]:{source,output,formatDraft,showOriginal:false}}));
      setGongwenSource(source);setGongwenOpen(false);gorkFeedback.success();progress(4);
      add(data.risk_report_mode==='demo_preset'?'演示风险报告已排为公文格式，未调用模型。':'模型风险报告已排为公文格式。',[{label:'查看报告',action:'report',primary:true}],'assistant',false,{kind:'artifact',title:output.name,caption:data.risk_report_mode==='demo_preset'?'演示预设 · 公文格式':'风险报告 · 公文格式',icon:'file',status:output.warnings.length?'待核对':'已生成',note:output.warnings.join('；')||undefined});
      }catch(error){if(context===conversationContext.current)setMessages(old=>old.map(m=>m.id===progressId?{...m,card:reportProgressCard(stage,true)}:m));throw error;}
    });
  }
  async function recalculate(){if(!result){add('请先完成文件转换与匹配，再重算公式。');return;}const job=result.job_id;await perform('刷新公式与 Word 报告',async()=>{const data=await api<Result>('/api/preview/recalculate',json({job_id:job}));acceptResult(data);add(data.formula_recalculated?'Excel 公式已重算，预览和 Word 报告已刷新。':'预览与报告已刷新，但本机 Excel 公式重算不可用。请在 Excel 中打开成果刷新公式后再交付。',[{label:'查看报告',action:'report'}],'assistant',false,artifactCard(data,data.formula_recalculated?'公式、预览与报告已同步刷新。':'公式尚未完成重算，请在 Excel 中刷新公式后交付。'));});}
  function setSharedPreview(value:typeof previewPreferences){setPreviewPreferences(value);try{localStorage.setItem('astra.preview-columns.v1',JSON.stringify(value));}catch{setOperationError('预览偏好未能保存，请检查浏览器存储权限');}}
  async function beginRowAssist(cell:SelectedCell){
    if(!result||busyRef.current||!workspace.ready||startingRowAssist.current)return;
    startingRowAssist.current=true;const context=conversationContext.current,job=result.job_id,conversation=workspace.active?.id;
    try{await workspace.flush();if(context!==conversationContext.current||job!==loadedJob.current||!conversation)return;
      const id=crypto.randomUUID();pendingFeeFocus.current=id;setRowAssist(id);chatFollow.current=false;presentation.open('table');presentation.returnToSplit();setSidebar(false);
      setMessages(old=>[...old.map(m=>m.rowPricing&&['loading','analyzing'].includes(m.rowPricing.phase)?{...m,rowPricing:{...m.rowPricing,phase:'stopped' as const}}:m),{id,role:'assistant',text:'',job,context,rowPricing:{cell,conversation,phase:'loading'}}]);
    }catch(e){add((e as Error).message,undefined,'assistant',true);}finally{startingRowAssist.current=false;}
  }
  async function inspectRow(cell:SelectedCell){if(!result)return;const token=presentation.interactionToken();const job=result.job_id;await perform('读取当前行的来源',async()=>{const data=await api<any>('/api/fill-assist/candidates',json({job_id:job,sheet_name:cell.sheet,row_number:cell.row}));setSources({...data,cell});if(token===presentation.interactionToken())open('sources');add('已为你展开这一行的依据。',[{label:'返回计算表',action:'locate',target:{sheet:cell.sheet,row:cell.row}}],'assistant',false,sourceCard(cell,data.candidates?.length||0));});}
  async function saveCell(){if(!selection||!result)return;const cell=selection;const job=result.job_id;await perform('保存人工修改与留痕',async()=>{const data=await api<Result>('/api/preview/cell',json({job_id:job,sheet_name:cell.sheet,row_number:cell.row,column_number:cell.column,value:editableValue(cellValue),edit_note:editNote,actor:'Astra 本机用户',recalculate:false}));acceptResult(data);setSelection(null);gorkFeedback.success();add('你的修改已经保存并留痕。',[{label:'重算公式与报告',action:'recalculate',primary:true},{label:'继续核对表格',action:'table'}],'assistant',false,editCard(cell,editableValue(cellValue),editNote));});}
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
  function action(name:string){if(name==='import-projects'){showProjectImports();return;}if(name.startsWith('import-project:')){void sample(name.slice(15));return;}if(name==='digital'||name.startsWith('digital-')){digitalAction(name);return;}if(name==='recover-match'){void recoverMatch();return;}if(name==='download-excel'||name==='download-word'){const kind=name==='download-excel'?'excel':'report';if(!result||!completed){add('请先完成批量匹配，再下载成果。');return;}const url=result.downloads[kind];if(url)window.open(url,'_blank','noopener');return;}if(name.startsWith('format-document:')){void formatDocument(name.slice(16));return;}if(name.startsWith('download:')){const url=name.slice(9);if(/^\/api\/(?:settlement-audit|workload-capture)\/(?:download|current-download)\/[a-f0-9]{32}\/[a-z]+$/.test(url))window.open(url,'_blank','noopener');return;}if(name==='attach'){input.current?.click();return;}if(name==='convert'){void convert();return;}if(name==='match'){void match();return;}if(name==='warning'){void warning();return;}if(name==='risk-report'){void generateRisk();return;}if(name==='recalculate'){void recalculate();return;}if(name==='sample'){void sample();return;}if(name==='mapping'&&!file){input.current?.click();return;}open(name);}
  function runQuickCommand(id:string,userText?:string){
    const reason=quickUnavailable(id,{ready:workspace.ready,busy:busyRef.current,connected,hasResult:!!result,completed});
    if(reason){if(!userText)add(reason+'。');return;}
    chatFollow.current=true;
    if(userText)add(userText,undefined,'user');
    if(['table','risk','report'].includes(id))openDataTab(id as DataTab);else action(id);
  }
  function offerContent(next:View,explicit=false){if(explicit)open(next);add(`可以打开${titles[next]}查看。`,[{label:'打开'+titles[next],action:next,primary:true}]);}
  function send(customText?:string){const text=(typeof customText==='string'?customText:draft).trim();const explicitOpen=/^(请|帮我)?\s*(打开|查看|显示|进入|切换|展示|回到)/.test(text);if(!text||busyRef.current||!workspace.ready)return;const knowledgeQuestion=prefixedKnowledgeQuestion(text);if(knowledgeQuestion===''){add('请在 #知识库： 后输入问题。');return;}chatFollow.current=true;if(typeof customText!=='string')setDraft('');add(text,undefined,'user');if(digitalSession&&view==='digital'){const guidedActions:Record<string,string>={'开始功能点分析':'identify','分析功能点':'identify','继续':'next','下一步':'next','核对系数':'prices','查看费用':'fees','演示价格形成':'story','上传文档':'upload'};const step=guidedActions[text.replace(/[。！!]/g,'')];if(step){digitalAction('digital-'+step);return;}}const command=resolveCommand(text);if(knowledgeQuestion===null&&command){if(command.kind==='explain'){add(command.text,command.action&&command.label?[{label:command.label,action:command.action}]:[{label:'查看全部能力',action:'tools'}]);return;}if(quickPrompt(command.action))runQuickCommand(command.action);else action(command.action);return;}if(chatMode==='knowledge'||knowledgeQuestion!==null){void askKnowledge(knowledgeQuestion??text,true,knowledgeQuestion!==null);return;}if(/协同设置|飞书设置|weact设置/i.test(text)){open('collaboration-settings');return;}if(/复核进度|审核进度|复核状态|审核状态/.test(text)){prepareReview('progress');return;}if(/(飞书|weact|同事).*复核|发送.*复核|复核.*(飞书|weact|同事)/i.test(text)){prepareReview();return;}if(/公文|文稿排版/.test(text)){open('document');return;}const intents:[RegExp,View][]=[[/Gork|机器人|任务哨兵|任务追踪/i,'gork'],[/工作量|抓取/,'workload'],[/导入.*经验|经验池导入/,'experience'],[/结算|送审/,'settlement'],[/记忆|候选知识/,'memory'],[/项目鸟瞰|三维地球|鸟瞰/,'aerial'],[/地图|地点|地理/,'map'],[/能力治理|上岗|Skill/i,'skills'],[/AI.*增强|智能.*编制|字段确认/,'advanced'],[/费用.*图|分析图表/,'analysis'],[/分页|Word 预览/i,'word'],[/配置|设置/,'configuration'],[/派发|回执|通讯录/,'dispatch'],[/双路|对比回答/,'knowledge'],[/数字化项目/,'digital']];const intent=intents.find(([pattern])=>pattern.test(text));if(intent){if(explicitOpen)open(intent[1]);add(`${titles[intent[1]]}可以从下面的入口打开。`,[{label:'打开专业详情',action:intent[1],primary:true}],'assistant',false,{kind:'confirmation',title:titles[intent[1]],caption:'专业工具',icon:'grid',status:'等待操作'});return;}if(/架构图|系统架构/.test(text)){offerContent('architecture',explicitOpen);return;}if(/智能协同|协同|飞书|WeAct/i.test(text)){offerContent('collaboration',explicitOpen);return;}if(/知识图谱|知识网络/.test(text)){if(explicitOpen)open('network');else add('可以在知识图谱中查看文章关联。',[{label:'打开知识图谱',action:'network',primary:true}]);return;}if(/文章库/.test(text)){offerContent('articles',explicitOpen);return;}if(/知识库|资料库/.test(text)){offerContent('knowledge',explicitOpen);return;}if(/^(查看|显示|打开).*(风险|预警|复核)/.test(text)){open('risk');return;}if(/报告|导出|下载/.test(text)){if(completed){if(explicitOpen)open('report');add('成果已就绪，可以从下面的入口打开。',[{label:'补充风险报告',action:'risk-report'}],'assistant',false,artifactCard({...result!,needs_recalculate:needsRecalculate}));}else add('请先完成批量匹配，才能生成正式成果。',[{label:result?'批量匹配':'添加 Excel',action:result?'match':'attach',primary:true}]);return;}if(/表格|计算表/.test(text)){offerContent('table',explicitOpen);return;}if(/星图|3d/i.test(text)){offerContent('universe',explicitOpen);return;}if(DEBUG_MODE&&/项目/.test(text)&&!/看板|历史|资料|新建/.test(text)){if(explicitOpen)showInsights();add('项目信息只显示当前会话所属项目。',[{label:'查看项目信息',action:'insights'}]);return;}if(/项目|历史|看板/.test(text)){if(explicitOpen)open('projects');add('可以从入口查看项目看板，或从历史成果继续工作。',[{label:'查看项目看板',action:'projects',primary:true}],'assistant',false,{kind:'confirmation',title:'项目看板',caption:'项目与历史成果',icon:'folder',status:'已打开',note:'统计来自本工作区的真实业务记录。'});return;}add('你可以通过这些已接通的能力，在对话中推进编制。',[{label:result?(completed?'检查经验池预警':'开始批量匹配'):file?'确认结构并转换':'添加 Excel',action:result?(completed?'warning':'match'):file?'convert':'attach',primary:true},{label:'查看全部能力',action:'tools'}],'assistant',false,capabilitiesCard);}

  function unavailable(message:Message,a:Action){if(a.action.startsWith('digital-')){if(message.context&&message.context!==conversationContext.current)return '请在所属对话中继续';if(message.digital&&message.digital.taskId!==lastDigital?.taskId)return '请使用当前数字化任务';return busy?'正在执行，请稍候':undefined;}if(a.action.startsWith('format-document:')&&(!activeDocumentSource||a.action.slice(16)!==sourceKey(activeDocumentSource)))return '请先打开这份文稿';return actionUnavailable(message,a,{context:conversationContext.current,result,busy:!!busy,needsRecalculate});}
  function locate(sheet:string,row:number,metric?:string,severity?:string){
    if(!result)return;const previews=result.summary.table_preview.sheets||[result.summary.table_preview];
    const index=previews.findIndex(s=>s.sheet_name===sheet);if(index<0){add('当前预览未包含该工作表，请在完整 Excel 中查看。');return;}
    const preview=previews[index];
    if(!hasPreviewRow(preview,row)){add(`第 ${row} 行不在当前预览范围内，请在完整 Excel 中查看。`);return;}
    const column=metric?riskColumn(preview,metric,result.summary.price_column):undefined;
    if(metric&&column===undefined){add(`当前表头无法唯一定位「${metric}」，请在完整 Excel 中核对。`);return;}
    setLocatedCell(column?{sheet,row,column,severity,request:++locationRequest.current,job:result.job_id}:undefined);
    setSheetIndex(index);setLocatedRow(row);open('table');
  }
  function prepareKnowledgeCandidate(message:Message){
    const answer=message.evidence;if(!answer||busyRef.current)return;
    const question=answer.question||messages.slice(0,messages.findIndex(m=>m.id===message.id)).reverse().find(m=>m.role==='user')?.text||'知识问答';
    const references=(answer.sources||[]).map((item:any)=>item.title||item.title_path||item.source_name||item.source||item.source_file||'知识引用').join('；');
    const excerpts=(answer.sources||[]).map((item:any)=>item.snippet||item.excerpt||item.content||item.text||'').filter(Boolean).join('\n\n');
    setKnowledgeSeed({id:crypto.randomUUID(),context:conversationContext.current,title:question.slice(0,120),question,conclusion:['evidence_only','evidence_fallback'].includes(answer.answer_mode)?excerpts:message.text,sourceReference:references,evidenceSummary:excerpts.slice(0,4000),sourceType:'knowledge_answer',jobId:message.job||''});open('memory');
  }
  function messageAction(message:Message,a:Action){if(unavailable(message,a)||busyRef.current)return;if(a.action==='knowledge-result'&&message.evidence){setEvidence(message.evidence);open('knowledge');return;}if(a.action==='locate'&&a.target){const target=riskActionTarget(message,a,risks);if(message.card?.kind==='review'&&!target?.metric){add('此风险卡缺少字段信息，请从当前风险详情定位。');return;}if(target)locate(target.sheet,target.row,target.metric,target.severity);return;}action(message.card?.kind==='result'&&a.label==='查看成果'&&a.action==='report'?'table':a.action);}

  useEffect(()=>{if(isProfessional(view))setProfessionalWarm(true);},[view]);
  useEffect(()=>{if(!visible||welcomeVisible||view!=="projects"||mapPrewarm)return;return scheduleIdlePreload(()=>{setProfessionalWarm(true);setMapPrewarm(true);void Promise.allSettled([warmMapResources(),warmGlobeResources()]);},{busy:()=>busyRef.current,delay:500});},[visible,welcomeVisible,view,mapPrewarm]);
  function summaryContent(){return <CurrentProjectCard riskLoading={riskRead.job===currentProject?.jobId&&riskRead.loading} riskError={riskRead.job===currentProject?.jobId?riskRead.error:''} reloadRisks={()=>{if(result)void refreshRisk(result.job_id,true);}} checkRisks={()=>void warning()} project={currentProject} ready={workspace.ready} openBoard={()=>open('projects')} openData={()=>{if(currentProject?.workspaceProjectId){setProjectId(currentProject.workspaceProjectId);open('project');}else open('library');}} openInput={()=>open('mapping')} openTable={()=>open('table')} openRisks={()=>open('risk')} assign={id=>void associateProject(id)} newProject={()=>{associateNewProject.current=workspace.currentConversation()?.id||null;setProjectEditor(true);}} projects={workspace.projects} busy={!!busy} contextKey={workspace.active?.id}/>;}
  const details=(panelView:View=view)=>{const contentActive=visible&&presentation.state.content===panelView;const view=panelView;

    if(view==='example')return null;
    if(view==='connections')return DEBUG_MODE?<LegacyConnections selected={connectionPlatform} select={setConnectionPlatform}/>:<PlatformConnections selected={connectionPlatform} select={setConnectionPlatform} {...platformConnection} onSettings={()=>{setConnectionsOpen(false);openSettings('collaboration-settings');}} onReview={()=>{setConnectionsOpen(false);prepareReview();}} onProgress={()=>{setConnectionsOpen(false);prepareReview('progress');}}/>;

    if(view==='report'||view==='document')return <div className="result-tab-panel document-tab-panel" id={view==='report'?'result-panel-report':undefined} role={view==='report'?'tabpanel':undefined} aria-labelledby={view==='report'?'result-tab-report':undefined}><DocumentPanel onReload={async()=>{await workspace.flush();window.location.reload();}} document={documentFor(view==='report'?reportDocument:selectedDocument)} reportExcel={view==='report'&&result?.downloads.excel?{jobId:result.job_id,url:result.downloads.excel}:undefined} conversation={workspace.active?.id||''} busy={!!busy} upload={()=>input.current?.click()}/></div>;
    if(isProfessional(view))return null;
    if(view==='gork')return <GorkConsole/>;
    if(view==='digital')return <DigitalAssistant key={conversationContext.current+':'+(digitalSession?.id||'browse')} guided={digitalSession} onSelectTask={taskId=>{if(!taskId){setDigitalPicker(true);return;}const id=crypto.randomUUID(),context=conversationContext.current;setDigitalImport({context,session:{id,taskId}});setMessages(old=>[...old,{id:crypto.randomUUID(),role:'assistant',text:'已切换数字化项目，正在读取当前进展。你可以继续这份任务，或选择文档开始新的测算。',actions:[{label:'继续当前任务',action:'digital-resume'},{label:'选择项目文档',action:'digital-upload'}],context,digital:{taskId,key:taskId+':selected',sessionId:id,revision:0}}]);setDigitalCommand(null);setConversationCollapsed(false);presentation.returnToSplit();}} guideCommand={digitalCommand} onGuide={state=>digitalEvent(state,conversationContext.current,digitalSession?.id||'')} onGuideError={message=>{if(digitalLatest.current.context===conversationContext.current)add(message,[{label:'重新选择文档',action:'digital-upload'}]);}} toolbarTarget={digitalHeaderTarget} dark={dark} palette={palette} active={contentActive&&!welcomeVisible&&!settings} onExpand={presentation.fullscreen}/>;
    if(view==='architecture')return null;
    if(view==='knowledge'||view==='articles')return <KnowledgeWorkspace fullScreen={expanded} tab={view==='articles'?'articles':knowledgeTab} select={selectKnowledgeTab} active={visible&&isKnowledge&&!welcomeVisible&&!settings&&!architecturePresentation} present={id=>void presentArticle(id)} options={knowledgeOptions} setOptions={v=>{setKnowledgeOptions(v);setChatMode('knowledge');}} evidence={evidence} onGraphVisible={setWeKnoraGraphVisible} prepareQuestion={q=>{void weknora.refresh();setChatMode('knowledge');setKnowledgeOptions(v=>({...v,engine:'weknora'}));setDraft(current=>current.trim()?`${current}\n#知识库：${q}`:`#知识库：${q}`);presentation.chat();requestAnimationFrame(()=>prompt.current?.focus());}} ask={q=>{setChatMode('knowledge');void askKnowledge(q);}} busy={!!busy||!workspace.ready} running={qaRunning} stop={stopKnowledge} weknora={weknora.status} refreshWeKnora={weknora.refresh} settings={()=>openSettings('knowledge-settings')} memory={()=>open('memory')} revision={knowledgeRevision}/>;
    if(view==='collaboration')return <><div className="module-actions"><Button onClick={()=>open('dispatch')}>派发、平台配置与复核回执</Button></div><CollaborationPanel key={workspace.active?.id} conversation={workspace.active?.id||''} job={result?.job_id||''} busy={!!busy} flush={workspace.flush} prepared={()=>add('复核草稿已保存。平台尚未连接，未发起发送。',undefined,'assistant',false,{kind:'confirmation',title:'复核草稿已保存',caption:'智能协同 · 本地准备',icon:'users',status:'未发送',note:'接收人尚待平台身份核验，没有送达回执。'})}/></>;
    if(view==='library'||view==='project')return <Library key={view+projectId} workspace={workspace} projectId={view==='project'?projectId:undefined} editProject={setProjectEditor} newChat={id=>void newConversation(id)} useFile={a=>void storedFile(a)} open={open}/>;

    if(view==='universe')return <Universe open={open}/>;
    if(view==='tools')return <CapabilityHub open={open}/>;
    if(view==='projects')return null;
    if(view==='mapping'&&file)return <Mapping sheets={sheets} setSheets={setSheets} filename={file.name} project={project} setProject={setProject} busy={!!busy} convert={convert} inspectHeader={inspectHeader}/>;
    if(DEBUG_MODE&&!result&&['table','risk','report'].includes(view))return <div className="empty-state result-tab-panel" id={`result-panel-${view}`} role="tabpanel" aria-labelledby={`result-tab-${view}`}><Icon name="sheet"/><h3>尚未载入表格内容</h3><p>在设置的“表格演示”中加载你的附件后，可切换表格、风险和文字报告。</p><Button primary onClick={()=>setSettings(true)}>打开设置 · 表格演示</Button></div>;
    if(!result)return <div className="empty-state"><Icon name="sheet"/><h3>从一份资料开始</h3><p>添加 Excel 后，这里会显示当前任务的专业细节。</p><Button primary onClick={()=>input.current?.click()} disabled={!!busy}>添加 Excel</Button></div>;
    if(view==='table')return <div className="result-tab-panel" id="result-panel-table" role="tabpanel" aria-labelledby="result-tab-table"><Workbook active={contentActive&&!welcomeVisible&&!settings} location={locatedCell} preferences={previewPreferences} setPreferences={setSharedPreview} refreshHeaders={refreshPreviewHeaders} result={result} sheetIndex={sheetIndex} setSheetIndex={index=>{if(index!==sheetIndex){setLocatedRow(undefined);setLocatedCell(undefined);}setSheetIndex(index);}} busy={!!busy} match={match} recalculate={recalculate} needsRecalculate={needsRecalculate} selectedRow={locatedRow} edit={c=>{setOperationError('');setSelection(c);setCellValue(String(c.value??''));setEditNote('');}} inspect={inspectRow} assist={c=>void beginRowAssist(c)}/></div>;
    if(view==='risk')return <div className="result-tab-panel" id="result-panel-risk" role="tabpanel" aria-labelledby="result-tab-risk"><Risks manage={()=>open('experience')} items={risks} busy={!!busy} warning={warning} hasRun={Boolean(summary?.warning_summary?.executed)} locate={r=>locate(r.sheet_name,r.excel_row,r.metric,r.severity)}/></div>;

    if(view==='sources')return <div className="panel-content"><h3>{sources?`${sources.cell.sheet} · 第 ${sources.cell.row} 行`:'逐行核对来源'}</h3>{!sources?<div className="empty-state"><p>在计算表右侧点击书本按钮，查看当前行的来源。</p><Button onClick={()=>open('table')}>打开计算表</Button></div>:<><p className="panel-lead">标准规则、经验提示和候选建议分别核对。此处为原系统返回的来源信息。</p>{sources.trace?.map((t:any,i:number)=><div key={i} className="source-item"><span className="source-num">{String(i+1).padStart(2,'0')}</span><div><h3>{t.title||t.label||t.field||'来源记录'}</h3><p>{t.text||t.message||t.description||t.basis}</p><small>{t.source}</small></div></div>)}<h3 className="candidate-heading">基价辅助候选 · 尚未采用</h3>{sources.candidates?.slice(0,10).map((c:any)=><article className="candidate-card" key={c.id}><span className="badge badge-ghost">{c.source_label}</span><strong>{c.value}</strong><p>{c.reason}</p><small>{c.basis}</small></article>)}<Button onClick={()=>void beginRowAssist(sources.cell)}>打开当前行辅助填价</Button><Note>候选不会自动写入，请在专业表格中逐字段核对来源并确认。</Note><Button onClick={()=>open('table')}>返回计算表</Button></>}</div>;
    if(view==='trace')return <div className="panel-content"><h3>真实任务事件</h3><p className="panel-lead">只展示业务后端已经记录的事件，不模拟执行进度。</p>{timeline.length?timeline.map((t,i)=><article className="source-item" key={i}><span className="source-num">{i+1}</span><div><h3>{t.title||t.event_type}</h3><p>{t.detail||t.summary||t.message||({completed:'已完成',failed:'失败',running:'执行中'} as Record<string,string>)[t.status]||t.status}</p><small>{t.occurred_at||t.created_at}</small></div></article>):<Note>当前任务暂无可展示的业务事件。</Note>}</div>;
    return null;
  };

  const mergedKnowledgeHeader=expanded&&isKnowledge;
  const mergedAerialHeader=expanded&&view==='aerial';
  const mergedImmersiveHeader=mergedKnowledgeHeader||mergedAerialHeader;
  const pageTitle=isKnowledge?({ask:'知识问答',articles:'文章库',network:'知识图谱',weknora:'WeKnora 试验区'} as const)[view==='articles'?'articles':knowledgeTab]:isDashboard?({board:'项目总览',map:'全国项目',aerial:'项目鸟瞰',runs:'运行记录'} as const)[activeProjectTab]:view==='example'?({table:'表格演示',risk:'风险演示',report:'报告演示'} as const)[exampleRequest?.tab==='risks'?'risk':exampleRequest?.tab||'table']:titles[view];
  const contentCaption=['document','digital'].includes(view)?'':['architecture','articles','library','project','knowledge','tools','universe','projects','gork','insights','example'].includes(view)?({example:'只读节选 · 演示非正式审核',insights:'仅当前会话所属项目 · 可放大或收起',gork:'控制台连接与任务追踪',projects:'本工作区的真实项目与任务',architecture:'原图与动态展示',articles:'原文章与已整理关系',library:'公共与项目资料',project:'项目内对话共用',knowledge:'检索原文与引用依据',tools:'专业工具与迁移状态',universe:'能力关系 · 示意'} as any)[view]:result?`当前任务 ${result.job_id.slice(0,8)} · 独立成果`:'与对话共享当前任务';
  return <>{digitalPicker&&workspace.active&&<DigitalFilePicker key={workspace.active.id} conversationId={workspace.active.id} close={()=>setDigitalPicker(false)} upload={file=>{setDigitalPicker(false);const session={id:crypto.randomUUID(),file};setDigitalImport({context:conversationContext.current,session});add(`请分析这份数字化项目需求：${file.name}`,undefined,'user');add('正在读入文档。原文加载后，我们先确认分析范围，再识别功能点。');open('digital');setConversationCollapsed(false);presentation.returnToSplit();}}/>}<input ref={gongwenUpload} type="file" hidden accept=".doc,.docx,.md,.markdown" onChange={e=>{const next=e.target.files?.[0];e.target.value='';if(next&&!busy&&workspace.ready)void openDocumentFile(next);}}/>{welcomeVisible&&<WelcomeScreen openLogo={()=>openSettings('logo')} logoActive={!settings} ready={workspace.ready} busy={!!busy} dark={dark} toggleTheme={()=>setDark(!dark)} openAppearance={()=>setAppearanceOpen(true)} currentTitle={workspace.active?.title} hasWork={!!(messages.length||draft||file)} error={workspace.error} enter={()=>enterWorkspace()} newChat={welcomeNewChat} open={enterWorkspace}/>}<div className={`app-shell live-shell ${sidebar?'sidebar-open':''} ${!navigation.mobile&&navigation.collapsed?'sidebar-collapsed':''}`} id="shell" hidden={welcomeVisible}><WorkspaceSidebar workspace={workspace} navigation={navigation} activeView={visible?(view==='example'?(exampleRequest?.tab==='risks'?'risk':exampleRequest?.tab||'table'):view):'chat'} active={!welcomeVisible} settingsActive={settings} busy={!!busy} newChat={newTask} select={id=>void changeConversation(id)} showProject={id=>showProjectInsights(id)} open={next=>['table','risk','report'].includes(next)?openDataTab(next as DataTab):open(next,next==='projects')} settings={()=>openSettings()} search={()=>setSearchOpen(true)} newProject={()=>setProjectEditor(true)}/><button type="button" className="sidebar-backdrop" hidden={!navigation.mobile||!sidebar} tabIndex={-1} aria-label="关闭项目菜单遮罩" onClick={()=>setSidebar(false)}/><main className="main" inert={navigation.mobile&&sidebar}><header className={`topbar four-surface-topbar ${mergedImmersiveHeader?'knowledge-immersive-topbar':''}`}><div className="studio-identity">{navigation.mobile?<button type="button" ref={navigation.toggleRef} className="btn btn-ghost btn-square sidebar-toggle" aria-controls="project-sidebar" aria-expanded={navigation.visible} aria-label={navigation.visible?'收起项目菜单':'展开项目菜单'} onClick={navigation.toggle}><Icon name={navigation.visible?'sidebar-close':'sidebar-open'}/></button>:<button id="conversation-chat-toggle" type="button" className="btn btn-ghost btn-square sidebar-toggle" aria-controls="astra-conversation" aria-expanded={layout.chatActive} aria-label={layout.chatActive?'收起对话':'展开对话'} title={layout.chatActive?'收起对话':'展开对话'} onClick={toggleConversation}><Icon name={layout.chatActive?'sidebar-close':'sidebar-open'}/></button>}<strong className="studio-brand">造价智算</strong>{expanded&&!mergedImmersiveHeader&&<span className="topbar-page" title={pageTitle}><span className="topbar-page-divider" aria-hidden="true">·</span><span>{pageTitle}</span></span>}</div>{mergedKnowledgeHeader&&<KnowledgeTabs active={view==='articles'?'articles':knowledgeTab} select={selectKnowledgeTab}/>} {mergedAerialHeader&&<ProjectViewTabs active={activeProjectTab} select={selectProjectTab}/>}<div className="top-actions">{!sandboxVisible&&<button className="btn btn-ghost btn-sm sandbox-return" onClick={returnWorkbench}><Icon name="orbit"/>项目工作台</button>}{DEBUG_MODE?<LegacyStatusButtons open={id=>{setConnectionPlatform(id);setConnectionsOpen(true);}}/>:<PlatformStatusButtons snapshot={platformConnection.snapshot} open={id=>{setConnectionPlatform(id);setConnectionsOpen(true);}}/>}<GorkConnection active={!DEBUG_MODE&&!welcomeVisible} open={()=>openSettings('gork')}/><div className="tooltip tooltip-bottom header-icon-tip header-architecture" data-tip="系统架构图"><button type="button" className="btn btn-ghost btn-square header-icon-action" aria-label="系统架构图" title="系统架构图" onClick={()=>open('architecture')}><Icon name="architecture"/></button></div><div className="tooltip tooltip-bottom header-icon-tip header-welcome" data-tip="返回欢迎页"><button type="button" className="btn btn-ghost btn-square header-icon-action" aria-label="返回欢迎页" title="返回欢迎页" onClick={showWelcome}><Icon name="home"/></button></div><ThemeModeButton dark={dark} toggle={()=>setDark(!dark)}/><div className="tooltip tooltip-bottom header-icon-tip header-appearance" data-tip="外观与主题"><ThemeButton className="header-icon-action" label="外观与主题" expanded={appearanceOpen} open={()=>setAppearanceOpen(true)}/></div>{mergedImmersiveHeader&&<div className="content-heading-actions immersive-content-actions"><ContentActions fullscreen onFullscreen={presentation.fullscreen} onReturn={presentation.returnToSplit} onClose={presentation.closeContent}/></div>}</div></header><div ref={layout.ref} style={layout.style} className={`workbench adjustable-workbench four-surface mode-${sandboxHome?'content':classicHome?'chat':simpleHome?'summary':presentation.state.mode} ${sandboxHome?'sandbox-workbench':classicHome?'sandbox-classic':simpleHome?'simple-workbench':presentation.state.mode==='chat'?'no-artifact':''} ${conversationCollapsed?'conversation-collapsed':''} ${expanded?'expanded':''} ${layout.dragging?'is-resizing':''} ${layout.floating?'surface-floating':'surface-split'} ${layout.summaryFallback?'summary-fallback':''}`}>
<section id="astra-conversation" className={`conversation ${!messages.length?'home-scene':''}`} aria-label="智算任务对话"><div className="conversation-heading"><div className="conversation-identity"><div className="conversation-name"><h1>{DEBUG_MODE&&<span className="badge badge-outline conversation-demo-badge">模拟</span>}<span title={workspace.active?.title||'当前对话'}>{(workspace.active?.title||'当前对话').replace(/^【模拟】\s*/,'')}</span></h1></div></div><div className="conversation-header-actions"><button className="context-mode save-state" title={workspace.error||workspace.status} onClick={()=>void workspace.flush().catch(()=>{})}>{workspace.status}</button><button type="button" className="btn btn-ghost btn-square" aria-label={conversationDetails?'收起任务详情':'展开任务详情'} title="任务详情" aria-expanded={conversationDetails} aria-controls="conversation-task-details" onClick={()=>setConversationDetails(v=>!v)}><Icon name="info"/></button><button className="btn btn-ghost btn-square" aria-label="对话名称与归属" disabled={!!busy||!workspace.ready} onClick={()=>{setConversationTitle(workspace.active?.title||'');setConversationEditor(true);}}><Icon name="edit"/></button></div></div><div className="context-line compact-task-details" id="conversation-task-details" hidden={!conversationDetails}><span>智算 · ZSuan{busy?' · 正在处理':' · 与你一起工作'}</span>{currentProjectName&&<span title={currentProjectName}>项目：{currentProjectName}</span>}<span className="badge skill-badge"><Icon name="spark"/>勘察测量</span><span>{result?`任务 ${result.job_id.slice(0,8)}`:'等待资料'}</span></div><div className="messages" ref={scroll} onScroll={e=>{const n=e.currentTarget;chatFollow.current=n.scrollHeight-n.scrollTop-n.clientHeight<60;chatScrollMemory.current.set(conversationContext.current,n.scrollTop);}} aria-live="polite">{(workspace.error||workspace.recovery)&&<div className="workspace-error" role="alert">{workspace.error||'已保留冲突前的本机草稿，请导出后核对。'}<Button onClick={workspace.exportDraft}>导出本机草稿</Button><Button onClick={()=>workspace.active?void workspace.flush().catch(()=>{}):window.location.reload()}>{workspace.active?'重试保存':'重新载入'}</Button></div>}{!messages.length?<div className="welcome"><h1>您好，我是造价智算智能体。</h1><div className="welcome-grid"><button className="welcome-card" onClick={()=>input.current?.click()} disabled={!!busy}><Icon name="sheet"/><strong>编制控制价<Icon name="arrow-up-right"/></strong><small>{DEBUG_MODE?'真实上传已隔离':'上传 Excel，开始真实编制'}</small></button><button className="welcome-card" onClick={showProjectImports} disabled={!!busy||!workspace.ready}><Icon name="folder"/><strong>导入项目<Icon name="arrow-up-right"/></strong><small>从接入项目中选择 · 含 V3.1 体验</small></button><button className="welcome-card" onClick={()=>open('projects')}><Icon name="folder"/><strong>继续已有任务<Icon name="arrow-up-right"/></strong><small>恢复表格与当前成果</small></button><button className="welcome-card" onClick={()=>open('tools')}><Icon name="grid"/><strong>查看专业能力<Icon name="arrow-up-right"/></strong><small>工具与设置</small></button></div></div>:messages.map(m=>m.role==='user'?<div className="chat chat-end" key={m.id}><div className="chat-bubble">{m.text}</div></div>:<article className={`assistant-message ${m.error?'message-error':''}`} key={m.id} data-message-id={m.id}><div className="assistant-author">智算<small>ZSuan</small></div><div className="assistant-copy">{!m.rowPricing&&!m.error&&(m.evidence?<KnowledgeAnswer evidence={m.evidence} text={m.text} label={m.card?.caption} actions={m.evidence.sources?.length>0?<Button disabled={!!busy} onClick={()=>prepareKnowledgeCandidate(m)}>整理为知识候选</Button>:undefined} sources={m.card?<ConversationCard message={m} onCitations={()=>showCitations(m)} citationsOpen={presentation.state.mode==='summary'&&citationMessage?.id===m.id} onAction={a=>messageAction(m,a)} unavailable={a=>unavailable(m,a)}/>:undefined}/>:<p>{m.text}</p>)}{m.rowPricing?<RowAssist state={m.rowPricing} job={m.job||''} context={m.context||''} active={rowAssist===m.id&&m.context===conversationContext.current&&m.job===result?.job_id&&workspace.ready} blocked={!!busy||!workspace.ready||m.context!==conversationContext.current||m.job!==result?.job_id} headers={previewPreferences.headerRows} change={next=>{if(m.context===conversationContext.current){if(m.rowPricing?.phase==='loading')pendingFeeFocus.current=m.id;setMessages(old=>old.map(item=>item.id===m.id?{...item,rowPricing:next}:item));}}} saved={data=>{if(m.context!==conversationContext.current||data.job_id!==loadedJob.current)return;acceptResult(data);setRowAssist(null);gorkFeedback.success();add('已填写确认数值，其余字段未改动。',[{label:'重算公式与报告',action:'recalculate'}]);}} retry={()=>void beginRowAssist(m.rowPricing!.cell)} working={label=>{if(m.context===conversationContext.current)professionalBusy(label);}} professional={row=>{if(m.context!==conversationContext.current||m.job!==result?.job_id)return;setRowAssist(null);setRowContext(row);open('analysis');}}/>:m.review?(m.review.closed?<span className="badge badge-ghost">已关闭复核设置 · 不触发发送</span>:m.context===conversationContext.current&&m.review.jobId===result?.job_id&&m.review.version===(result?.task_tracking?.task.artifact_version||0)&&(m.review.kind==='progress'||!needsRecalculate)?<ReviewConversation key={m.id} request={m.review} busy={!!busy} onBusy={label=>{if(m.context===conversationContext.current)professionalBusy(label);}} onSettings={()=>open('collaboration-settings')} onClose={()=>{if(m.review?.kind==='progress'){prepareReview();return;}setMessages(old=>old.map(item=>item.id===m.id?{...item,review:{...item.review!,closed:true}}:item));}}/>:<div className="notice"><span>成果已变化，请重新准备复核。</span><Button disabled={!!busy} onClick={()=>prepareReview(m.review?.kind)}>重新准备</Button></div>):m.evidence&&!m.error?null:m.card?<ConversationCard message={m} inputSettings={m.card.kind==='input'&&m.context===conversationContext.current&&file&&!result?<div className="mapping-input-overview"><Icon name="sheet"/><div><strong>{project||file.name}</strong><span>{sheets.filter(s=>s.enabled).length} / {sheets.length} 张工作表参与处理 · {file.name}</span></div></div>:undefined} onAction={a=>messageAction(m,a)} unavailable={a=>unavailable(m,a)}/>:m.actions&&<div className="conversation-actions">{m.actions.map(a=><Button key={a.action} primary={a.primary} disabled={!!unavailable(m,a)} title={unavailable(m,a)} onClick={()=>messageAction(m,a)}>{a.label}</Button>)}</div>}</div></article>)}{!DEBUG_MODE&&gongwenOpen&&<GongwenCard key={`${workspace.active?.id}:${gongwenSource?.source_id||'empty'}:${gongwenSource?.revision||''}`} source={gongwenSource} conversation={workspace.active?.id||''} draft={documentFor(gongwenSource)?.formatDraft} output={documentFor(gongwenSource)?.output} busy={!!busy||!workspace.ready} change={formatDraft=>{const source=gongwenSource;if(!source)return;setDocuments(all=>({...all,[sourceKey(source)]:{...documentFor(source)!,source,formatDraft}}));}} convert={formatDraft=>gongwenSource?formatDocument(sourceKey(gongwenSource),formatDraft):Promise.resolve()} upload={()=>gongwenUpload.current?.click()} paste={pasteGongwen} currentReport={reportDocument?()=>beginGongwen(reportDocument):undefined} close={()=>setGongwenOpen(false)} reload={()=>{if(gongwenSource)setDocuments(all=>({...all,[sourceKey(gongwenSource)]:{...documentFor(gongwenSource)!,formatDraft:undefined}}));}}/>}{busy&&<WorkingCard label={busy} showAvatar={false}/>}</div><div className="composer-wrap"><ComposerKnowledgeQuestions key={workspace.active?.id} value={draft} enabled={!welcomeVisible&&layout.chatActive&&!settings&&workspace.ready} disabled={!!busy||projectAssociating} revision={knowledgeRevision} select={(q,libraries)=>{setKnowledgeOptions(o=>({...o,library_ids:recommendedKnowledgeScope(o.library_ids,libraries)}));setDraft(knowledgeQuestionPrompt(q));requestAnimationFrame(()=>prompt.current?.focus());}} focus={()=>requestAnimationFrame(()=>prompt.current?.focus())} changed={()=>setKnowledgeRevision(n=>n+1)}/><ComposerQuickMenu preferences={quickPreferences} custom={text=>send(text)} context={conversationContext.current} active={!welcomeVisible&&layout.chatActive} state={{ready:workspace.ready,busy:!!busy,connected,hasResult:!!result,completed}} run={id=>{const text=quickPrompt(id);if(text)runQuickCommand(id,text);}}/><form className="composer" onSubmit={e=>{e.preventDefault();send();}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy&&e.dataTransfer.files[0])void inspectFile(e.dataTransfer.files[0]);}}><div className="composer-input-row"><ComposerCompanion onPresented={onGorkPresented} suspended={gorkSuspended||architecturePresentation} state={gorkState}/><textarea ref={prompt} className="textarea" disabled={!workspace.ready||projectAssociating} aria-label="告诉智算你的任务" onFocus={()=>setComposing(true)} onBlur={()=>setComposing(false)} placeholder={busy?'可以先写下下一步需求…':'描述你的需求，或添加文件…'} rows={2} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{const completion=agentComposerSpaceCompletion(draft);if(e.key===' '&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.nativeEvent.isComposing&&completion){e.preventDefault();setDraft(completion);return;}if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}}/></div><div className={`composer-toolbar ${chatMode==='knowledge'?'with-knowledge':''}`}><div className="composer-tools"><button type="button" className="btn btn-ghost btn-square" aria-label="添加文件" disabled={!!busy||!connected||!workspace.ready} onClick={()=>input.current?.click()}><Icon name="plus"/></button><button type="button" className="btn btn-ghost skill-selector" onClick={()=>open('tools')}><Icon name="tools"/>专业工具<Icon name="chevron"/></button><span className="tool-divider"/><select className="chat-mode" aria-label="对话模式" disabled={!!busy} value={chatMode} onChange={e=>setChatMode(e.target.value as 'task'|'knowledge')}><option value="task">任务协作</option><option value="knowledge">知识问答</option></select>{chatMode==='knowledge'&&<div className="composer-knowledge"><Icon name="book"/><select className="chat-mode" aria-label="问答引擎" disabled={!!busy} value={knowledgeOptions.engine||'local'} onChange={e=>setKnowledgeOptions({...knowledgeOptions,engine:e.target.value as 'local'|'weknora'|'compare'})}><option value="local">原知识问答</option><option value="weknora" disabled={!weknora.status.available}>WeKnora{weknora.status.available?'':' · 未连接'}</option><option value="compare" disabled={!weknora.status.available}>双路对比{weknora.status.available?'':' · 待连接'}</option></select></div>}</div>{qaRunning?<button type="button" className="btn btn-outline stop-answer" onClick={stopKnowledge}><Icon name="stop"/>停止回答</button>:<button className="btn btn-primary btn-square send" type="submit" disabled={!!busy||!workspace.ready||!draft.trim()} aria-label="发送任务"><Icon name="arrow-up"/></button>}</div></form></div></section><aside id="astra-summary" className={`artifact summary-artifact${!mappingOpen&&!citationMessage?' project-summary-surface':''}`} hidden={sandboxVisible||(!simpleHome&&presentation.state.mode!=='summary')} aria-label={mappingOpen?'编制设置':citationMessage?'回答引用依据':'当前项目信息摘要'}>{mappingOpen&&file&&!result?<MappingPanel close={closeMapping} current={mappingSheet} setCurrent={setMappingSheet} expanded={mappingExpanded} setExpanded={setMappingExpanded} sheets={sheets} setSheets={setSheets} filename={file.name} project={project} setProject={setProject} busy={!!busy||!workspace.ready} convert={convert} inspectHeader={inspectHeader}/>:citationMessage?<KnowledgeCitationPanel key={citationMessage.id} message={citationMessage} close={closeCitations} onAction={a=>messageAction(citationMessage,a)} unavailable={a=>unavailable(citationMessage,a)}/>:<><header className="artifact-heading summary-heading"><h2>项目信息</h2><WorkbenchModeSwitch value="simple" change={changeWorkbenchMode}/></header><div className="artifact-body summary-body">{summaryContent()}</div></>}</aside><div className="workbench-separator" hidden={!layout.split} {...layout.separator}><span/><span className="separator-hint">拖动或方向键调整</span></div>{sandboxMounted&&<section id="astra-sandbox" className="sandbox-surface" aria-label="三维项目空间" hidden={!sandboxVisible}><Suspense fallback={<div className="sandbox-loading" role="status">正在载入项目工作台…</div>}><ProjectSandbox chatTransparency={sandboxChatBackground==='solid'?0:sandboxChatTransparency} setChatTransparency={value=>{setSandboxChatBackground('glass');setSandboxChatTransparency(value)}} roofLabels={sandboxRoofLabels} setRoofLabels={setSandboxRoofLabels} autoOrbit={sandboxAutoOrbit} setAutoOrbit={setSandboxAutoOrbit} orbitDelay={sandboxOrbitDelay} setOrbitDelay={setSandboxOrbitDelay} orbitSettings={()=>openSettings('appearance')} variant={workbenchStyle.style==='classic'?'card':'immersive'} immersive={showSandbox} key={workspace.active?.id||'initial'} context={workspace.active?.id||'initial'} active={sandboxVisible&&!welcomeVisible&&!settings&&!appearanceOpen&&!architecturePresentation&&!connectionsOpen&&!searchOpen&&!conversationEditor&&!projectEditor} dark={dark} title={currentProjectName||currentProject?.title||'当前任务'} taskId={workspace.active?.id||''} tasks={workspace.conversations.filter(c=>workspace.active?.project_id?c.project_id===workspace.active.project_id:c.id===workspace.active?.id).map(c=>({id:c.id,title:c.title}))} selectTask={id=>void changeConversation(id)} chatCollapsed={conversationCollapsed} simple={()=>changeWorkbenchMode('simple')} classic={()=>changeWorkbenchMode('classic')} toggleDark={()=>setDark(!dark)} enter={id=>runQuickCommand(id,quickPrompt(id))} overview={<SandboxFloatingCards project={currentProject} ready={workspace.ready} busy={!!busy} riskLoading={riskRead.job===currentProject?.jobId&&riskRead.loading} riskError={riskRead.job===currentProject?.jobId?riskRead.error:''} openInfo={showInsights} openTable={()=>open('table')} openRisks={()=>open('risk')} checkRisks={()=>void warning()} reloadRisks={()=>{if(result)void refreshRisk(result.job_id,true);}}/>} input={{ready:workspace.ready,project:currentProject,result,filename:inputConversationId===workspace.active?.id?file?.name||'':'',sheets,busy,qaRunning,operationError,cancelVersion:sandboxCancelVersion,needsRecalculate,riskLoading:riskRead.job===currentProject?.jobId&&riskRead.loading,riskError:riskRead.job===currentProject?.jobId?riskRead.error:'',reportReady:!!reportDocument,citations:messages.reduce((n,m)=>n+(m.evidence?.sources?.length||0),0)}}/>{classicHome&&<SandboxProjectOverview project={currentProject} ready={workspace.ready} busy={!!busy} riskLoading={riskRead.job===currentProject?.jobId&&riskRead.loading} riskError={riskRead.job===currentProject?.jobId?riskRead.error:''} openInfo={showInsights} openTable={()=>open('table')} openRisks={()=>open('risk')} checkRisks={()=>void warning()} reloadRisks={()=>{if(result)void refreshRisk(result.job_id,true);}} upload={()=>input.current?.click()}/>}</Suspense></section>}<section id="astra-preview" className={`artifact content-artifact ${view==='table'&&result?'artifact-table':''}`} aria-label="专业成果区" hidden={!visible}>{!mergedImmersiveHeader&&<header className={`artifact-heading ${isKnowledge?'data-preview-heading knowledge-preview-heading':isDashboard?'dashboard-preview-heading':view==='example'||['table','risk','report'].includes(view)?'data-preview-heading':''}`} aria-label={titles[view]}><div className="artifact-title">{isKnowledge?<KnowledgeTabs active={view==='articles'?'articles':knowledgeTab} select={selectKnowledgeTab}/>:isDashboard?<ProjectViewTabs active={activeProjectTab} select={selectProjectTab}/>:<>{view==='example'||['table','risk','report'].includes(view)?<><ContentViewTabs active={view==='example'?(exampleRequest?.tab==='risks'?'risk':exampleRequest?.tab||'table'):view as DataTab} example={view==='example'} select={openDataTab}/>{DEBUG_MODE&&<span className="badge badge-outline preview-demo-badge" title={view==='example'?'演示附件未随交接 · 无正式审核结论':'前端模拟数据 · 演示非正式审核'}>演示{view==='example'?' · 只读':''}</span>}</>:<>{view!=='digital'&&<span className="artifact-mark"><Icon name={viewIconName(view)}/></span>}<div><h2 title={titles[view]}>{titles[view]}</h2><small title={contentCaption}>{contentCaption}</small></div></>}</>}</div>{view==='digital'&&<div className="digital-cost-header-slot" ref={setDigitalHeaderTarget}/>}<div className="content-heading-actions">{view==='example'&&<button type="button" className="btn btn-ghost btn-square content-file-info" aria-label="文件说明" title="表格演示 · 文件说明" aria-expanded={exampleSourceDetails} aria-controls="example-source-note" onClick={()=>setExampleSourceDetails(value=>!value)}><Icon name="info"/></button>}{result&&['table','risk','report'].includes(view)&&<button type="button" className="btn btn-ghost btn-square" aria-label="查看依据" title="查看依据" onClick={()=>open('sources')}><Icon name="book"/></button>}<ContentActions fullscreen={expanded} onFullscreen={presentation.fullscreen} onReturn={presentation.returnToSplit} onClose={presentation.closeContent}/></div></header>}{busy&&!layout.chatActive&&<div className="task-progress-float"><TaskProgress compact label={busy}/></div>}<div className="artifact-body retained-content-body" ref={artifactScroll} id={isDashboard?"astra-dashboard-panel":undefined} role={isDashboard?"tabpanel":undefined} aria-labelledby={isDashboard?`dashboard-tab-${activeProjectTab}`:undefined}>
{DEBUG_MODE&&exampleRequest&&<RetainedContentPane scope={conversationContext.current} view="example" variant={expanded?'fullscreen':'content'} active={visible&&view==='example'}><div className="uploaded-example-host"><UploadedExample sourceDetails={exampleSourceDetails} request={exampleRequest} onTabChange={tab=>setExampleRequest(r=>r?{...r,tab}:r)} active={visible&&!welcomeVisible&&view==='example'}/></div></RetainedContentPane>}
{dashboardWarm&&<RetainedContentPane scope={conversationContext.current} view="projects" variant={expanded?'fullscreen':'content'} active={visible&&view==='projects'}><div className="astra-dashboard-host"><Suspense fallback={<div className="empty-state" role="status">正在载入项目看板…</div>}><ProjectDashboard key={presentation.state.context} active={visible&&!welcomeVisible&&view==='projects'&&dashboardTab==='board'} apiBase="" onOpenRun={openDashboardRun}/></Suspense>{dashboardTab==='runs'&&<Projects runs={runs} restore={restore} busy={!!busy}/>}</div></RetainedContentPane>}
{professionalWarm&&<RetainedContentPane scope={conversationContext.current} view={isProfessional(view)?view:'professional'} variant={expanded?'fullscreen':'content'} active={visible&&isProfessional(view)}><ProfessionalPanel key={conversationContext.current} prewarmMap={mapPrewarm} view={view} context={conversationContext.current} jobId={result?.job_id||''} inputFile={file} sheets={sheets} knowledgeSeed={knowledgeSeed} rowContext={rowContext} businessRevision={businessRevision} palette={palette} dark={dark} active={visible&&isProfessional(view)&&!welcomeVisible} onBusy={professionalBusy} onNavigate={open} onOpenRun={openDashboardRun} previewPreferences={previewPreferences} onPreferences={setSharedPreview} onSettingsChanged={()=>{setBusinessRevision(n=>n+1);}} onReceipt={r=>void professionalReceipt(r)}/></RetainedContentPane>}
{presentation.state.visited.filter(v=>!['projects','example','insights','architecture'].includes(v)&&!isProfessional(v)).map(v=><RetainedContentPane key={conversationContext.current+':'+v} scope={conversationContext.current} view={v} variant={expanded?'fullscreen':'content'} active={visible&&view===v}>{(['table','risk','report','document','sources','mapping','library','project','knowledge','architecture','digital'].includes(v)||visible&&view===v)?details(v):null}</RetainedContentPane>)}
</div><footer className="artifact-footer" hidden={isKnowledge||isDashboard||view==='report'||view==='document'||view==='digital'}><button className="text-button" onClick={()=>open('tools')}>全部工具<Icon name="arrow-right"/></button></footer></section></div></main></div><FloatingGork sourceActive={!gorkSuspended&&!architecturePresentation} onPresented={onGorkPresented} active={!welcomeVisible&&visible&&!layout.chatActive&&!settings&&!architecturePresentation} state={gorkState}/>{architecturePresentation&&<ArchitectureWindow key={architectureOpening} dark={dark} close={()=>setArchitectureOpen(false)}/>}<input ref={input} type="file" accept=".xlsx,.doc,.docx,.md,.markdown" hidden onChange={e=>{if(e.target.files?.[0])void inspectFile(e.target.files[0]);e.target.value='';}}/>{searchOpen&&<SearchConversations close={()=>setSearchOpen(false)} select={id=>void changeConversation(id)}/>}{projectEditor&&<ProjectEditor project={projectEditor===true?undefined:projectEditor} close={()=>{associateNewProject.current=null;setProjectEditor(null);}} saved={p=>void projectSaved(p)}/>}{conversationEditor&&<Modal title="对话名称与归属" close={()=>setConversationEditor(false)}><label className="field">对话名称<input className="input" value={conversationTitle} onChange={e=>setConversationTitle(e.target.value)} maxLength={120}/></label><Button primary disabled={!!busy||!conversationTitle.trim()} onClick={()=>void perform('正在保存对话名称',async()=>{await workspace.rename(conversationTitle);setConversationEditor(false);})}>保存名称</Button>{!workspace.active?.project_id&&workspace.projects.length>0&&<label className="field">归入项目（附件会成为项目共享资料）<select className="select" defaultValue="" disabled={!!busy} onChange={e=>{if(e.target.value)void perform('正在归入项目',async()=>{await workspace.assign(e.target.value);setConversationEditor(false);});}}><option value="">选择项目</option>{workspace.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}{workspace.active?.project_id&&<Note>此对话属于 {workspace.projects.find(p=>p.id===workspace.active?.project_id)?.name}，共用该项目资料。</Note>}</Modal>}{selection&&<Modal title={`第 ${selection.row} 行 · ${selection.header||'单元格'}`} close={()=>{if(!busy)setSelection(null);}}><p className="muted">{selection.sheet} · 只修改当前输出副本</p>{operationError&&<p className="edit-error" role="alert">{operationError}</p>}<label className="field">单元格值<input autoFocus className="input" aria-label="单元格值" value={cellValue} onChange={e=>setCellValue(e.target.value)} disabled={!!busy}/></label><label className="field">修改依据<textarea className="textarea" value={editNote} onChange={e=>setEditNote(e.target.value)} placeholder="填写来源或调整原因，随修改一起留痕" disabled={!!busy}/></label><Note>公式、受保护单元格及系统说明列由后端校验，不能强行覆盖。</Note><div className="action-row"><Button onClick={()=>setSelection(null)} disabled={!!busy}>取消</Button><Button primary disabled={!!busy||!editNote.trim()} onClick={saveCell}>确认保存并留痕</Button></div></Modal>}{appearanceOpen&&<Modal title="外观与主题" close={()=>setAppearanceOpen(false)}><AppearanceControls sandboxAutoOrbit={sandboxAutoOrbit} sandboxOrbitDelay={sandboxOrbitDelay} setSandboxAutoOrbit={setSandboxAutoOrbit} setSandboxOrbitDelay={setSandboxOrbitDelay} palette={palette} dark={dark} setPalette={setPalette} setDark={setDark} reset={resetAppearance} error={appearanceError} sandboxChatBackground={sandboxChatBackground} sandboxChatTransparency={sandboxChatTransparency} setSandboxChatBackground={setSandboxChatBackground} setSandboxChatTransparency={setSandboxChatTransparency}/></Modal>}{connectionsOpen&&<Modal title="飞书 / WeAct 复核" close={()=>setConnectionsOpen(false)}>{DEBUG_MODE?<LegacyConnections selected={connectionPlatform} select={setConnectionPlatform}/>:<PlatformConnections selected={connectionPlatform} select={setConnectionPlatform} {...platformConnection} onSettings={()=>{setConnectionsOpen(false);openSettings('collaboration-settings');}} onReview={()=>{setConnectionsOpen(false);prepareReview();}} onProgress={()=>{setConnectionsOpen(false);prepareReview('progress');}}/>}</Modal>}{settings&&<SettingsDialog pending={settingsWorking} section={settingsSection} select={setSettingsSection} close={()=>setSettings(false)} debug={DEBUG_MODE} render={(section,active)=>{
 if(section==='runtime-console')return <RuntimeConsole model={runtimeConsole} active={active}/>;
 if(section==='logo')return active?<Suspense fallback={<p role="status">正在载入 Logo…</p>}><LogoSettings active={active}/></Suspense>:null;
 if(section==='appearance')return <AppearanceControls sandboxAutoOrbit={sandboxAutoOrbit} sandboxOrbitDelay={sandboxOrbitDelay} setSandboxAutoOrbit={setSandboxAutoOrbit} setSandboxOrbitDelay={setSandboxOrbitDelay} palette={palette} dark={dark} setPalette={setPalette} setDark={setDark} reset={resetAppearance} error={appearanceError} sandboxChatBackground={sandboxChatBackground} sandboxChatTransparency={sandboxChatTransparency} setSandboxChatBackground={setSandboxChatBackground} setSandboxChatTransparency={setSandboxChatTransparency}/>;
 if(section==='model-settings')return <ModelSettings active={active} changed={()=>setBusinessRevision(n=>n+1)} onBusy={setSettingsWorking}/>;
 if(section==='knowledge-settings')return <KnowledgeSettings weknora={weknora.status} refresh={weknora.refresh} changed={()=>setKnowledgeRevision(n=>n+1)}/>;
 if(section==='business')return <BusinessSettings revision={businessRevision} changed={()=>setBusinessRevision(n=>n+1)}/>;
 if(section==='quick-settings')return <QuickSettings value={quickPreferences} change={setQuickPreferences}/>;
 if(section==='robot')return active?<GorkSettings/>:null;
 if(section==='gork')return <GorkConsole active={active} onBusy={setSettingsWorking}/>;
 if(section==='example')return <UploadedExampleSettings activeTab={view==='example'&&visible?exampleRequest?.tab:undefined} open={tab=>{setSettings(false);showUploadedExample(tab);}}/>;
 return <ProfessionalPanel businessRevision={businessRevision} previewPreferences={previewPreferences} onPreferences={setSharedPreview} onSettingsChanged={()=>setBusinessRevision(n=>n+1)} key={workspace.active?.id||'new'} view={section} context={conversationContext.current} jobId={result?.job_id||''} inputFile={file} sheets={sheets} knowledgeSeed={null} palette={palette} dark={dark} active={active} onCloseSettings={()=>{if(!settingsWorking)setSettings(false);}} onBusy={label=>{setSettingsWorking(label);professionalBusy(label);}} onReceipt={professionalReceipt} onNavigate={next=>{if(next==='tools'){setSettingsSection('appearance');return;}if(!settingsSectionForRoute(next))setSettings(false);open(next);}} onOpenRun={openDashboardRun}/>;
 }}/>}</>;
}

createRoot(document.getElementById('root')!).render(<App/>);
