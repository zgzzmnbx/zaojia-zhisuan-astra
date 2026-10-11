import {DEBUG_MODE} from '../frontend-debug/mock-adapter';
import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {TaskProgress} from './TaskProgress';
import {Icon} from './ui';
import {Prose} from './Prose';
import {documentDownload,type DocumentState} from './document-types';
import './documents.css';
import {DocumentPreviewBoundary} from './DocumentPreviewBoundary';
const DocumentPreview=lazy(()=>import('./document-preview/DocumentPreview'));
export function DocumentPanel({document:doc,conversation,busy,upload,reportExcel,onReload}:{document:DocumentState|null;conversation:string;busy:boolean;upload:()=>void;reportExcel?:{jobId:string;url:string};onReload:()=>Promise<void>}){
 const [toolbar,setToolbar]=useState<HTMLDivElement|null>(null),[markdown,setMarkdown]=useState(''),[error,setError]=useState('');
 const output=doc?.output||null;
 const url=output?documentDownload(output.id,conversation):doc?`/api/astra/documents/source/download?kind=${doc.source.kind}&source_id=${encodeURIComponent(doc.source.source_id)}&conversation_id=${encodeURIComponent(conversation)}`:'';
 const excelUrl=doc&&doc.source.kind!=='asset'&&reportExcel?.jobId===doc.source.source_id?reportExcel.url:undefined;
 const source=useMemo(()=>({kind:'url' as const,url}),[url]);
 const name=output?.name||doc?.source.name||'';
 const isMarkdown=/\.(md|markdown)$/i.test(name),isDoc=/\.doc$/i.test(name);
 useEffect(()=>{setMarkdown('');setError('');if(!doc||!isMarkdown)return;const abort=new AbortController();void fetch(url,{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('原文读取失败');return r.text();}).then(value=>{if(!abort.signal.aborted)setMarkdown(value);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[url,isMarkdown,!!doc]);
 if(DEBUG_MODE)return <div className="empty-state"><Icon name="file"/><p>前端调试版未生成真实 Word，请在本地工作室查看。</p></div>;
 if(!doc)return <div className="empty-state"><Icon name="file"/><h3>选择 Word 或 Markdown</h3><button className="btn btn-primary" onClick={upload} disabled={busy}>选择文稿</button></div>;
 return <section className="astra-document" aria-label="文稿预览">
  <div className="document-toolbar"><span className="document-filename" title={name}>{name}</span><div ref={setToolbar}/><a className="btn btn-ghost btn-sm document-download" href={url} download title={doc.source.kind==='report'?'下载 Word 报告':'下载当前文稿'} aria-label={doc.source.kind==='report'?'下载 Word 报告':'下载当前文稿'}><Icon name="download"/>{output||doc.source.kind==='report'?'Word':'原文'}</a>{excelUrl&&<a className="btn btn-ghost btn-sm document-download" href={excelUrl} download title="下载 Excel 计算表" aria-label="下载 Excel 计算表"><Icon name="download"/>Excel</a>}</div>
  <div className="document-surface">{isMarkdown?<article className="document-markdown">{error?<p role="alert">{error}</p>:markdown?<Prose text={markdown}/>:<TaskProgress label="正在读取原文"/>}</article>:isDoc?<div className="empty-state"><Icon name="file"/><p>DOC 原文可下载查看，转换后显示 Word 分页预览。</p></div>:<DocumentPreviewBoundary key={`${conversation}:${url}:${doc.source.revision||output?.sha256||''}`} onReload={onReload}><Suspense fallback={<TaskProgress label="正在加载 Word 预览"/>}><DocumentPreview documentId={output?.id||doc.source.source_id} revisionKey={output?.sha256||doc.source.revision||url} filename={name} source={source} enabled toolbarTarget={toolbar} previewProfile={doc.source.kind==='report'&&!output?'zaojia-legacy':'generic'}/></Suspense></DocumentPreviewBoundary>}</div>
 </section>;
}
