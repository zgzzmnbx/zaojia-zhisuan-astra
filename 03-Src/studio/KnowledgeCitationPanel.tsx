import {useEffect,useRef} from 'react';
import type {Message,Action} from './types';
import {CitationLink} from './KnowledgeWorkspace';
import {Prose,sourceExcerpt} from './Prose';
import {citationContent,readableCitationLocator} from './citation-content';
import {Icon} from './ui';
import './knowledge-citation-panel.css';

export function KnowledgeCitationPanel({message,close,onAction,unavailable}:{message:Message;close:()=>void;onAction:(action:Action)=>void;unavailable:(action:Action)=>string|undefined}){
 const evidence=message.evidence!;
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});},[message.id]);
 return <div className="knowledge-citation-panel" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>
  <header className="artifact-heading summary-heading"><div className="citation-panel-title"><Icon name="book"/><h2 ref={heading} tabIndex={-1}>引用依据</h2><span className="badge badge-ghost">{evidence.sources.length} 条</span></div><button className="btn btn-ghost btn-square" type="button" aria-label="关闭引用依据" onClick={close}><Icon name="close"/></button></header>
  <div className="artifact-body summary-body citation-panel-body">
   <div className="citation-answer-context"><span>{message.card?.caption||'本次回答'}</span>{evidence.question&&<p>{evidence.question}</p>}</div>
   {evidence.degradation_reason&&<p className="notice">检索降级：{evidence.degradation_reason}</p>}
   <ol className="citation-source-list">{evidence.sources.map((source:any,index:number)=>{
    const location=[source.library_name,source.source_file||source.source_path||source.path,source.sheet_name,source.row_number?`第 ${source.row_number} 行`:null,readableCitationLocator(source.locator_value)].filter(Boolean).join(' · ');
    const content=citationContent(String(source.snippet||source.excerpt||source.content||source.text||source.summary||'未提供摘录，请根据定位核对原文。'));
    return <li key={`${source.citation_id||'source'}:${index}`} className="card citation-source-card"><header><span className="citation-source-mark" aria-hidden="true"><Icon name="file"/></span><div><span className="citation-source-index">来源 {String(index+1).padStart(2,'0')}</span><h3>{source.title||source.title_path||source.source_name||source.source||'知识来源'}</h3></div></header>{location&&<p className="citation-source-location"><Icon name="pin"/>{location}</p>}<p className="citation-source-preview">{sourceExcerpt(content.body)}</p><details className="citation-source-reading"><summary>完整摘录<Icon name="chevron"/></summary><div className="citation-source-excerpt"><Prose text={content.body}/></div></details>{content.metadata&&<details className="citation-source-metadata"><summary>资料元信息<Icon name="chevron"/></summary><pre>{content.metadata}</pre></details>}{source.citation_id&&<CitationLink id={source.citation_id}/>}</li>;
   })}</ol>
   {!evidence.sources.length&&<div className="citation-empty"><Icon name="book"/><p>本次回答未返回可引用来源。</p></div>}
  </div>
  {!!message.actions?.length&&<footer className="citation-panel-footer">{message.actions.map(action=><button type="button" className="btn btn-ghost btn-sm" key={action.action} disabled={!!unavailable(action)} title={unavailable(action)} onClick={()=>onAction(action)}>{action.label}<Icon name="arrow-up-right"/></button>)}</footer>}
 </div>;
}
