import {ChevronLeft,ChevronRight} from '../PhosphorIcons';
import {useEffect,useRef,useState} from 'react';
import {api,json} from './api';
import {Icon} from './ui';
import {showKnowledgeSuggestions,replaceRecommendedQuestion} from './knowledge-shortcut';
import {isDemoKnowledgeQuestion} from '../professional/components/knowledge/knowledgeDemoQuestions';
import './composer-knowledge.css';
import {createRecommendationLoader} from './recommendation-loader';

const recommendations=createRecommendationLoader(async()=>{
 const [d,p,l]=await Promise.all([api<any>('/api/project-default-settings'),api<any>('/api/ui-preferences'),api<any>('/api/knowledge/libraries')]);
 return {defaults:d.zhisuanWindow?.commonQuestions??[] as string[],questions:p.preferences?.commonQuestions??d.zhisuanWindow?.commonQuestions??[] as string[],libraries:l.libraries.filter((item:any)=>item.available).map((item:any)=>item.id) as string[]};
});

export function ComposerKnowledgeQuestions({value,enabled,disabled,revision,select,focus,changed}:{value:string;enabled:boolean;disabled:boolean;revision:number;select:(q:string,libraries:string[])=>void;focus:()=>void;changed:()=>void}){
 const eligible=enabled&&showKnowledgeSuggestions(value);
 const cached=recommendations.peek(revision);
 const panel=useRef<HTMLElement|null>(null);
 const [libraries,setLibraries]=useState<string[]>(cached?.libraries??[]);
 const [dismissed,setDismissed]=useState(false),[questions,setQuestions]=useState<string[]>(cached?.questions??[]),[defaults,setDefaults]=useState<string[]>(cached?.defaults??[]),[page,setPage]=useState(0),[editing,setEditing]=useState(false),[drafts,setDrafts]=useState<string[]>(cached?.questions??[]),[saving,setSaving]=useState<number|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(!cached),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!eligible){setDismissed(false);setPage(0);setEditing(false);}},[eligible]);
 useEffect(()=>{
  let live=true;setLoading(true);setError('');
  void recommendations.load(revision).then(snapshot=>{
   if(!live)return;
   setDefaults(snapshot.defaults);setQuestions(snapshot.questions);setLibraries(snapshot.libraries);if(!editing)setDrafts(snapshot.questions);
  }).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[revision,retry,eligible]);
 const pages=Math.max(1,Math.ceil(questions.length/6));
 useEffect(()=>setPage(p=>Math.min(p,pages-1)),[pages]);
 function close(){if(saving!==null)return;setDismissed(true);setEditing(false);focus();}
 useEffect(()=>{
  if(!eligible||dismissed)return;
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&panel.current?.parentElement?.contains(event.target as Node)){event.preventDefault();event.stopPropagation();close();}};
  document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);
 },[eligible,dismissed,saving]);
 async function save(index:number,restore=false){
  if(saving!==null)return;setSaving(index);setError('');
  try{
   const latest=await api<any>('/api/ui-preferences');
   const next=replaceRecommendedQuestion(latest.preferences?.commonQuestions??defaults,index,restore?defaults[index]||'':drafts[index]||'');
   await api('/api/ui-preferences',json({preferences:{...latest.preferences,commonQuestions:next}}));
   setQuestions(next);setDrafts(d=>d.map((v,i)=>i===index?next[index]:v));changed();
  }catch(e){setError((e as Error).message);}finally{setSaving(null);}
 }
 if(!eligible||dismissed)return null;
 return <section ref={panel} className="composer-knowledge-questions card" aria-label="知识库推荐问题">
  <header><strong>常见问题</strong><span>{page+1} / {pages}</span><button className="btn btn-ghost btn-square btn-sm" type="button" aria-label="上一组推荐问题" disabled={page===0||saving!==null} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/></button><button className="btn btn-ghost btn-square btn-sm" type="button" aria-label="下一组推荐问题" disabled={page+1>=pages||saving!==null} onClick={()=>setPage(p=>p+1)}><ChevronRight size={16}/></button><button className="btn btn-ghost btn-square btn-sm" type="button" aria-label={editing?'完成问题编辑':'编辑推荐问题'} disabled={saving!==null||loading||!questions.length} onClick={()=>{if(!editing)setDrafts([...questions]);setEditing(!editing);setError('');}}><Icon name={editing?'check':'settings'}/></button><button className="btn btn-ghost btn-square btn-sm" type="button" aria-label="关闭推荐问题" disabled={saving!==null} onClick={close}><Icon name="close"/></button></header>
  <div className="ckq-list">{error&&<div className="ckq-error" role="alert">{error}<button className="btn btn-ghost btn-sm" type="button" onClick={()=>setRetry(n=>n+1)}>重试</button></div>}{loading&&!questions.length?<p role="status">正在读取推荐问题…</p>:!questions.length?<p>暂无推荐问题</p>:questions.slice(page*6,page*6+6).map((q,i)=>{const index=page*6+i;return editing?<div className="ckq-edit" key={index}><span>{index+1}</span><textarea className="textarea textarea-bordered" aria-label={`推荐问题 ${index+1}`} rows={2} maxLength={500} value={drafts[index]||''} disabled={saving!==null} onChange={e=>setDrafts(d=>d.map((v,n)=>n===index?e.target.value:v))}/><div><button className="btn btn-ghost btn-square btn-sm" type="button" aria-label={`保存第 ${index+1} 条推荐问题`} disabled={saving!==null||disabled} onClick={()=>void save(index)}><Icon name="check"/></button><button className="btn btn-ghost btn-square btn-sm" type="button" aria-label={`恢复第 ${index+1} 条推荐问题`} disabled={saving!==null||disabled||!defaults[index]} onClick={()=>void save(index,true)}><Icon name="refresh"/></button></div></div>:<button className="ckq-question btn btn-ghost" type="button" key={index} disabled={disabled} onClick={()=>select(q,libraries)}><span className="ckq-number">{index+1}</span><span className="ckq-text">{q}{isDemoKnowledgeQuestion(q)&&<i className="knowledge-preset-dot" role="img" aria-label="标准演示问题" title="标准演示问题 · 预设答案"/>}</span><Icon name="arrow-up-right"/></button>;})}</div>
 </section>;
}
