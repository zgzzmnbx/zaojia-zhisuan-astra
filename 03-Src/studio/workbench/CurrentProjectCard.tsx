import {FeeSummary} from '../FeeSummary';
import {ProjectAssociationEmpty} from './ProjectAssociationEmpty';
import type {Project} from '../useWorkspace';
import {Icon} from '../ui';
import type {CurrentProject} from './current-project';
import './current-project.css';
export function CurrentProjectCard({project,ready,openBoard,openData,openTable,openRisks,assign,newProject,projects=[],busy=false,contextKey=''}:{project:CurrentProject|null;ready:boolean;openBoard:()=>void;openData:()=>void;openTable:()=>void;openRisks:()=>void;assign:(id:string)=>void;newProject:()=>void;projects?:Project[];busy?:boolean;contextKey?:string}){
 if(!ready)return <div className="current-project-empty" role="status"><span className="loading loading-spinner"/><p>正在切换当前项目…</p></div>;
 if(!project)return <ProjectAssociationEmpty key={contextKey} projects={projects} busy={busy} assign={assign} newProject={newProject}/>;

 const stages=[{label:'资料',done:!!project.filename||project.hasResult},{label:'结构',done:project.hasResult},{label:'匹配',done:project.matchingStatus==='completed'},{label:'风险检查',done:project.riskChecked}];
 const distribution=[{key:'high',label:'高',value:project.severity.high},{key:'medium',label:'中',value:project.severity.medium},{key:'low',label:'低',value:project.severity.low},{key:'other',label:'其他',value:project.severity.other}];
 return <div className="current-project-deck"><article className="card current-project-card cp-compact" aria-label={`当前项目：${project.title}`}>
  <header><div className="current-project-heading"><span className="cp-project-icon"><Icon name="folder"/></span><div><span className="cp-eyebrow">{project.debug?'当前项目 · 模拟任务':'当前项目'}</span><h3 title={project.title}>{project.title}</h3></div></div></header>
  {project.matchingStatus==='completed'&&<FeeSummary snapshot={project.fees} compact/>}
  <section className="cp-match-strip" aria-label="当前任务匹配覆盖"><div><span>匹配覆盖</span><strong>{project.percent===null?'—':`${project.percent}%`}</strong></div><div><span>有效行</span><strong>{project.total??'—'}</strong></div><div><span>待匹配</span><strong>{project.remaining??'—'}</strong></div><div><span>待复核</span><strong>{project.review??'—'}</strong></div></section>
  {project.total!==null&&project.total>0&&<div className="cp-composition-bar" role="img" aria-label={`已匹配 ${project.matched} 行，待匹配 ${project.remaining} 行`}><span style={{width:`${project.percent}%`}}/></div>}

  <section className="cp-risk-strip" aria-label="风险提醒分布"><div className="cp-section-title"><h4>风险提醒</h4><span>{project.riskLoaded?`${project.riskTotal} 项`:(project.riskChecked?'明细待载入':'未运行检查')}</span></div>{project.riskLoaded&&<div className="cp-risk-totals">{distribution.map(item=><span key={item.key}><i className={`cp-severity-${item.key}`}/>{item.label}<strong>{item.value}</strong></span>)}</div>}</section>
  <details className="cp-context-details"><summary>项目与复核详情</summary><section className="cp-stage-strip" aria-label="当前任务阶段">{stages.map((s,i)=><span key={s.label} className={s.done?'is-done':''} title={s.done?'已就绪':'待开始'}><span>{s.done?<Icon name="check"/>:i+1}</span>{s.label}</span>)}</section><div className="cp-meta"><span>{project.workspaceProjectId?`${project.conversationCount} 段项目会话`:'当前会话任务'}</span><span>{project.resultConversations} 段已有关联成果</span></div>{project.background&&<p>{project.background}</p>}<p>{project.conversationTitle.replace(/^【模拟】\s*/,'')}</p>{project.filename&&<p className="cp-filename"><Icon name="sheet"/>{project.filename}</p>}<p>已匹配 {project.matched??'—'} 行；待复核可与已匹配重叠，匹配完成不等于审核通过。风险仅统计已载入提醒，0 项不表示通过审核。</p><p>{project.needsRecalculate?'人工修改后待重算，金额以当前表内值展示。':project.recalculated?'表内金额待人工复核。':'金额为当前表内值，公式未确认重算。'}</p></details>
  <footer><div><button className="btn btn-ghost btn-sm" onClick={openData}>{project.workspaceProjectId?'项目资料':'当前资料'}</button>{project.hasResult&&<><button className="btn btn-ghost btn-sm" onClick={openTable}>表格</button><button className="btn btn-ghost btn-sm" onClick={openRisks}>风险</button></>}<button className="btn btn-outline btn-sm" onClick={openBoard}><Icon name="grid"/>看板</button></div></footer>
 </article></div>;
}
