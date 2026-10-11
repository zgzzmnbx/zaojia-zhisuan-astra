import {useEffect,useRef,useState} from 'react';
import {TaskProgress} from './TaskProgress';
import {api,json} from './api';
import {Icon} from './ui';
import {documentDownload,type DocumentSource,type FormattedDocument,type GongwenDraft,type GongwenPrepared} from './document-types';
import './documents.css';

const switches:[string,string][]=[['add_page_numbers','页码'],['auto_letter_layout','主送、落款与附件识别'],['split_numbered_paragraphs','括号编号自动分段'],['split_decimal_numbered_paragraphs','数字点号自动分段'],['use_times_new_roman','正文英文与数字使用 Times New Roman'],['interpret_bold_markers','Word 双星号按加粗处理'],['flatten_numbering','自动编号转为文字'],['clean_extra_spaces','清理多余空格'],['convert_chinese_punctuation','统一中文标点']];

export function GongwenCard({source,conversation,draft,output,busy,change,convert,upload,paste,currentReport,close,reload}: {
 source:DocumentSource|null;conversation:string;draft?:GongwenDraft;output?:FormattedDocument;busy:boolean;
 change:(draft:GongwenDraft)=>void;convert:(draft:GongwenDraft)=>Promise<void>;upload:()=>void;paste:(text:string)=>Promise<void>;
 currentReport?:()=>void;close:()=>void;reload:()=>void;
}){
 const [error,setError]=useState(''),[retry,setRetry]=useState(0),[loading,setLoading]=useState(false),[checks,setChecks]=useState<any>(null),[pasteOpen,setPasteOpen]=useState(false),[text,setText]=useState('');
 const changeRef=useRef(change);changeRef.current=change;
 useEffect(()=>{
  if(!source||draft?.prepared)return;
  const controller=new AbortController();setLoading(true);setError('');
  void api<GongwenPrepared>('/api/astra/documents/prepare',{...json({...source,conversation_id:conversation,...(/^[a-f0-9]{64}$/.test(source.revision||'')?{sha256:source.revision}:{})}),signal:controller.signal}).then(prepared=>{
   if(!controller.signal.aborted){setLoading(false);changeRef.current({prepared,options:prepared.defaults,titleMode:prepared.suggested?'suggested':'none',selected:prepared.suggested||'',manualTitle:''});}
  }).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[source?.source_id,source?.revision,conversation,retry,!!draft?.prepared]);
 useEffect(()=>{setChecks(null);if(!output)return;const abort=new AbortController();void api<any>(`/api/astra/documents/${output.id}/checks?conversation_id=${encodeURIComponent(conversation)}`,{signal:abort.signal}).then(data=>{if(!abort.signal.aborted)setChecks(data);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[output?.id,conversation]);
 const ready=!!draft?.prepared&&!loading;
 const selected=draft?.prepared.candidates.find(row=>row.id===(draft.titleMode==='suggested'?draft.prepared.suggested:draft.selected));
 const valid=ready&&(draft!.titleMode==='none'||draft!.titleMode==='manual'&&!!draft!.manualTitle.trim()||['suggested','other'].includes(draft!.titleMode)&&!!selected?.selectable);
 const update=(next:Partial<GongwenDraft>)=>draft&&change({...draft,...next});
 return <section className="card gongwen-card" aria-label="公文转换设置">
  <header><span><Icon name="file"/><strong>公文转换</strong></span><button className="btn btn-ghost btn-square" aria-label="收起公文转换" disabled={busy} onClick={close}><Icon name="close"/></button></header>
  {source&&<p className="gongwen-source" title={source.name}>{source.name}</p>}
  <div className="gongwen-inputs">{currentReport&&<button className="btn btn-ghost btn-sm" disabled={busy} onClick={currentReport}>当前风险报告</button>}<button className="btn btn-ghost btn-sm" disabled={busy} onClick={upload}><Icon name="plus"/>上传文稿</button><button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>setPasteOpen(v=>!v)}>粘贴 Markdown</button></div>
  {pasteOpen&&<div className="gongwen-paste"><textarea className="textarea textarea-bordered" aria-label="公文 Markdown 正文" placeholder="粘贴要排版的 Markdown 正文…" value={text} onChange={e=>setText(e.target.value)} disabled={busy}/><button className="btn btn-outline btn-sm" disabled={busy||!text.trim()} onClick={()=>void paste(text).then(()=>{setText('');setPasteOpen(false);}).catch(e=>setError(e.message))}>载入正文</button></div>}
  {loading?<TaskProgress compact label="正在识别标题" detail="读取文稿结构与格式设置"/>:!source&&<p>上传 Word／Markdown，或粘贴正文。</p>}
  {error&&<div className="gongwen-error" role="alert">{error}<button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>{setError('');reload();setRetry(n=>n+1);}}>重新识别</button></div>}
  {ready&&draft&&<>
   <fieldset disabled={busy}><legend>确认标题</legend><div className="gongwen-title-modes">{([['suggested','采用识别标题'],['other','选择其他行'],['none','不设标题'],['manual','手动输入标题']] as const).map(([mode,label])=><label className={`gongwen-title-choice btn btn-ghost btn-sm ${draft.titleMode===mode?'is-selected':''}`} key={mode}><input className="gongwen-title-radio" type="radio" name={`gongwen-title-${draft.prepared.id}`} checked={draft.titleMode===mode} disabled={busy||mode==='suggested'&&!draft.prepared.suggested} onChange={()=>update({titleMode:mode})}/><span>{label}</span><Icon name="check"/></label>)}</div>
   {draft.titleMode==='suggested'&&<p className="gongwen-recognized">{selected?.text}</p>}
   {draft.titleMode==='other'&&<select className="select select-bordered" aria-label="公文标题候选行" value={draft.selected} onChange={e=>update({selected:e.target.value})}><option value="">选择标题行</option>{draft.prepared.candidates.map(row=><option key={row.id} value={row.id} disabled={!row.selectable}>{row.text}</option>)}</select>}
   {draft.titleMode==='manual'&&<input className="input input-bordered" aria-label="手动公文标题" placeholder="输入标题，原稿文字保留" maxLength={100} value={draft.manualTitle} onChange={e=>update({manualTitle:e.target.value})}/>}
   </fieldset>
   <details className="gongwen-options"><summary><Icon name="settings"/>格式设置</summary><p>标题：方正小标宋 22pt；正文：方正仿宋 16pt；一级／二级：方正黑体／方正楷体。正文行距 28pt。</p><div>{switches.map(([key,label])=><label key={key}><input className="checkbox checkbox-sm checkbox-primary" type="checkbox" checked={!!draft.options[key]} disabled={busy} onChange={e=>update({options:{...draft.options,[key]:e.target.checked}})}/><span>{label}</span><Icon name="check"/></label>)}</div></details>
   <div className="gongwen-actions"><button className="btn btn-primary btn-sm" disabled={busy||!valid} onClick={()=>void convert(draft).catch(e=>setError(e.message))}>{busy?'正在处理…':output?'重新生成公文版':'生成公文版'}</button>{output&&<a className="btn btn-outline btn-sm" href={documentDownload(output.id,conversation)} download><Icon name="download"/>下载 Word</a>}</div>
  </>}
  {output&&<div className="gongwen-checks"><strong>{output.warnings.length?'已生成 · 有待核对项':'公文版已生成'}</strong><p>网页预览仅供参考，请下载 Word 查看最终效果。</p><details><summary>检查结果{checks?` · ${checks.checks.length} 项`:''}</summary>{checks?<ul>{checks.checks.map((check:any,index:number)=><li key={index}><span className={`badge ${check.status==='pass'?'badge-ghost':'badge-outline'}`}>{check.status==='pass'?'通过':check.status==='needs_review'?'待核对':check.status==='fail'?'失败':'提示'}</span>{check.message}</li>)}</ul>:error?<p>检查结果暂不可用，请下载检查记录核对。</p>:<TaskProgress compact label="正在读取检查结果"/>}<a className="btn btn-ghost btn-sm" href={documentDownload(output.id,conversation)+'&kind=checks'} download>下载检查记录</a></details></div>}
 </section>;
}
