import {useEffect,useRef,useState,useId} from 'react';
import {Icon} from '../../studio/ui';
import type {ExampleProps,ExampleTab} from './disabled';
import {cellText,cellValue,columnWidth,findEvidence,locateObservation,type ExampleCell,type ExampleData,type ExampleSheet,type Observation} from './model';
import './example.css';
import {SheetTabs} from '../../studio/table/SheetTabs';
const loaders={table:'加载附件表格节选',risks:'加载样表观察与演示风险',report:'排版演示文字报告'};

export default function UploadedExample({request,active,onTabChange,sourceDetails=false}:ExampleProps){
 const [data,setData]=useState<ExampleData|null>(null),[tab,setTab]=useState<ExampleTab>('table'),[phase,setPhase]=useState<'loading'|'ready'|'empty'|'error'>('loading'),[error,setError]=useState('');
 const [sheetIndex,setSheetIndex]=useState(0),[reference,setReference]=useState(false),[location,setLocation]=useState<{row:number;refs:string[]}|null>(null),[selectedCell,setSelectedCell]=useState<ExampleCell|null>(null),[synthetic,setSynthetic]=useState(false),[marked,setMarked]=useState(false);
 const sheetPanelId=useId();
 const tableRef=useRef<HTMLDivElement>(null),pendingLocation=useRef(false),loaded=useRef<ExampleData|null>(null);
 useEffect(()=>{
  if(!request)return;let cancelled=false;let timer:ReturnType<typeof setTimeout>|undefined;
  setTab(request.tab);setPhase('loading');setError('');
  // Display a short, explicitly frontend-only loading state. No workbook
  // formulas, audit service or model is executed by this demo.
  import('./sample-provider').then(module=>module.loadExampleData()).then(next=>{if(cancelled)return;if(!next?.sheets.length){setData(null);setPhase('empty');return;}
   timer=setTimeout(()=>{if(cancelled)return;if(!loaded.current)setSheetIndex(Math.max(0,next.sheets.findIndex(s=>s.name===next.primarySheet)));loaded.current=next;setData(next);setPhase('ready');},380);
  }).catch(reason=>{if(!cancelled){setError(reason instanceof Error?reason.message:'附件节选载入失败');setPhase('error')}});
  return()=>{cancelled=true;if(timer)clearTimeout(timer)};
 },[request?.id]);
 useEffect(()=>{if(request)setTab(request.tab)},[request?.tab]);
 const sheet=data?.sheets[sheetIndex];
 useEffect(()=>{
  if(!active||tab!=='table'||phase!=='ready'||!location||!pendingLocation.current)return;
  const node=tableRef.current?.querySelector<HTMLElement>(`[data-cell="${location.refs[0]}"]`);if(node){node.scrollIntoView({block:'center',inline:'center',behavior:'auto'});node.focus({preventScroll:true});pendingLocation.current=false;}
 },[active,tab,phase,location,sheetIndex,reference]);
 function navigate(next:ExampleTab){setTab(next);onTabChange?.(next)}
 function locate(item:Observation){if(!data)return;const target=locateObservation(data,item);setSheetIndex(target.sheetIndex);setReference(target.reference);setLocation({row:target.row,refs:target.refs});setSelectedCell(null);pendingLocation.current=true;navigate('table')}
 return <div className="uploaded-example" aria-busy={phase==='loading'}>
  <div id="example-source-note" className="example-source-note" hidden={!sourceDetails}><strong>{data?'已加载资料 · 只读展示':'数据边界'}</strong><p>{data?`${data.source.fileName} · ${data.sheets.length} 张可见表 · ${data.sheets.reduce((total,sheet)=>total+sheet.businessRowCount,0)} 条业务明细`:'此交接分支不包含用户上传的附件或派生数据'}。演示非正式审核。</p></div>
  <div className="example-content">
   {phase==='loading'&&<div className="example-loading" role="status"><span className="loading loading-spinner loading-md"/><strong>{loaders[request?.tab||tab]}</strong><progress className="progress progress-primary example-progress"/><p>本地附件节选的界面演示，未运行审核或计价。</p></div>}
   {phase==='empty'&&<ExampleUnavailable/>}
   {phase==='error'&&<div className="example-scroll" role="alert"><h3>暂时无法载入附件节选</h3><p>{error}</p><p>请在设置 → 表格演示中点击“加载表格”重试。</p></div>}
   {data&&sheet&&<>
    <section className="example-panel" id="example-panel-table" role="tabpanel" aria-labelledby="example-tab-table" hidden={tab!=='table'} aria-label="上传表格内容">
     <div className="example-sheetbar"><SheetTabs names={data.sheets.map(s=>s.name)} index={sheetIndex} panelId={sheetPanelId} onChange={index=>{setSheetIndex(index);setReference(false);setLocation(null);setSelectedCell(null);tableRef.current?.scrollTo({left:0,top:0});}}/><small>{sheet.businessRowCount?`${sheet.businessRowCount} 条明细`:'汇总快照'}</small>{sheet.referenceColumns&&<button className="btn btn-ghost btn-sm" aria-pressed={reference} onClick={()=>setReference(!reference)}>{reference?'收起参考列':'展开样表参考列'}</button>}</div>
     {location&&<div className="example-location" role="status"><span>已定位原第 {location.row} 行 · {location.refs.join('、')}</span><button className="btn btn-ghost btn-sm" onClick={()=>navigate('risks')}>返回风险</button></div>}
     <div className="example-table-scroll" id={sheetPanelId} role="tabpanel" aria-labelledby={`${sheetPanelId}-tab-${sheetIndex}`} ref={tableRef} tabIndex={0} aria-label="可横向和纵向滚动的原表节选">
      <ExampleGrid sheet={sheet} reference={reference} location={location} select={setSelectedCell}/>
     </div>
     <div className="example-table-foot">{selectedCell?<><strong>{selectedCell.ref}</strong> · {cellText(selectedCell)}{selectedCell.formula&&<span> · 原公式：{selectedCell.formula}（仅展示，未执行）</span>}{selectedCell.mergedFrom&&<span> · 显示内容继承自合并格 {selectedCell.mergedFrom}</span>}</>:<>横向滚动查看各列；点击单元格查看原坐标和公式。<br/>“—”为空白，0 保留为 0；ƒ 为文件保存的公式结果，未重算。金额列按元或万元标注。</>}</div>
    </section>
    <section className="example-panel" id="example-panel-risk" role="tabpanel" aria-labelledby="example-tab-risk" hidden={tab!=='risks'} aria-label="演示风险与样表观察"><div className="example-scroll">
     <div className="example-caution"><strong>{data.observations.length} 条资料观察，供人工复核</strong><p>依据这份文件的单元格与保存结果整理。未核验外部标准，不能据此认定报价错误，也不是正式审核。</p></div>
     {data.observations.map((item,i)=><article className="example-risk" key={item.id}><header><span className="badge badge-outline example-badge">{item.status}</span><small>原表可观察 · 0{i+1}</small></header><h4>{item.label}</h4><p>{item.description}</p><details><summary>查看原单元格依据</summary><ul>{findEvidence(data,item).map(({ref,cell})=><li key={ref}><strong>{ref}</strong>：{cell?cellText(cell):'此格不在发布节选中'}{cell?.formula?'（保存的公式结果）':''}</li>)}</ul></details><footer><small>{item.sheet} · 原第 {item.rows.join('、')} 行</small><button className="btn btn-outline btn-sm" onClick={()=>locate(item)}><Icon name="sheet"/>定位原表</button></footer></article>)}
     <article className="example-risk"><header><span className="badge badge-ghost example-badge">合成演示 · 非原表结论</span></header><h4>体验风险待办的交互</h4><p>单独展示前端卡片和待办状态，不修改任何源数据或复核结论。</p><button className="btn btn-outline btn-sm" aria-expanded={synthetic} onClick={()=>setSynthetic(!synthetic)}>{synthetic?'收起合成风险卡':'显示一条合成风险卡'}</button>{synthetic&&<div className="example-caution" style={{marginTop:12}}><strong>【合成】待补充现场条件说明</strong><p>为演示定位和标记操作，可关联当前首条观察；这不表示该行真实缺少材料。</p><div className="action-row">{data.observations[0]&&<button className="btn btn-ghost btn-sm" onClick={()=>locate(data.observations[0])}>定位演示关联行</button>}<button className="btn btn-outline btn-sm" aria-pressed={marked} onClick={()=>setMarked(!marked)}>{marked?'已标记待办（仅本次界面）':'标记待办'}</button></div></div>}</article>
     <button className="btn btn-primary" onClick={()=>navigate('report')}><Icon name="file"/>查看排版报告</button>
    </div></section>
    <section className="example-panel" id="example-panel-report" role="tabpanel" aria-labelledby="example-tab-report" hidden={tab!=='report'} aria-label="演示文字报告"><div className="example-scroll example-report-wrap"><ExampleReport data={data} locate={locate}/></div></section>
   </>}
  </div>
 </div>;
}

export function ExampleGrid({sheet,reference,location,select}:{sheet:ExampleSheet;reference:boolean;location:{row:number;refs:string[]}|null;select:(cell:ExampleCell)=>void}){
 const columns=[...sheet.columns,...(reference?sheet.referenceColumns||[]:[])];
 return <table className="example-grid"><caption>{sheet.name} · {sheet.sourceRange} 可见节选{reference?' + 样表自带参考值（未验证）':''}</caption><colgroup><col style={{width:54}}/>{columns.map(c=><col key={c.letter} style={{width:columnWidth(c)}}/>)}</colgroup><thead><tr><th className="example-row-number" scope="col">原行</th>{columns.map(c=><th key={c.letter} scope="col" style={{width:columnWidth(c)}}><small>{c.letter}{c.unit?` · ${c.unit}`:''}</small>{c.label}</th>)}</tr></thead><tbody>{sheet.rows.map(row=>{const cells=[...row.cells,...(reference?sheet.referenceRows?.find(r=>r.row===row.row)?.cells||[]:[])];return <tr key={row.row} className={`${location?.row===row.row?'is-located':''} ${row.kind!=='business'?'is-total':''}`}><th scope="row" className="example-row-number">{row.row}</th>{columns.map(column=>{const cell=cells.find(c=>c.ref===column.letter+row.row)||{ref:column.letter+row.row,value:null,kind:'blank'};const value=cellValue(cell);return <td key={column.letter} data-cell={cell.ref} tabIndex={0} className={`${typeof value==='number'?'is-number':''} ${value===null?'is-empty':''} ${location?.refs.includes(cell.ref)?'is-evidence':''}`} onClick={()=>select(cell)} onFocus={()=>select(cell)} title={`${cell.ref} · ${cellText(cell)}${cell.formula?' · 原公式 '+cell.formula+'（未执行）':''}`} style={{maxWidth:columnWidth(column)}}>{cellText(cell)}{cell.formula&&<sup className="formula-indicator" aria-label="保存的公式结果">ƒ</sup>}{cell.mergedFrom&&<small>合并自 {cell.mergedFrom}</small>}</td>})}</tr>})}</tbody></table>;
}

export function ExampleUnavailable(){return <div className="example-scroll empty-state" role="status"><Icon name="sheet"/><h3>演示表格未随代码交接</h3><p>保留表格、风险和报告展示组件，不包含私有附件、业务行或派生审核内容。</p><p>验证实际业务时，请在正式模式中上传已获授权的资料；当前没有加载数据。</p></div>;}

export function ExampleReport({data,locate}:{data:ExampleData;locate:(item:Observation)=>void}){
 const rows=data.sheets.reduce((total,sheet)=>total+sheet.businessRowCount,0);
 return <article className="example-report"><header><small>ASTRA / WORKBOOK REVIEW DEMO</small><h1>资料观察报告</h1><span className="badge badge-warning example-badge">演示报告 · 非正式审核结论</span><p className="report-subtitle">依据已加载资料的只读片段 · 无规则引擎或模型分析</p></header>
  <h2>一、资料范围</h2><p>本次展示 {data.sheets.length} 张可见工作表、{rows} 条业务明细。保留资料中的工作表名、行号、列号、单位与保存值。</p><dl><div><dt>可见工作表</dt><dd>{data.sheets.length}</dd></div><div><dt>公式保存结果</dt><dd>{data.cache.formulaCount} <small>项（未重算）</small></dd></div></dl>
  <h2>二、资料观察</h2>{data.observations.length?data.observations.map((item,i)=><section key={item.id}><h3>{i+1}. {item.label}</h3><p>{item.description}</p><button className="btn btn-ghost btn-sm" onClick={()=>locate(item)}>查看 {item.refs.join(' / ')} 的原表位置</button></section>):<p>没有已加载的观察记录；不自动生成审计结论。</p>}
  <h2>三、缓存说明</h2><p>{data.cache.notice}</p><p>本界面没有执行公式，也没有验证外部标准、工程条件或计算口径。</p>
  <h2>四、后续复核</h2><p>在获准的正式业务流程中核对资料来源、输入完整性与适用条件；按原引擎重算并校验输出。当前展示不形成审定价格、风险评级或正式 Word 成果。</p>
  <footer>来源：{data.source.fileName}<br/>只读展示 · 未向外部服务发送数据</footer>
 </article>;
}
