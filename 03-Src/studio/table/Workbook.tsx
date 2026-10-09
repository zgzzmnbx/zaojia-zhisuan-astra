import {canPriceRow} from '../row-pricing';
import {useEffect,useRef,useState,useId,type CSSProperties,type PointerEvent} from 'react';
import type {Result,SelectedCell} from '../types';
import {Button,Icon,Modal,Note} from '../ui';
import {exportUrl} from '../api';
import defaults from './legacy-defaults.json';
import {columnSelectionKey,selectedPreviewColumns} from './columns';
import {
  buildAvailablePreviewColumns,buildPreviewColumns,clampPreviewColumnWidth,filterPreviewRows,
  isEditablePreviewColumn,isTotalSummaryRow,normalizePreviewColumnPreferences,previewCellClass,
  previewCellText,previewCellTitle,previewColumnWidthKeys,previewExcelRowNumber,previewSheetKey,
  previewSheetsFromTablePreview,warningCellState,warningFilterColumnIndex,isCorePreviewSheet,
  type PreviewColumn,type PreviewColumnPreferences,
} from './legacy-preview';
import './workbook.css';
import {SheetTabs} from './SheetTabs';
import type {CellLocation} from './risk-location';

const preferenceKey='astra.preview-columns.v1';
export function readPreviewPreferences():PreviewColumnPreferences {
  try {const saved=localStorage.getItem(preferenceKey);if(saved)return normalizePreviewColumnPreferences(JSON.parse(saved));} catch { /* Local preferences may be unavailable; project defaults remain usable. */ }
  return normalizePreviewColumnPreferences(defaults);
}

type Props={
  active?:boolean;location?:CellLocation;
  result:Result;sheetIndex:number;setSheetIndex:(index:number)=>void;busy:boolean;
  match:()=>void;recalculate:()=>void;needsRecalculate:boolean;selectedRow?:number;
  assist?:(cell:SelectedCell)=>void;edit:(cell:SelectedCell)=>void;inspect:(cell:SelectedCell)=>void;
  preferences:PreviewColumnPreferences;setPreferences:(value:PreviewColumnPreferences)=>void;
  refreshHeaders:(rows:Record<string,number>)=>Promise<boolean>;
};

/** Sheet toolbar / tabs / resizable columns / fixed row actions follow the original preview structure. */
export function Workbook({active=true,location,result,sheetIndex,setSheetIndex,busy,match,recalculate,needsRecalculate,selectedRow,assist,edit,inspect,preferences,setPreferences,refreshHeaders}:Props){
  const sheets=previewSheetsFromTablePreview(result.summary.table_preview);
  const activeSheetIndex=sheets[sheetIndex]?sheetIndex:0;
  const sheet=sheets[activeSheetIndex];
  const sheetKey=previewSheetKey(sheet);
  const complete=result.summary.matching_status==='completed';
  const [searchOpen,setSearchOpen]=useState(false);const [query,setQuery]=useState('');const [hideEmpty,setHideEmpty]=useState(true);
  const [settings,setSettings]=useState<PreviewColumnPreferences|null>(null);
  const [settingsError,setSettingsError]=useState('');const [storageError,setStorageError]=useState('');
  const scroller=useRef<HTMLDivElement>(null);const resizing=useRef<(()=>void)|null>(null);
  const sheetPanelId=useId();
  const latestPreferences=useRef(preferences);latestPreferences.current=preferences;
  const available=buildAvailablePreviewColumns(sheet,result.summary.price_column);
  const target=location?.sheet===sheet.sheet_name&&location.job===result.job_id?location:undefined;
  const playedLocation=useRef<number|undefined>(undefined);
  const selectedColumns=selectedPreviewColumns(sheet,result.summary.price_column,preferences);
  const columns=available.filter(column=>selectedColumns.some(selected=>selected.index===column.index)||column.index+1===target?.column);
  const filtered=filterPreviewRows(sheet,{enabled:hideEmpty,value_filter_field:'数量'});
  const matchingRows=new Set(filtered.filter(({row})=>!query.trim()||row.some(value=>String(value??'').includes(query.trim()))).map(item=>item.sourceIndex));
  const rows=sheet.rows.flatMap((row,sourceIndex)=>matchingRows.has(sourceIndex)||previewExcelRowNumber(sheet,sourceIndex)===target?.row?[{row,sourceIndex}]:[]);
  const locatedVisible=selectedRow===undefined||rows.some(({sourceIndex})=>previewExcelRowNumber(sheet,sourceIndex)===selectedRow);
  useEffect(()=>{setQuery('');scroller.current?.scrollTo({left:0,top:0});},[sheetKey,result.job_id]);
  useEffect(()=>{if(active&&!target&&selectedRow!==undefined)scroller.current?.querySelector(`[data-preview-row="${selectedRow}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});},[active,selectedRow,sheetKey,query,hideEmpty,target?.request]);
  useEffect(()=>{
    if(!active||!target||playedLocation.current===target.request)return;
    let animation:Animation|undefined;let observer:IntersectionObserver|undefined;
    const cancel=()=>animation?.cancel();
    const hidden=()=>{if(document.hidden)cancel();};
    const frame=requestAnimationFrame(()=>{
      const cell=scroller.current?.querySelector<HTMLTableCellElement>(`[data-preview-row="${target.row}"] [data-preview-column="${target.column}"]`);
      if(!cell||document.hidden||!cell.getClientRects().length)return;
      cell.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
      cell.focus({preventScroll:true});playedLocation.current=target.request;
      // Explicitly requested risk feedback: three gentle color pulses, no spatial motion.
      {
        const style=getComputedStyle(cell);
        animation=cell.animate([{backgroundColor:style.getPropertyValue('--paper'),boxShadow:'inset 0 0 0 2px transparent'},{backgroundColor:style.backgroundColor,boxShadow:`inset 0 0 0 3px ${style.outlineColor}`,offset:.5},{backgroundColor:style.getPropertyValue('--paper'),boxShadow:'inset 0 0 0 2px transparent'}],{duration:700,iterations:3,easing:'ease-in-out'});
        animation.id='astra-risk-cell';
        observer=new IntersectionObserver(entries=>{if(entries.some(entry=>!entry.isIntersecting))cancel();},{root:scroller.current});observer.observe(cell);
      }
    });
    document.addEventListener('visibilitychange',hidden);
    return ()=>{cancelAnimationFrame(frame);cancel();observer?.disconnect();document.removeEventListener('visibilitychange',hidden);};
  },[active,target?.request,sheetKey,result.job_id]);
  useEffect(()=>()=>resizing.current?.(),[]);

  function savePreferences(next:PreviewColumnPreferences){
    const normalized=normalizePreviewColumnPreferences(next);setPreferences(normalized);
    try{localStorage.setItem(preferenceKey,JSON.stringify(normalized));setStorageError('');}
    catch{setStorageError('浏览器未允许保存列设置；本次会话仍然有效。');}
  }
  function width(column:PreviewColumn){
    const saved=preferences.columnWidths[sheetKey]||{};
    for(const key of previewColumnWidthKeys(column))if(saved[key])return saved[key];
    return Math.max(88,Math.min(260,preferences.maxDisplayChars*13+24));
  }
  function resize(column:PreviewColumn,value:number){
    const next=clampPreviewColumnWidth(value);if(next===null)return;
    const current=latestPreferences.current;
    const widths={...(current.columnWidths[sheetKey]||{})};
    for(const key of previewColumnWidthKeys(column))widths[key]=next;
    const updated={...current,columnWidths:{...current.columnWidths,[sheetKey]:widths}};
    latestPreferences.current=updated;setPreferences(updated);
  }
  function startResize(event:PointerEvent<HTMLSpanElement>,column:PreviewColumn){
    if(event.button!==0)return;
    event.preventDefault();resizing.current?.();
    const start=event.clientX;const startWidth=width(column);
    const cursor=document.body.style.cursor;const select=document.body.style.userSelect;
    document.body.style.cursor='col-resize';document.body.style.userSelect='none';
    const move=(event:globalThis.PointerEvent)=>resize(column,startWidth+event.clientX-start);
    const cleanup=()=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);
      window.removeEventListener('pointercancel',finish);window.removeEventListener('blur',finish);
      document.body.style.cursor=cursor;document.body.style.userSelect=select;resizing.current=null;
    };
    const finish=()=>{cleanup();savePreferences(latestPreferences.current);};
    resizing.current=cleanup;
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);
    window.addEventListener('pointercancel',finish);window.addEventListener('blur',finish);
  }
  function openSettings(){setSettingsError('');setSettings({...preferences,headerRows:{...preferences.headerRows,[sheetKey]:sheet.header_row},sheetOverrides:{...preferences.sheetOverrides,[sheetKey]:columns.map(c=>columnSelectionKey(c,available))}});}
  async function applySettings(){
    if(!settings)return;
    const labels=settings.sheetOverrides[sheetKey]||[];
    const header=settings.headerRows[sheetKey];
    if(!labels.length){setSettingsError('请至少保留一列。');return;}
    if(!Number.isInteger(header)||header<1||header>1000){setSettingsError('表头行需为 1 到 1000 的整数。');return;}
    if(header!==sheet.header_row && !await refreshHeaders(settings.headerRows)){setSettingsError('表头刷新失败，请检查对话中的错误说明后重试。');return;}
    savePreferences(settings);setSettings(null);
  }
  function selectSheet(index:number){resizing.current?.();setSheetIndex(index);}

  return <div className="astra-legacy-table">
    <div className="preview-window">
      <div className="window-bar">
        <SheetTabs names={sheets.map(item=>item.sheet_name)} index={activeSheetIndex} onChange={selectSheet} panelId={sheetPanelId}/>
        <div className="window-actions">
          {!complete&&<Button primary disabled={busy} onClick={match}>批量匹配</Button>}
          <label className="check-line" title="按数量过滤表2、表3、表4的空量行；合计行保留"><input type="checkbox" className="checkbox checkbox-sm" aria-label="隐藏空量行" checked={hideEmpty} onChange={e=>setHideEmpty(e.target.checked)}/><span className="preview-filter-label">隐藏空量行</span><span className="preview-filter-icon"><Icon name="filter"/></span></label>
          <button className={`btn btn-ghost btn-square ${searchOpen?'is-active':''}`} aria-label="查找表格" title="查找当前工作表" aria-expanded={searchOpen} onClick={()=>{setSearchOpen(!searchOpen);setQuery('');}}><Icon name="search"/></button>
          <button className="btn btn-ghost btn-square" aria-label="重算公式" title="重算公式与报告" onClick={recalculate} disabled={busy||!complete}><Icon name="refresh"/></button>
          <button className="btn btn-ghost btn-square" aria-label="预览列设置" title="设置显示列、表头与列宽" disabled={busy} onClick={openSettings}><Icon name="columns"/></button>
        </div>
      </div>

      {searchOpen&&<div className="preview-filterbar"><label className="preview-search"><Icon name="search"/><input autoFocus className="input" aria-label="查找表格" placeholder="查找当前工作表" value={query} onChange={e=>setQuery(e.target.value)}/><button className="btn btn-ghost btn-square" aria-label="收起表格查找" onClick={()=>{setQuery('');setSearchOpen(false);}}><Icon name="close"/></button></label><span>{matchingRows.size} 行符合条件{rows.length>matchingRows.size?' · 另显示定位行':''}</span></div>}
      {needsRecalculate&&<Note>存在人工修改，请重算公式并刷新报告后交付。</Note>}
      {storageError&&<Note>{storageError}</Note>}
      {!locatedVisible&&<Note>第 {selectedRow} 行不在当前预览或筛选范围内。可清除筛选，或下载完整 Excel 查看。</Note>}
      {hideEmpty&&isCorePreviewSheet(sheet)&&warningFilterColumnIndex(sheet.headers,'数量')<0&&<Note>当前表头未识别到数量列，已保留全部预览行。可在列设置中调整表头行。</Note>}
      <div ref={scroller} id={sheetPanelId} className="table-scroll" tabIndex={0} role="tabpanel" aria-labelledby={`${sheetPanelId}-tab-${activeSheetIndex}`} aria-label={`${sheet.sheet_name}，可横向滚动的计算表`} style={{'--preview-cell-max-chars':`${preferences.maxDisplayChars}ch`} as CSSProperties}>
        <table className="table"><caption className="sr-only">{sheet.sheet_name}，预览表头后 {sheet.rows.length} 行；双击或键盘 Enter 编辑普通单元格。</caption><thead><tr><th className="row-number" scope="col">行</th>{columns.map(column=><th key={column.index} scope="col" className="preview-data-header" style={{'--preview-column-width':`${width(column)}px`} as CSSProperties}><span title={column.label}>{column.label}</span><span role="separator" aria-orientation="vertical" aria-label={`调整 ${column.label} 列宽`} aria-valuenow={width(column)} aria-valuemin={72} aria-valuemax={420} tabIndex={0} className="preview-column-resize-handle" onPointerDown={e=>startResize(e,column)} onKeyDown={e=>{const change=e.key==='ArrowRight'?(e.shiftKey?24:8):e.key==='ArrowLeft'?-(e.shiftKey?24:8):0;if(change||e.key==='Home'||e.key==='End'){e.preventDefault();resize(column,e.key==='Home'?72:e.key==='End'?420:width(column)+change);savePreferences(latestPreferences.current);}}}/></th>)}<th scope="col" className="action-th">填价</th></tr></thead>
        <tbody>{rows.map(({row,sourceIndex})=>{const excelRow=previewExcelRowNumber(sheet,sourceIndex);return <tr key={excelRow} className={`${selectedRow===excelRow?'preview-row-focused ':''}${isTotalSummaryRow(row)?'preview-total-row':''}`} data-preview-row={excelRow} data-preview-sheet={sheet.sheet_name}><th scope="row" className="row-number">{excelRow}</th>{columns.map(column=>{
          const value=row[column.index];const text=previewCellText(value);const canEdit=complete&&!busy&&isEditablePreviewColumn(column);const warning=warningCellState(available,row);
          const selected={sheet:sheet.sheet_name,row:excelRow,column:column.index+1,header:column.label,value:value??null};
          const located=target?.row===excelRow&&target.column===column.index+1;
          return <td key={column.index} data-preview-column={column.index+1} data-risk-severity={located?target.severity:undefined} tabIndex={located?-1:undefined} aria-label={located?`${column.label}，第 ${excelRow} 行，${text}，风险待复核`:undefined} className={`${previewCellClass(column,row,available)||''} ${typeof value==='number'?'preview-numeric-cell':''} ${located?'preview-cell-located':''}`} style={{'--preview-column-width':`${width(column)}px`} as CSSProperties} title={previewCellTitle(column,row,available)}>{canEdit?<button className="preview-cell-content preview-cell-edit" aria-label={`编辑第 ${excelRow} 行 ${column.label}`} title={`${text}\n双击或按 Enter 编辑`} onDoubleClick={()=>edit(selected)} onClick={e=>{if(e.detail===0)edit(selected);}}>{text||<span className="empty-cell">—</span>}</button>:<span className="preview-cell-content">{column.kind==='warning'&&text&&<Icon name={warning==='ok'?'check':'alert'}/>}<span>{text||<span className="empty-cell">—</span>}</span></span>}</td>;
        })}<td className="row-ai-cell">{assist&&canPriceRow(sheet.headers,row,excelRow,sheet.header_row,isTotalSummaryRow(row))&&<div className="row-ai-actions"><button className="btn btn-ghost" aria-label={`第 ${excelRow} 行 AI 填价`} title="AI 填价：推荐价格、模型分析与详细依据" disabled={busy||!complete} onClick={()=>assist({sheet:sheet.sheet_name,row:excelRow,column:0,header:'',value:null})}><Icon name="spark"/></button></div>}</td></tr>;})}</tbody></table>
        {!rows.length&&<div className="empty-state"><Icon name="search"/><p>当前筛选没有记录</p><Button onClick={()=>{setQuery('');setHideEmpty(false);}}>显示全部预览行</Button></div>}
      </div>
    </div>
    <div className="preview-downloads"><p title={`当前显示 ${rows.length} 行 · ${columns.length} 列；双击或按 Enter 编辑，拖动表头边缘调宽。完整记录保留在下载的 Excel 中。`}><span>前 {sheet.rows.length} 行预览</span><small>{complete?`${result.summary.total_data_rows} 条 · ${result.summary.review_rows+result.summary.conflict_rows} 待复核`:'等待匹配'}</small></p><div>{complete?<><a className="btn btn-primary" href={exportUrl(result.downloads.excel||`/api/download/${result.job_id}/excel`,hideEmpty)}><Icon name="download"/>Excel</a>{result.downloads.report&&<a className="btn btn-outline" href={result.downloads.report}><Icon name="file"/>Word</a>}</>:<Button disabled icon="download">匹配后下载</Button>}</div></div>
    {settings&&<Modal title="预览列设置" close={()=>{if(!busy)setSettings(null);}}><div className="preview-settings"><p className="panel-lead">{sheet.sheet_name} · 只调整预览，不改变 Excel 结构。</p><div className="preview-settings-fields"><label className="field">预览表头行<input className="input" type="number" min={1} max={1000} value={settings.headerRows[sheetKey]} disabled={busy} onChange={e=>setSettings({...settings,headerRows:{...settings.headerRows,[sheetKey]:Number(e.target.value)}})}/></label><label className="field">默认列宽字符数<input className="input" type="number" min={4} max={40} value={settings.maxDisplayChars} disabled={busy} onChange={e=>setSettings({...settings,maxDisplayChars:Number(e.target.value)})}/></label></div><div className="preview-settings-caption"><strong>显示列</strong><button className="text-button" disabled={busy} onClick={()=>setSettings({...settings,sheetOverrides:{...settings.sheetOverrides,[sheetKey]:available.map(c=>columnSelectionKey(c,available))}})}>全选</button></div><div className="preview-column-options">{available.map(column=><label key={column.index} className="check-line"><input type="checkbox" className="checkbox checkbox-sm" checked={settings.sheetOverrides[sheetKey]?.includes(columnSelectionKey(column,available))||false} disabled={busy} onChange={e=>setSettings({...settings,sheetOverrides:{...settings.sheetOverrides,[sheetKey]:e.target.checked?[...(settings.sheetOverrides[sheetKey]||[]),columnSelectionKey(column,available)]:(settings.sheetOverrides[sheetKey]||[]).filter(label=>label!==columnSelectionKey(column,available))}})}/><span>{column.label}{columnSelectionKey(column,available).startsWith('#')&&<small> · 第 {column.index+1} 列</small>}</span></label>)}</div>{settingsError&&<p className="edit-error" role="alert">{settingsError}</p>}<div className="action-row"><Button disabled={busy} onClick={()=>{const reset=normalizePreviewColumnPreferences(defaults);setSettings({...settings,maxDisplayChars:reset.maxDisplayChars,headerRows:{...settings.headerRows,[sheetKey]:reset.headerRows[sheetKey]||sheet.header_row},sheetOverrides:{...settings.sheetOverrides,[sheetKey]:buildPreviewColumns(sheet,result.summary.price_column,reset).map(c=>c.label)},columnWidths:{...settings.columnWidths,[sheetKey]:reset.columnWidths[sheetKey]||{}}});}}>恢复默认</Button><Button disabled={busy} onClick={()=>setSettings(null)}>取消</Button><Button primary disabled={busy} onClick={()=>void applySettings()}>应用设置</Button></div></div></Modal>}
  </div>;
}
