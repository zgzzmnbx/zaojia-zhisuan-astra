import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Icon} from './ui';
import {settingsSections,type SettingsSection} from './settings-sections';
import './settings-dialog.css';

export function SettingsDialog({section,select,close,render,debug=false,pending=''}:{section:SettingsSection;select:(section:SettingsSection)=>void;close:()=>void;render:(section:SettingsSection,active:boolean)=>ReactNode;debug?:boolean;pending?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 const [visited,setVisited]=useState<SettingsSection[]>([section]);
 const sections=debug?[...settingsSections,{id:'example' as const,label:'表格演示',icon:'sheet'}]:settingsSections;
 useEffect(()=>{setVisited(previous=>previous.includes(section)?previous:[...previous,section]);ref.current?.querySelector('.settings-navigation [aria-current]')?.scrollIntoView({block:'nearest',inline:'nearest'});},[section]);
 useEffect(()=>{const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;const dialog=ref.current;dialog?.showModal();return()=>{dialog?.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});};},[]);
 const dismiss=()=>{if(!pending)close();};
 return <dialog ref={ref} className="modal settings-dialog" aria-labelledby="settings-title" onCancel={e=>{e.preventDefault();dismiss();}}>
  <div className="modal-box settings-window">
   <header className="settings-heading"><div><Icon name="settings"/><h2 id="settings-title">设置</h2></div>{pending&&<span role="status">{pending}</span>}<button type="button" className="btn btn-ghost btn-square" aria-label="关闭设置" disabled={!!pending} onClick={dismiss}><Icon name="close"/></button></header>
   <div className="settings-layout">
    <nav className="settings-navigation" aria-label="设置分类">{sections.map(item=><button type="button" key={item.id} disabled={!!pending} className={section===item.id?'is-active':''} aria-current={section===item.id?'page':undefined} aria-controls={`settings-section-${item.id}`} onClick={()=>select(item.id)}><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav>
    <div className="settings-content">{sections.filter(item=>visited.includes(item.id)||section===item.id).map(item=><section key={item.id} id={`settings-section-${item.id}`} className={`settings-section settings-section-${item.id}`} hidden={section!==item.id} aria-label={item.label}>
     <h3 className="settings-section-title">{item.label}</h3>{render(item.id,section===item.id)}
    </section>)}</div>
   </div>
  </div>
  <form method="dialog" className="modal-backdrop" onSubmit={e=>e.preventDefault()}><button aria-label="关闭设置背景" disabled={!!pending} onClick={dismiss}>关闭</button></form>
 </dialog>;
}
