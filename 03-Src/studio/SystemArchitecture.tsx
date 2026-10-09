import {useEffect,useRef,useState} from 'react';
import {Icon} from './ui';
import './system-architecture.css';

/** Both builds use the same offline copies from 智算 2.0. */
export function Architecture({active=true,dark=false,close}:{active?:boolean;dark?:boolean;close?:()=>void}){
  const [kind,setKind]=useState<'original'|'live'>('live');
  const url=kind==='original'
    ? `/system-architecture/index.html?present=1&motion=focus-v4&theme=${dark?'dark':'light'}`
    : '/system-architecture/live-panel-landscape.html?autoplay=1';
  return <div className="architecture-module">
    <div className="module-toolbar">
      {close&&<h2 id="architecture-window-title"><Icon name="architecture"/>系统架构</h2>}
      <div className="module-tabs" role="group" aria-label="架构图版本">
        <button type="button" aria-pressed={kind==='original'} className={kind==='original'?'active':''} onClick={()=>setKind('original')}>原系统架构</button>
        <button type="button" aria-pressed={kind==='live'} className={kind==='live'?'active':''} onClick={()=>setKind('live')}>动态横版</button>
      </div>
      <div className="architecture-actions">{close&&<span className="architecture-demo" title="流动、计数和日志为示意，不代表当前部署或连接状态。">示意</span>}<a className="btn btn-ghost" href={url} target="_blank" rel="noopener noreferrer">独立打开<Icon name="arrow-up-right"/></a>{close&&<button type="button" className="btn btn-ghost btn-square" aria-label="关闭系统架构" onClick={close}><Icon name="close"/></button>}</div>
    </div>
    {active?<iframe key={url} title={kind==='original'?'原系统架构图':'动态架构图（示意）'} src={url} sandbox="allow-scripts allow-downloads"/>:<div className="empty-state">展开后继续查看架构图。</div>}
    {!close&&<p className="module-footnote">两图迁自智算 2.0。动态横版保留原深色画布；流动、计数和日志均为示意，不代表造价智算当前部署或连接状态。可全屏查看或独立打开。</p>}
  </div>;
}

export function ArchitectureWindow({dark,close}:{dark:boolean;close:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const node=dialog.current;const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;node?.showModal();return()=>{node?.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});};},[]);
  useEffect(()=>{const escape=(event:MessageEvent)=>{if(event.data?.type==='astra:architecture-close'&&event.source===dialog.current?.querySelector('iframe')?.contentWindow&&(event.origin==='null'||event.origin===location.origin))close();};window.addEventListener('message',escape);return()=>window.removeEventListener('message',escape);},[close]);
  return <dialog ref={dialog} className="modal architecture-window" aria-labelledby="architecture-window-title" onCancel={event=>{event.preventDefault();close();}}><div className="modal-box architecture-window-box"><Architecture dark={dark} close={close}/></div></dialog>;
}
