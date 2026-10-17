import type {ReactNode} from 'react';
import {FeeSummary} from '../FeeSummary';
import {Icon} from '../ui';
import type {CurrentProject} from '../workbench/current-project';
import {compactSandboxTitle} from './view-settings';
import './sandbox-floating-cards.css';

type Props={project:CurrentProject|null;ready:boolean;busy:boolean;riskLoading:boolean;riskError:string;openInfo:()=>void;openTable:()=>void;openRisks:()=>void;checkRisks:()=>void;reloadRisks:()=>void};
function GlassCard({title,children}:{title:string;children:ReactNode}){
 return <details className="card sandbox-info-card" open><summary><span>{title}</span><Icon name="chevron"/></summary><div className="sandbox-info-body">{children}</div></details>;
}
/** Read the same conversation/job-scoped snapshot as CurrentProjectCard. No extra fetches. */
export function SandboxFloatingCards({project,ready,busy,riskLoading,riskError,openInfo,openTable,openRisks,checkRisks,reloadRisks}:Props){
 const p=ready?project:null,fees=p?.matchingStatus==='completed'?p.fees:null;
 const checked=!!p?.riskLoaded&&(p.riskChecked||(p.riskTotal??0)>0);
 const pending=!ready?'正在恢复项目…':p?.hasInput?'等待结构确认':p?.hasResult?'等待匹配完成':'等待导入清单';
 return <aside className="sandbox-floating-cards" aria-label="悬浮项目信息">
  <GlassCard title="项目概况"><strong className="sfc-project-name" title={p?.title}>{p?compactSandboxTitle(p.title):'当前项目'}</strong><div className="sfc-project-meta"><span>{p?.total===null||p?.total===undefined?pending:`${p.total} 项清单`}</span>{p?.fees?.version!==null&&p?.fees?.version!==undefined&&<span>v{p.fees.version}</span>}{p?.debug&&<span>演示</span>}</div><button className="sfc-link" disabled={!ready} onClick={openInfo}>完整信息<Icon name="arrow-up-right"/></button></GlassCard>
  <GlassCard title="费用汇总">{fees?<FeeSummary snapshot={fees} compact overview part="amounts"/>:<p className="sfc-empty">{p?.matchingStatus==='completed'?'费用汇总暂不可用':pending}</p>}</GlassCard>
  <GlassCard title="费用构成">{fees?<FeeSummary snapshot={fees} compact overview part="composition"/>:<p className="sfc-empty">{p?.matchingStatus==='completed'?'暂无费用构成':'匹配后显示费用占比'}</p>}</GlassCard>
  <GlassCard title="匹配覆盖"><div className="sfc-match"><strong>{p?.matched??'—'}<small> / {p?.total??'—'} 项</small></strong><span>{p?.percent===null||p?.percent===undefined?'—':`${p.percent}%`}</span></div><div className="sfc-track" role="img" aria-label={`已匹配 ${p?.matched??'—'} 项，共 ${p?.total??'—'} 项`}><span style={{width:`${p?.percent??0}%`}}/></div><button className="sfc-link" disabled={!p?.hasResult} onClick={openTable}>查看计算表<Icon name="arrow-up-right"/></button></GlassCard>
  <GlassCard title="风险复核">{!ready?<p className="sfc-empty" role="status">正在恢复项目…</p>:riskError?<div className="sfc-empty" role="alert"><span>风险读取失败</span><button className="sfc-link" disabled={busy} title={riskError} onClick={reloadRisks}>重试</button></div>:riskLoading?<p className="sfc-empty" role="status">正在读取风险…</p>:checked&&p?<><div className="sfc-risk-total"><strong>{p.riskTotal}<small> 项风险</small></strong><span>{p.severity.high} 项重点</span></div><div className="sfc-risk-levels">{([['高',p.severity.high,7],['中',p.severity.medium,5],['低',p.severity.low,3]] as const).map(([label,count,shade])=><span key={label}><i style={{background:`var(--astra-chart-${shade})`}}/>{label} {count}</span>)}{p.severity.other>0&&<span>其他 {p.severity.other}</span>}</div><button className="sfc-link" onClick={openRisks}>查看风险与依据<Icon name="arrow-up-right"/></button></>:<><p className="sfc-empty">尚未检查</p><button className="sfc-link" disabled={busy||p?.matchingStatus!=='completed'} onClick={checkRisks}>开始检查<Icon name="arrow-right"/></button></>}</GlassCard>
 </aside>;
}
