import {TaskProgress} from "../TaskProgress";
import {FeeSummary} from '../FeeSummary';
import {ProjectAssociationEmpty} from './ProjectAssociationEmpty';
import type {Project} from '../useWorkspace';
import {Icon} from '../ui';
import type {CurrentProject} from './current-project';
import './current-project.css';

type Props={project:CurrentProject|null;ready:boolean;openBoard:()=>void;openData:()=>void;openInput:()=>void;openTable:()=>void;openRisks:()=>void;assign:(id:string)=>void;newProject:()=>void;projects?:Project[];busy?:boolean;contextKey?:string;riskLoading?:boolean;riskError?:string;reloadRisks:()=>void;checkRisks:()=>void};
export function CurrentProjectCard({project,ready,openBoard,openData,openInput,openTable,openRisks,assign,newProject,projects=[],busy=false,contextKey='',riskLoading=false,riskError='',reloadRisks,checkRisks}:Props){
 if(!ready)return <TaskProgress label="正在切换当前项目"/>;
 if(!project)return <ProjectAssociationEmpty key={contextKey} projects={projects} busy={busy} assign={assign} newProject={newProject}/>;
 const distribution=[{key:'high',label:'高风险',value:project.severity.high},{key:'medium',label:'中风险',value:project.severity.medium},{key:'low',label:'低风险',value:project.severity.low},{key:'other',label:'其他',value:project.severity.other}];
 const priority=project.priorityRisk;
 const deviation=priority?.deviation_percent==null||priority.deviation_percent===''?null:Number(priority.deviation_percent);
 const hasRiskSummary=project.riskLoaded&&(project.riskChecked||(project.riskTotal??0)>0);
 return <div className="current-project-deck"><article className="card current-project-card cp-compact cp-refined" aria-label={`当前项目：${project.title}`}>
  <header><div className="current-project-heading"><span className="cp-project-icon"><Icon name="folder"/></span><div><span className="cp-eyebrow">{project.debug?'当前项目 · 模拟任务':'当前项目'}</span><h3 title={project.title}>{project.title}</h3></div></div></header>
  {project.matchingStatus==='completed'&&<FeeSummary snapshot={project.fees} compact/>}
  {!project.hasResult&&<section className="cp-input-summary"><span className="badge badge-outline">{project.hasInput?'待确认表格结构':'等待项目资料'}</span>{project.hasInput&&<button className="btn btn-outline btn-sm" onClick={openInput}>核对匹配设置<Icon name="arrow-right"/></button>}</section>}
  {project.hasResult&&<div className="cp-review-overview">
   <section className="cp-matching" aria-label="当前任务匹配覆盖">
    <div className="cp-block-heading"><h4>匹配进度</h4><span>{project.total??'—'} 行有效数据</span><strong>{project.percent===null?'—':`${project.percent}%`}</strong></div>
    <div className="cp-match-track" role="img" aria-label={`已匹配 ${project.matched??'—'} 行，待匹配 ${project.remaining??'—'} 行`}><span style={{width:`${project.percent??0}%`}}/></div>
    <div className="cp-match-metrics"><span><i/>已匹配<strong>{project.matched??'—'}</strong></span><span><i/>待匹配<strong>{project.remaining??'—'}</strong></span><span title="待复核行可与已匹配行重叠，不代表审核结论"><Icon name="shield"/>待复核<strong>{project.review??'—'}</strong></span></div>
   </section>
   <section className="cp-risk-review" aria-label="风险复核">
    <div className="cp-block-heading"><h4><Icon name="shield"/>风险复核</h4>{hasRiskSummary&&<button className="cp-inline-link" onClick={openRisks}>{project.riskTotal?`查看 ${project.riskTotal} 项`:'查看检查结果'}<Icon name="arrow-right"/></button>}</div>
    {riskError?<div className="cp-risk-state" role="alert"><Icon name="alert"/><span>风险明细读取失败</span><button className="cp-inline-link" title={riskError} onClick={reloadRisks}>重试<Icon name="refresh"/></button></div>:hasRiskSummary?<>
     <div className="cp-risk-counters">{distribution.map(item=><div key={item.key} className={`cp-risk-count ${item.value?'has-items':''}`}><span><i className={`cp-severity-${item.key}`}/>{item.label}</span><strong>{item.value}</strong></div>)}</div>
     {priority?<button className={`cp-priority-risk cp-priority-${priority.severity}`} onClick={openRisks} title={priority.title}><span className="cp-priority-mark"><Icon name="alert"/></span><span><strong>{priority.title.replace(/^.*第\s*\d+\s*行\s*/,'')||priority.metric}</strong><small>{priority.sheet_name} · 第 {priority.excel_row} 行{deviation!==null&&Number.isFinite(deviation)?` · 偏离 ${deviation.toLocaleString('zh-CN',{maximumFractionDigits:1})}%`:''}</small></span><Icon name="arrow-up-right"/></button>:<p className="cp-risk-clear"><Icon name="check"/>本次检查未返回风险提醒，仍需人工复核。</p>}
    </>:project.riskChecked||riskLoading?<div className="cp-risk-state" role="status"><span className="loading loading-spinner loading-xs"/><span>正在读取当前项目风险…</span></div>:<div className="cp-risk-state"><Icon name="shield"/><span>尚未运行经验池检查</span><button className="cp-inline-link" disabled={busy||project.matchingStatus!=='completed'} onClick={checkRisks}>开始检查<Icon name="arrow-right"/></button></div>}
   </section>
  </div>}
  <details className="cp-source-details"><summary><span className="cp-file-mark"><Icon name={project.filename?'sheet':'folder'}/></span><span><small>{project.filename?'当前资料':'项目资料'}</small><strong title={project.filename||project.title}>{project.filename||'等待添加资料'}</strong></span><Icon name="chevron"/></summary><div className="cp-source-body">
   <dl><div><dt>项目会话</dt><dd>{project.conversationCount} 段</dd></div><div><dt>关联成果</dt><dd>{project.resultConversations} 段</dd></div></dl>
   {project.background&&<p>{project.background}</p>}
   {project.hasResult&&<p>待复核行可与已匹配行重叠；匹配结果与风险提醒均不代表审核通过。</p>}
   <button className="cp-inline-link" onClick={openData}>查看{project.workspaceProjectId?'项目':'当前'}资料<Icon name="arrow-right"/></button>
  </div></details>
  <footer className="cp-navigation"><button onClick={openData}><Icon name="folder"/><span>资料</span></button>{project.hasResult&&<button onClick={openTable}><Icon name="sheet"/><span>计算表</span></button>}{project.hasInput&&<button onClick={openInput}><Icon name="settings"/><span>匹配设置</span></button>}<button onClick={openBoard}><Icon name="grid"/><span>项目看板</span></button></footer>
 </article></div>;
}
