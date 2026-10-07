import type {CSSProperties} from 'react';
import {Icon} from './ui';
import './welcome-workspace-preview.css';

// A self-contained illustration: synthetic values, no live task, storage or API.
const fees=[{label:'实物工作费',value:'86.40',share:67.185,offset:0,tone:'physical'},{label:'技术工作费',value:'34.92',share:27.154,offset:67.185,tone:'technical'},{label:'税金',value:'7.28',share:5.661,offset:94.339,tone:'tax'}];
const rows=[['地质勘察','54.00','21.82','75.82'],['工程测量','32.40','13.10','45.50'],['合计','86.40','34.92','121.32']];
export function WelcomeWorkspacePreview(){
 return <div className="aw2-workspace awp-workspace" inert aria-hidden="true">
  <aside className="awp-rail"><span className="awp-brand">A</span><div>{['message','plus','folder','grid','sheet','book'].map((name,index)=><span key={name} className={index===0?'awp-rail-item is-current':'awp-rail-item'}><Icon name={name}/></span>)}</div><span className="awp-rail-item awp-rail-bottom"><Icon name="settings"/></span></aside>
  <div className="awp-main">
   <header className="awp-topbar"><div><Icon name="folder"/><strong>勘察测量示例项目</strong><span className="awp-workspace-label">工作空间</span></div><span className="awp-demo"><i/>合成数据 · 界面示例</span></header>
   <div className="awp-panes">
    <section className="awp-dialogue">
     <header className="awp-dialogue-heading"><strong>当前对话</strong><span><Icon name="check"/>已保存</span></header>
     <div className="awp-dialogue-body">
      <div className="awp-user-message">编制这份勘察测量控制价。<span className="awp-attachment"><Icon name="sheet"/>勘察测量工作量.xlsx</span></div>
      <div className="awp-assistant"><strong>智算</strong><p>费用已整理，2 项需要你复核。</p></div>
      <div className="awp-result-card"><header><span className="awp-result-icon"><Icon name="circlecheck"/></span><div><small>规则匹配</small><h3>计算完成</h3></div><span className="awp-review-pill">待复核</span></header><div className="awp-result-metrics"><div><strong>24<span> / 24</span></strong><small>已匹配条目</small></div><div><strong>2</strong><small>待人工复核</small></div></div><div className="awp-progress"><span/></div><footer><span><Icon name="sheet"/>查看计算表<Icon name="arrow-up-right"/></span><span>风险复核<Icon name="arrow-right"/></span></footer></div>
     </div>
     <div className="awp-composer"><span className="awp-quick-handle"><Icon name="grid"/>快捷功能<Icon name="chevron"/></span><div className="awp-input"><span>继续描述你的需求…</span><div><span><Icon name="plus"/><Icon name="spark"/>专业工具</span><span className="awp-send"><Icon name="arrow-up"/></span></div></div></div>
    </section>
    <section className="awp-results">
     <header className="awp-view-tabs"><span className="is-current">表格</span><span>风险<i>2</i></span><span>文字报告</span><Icon name="expand"/></header>
     <div className="awp-sheet-tabs"><span className="is-current"><Icon name="sheet"/>费用汇总</span><span>地质勘察</span><span>工程测量</span></div>
     <div className="awp-finance">
      <div className="awp-fee-summary"><span className="awp-caption">含税控制价</span><div className="awp-total">128.60<small>万元</small></div><div className="awp-fee-legend">{fees.map(fee=><div key={fee.tone}><i className={`awp-color-${fee.tone}`}/><span>{fee.label}</span><strong>{fee.value}</strong></div>)}</div></div>
      <div className="awp-donut"><svg viewBox="0 0 180 180" fill="none"><circle cx="90" cy="90" r="68" stroke="var(--soft)" strokeWidth="21"/>{fees.map(fee=><circle key={fee.tone} className={`awp-arc awp-color-${fee.tone}`} cx="90" cy="90" r="68" pathLength="100" strokeWidth="21" strokeDasharray={`${fee.share} ${100-fee.share}`} strokeDashoffset={-fee.offset} transform="rotate(-90 90 90)" style={{'--awp-share':fee.share} as CSSProperties}/>)}</svg><div><strong>3</strong><span>费用构成</span></div></div>
     </div>
     <div className="awp-table-wrap"><div className="awp-table-caption"><strong>专业费用明细</strong><span>单位：万元</span></div><table className="awp-table"><thead><tr>{['专业','实物工作费','技术工作费','合计'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row[0]}>{row.map((cell,index)=><td key={index}>{cell}</td>)}</tr>)}</tbody></table></div>
     <footer className="awp-result-foot"><span><i/>示例成果</span><span>Excel / Word<Icon name="download"/></span></footer>
    </section>
   </div>
  </div>
 </div>;
}
