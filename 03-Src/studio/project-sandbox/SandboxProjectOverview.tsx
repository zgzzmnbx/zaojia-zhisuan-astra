import {FeeSummary} from '../FeeSummary';
import {Icon} from '../ui';
import type {CurrentProject} from '../workbench/current-project';
import './sandbox-project-overview.css';

type Props={project:CurrentProject|null;ready:boolean;busy:boolean;riskLoading:boolean;riskError:string;openInfo:()=>void;openTable:()=>void;openRisks:()=>void;checkRisks:()=>void;reloadRisks:()=>void;upload:()=>void};

/** The classic scene's lower deck reads the same scoped snapshot as the project card. */
export function SandboxProjectOverview({project,ready,busy,riskLoading,riskError,openInfo,openTable,openRisks,checkRisks,reloadRisks,upload}:Props){
 const hasRisks=!!project?.riskLoaded&&(project.riskChecked||(project.riskTotal??0)>0);
 const levels=project?[['高',project.severity.high],['中',project.severity.medium],['低',project.severity.low],['其他',project.severity.other]] as const:[];
 return <section className="sandbox-project-overview" aria-label="沙盘项目信息">
  <header><div><span className="spo-heading">项目概览</span><span className="spo-source" title={project?.filename||project?.title}>{project?.filename||project?.title||'等待项目资料'}</span>{project?.debug&&<span className="badge badge-outline">演示</span>}</div><nav aria-label="项目概览操作">{project?.hasResult&&<button className="btn btn-ghost btn-sm" onClick={openTable}><Icon name="sheet"/>计算表</button>}<button className="btn btn-ghost btn-sm" onClick={openInfo}>完整信息<Icon name="arrow-up-right"/></button></nav></header>
  {!ready?<div className="spo-empty" role="status"><span className="loading loading-spinner loading-sm"/>正在读取当前项目…</div>:!project?.hasResult?<div className="spo-empty"><span className="spo-empty-icon"><Icon name="sheet"/></span><div><strong>{project?.hasInput?'清单已就位，等待结构确认':'从一份工程清单开始'}</strong><p>{project?.hasInput?'完成匹配后，在这里查看费用构成、匹配覆盖与风险。':'导入后，沙盘与下方图表将跟随当前任务更新。'}</p></div><button className="btn btn-outline btn-sm" disabled={busy} onClick={project?.hasInput?openInfo:upload}>{project?.hasInput?'查看资料':'导入清单'}<Icon name="arrow-right"/></button></div>:<div className="spo-content">
   {project.matchingStatus==='completed'?<FeeSummary snapshot={project.fees} compact overview/>:<div className="spo-pending-amount"><span>费用汇总</span><strong>等待匹配</strong><p>完成后显示当前成果金额</p></div>}
   <section className="spo-review" aria-label="匹配与风险概览">
    <div className="spo-match-heading"><span>匹配覆盖</span><strong>{project.matched??'—'}<small> / {project.total??'—'} 项</small></strong></div>
    <div className="spo-match-track" role="img" aria-label={`已匹配 ${project.matched??'—'} 项，共 ${project.total??'—'} 项`}><span style={{width:`${project.percent??0}%`}}/></div>
    <div className="spo-risk-heading"><span>风险复核</span>{hasRisks&&!riskError&&<button className="spo-link" onClick={openRisks}>{project.riskTotal?`${project.riskTotal} 项风险`:'查看检查结果'}<Icon name="arrow-up-right"/></button>}</div>
    {riskError?<div className="spo-risk-state" role="alert"><span>风险读取失败</span><button className="spo-link" title={riskError} onClick={reloadRisks}>重试</button></div>:hasRisks?<><div className="spo-risk-levels" aria-label="风险等级分布">{levels.map(([label,value],i)=><span key={label}><i style={{background:`var(--astra-chart-${[7,5,3,2][i]})`}}/>{label}<strong>{value}</strong></span>)}</div><p className="spo-risk-note" title={project.priorityRisk?.title}>{project.priorityRisk?.title||'本次检查无风险提醒，仍需人工复核。'}</p></>:riskLoading||project.riskChecked?<div className="spo-risk-state" role="status"><span className="loading loading-spinner loading-xs"/>正在读取风险…</div>:<div className="spo-risk-state"><span>尚未检查</span><button className="spo-link" disabled={busy||project.matchingStatus!=='completed'} onClick={checkRisks}>开始检查<Icon name="arrow-right"/></button></div>}
   </section>
  </div>}
 </section>;
}
