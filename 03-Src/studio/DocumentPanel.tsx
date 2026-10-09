import {DEBUG_MODE} from '../frontend-debug/mock-adapter';
import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {Icon} from './ui';
import {Prose} from './Prose';
import {documentDownload,type DocumentState} from './document-types';
import './documents.css';
import {DocumentPreviewBoundary} from './DocumentPreviewBoundary';
const DocumentPreview=lazy(()=>import('./document-preview/DocumentPreview'));
export function DocumentPanel({document:doc,conversation,selectOriginal,busy,upload,reportExcel,onReload}:{document:DocumentState|null;conversation:string;selectOriginal:(value:boolean)=>void;busy:boolean;upload:()=>void;reportExcel?:{jobId:string;url:string};onReload:()=>Promise<void>}){
 const [toolbar,setToolbar]=useState<HTMLDivElement|null>(null),[markdown,setMarkdown]=useState(''),[error,setError]=useState('');
 const output=doc?.output&&!doc.showOriginal?doc.output:null;
 const url=output?documentDownload(output.id,conversation):doc?.source.kind==='report'?`/api/download/${doc.source.source_id}/report`:`/api/astra/workspace/assets/${doc?.source.source_id}?conversation_id=${conversation}`;
 const excelUrl=doc?.source.kind==='report'&&reportExcel?.jobId===doc.source.source_id?reportExcel.url:undefined;
 const source=useMemo(()=>({kind:'url' as const,url}),[url]);
 const name=output?.name||doc?.source.name||'';
 const isMarkdown=/\.(md|markdown)$/i.test(name),isDoc=/\.doc$/i.test(name);
 useEffect(()=>{setMarkdown('');setError('');if(!doc||!isMarkdown)return;const abort=new AbortController();void fetch(url,{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('原文读取失败');return r.text();}).then(value=>{if(!abort.signal.aborted)setMarkdown(value);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[url,isMarkdown,!!doc]);
 if(DEBUG_MODE)return <div className="empty-state"><Icon name="file"/><p>前端调试版未生成真实 Word，请在本地工作室查看。</p></div>;
 if(!doc)return <div className="empty-state"><Icon name="file"/><h3>选择 Word 或 Markdown</h3><button className="btn btn-primary" onClick={upload} disabled={busy}>选择文稿</button></div>;
 return <section className="astra-document" aria-label="文稿预览">
  <div className="document-toolbar"><span className="document-filename" title={name}>{name}</span>{doc.output&&<select aria-label="选择文稿版本" className="select select-sm" value={doc.showOriginal?'original':'formatted'} onChange={e=>selectOriginal(e.target.value==='original')}><option value="formatted">公文版</option><option value="original">原文</option></select>}<div ref={setToolbar}/><span className="document-preview-hint" tabIndex={0} aria-label="网页预览仅供参考，以下载后的 Word 排版为准" title="网页预览仅供参考，以下载后的 Word 排版为准"><Icon name="info"/><span>预览说明</span></span><a className="btn btn-ghost btn-sm document-download" href={url} download title={doc.source.kind==='report'?'下载 Word 报告':'下载当前文稿'} aria-label={doc.source.kind==='report'?'下载 Word 报告':'下载当前文稿'}><Icon name="download"/>{doc.source.kind==='report'?'Word':'下载'}</a>{excelUrl&&<a className="btn btn-ghost btn-sm document-download" href={excelUrl} download title="下载 Excel 计算表" aria-label="下载 Excel 计算表"><Icon name="download"/>Excel</a>}{output&&<a className="btn btn-ghost btn-sm" href={documentDownload(output.id,conversation)+'&kind=checks'} title="格式检查记录" aria-label="格式检查记录"><Icon name="shield"/></a>}</div>
  <div className="document-surface">{isMarkdown?<article className="document-markdown">{error?<p role="alert">{error}</p>:markdown?<Prose text={markdown}/>:<p role="status">正在读取原文…</p>}</article>:isDoc?<div className="empty-state"><Icon name="file"/><p>DOC 原文可下载查看，转换后显示 Word 分页预览。</p></div>:<DocumentPreviewBoundary key={`${conversation}:${url}:${doc.source.revision||output?.sha256||''}`} onReload={onReload}><Suspense fallback={<p role="status">正在加载 Word 预览…</p>}><DocumentPreview documentId={output?.id||doc.source.source_id} revisionKey={output?.sha256||doc.source.revision||url} filename={name} source={source} enabled toolbarTarget={toolbar} previewProfile={doc.source.kind==='report'&&!output?'zaojia-legacy':'generic'}/></Suspense></DocumentPreviewBoundary>}</div>
 </section>;
}
