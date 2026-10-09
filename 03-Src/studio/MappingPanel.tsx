import {useEffect,useRef,type ComponentProps} from 'react';
import {Mapping} from './panels';
import {Icon} from './ui';
import './mapping-panel.css';

export function MappingPanel({close,...props}:ComponentProps<typeof Mapping>&{close:()=>void}){
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
 const selected=props.sheets.filter(s=>s.enabled).length;
 return <div className="mapping-panel" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
  <header className="artifact-heading summary-heading"><div className="mapping-panel-title"><Icon name="columns"/><h2 ref={heading} tabIndex={-1}>编制设置</h2></div><button type="button" className="btn btn-ghost btn-square" aria-label="关闭编制设置" onClick={close}><Icon name="close"/></button></header>
  <div className="artifact-body summary-body mapping-panel-body">
   <div className="mapping-file-summary"><span className="mapping-file-symbol"><Icon name="sheet"/></span><div><strong>{props.filename}</strong><span>{selected} / {props.sheets.length} 张工作表参与处理</span></div></div>
   <section className="card mapping-config-card"><Mapping {...props} compact/></section>
  </div>
  <footer className="mapping-panel-footer"><span>{selected?'核对完成后继续':'请至少选择一张工作表'}</span><button type="button" className="btn btn-primary" disabled={props.busy||!selected} onClick={props.convert}>确认结构并转换<Icon name="arrow-right"/></button></footer>
 </div>;
}
