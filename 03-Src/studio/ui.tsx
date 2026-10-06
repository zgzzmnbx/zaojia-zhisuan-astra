import {useEffect,useRef,useState,type ReactNode} from 'react';
import {icon} from '../icons.js';
export {Gork} from './Gork';

export function Icon({name}:{name:string}){return <span className="astra-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:icon(name)}}/>;}
export function Button({children,onClick,icon:name,primary=false,disabled=false,title}:{children?:ReactNode;onClick?:()=>void;icon?:string;primary?:boolean;disabled?:boolean;title?:string}){return <button type="button" className={`btn ${primary?'btn-primary':'btn-outline'}`} onClick={onClick} disabled={disabled} title={title}>{name&&<Icon name={name}/>} {children}</button>;}
export function Note({children}:{children:ReactNode}){return <div className="notice"><Icon name="info"/><span>{children}</span></div>;}
export function Modal({title,children,close}:{title:string;children:ReactNode;close:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const dialog=ref.current;const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog?.showModal();return()=>{dialog?.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});};},[]);
  return <dialog className="modal" ref={ref} onCancel={e=>{e.preventDefault();close();}}><div className="modal-box"><header className="modal-heading"><h2>{title}</h2><button className="btn btn-ghost btn-square" aria-label="关闭弹窗" onClick={close}><Icon name="close"/></button></header>{children}</div><form method="dialog" className="modal-backdrop" onSubmit={e=>e.preventDefault()}><button onClick={close} aria-label="关闭弹窗背景">关闭</button></form></dialog>;
}
export function Universe({open}:{open:(view:string)=>void}){
  const ref=useRef<HTMLDivElement>(null),controller=useRef<{setMotion:(value:boolean,allowReduced:boolean)=>void;reset:()=>void}|null>(null);
  const [preference,setPreference]=useState<'auto'|'play'|'paused'>(()=>{try{const saved=localStorage.getItem('astra.galaxy-motion');return saved==='play'||saved==='paused'?saved:'auto';}catch{return 'auto';}});
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),[ready,setReady]=useState(false);
  const motion=preference==='play'||(preference==='auto'&&!reduced);
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  useEffect(()=>{let disposed=false;let cleanup:(()=>void)|undefined;import('../universe.js').then(m=>{if(!disposed&&ref.current){const instance=m.mountUniverse(ref.current,open,{taskLabel:'当前任务',motion,allowReducedMotion:preference==='play'});controller.current=instance;cleanup=instance;setReady(true);}}).catch(()=>{if(ref.current)ref.current.textContent='3D 暂不可用，可使用下方入口';});return()=>{disposed=true;controller.current=null;cleanup?.();};},[]);
  useEffect(()=>{controller.current?.setMotion(motion,preference==='play');},[motion,preference,ready]);
  function toggleMotion(){const next=motion?'paused':'play';setPreference(next);try{localStorage.setItem('astra.galaxy-motion',next);}catch{/* The control still works without storage. */}}
  return <div className="universe-panel galaxy-universe">
    <div className="universe-top"><span className="space-label">PROJECT CONSTELLATION</span><span className="badge">能力关系 · 示意</span></div>
    <div className="universe-intro"><h2>任务、知识与成果，在此相连</h2></div>
    <div className="galaxy-toolbar" role="group" aria-label="星图动效">
      <button className="btn btn-ghost" disabled={!ready} onClick={toggleMotion} aria-pressed={motion} title={reduced&&!motion?'已遵循系统减少动效设置，点击可手动开启银河动画':undefined}><Icon name={motion?'pause':'play'}/>{motion?'暂停银河':'让银河流动'}</button>
      <button className="btn btn-ghost" disabled={!ready} onClick={()=>controller.current?.reset()}><Icon name="refresh"/>复位视角</button>
    </div>
    <div className="universe-stage"><div ref={ref} id="universe-canvas"><span className="loading loading-spinner"/></div><span className="universe-instruction">拖动旋转 · 滚轮缩放 · 悬停节点暂停公转</span></div>
    <div className="universe-legend"><span><i className="legend-blue"/>专业任务</span><span><i className="legend-teal"/>知识依据</span><span><i className="legend-gold"/>人工决策</span></div>
    <div className="universe-actions">{[['sources','book','专业规则'],['table','sheet','计算表'],['risk','shield','风险复核'],['knowledge','book','知识库'],['report','file','成果报告'],['collaboration','users','协同复核']].map(([view,icon,label])=><button key={view} onClick={()=>open(view)}><Icon name={icon}/><strong>{label}</strong></button>)}</div>
  </div>;
}
