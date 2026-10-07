import {DEBUG_MODE} from '../frontend-debug/mock-adapter';
import {useState} from 'react';
import type {Result,SheetConfig,Report,Run} from './types';
import {Button,Icon,Note} from './ui';


export function Mapping({sheets,setSheets,filename,project,setProject,busy,convert,inspectHeader,compact=false,expanded=false,setExpanded}:{sheets:SheetConfig[];setSheets:(s:SheetConfig[])=>void;filename:string;project:string;setProject:(v:string)=>void;busy:boolean;convert:()=>void;inspectHeader:(name:string,row:number)=>void;compact?:boolean;expanded?:boolean;setExpanded?:(value:boolean)=>void}){
  const [current,setCurrent]=useState(0);const sheet=sheets[current];
  const update=(next:Partial<SheetConfig>)=>setSheets(sheets.map((s,i)=>i===current?{...s,...next}:s));
  return <div className={compact?'mapping-inline':'panel-content live-mapping'} aria-label="匹配设置">
    {!compact&&<div className="section-caption"><h3>确认输入结构</h3><span className="badge badge-success">{DEBUG_MODE?'合成调试数据':'已读取实际文件'}</span></div>}
    <div className="mapping-basics"><label className="field">项目名称<input className="input" value={project} onChange={e=>setProject(e.target.value)} disabled={busy}/></label>
    <label className="field">工作表<select className="select" aria-label="工作表" value={current} onChange={e=>setCurrent(Number(e.target.value))} disabled={busy}>{sheets.map((s,i)=><option key={s.sheet_name} value={i}>{s.sheet_name}{s.enabled?'':'（跳过）'}</option>)}</select></label></div>
    {!sheet?<Note>没有识别到支持的候选工作表，请使用包含表2、表3、表4的控制价模板。</Note>:<>
    <div className="mapping-meta"><label className="check-line"><input className="checkbox" type="checkbox" checked={sheet.enabled} onChange={e=>update({enabled:e.target.checked})} disabled={busy}/>参与处理</label><label className="field">表头行<input className="input" type="number" min="1" value={sheet.header_row} onChange={e=>update({header_row:Number(e.target.value)})} disabled={busy} onFocus={e=>{e.currentTarget.dataset.original=e.currentTarget.value;}} onBlur={e=>{if(e.currentTarget.value!==e.currentTarget.dataset.original)inspectHeader(sheet.sheet_name,sheet.header_row);}}/></label><span className="mapping-count">已选 {sheets.filter(s=>s.enabled).length} / {sheets.length} 张表</span></div>
    <details className="mapping-fields" open={compact?expanded:undefined} onToggle={e=>{if(compact)setExpanded?.(e.currentTarget.open);}}><summary>字段映射与匹配范围</summary><div className="field-grid">{Object.entries(sheet.column_mapping).filter(([field])=>field!=='价格列').map(([field,value])=><label key={field} className="field">{field}<select className="select" aria-label={field} value={value} disabled={busy} onChange={e=>update({column_mapping:{...sheet.column_mapping,[field]:e.target.value,...(field==='输出-价格列'?{'价格列':e.target.value}:{})}})}><option value="">不映射</option>{field.startsWith('要素')&&<option value="空元素列">空元素列</option>}{sheet.columns.map(c=><option key={c.letter} value={c.letter}>{c.label}</option>)}</select></label>)}</div><label className="check-line"><input className="checkbox" type="checkbox" checked={sheet.only_match_rows_with_value} disabled={busy} onChange={e=>update({only_match_rows_with_value:e.target.checked})}/>只匹配数量有值的行</label><p className="mapping-note">跨行合并：每行继承；跨列合并：仅首列有值。0 和空白不计入有效数量行。</p></details>
    {!compact&&<div className="action-row"><Button primary disabled={busy||!sheets.some(s=>s.enabled)} icon="arrow-right" onClick={convert}>确认结构并转换</Button></div>}
    </>}
  </div>;
}

export {Risks} from './RiskReview';

export function ReportPanel({report,result,generate,busy}:{report:Report|null;result:Result;generate:()=>void;busy:boolean}){return <div className="panel-content"><div className="section-caption"><h3>{DEBUG_MODE?'模拟报告文本':'当前实际 Word 成果'}</h3><span className="badge badge-success">{DEBUG_MODE?'未生成 DOCX':'来自 DOCX'}</span></div><p className="panel-lead">{report?.note||'完成批量匹配后，模板化报告随计算表一起生成。'}</p><div className="action-row">{result.downloads.report&&<a className="btn btn-primary" href={result.downloads.report}><Icon name="download"/>下载正式 Word</a>}<Button onClick={generate} disabled={busy}>补充风险报告</Button></div>{report&&<article className="live-report">{report.paragraphs.map((p,i)=>/^[一二三四五六七八九十]+、/.test(p)?<h3 key={i}>{p}</h3>:<p key={i}>{p}</p>)}{report.tables.map((table,i)=><div className="report-table-scroll" key={i}><table>{table.map((row,r)=><tbody key={r}><tr>{row.map((cell,c)=><td key={c}>{cell}</td>)}</tr></tbody>)}</table></div>)}</article>}</div>;}

export function Projects({runs,restore,busy}:{runs:Run[];restore:(run:Run)=>void;busy:boolean}){return <div className="panel-content"><p className="panel-lead">最近 60 次运行 · 含未归入业务项目的任务</p>{!runs.length&&<div className="empty-state">完成首次转换后，任务会出现在这里。</div>}{runs.map(run=><article className="project-record" key={run.job_id}><div><h3>{run.name}</h3><small>{run.input_filename}</small><small>{run.rows} 行 · {run.updated_at?.replace('T',' ').slice(0,19)}</small></div><span className={`badge ${run.status==='completed'?'badge-success':'badge-warning'}`}>{run.status==='completed'?'已匹配':'待匹配'}</span><div className="action-row"><Button onClick={()=>restore(run)} disabled={busy}>恢复任务</Button></div></article>)}</div>;}
