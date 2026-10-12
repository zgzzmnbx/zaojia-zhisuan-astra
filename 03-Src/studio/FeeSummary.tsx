import {useId} from 'react';
import type {FeeItem,FeeSnapshot} from './fee-summary';
import './fee-summary.css';

const amount=(value:number|null)=>value===null?'—':value.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const percent=(value:number|null)=>value===null?'—':`${(value*100).toLocaleString('zh-CN',{maximumFractionDigits:1})}%`;
function Breakdown({items,professional=false}:{items:FeeItem[];professional?:boolean}){
 return <table className="fs-table"><caption className="sr-only">{professional?'专业费用（浮动前）':'最终费用构成'}</caption><thead><tr><th scope="col">{professional?'专业':'费用项目'}</th><th scope="col">金额</th><th scope="col">占比</th></tr></thead><tbody>{items.map((item,index)=><tr key={`${item.label}-${index}`}><th scope="row"><span>{!professional&&<i style={{background:`var(--fs-color-${index%2})`}}/>}{item.label}</span></th><td title={item.value===null?'表内无有效金额':String(item.value)}>{amount(item.value)}</td><td>{percent(item.share)}</td></tr>)}</tbody></table>;
}
export function FeeSummary({snapshot,historical=false,compact=false}:{snapshot:FeeSnapshot|null;historical?:boolean;compact?:boolean}){
 const gradientId=`fee-${useId().replace(/:/g,'')}`;
 if(!snapshot)return <section className="fee-summary fs-empty" aria-label="费用汇总">费用汇总暂不可用</section>;
 const s=snapshot,composition=s.finalComposition,valid=composition.length>0&&composition.every(item=>item.share!==null);
 let offset=0;
 return <section className={`fee-summary ${compact?'fs-compact':''}`} aria-label={historical?'本次金额快照':'当前任务费用汇总'}>
  {!compact&&<header className="fs-heading"><h4>{historical?'本次金额快照':'费用汇总'}</h4>{historical&&s.version!==null&&<span>版本 {s.version}</span>}</header>}
  <div className="fs-amounts" role="group" aria-label={`金额摘要，${s.unit||'单位未标注'}`}>
   <div className="fs-total"><span className="fs-total-label">含税总额<small>单位：{s.unit||'未标注'}</small></span><strong title={s.totalWithTax===null?'表内无有效金额':String(s.totalWithTax)}>{amount(s.totalWithTax)}</strong><span className={`fs-status fs-${s.status}`}>{s.status==='dirty'?'修改后待重算':s.status==='recalculated'?'公式已重算':'公式未确认重算'}</span></div>
   <dl className="fs-tax"><div><dt>不含税金额</dt><dd title={s.totalWithoutTax===null?'表内无有效金额':String(s.totalWithoutTax)}>{amount(s.totalWithoutTax)}</dd></div><div><dt>税金<span>增值税</span></dt><dd title={s.vat===null?'表内无有效金额':String(s.vat)}>{amount(s.vat)}</dd></div></dl>
  </div>
  <div className="fs-breakdowns">
   <figure className="fs-chart"><figcaption>最终费用构成</figcaption>
    <div className="fs-donut" role="img" aria-label={valid?composition.map(item=>`${item.label} ${percent(item.share)}`).join('，'):'占比不可计算'}>
     <svg viewBox="0 0 220 220" aria-hidden="true"><defs>{[0,1].map(i=><linearGradient key={i} id={`${gradientId}-${i}`} gradientUnits="userSpaceOnUse" x1="26" y1="26" x2="194" y2="194"><stop offset="0%" stopColor={`color-mix(in oklab,var(--fs-color-${i}) 72%,white)`}/><stop offset="52%" stopColor={`var(--fs-color-${i})`}/><stop offset="100%" stopColor={`color-mix(in oklab,var(--fs-color-${i}) 80%,var(--astra-chart-9))`}/></linearGradient>)}</defs><circle className="fs-track" cx="110" cy="110" r="84"/>{valid&&composition.map((item,i)=>{const start=offset;offset+=item.share!*100;return <circle key={i} cx="110" cy="110" r="84" pathLength="100" stroke={`url(#${gradientId}-${i%2})`} strokeDasharray={`${item.share!*100} 100`} strokeDashoffset={-start}><title>{item.label}：{amount(item.value)}{s.unit||''}，{percent(item.share)}</title></circle>;})}</svg>
     <div className="fs-donut-center"><span>主要构成</span><strong>{valid?percent(composition.reduce((a,b)=>a.share!>=b.share!?a:b).share):'—'}</strong><small>{valid?composition.reduce((a,b)=>a.share!>=b.share!?a:b).label:'占比不可计算'}</small></div>
    </div>
    <ul className="fs-chart-legend">{composition.map((item,i)=><li key={item.label}><span><i style={{background:`var(--fs-color-${i%2})`}}/>{item.label}</span><strong title={String(item.value??'')}>{amount(item.value)}</strong><small>{percent(item.share)}</small></li>)}</ul>
    {!composition.length&&<p className="fs-missing">表内暂无费用构成</p>}
   </figure>
   {!!s.professionalComposition.length&&<figure className="fs-chart"><figcaption>专业费用<span>浮动前</span></figcaption>
    <div className="fs-column-chart" aria-label="专业费用横向柱状图">{s.professionalComposition.map(item=><div className="fs-column-row" key={item.label}>
     <div className="fs-column-label"><span title={item.label}>{item.label}</span><strong title={String(item.value??'')}>{amount(item.value)}</strong></div>
     <div className="fs-column-value"><span className="fs-column-track" aria-hidden="true">{item.share!==null&&<i style={{width:`${item.share*100}%`}}/>}</span><span>{percent(item.share)}</span></div>
    </div>)}</div>
   </figure>}
  </div>
  {!compact&&<details className="fs-details"><summary>金额明细</summary><Breakdown items={composition}/>{!!s.professionalComposition.length&&<Breakdown items={s.professionalComposition} professional/>}</details>}
  {!valid&&composition.length>0&&<p className="fs-missing">金额缺失、非正合计或含负值时不计算占比。</p>}
 </section>;
}
