import {useState,type CSSProperties} from 'react';
import type {Risk} from './types';
import {Button,Icon,Note} from './ui';
import {comparisonScale,deviationScale,prefersCompressed,riskNumbers,riskPercent,riskValue} from './risk-visuals';
import './risk-review.css';

export function Risks({items,busy,warning,locate,hasRun,manage}:{items:Risk[];busy:boolean;warning:()=>void;locate:(r:Risk)=>void;hasRun:boolean;manage?:()=>void}){
 const [filter,setFilter]=useState('all'),[scaleMode,setScaleMode]=useState<'auto'|'linear'|'compressed'>('auto');
 const shown=items.filter(r=>filter==='all'||(['high','medium','low'].includes(r.severity)?r.severity:'unknown')===filter),numbers=shown.map(riskNumbers);
 const compressed=scaleMode==='auto'?prefersCompressed(numbers.map(n=>n.deviation)):scaleMode==='compressed';
 const scale=deviationScale(numbers.map(n=>n.deviation),compressed);
 const counts=['high','medium','low','unknown'].map(key=>({key,label:({high:'高风险',medium:'中风险',low:'低风险',unknown:'其他'} as Record<string,string>)[key],count:items.filter(r=>(['high','medium','low'].includes(r.severity)?r.severity:'unknown')===key).length}));
 const focusCard=(id:string)=>{const card=document.getElementById(`risk-item-${id}`);card?.focus({preventScroll:true});card?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 return <div className="risk-review">
  <header className="rr-header"><div><h3>风险复核 <span>{items.length} 项</span></h3><p>偏离经验均值，仅提示复核，不自动改价。</p></div><div className="rr-actions">{manage&&<button type="button" className="btn btn-ghost btn-sm" onClick={manage}>经验池</button>}<Button icon="refresh" onClick={warning} disabled={busy}>{busy?'正在检查…':hasRun?'重新检查':'检查经验池'}</Button></div></header>
  {!hasRun&&<Note>经验池尚未检查。完成检查后显示偏离数据。</Note>}
  <div className="rr-filters" role="group" aria-label="风险等级筛选"><button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>全部 <b>{items.length}</b></button>{counts.filter(c=>c.count>0).map(c=><button type="button" key={c.key} data-severity={c.key} aria-pressed={filter===c.key} onClick={()=>setFilter(c.key)}><i/>{c.label} <b>{c.count}</b></button>)}</div>
  {shown.length>0?<>
   <section className="rr-chart card" aria-label="偏离率对比图"><div className="rr-chart-heading"><div><h4>偏离率对比</h4><p>{compressed?'压缩刻度 · 大小偏离同时可见':'线性刻度 · 条长按实际比例'}<span>相对经验均值</span></p></div><div className="rr-scale" role="group" aria-label="偏离率图表刻度"><button type="button" aria-pressed={!compressed} onClick={()=>setScaleMode('linear')}>线性</button><button type="button" aria-pressed={compressed} onClick={()=>setScaleMode('compressed')}>压缩</button></div></div>
    <div className="rr-chart-rows">{shown.map((r,i)=><button type="button" className="rr-chart-row" data-severity={r.severity} key={r.id} onClick={()=>focusCard(r.id)} aria-label={`${r.sheet_name} 第 ${r.excel_row} 行 ${r.metric}，偏离率 ${riskPercent(numbers[i].deviation)}，查看详情`}>
     <span className="rr-chart-label"><strong>{r.metric||r.risk_type||'待复核'}</strong><small>{r.sheet_name} · 第 {r.excel_row} 行</small></span>
     <span className="rr-chart-track" aria-hidden="true">{scale.ticks.map(t=><i className="rr-gridline" key={t} style={{left:`${scale.position(t)}%`}}/>)}{numbers[i].deviation!==null?<span className="rr-animated-track"><i style={{width:`${scale.position(numbers[i].deviation!)}%`}}/></span>:<span className="rr-missing-line"/>}</span>
     <strong className="rr-chart-value">{riskPercent(numbers[i].deviation)}</strong>
    </button>)}</div>
    <div className="rr-axis" aria-hidden="true"><div>{scale.ticks.map(t=><span key={t} style={{left:`${scale.position(t)}%`}}>{t>=10000?`${t/10000}万`:riskValue(t)}%</span>)}</div></div>
   </section>
   <div className="rr-details-grid">{shown.map(r=>{const n=riskNumbers(r),compare=n.current!==null&&n.reference!==null?comparisonScale(n.current,n.reference):null;return <article key={r.id} id={`risk-item-${r.id}`} tabIndex={-1} className="rr-detail card" data-severity={r.severity} aria-label={`${r.metric} 第 ${r.excel_row} 行复核详情`}>
    <header><span className="rr-severity"><i/>{r.severity_label||'待复核'}</span><span className="rr-row">第 {r.excel_row} 行</span></header>
    <h4>{r.metric||r.title}</h4><p className="rr-sheet">{r.sheet_name||'工作表待确认'}</p>
    <div className="rr-deviation"><strong>{riskPercent(n.deviation)}</strong><span>{n.deviation===null?(n.reference===0?'经验均值为 0，无法计算比例':'未提供有效偏离率'):`偏离率 · ${n.direction||'方向待确认'}`}</span></div>
    {compare?<div className="rr-comparison" role="img" aria-label={`当前值 ${riskValue(n.current)}，经验均值 ${riskValue(n.reference)}。各项独立线性刻度。`}>{[{label:'当前值',value:n.current!,current:true},{label:'经验均值',value:n.reference!,current:false}].map(bar=>{const b=compare.bar(bar.value);return <div key={bar.label} className={`rr-compare-row ${bar.current?'is-current':''}`}><div><span>{bar.label}</span><strong>{riskValue(bar.value)}</strong></div><div className="rr-compare-track"><span className="rr-animated-track" style={{left:`${b.left}%`,width:`${b.width}%`} as CSSProperties}><i/></span><i className="rr-zero" style={{left:`${compare.zero}%`}}/></div></div>;})}</div>:<p className="rr-no-data">{r.message||'缺少可比较数值，请核对原始记录。'}</p>}
    <div className="rr-samples"><Icon name="database"/><span>{n.samples===null?'经验样本数未提供':n.samples===1?'仅 1 条经验样本':`${n.samples} 条经验样本`}</span><span>{r.evidence?.find(e=>e.label==='经验范围')?.text?`范围 ${r.evidence.find(e=>e.label==='经验范围')!.text}`:''}</span></div>
    <footer><details><summary>依据与复核建议 <Icon name="chevron"/></summary><div className="rr-evidence">{r.key_text&&<p>{r.key_text}</p>}{r.evidence?.map((e,i)=><div key={i}><strong>{e.label}</strong><p>{e.text}</p></div>)}<p>{r.suggested_action||r.message}</p></div></details><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={()=>locate(r)}>定位表格<Icon name="arrow-up-right"/></button></footer>
   </article>;})}</div>
  </>:<div className="rr-empty"><Icon name="shield"/><h4>{items.length?'该等级暂无风险项':hasRun?'本次未返回风险项':'等待经验池检查'}</h4><p>{items.length?'可切换“全部”查看其他事项。':hasRun?'仍需结合依据与项目条件人工复核。':'运行检查后，在这里查看偏离率与复核依据。'}</p></div>}
 </div>;
}
