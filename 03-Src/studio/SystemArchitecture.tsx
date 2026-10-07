import {useState} from 'react';
import {Icon} from './ui';

/** Both builds use the same offline copies from 智算 2.0. */
export function Architecture({active=true,dark=false}:{active?:boolean;dark?:boolean}){
  const [kind,setKind]=useState<'original'|'live'>('original');
  const url=kind==='original'
    ? `/system-architecture/index.html?present=1&motion=focus-v4&theme=${dark?'dark':'light'}`
    : '/system-architecture/live-panel-landscape.html';
  return <div className="architecture-module">
    <div className="module-toolbar">
      <div className="module-tabs" role="group" aria-label="架构图版本">
        <button type="button" aria-pressed={kind==='original'} className={kind==='original'?'active':''} onClick={()=>setKind('original')}>原系统架构</button>
        <button type="button" aria-pressed={kind==='live'} className={kind==='live'?'active':''} onClick={()=>setKind('live')}>动态横版</button>
      </div>
      <a className="btn btn-ghost" href={url} target="_blank" rel="noopener noreferrer">独立打开<Icon name="arrow-up-right"/></a>
    </div>
    {active?<iframe key={url} title={kind==='original'?'原系统架构图':'动态架构图（示意）'} src={url} sandbox="allow-scripts allow-downloads"/>:<div className="empty-state">展开后继续查看架构图。</div>}
    <p className="module-footnote">两图迁自智算 2.0。动态横版保留原深色画布；流动、计数和日志均为示意，不代表 Astra 当前部署或连接状态。可全屏查看或独立打开。</p>
  </div>;
}
