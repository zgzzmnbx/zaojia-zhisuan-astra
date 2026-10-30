import {LoadingLogo} from './brand/LoadingLogo';
import {lazy,Suspense,useEffect,useId,useRef,useState} from 'react';
import {api,json} from './api';
import {Button,Icon,Modal} from './ui';
import {PricingAnalysis} from './PricingAnalysis';
import {priceText,type RowCandidates,type PriceCandidate,type RowPricingState} from './row-pricing';
import {candidateAgreement,numericPrice,pricePosition,pricingConditions} from './pricing-visual';
import './pricing-visual.css';
const PricingFlow=lazy(()=>import('./PricingFlow'));


type Distribution={count:number;min?:number;max?:number;mean?:number;median?:number;bins:{min:number;max:number;count:number}[]};
type Details={rules:{items:PriceCandidate[];total:number;distribution:Distribution};experience:{items:{value:number;source_file:string;source_sheet:string;source_row:number;pool_row:number}[];total:number;match_detail:string;distribution:Distribution};trace:{kind:string;title:string;text?:string;source?:string;source_rows?:unknown[];summary?:string;detail?:string;rows?:unknown[]}[]};
type Props={data:RowCandidates;state:RowPricingState;active:boolean;blocked:boolean;close:()=>void;professional:()=>void;retry:()=>void;stop:()=>void};

export function PricingDetails(props:Props){
 // A fresh result gets fresh selection, request and explanation playback state.
 return <PricingDetailsView key={JSON.stringify(props.data.row_context)} {...props}/>;
}
function PricingDetailsView({data,state,active,blocked,close,professional,retry,stop}:Props){
 const coefficient=/系数/.test(data.row_context.target_header),unit=coefficient?'':`元/${String(data.context.row['单位']||'单位')}`;
 const conditions=pricingConditions(data.context.row),uid=useId();
 const [details,setDetails]=useState<Details>(),[error,setError]=useState(''),[requestVersion,setRequestVersion]=useState(0);
 const [selectedId,setSelectedId]=useState(''),[tab,setTab]=useState<'basis'|'analysis'>('analysis'),[expanded,setExpanded]=useState(false),[step,setStep]=useState(0);
 const [foreground,setForeground]=useState(()=>!document.hidden),[onscreen,setOnscreen]=useState(true);
 const playbackPath=useRef<HTMLElement>(null);
 const scroll=useRef<HTMLDivElement>(null),panel=useRef<HTMLElement>(null),expandButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const controller=new AbortController();setError('');setDetails(undefined);
  void api<Details>('/api/astra/row-assist/details',{...json({row_context:data.row_context,token:data.token}),signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setDetails(value);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return()=>controller.abort();
 },[data.token,requestVersion]);
 useEffect(()=>{
  const change=()=>setForeground(!document.hidden);document.addEventListener('visibilitychange',change);
  return()=>document.removeEventListener('visibilitychange',change);
 },[]);
 useEffect(()=>{
  if(!details||!playbackPath.current)return;
  const observer=new IntersectionObserver(([entry])=>setOnscreen(entry.isIntersecting));observer.observe(playbackPath.current);
  return()=>observer.disconnect();
 },[details]);
 useEffect(()=>{
  if(!details||step<0||expanded||!foreground||!onscreen)return;
  const timer=window.setTimeout(()=>setStep(value=>(value+1)%4),1100);
  return()=>clearTimeout(timer);
 },[details,step,expanded,foreground,onscreen]);
 const candidates=details?.rules.items||[];
 const selected=candidates.find(c=>c.id===selectedId)||candidates[0];
 const running=active&&['loading','analyzing'].includes(state.phase);
 function select(candidate:PriceCandidate){setSelectedId(candidate.id);setStep(-1);}
 function showBasis(){setTab('basis');panel.current?.focus({preventScroll:true});}
 function collapse(){setExpanded(false);expandButton.current?.focus({preventScroll:true});}
 const title=`${coefficient?'系数':'价格'}匹配依据`;
 const heading=<div className="pricing-map-heading"><div className="pricing-map-identity"><h2>{title} <span>第 {data.row_context.row_number} 行</span></h2><small title={data.row_context.sheet_name}>{data.row_context.sheet_name} · {data.row_context.target_header}{unit&&` · ${unit}`}</small></div><div className="pricing-map-conditions" aria-label="当前清单条件">{conditions.map(([key,value])=><span key={key} title={`${key}：${String(value)}`}><small>{key}</small>{String(value)}</span>)}</div><button className="btn btn-ghost btn-sm" disabled={!details} onClick={()=>setStep(step>=0?-1:0)}><Icon name={step>=0?'stop':'play'}/>{step>=0?'暂停说明':'播放匹配说明'}</button></div>;
 return <Modal title={`${title} · 第 ${data.row_context.row_number} 行`} heading={heading} close={close}><div className={`pricing-map${expanded?' report-expanded':''}`} onKeyDown={event=>{if(event.key==='Escape'&&expanded){event.preventDefault();event.stopPropagation();collapse();}}}>
  <div className="pricing-map-scroll" ref={scroll}>
   {error?<div className="pricing-map-empty" role="alert"><p>{error}</p><Button onClick={()=>setRequestVersion(v=>v+1)}>重新读取依据</Button></div>:!details?<div className="pricing-map-empty" role="status"><LoadingLogo/>正在读取具体样本与规则</div>:<>
    <section className="pricing-map-path" ref={playbackPath} aria-label="匹配路径">
     <div className="pricing-map-caption"><h3>这个{coefficient?'系数':'价格'}，从哪里来？</h3><small>规则匹配 → 候选比较 → 人工确认</small></div>
     <Suspense fallback={<div className="pricing-flow-loading" role="status">正在载入交互路径，下方仍可查看完整依据。</div>}><PricingFlow conditions={conditions} candidates={candidates} selected={selected} select={select} unit={unit} current={data.row_context.current_value} saved={state.phase==='saved'} savedValue={state.savedValue} step={step} showBasis={showBasis} returnToChat={close} experienceCount={details.experience.total} experienceMean={details.experience.distribution.count>0?details.experience.distribution.mean:undefined} visible={!expanded}/></Suspense>
     <div className="pricing-map-playback" role="status">{step>=0?['读取本行要素与计价单位。','按规则返回的要素一致程度比较候选。','查看所选候选来源、差异和经验样本。','由你核对条件，返回聊天确认填写。'][step]:'点击候选数值，查看与本行的关系。'}</div>
    </section>
    <div className="pricing-map-bottom">
     <section className="pricing-map-comparison" aria-label="逐项对照"><div className="pricing-map-caption"><h3>{expanded?'候选索引':'逐项对照'}</h3><small>{candidates.length} / {details.rules.total} 条候选</small></div>
      {expanded?<div className="pricing-map-index">{candidates.map(c=><button key={c.id} aria-pressed={selected?.id===c.id} onClick={()=>select(c)}><strong>{priceText(c.value)}</strong><SimilarityBadge value={c.similarity}/><small>{c.basis}</small></button>)}</div>:<><p className="pricing-map-hint">条件原文对照 · 相似度与一致数量以规则结果为准</p><div className="pricing-map-table"><table className="table"><thead><tr><th>{coefficient?'候选系数':`候选价格 ${unit}`}</th>{conditions.map(([key])=><th key={key}>{key}</th>)}<th>相似度</th><th>要素一致</th></tr></thead><tbody>{candidates.map(c=>{const count=candidateAgreement(c);return <tr key={c.id} className={selected?.id===c.id?'is-selected':''}><td><button aria-pressed={selected?.id===c.id} onClick={()=>select(c)} title={c.basis}>{priceText(c.value)}</button></td>{conditions.map(([key,value])=>{const other=c.candidate_key?.[key];const equal=other!=null&&String(value).trim()===String(other).trim();return <td key={key} title={`本行：${String(value)}；候选：${other==null?'未提供':String(other)}`}><span className={other==null?'':'pricing-map-raw '+(equal?'same':'different')}>{other==null?'—':`${equal?'●':'○'} ${String(other)}`}</span></td>;})}<td>{c.similarity==null?'—':<SimilarityBadge value={c.similarity}/>}</td><td>{count?`${count.matched}/${count.total}`:'按适用规则'}</td></tr>;})}</tbody></table>{!candidates.length&&<p className="pricing-map-empty">没有规则候选，经验样本仍可在下方查看。</p>}</div><PriceAxis candidates={candidates} selected={selected} select={select} unit={unit}/></>}
      <details className="pricing-map-samples"><summary>经验池样本 <span>{details.experience.total} 条</span></summary><p>{details.experience.match_detail||'当前匹配范围'} · 仅供复核参考</p><div className="pricing-map-table"><table className="table"><thead><tr><th>数值</th><th>来源文件 / 工作表</th><th>来源行 / 经验池行</th></tr></thead><tbody>{details.experience.items.map((s,i)=><tr key={`${s.pool_row}-${i}`}><td>{priceText(s.value)}</td><td>{s.source_file||'未记录来源文件'}<small>{s.source_sheet}</small></td><td>{s.source_row||'—'} / {s.pool_row||'—'}</td></tr>)}</tbody></table></div>{!details.experience.total&&<p>本行没有符合条件的经验样本。</p>}{details.experience.total>200&&<p>明细显示前 200 条。</p>}</details>
      <details className="pricing-map-samples"><summary>数值分布与当前行匹配记录</summary><div className="pricing-map-stats"><DistributionSummary label="规则 / 计价库" data={details.rules.distribution}/><DistributionSummary label="经验池" data={details.experience.distribution}/></div>{details.trace.map((t,i)=><article key={i}><strong>{t.title}</strong><p>{t.text||t.summary||t.detail||''}</p>{t.source&&<small>{t.source}</small>}{(t.source_rows||t.rows)?.map((r,j)=><pre key={j}>{typeof r==='string'?r:JSON.stringify(r,null,2)}</pre>)}</article>)}{!details.trace.length&&<p>暂无当前行匹配记录。</p>}</details>
     </section>
     <aside className="pricing-map-report" ref={panel} tabIndex={-1} aria-label="候选依据与分析报告"><div className="pricing-map-report-heading"><div role="tablist" aria-label="依据与分析">{(['basis','analysis'] as const).map(value=><button role="tab" id={`${uid}-${value}`} aria-controls={`${uid}-panel`} aria-selected={tab===value} tabIndex={tab===value?0:-1} key={value} onClick={()=>setTab(value)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'basis':e.key==='End'?'analysis':value==='basis'?'analysis':'basis';setTab(next);document.getElementById(`${uid}-${next}`)?.focus();}}}>{value==='basis'?'匹配依据':'AI 分析'}</button>)}</div><button className="btn btn-ghost btn-sm" ref={expandButton} aria-expanded={expanded} onClick={()=>{if(expanded)collapse();else{setExpanded(true);scroll.current?.scrollTo({top:0});}}}>{expanded?'收起报告':'展开报告'}<Icon name={expanded?'chevron':'arrow-up-right'}/></button></div>
      <section role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${tab}`} className="pricing-map-report-body">
       {tab==='basis'?selected?<><div className="pricing-map-report-summary"><small>所选候选 · {selected.source_label}</small><strong>{priceText(selected.value)} <small>{unit}</small></strong><p>{selected.reason}</p></div><h4>来源与适用依据</h4><p>{selected.basis}</p>{selected.risk_tips?.length?<><h4>采用前核对</h4><ul>{selected.risk_tips.map((tip,i)=><li key={i}>{tip}</li>)}</ul></>:<p>请结合本行条件核对适用范围。</p>}<small>切换候选只更新依据，不会改写已有模型报告。</small></>:<p>暂无选中候选。</p>:<><div className="pricing-map-caption"><small>第 {data.row_context.row_number} 行 · {data.row_context.target_header}</small><span className="badge badge-ghost">{running?'分析中':state.generated?'模型分析':'本地依据'}</span></div>{running?<p role="status" className="pricing-map-empty"><LoadingLogo/>正在结合当前行与候选分析</p>:state.answer?<div className="pricing-map-answer"><PricingAnalysis text={state.answer}/></div>:<p className="pricing-map-empty">{state.phase==='stopped'?'分析已停止。':'暂无分析报告。'}</p>}{state.error&&<p role="alert" className="pricing-error">{state.error}</p>}<div className="pricing-map-report-actions"><small>{state.generated?'模型建议，需人工核对':'未生成模型答案'}{!active?' · 历史快照':''}</small>{running?<Button onClick={stop}>停止分析</Button>:<Button icon="refresh" disabled={blocked} onClick={retry}>重新分析</Button>}</div></>}
      </section>
     </aside>
    </div>
   </>}
  </div>
  <footer className="pricing-map-footer"><small>相似度不代表命中概率{details&&details.rules.total>200?' · 展示前 200 条，分布统计全部有效数值':''}。</small><div><Button icon="spark" onClick={professional}>专业逐字段分析</Button><Button onClick={close}>返回聊天</Button></div></footer>
 </div></Modal>;
}
function DistributionSummary({label,data}:{label:string;data:Distribution}){return <section><strong>{label} · {data.count} 条</strong>{data.count?<dl>{[['最低',data.min],['中位',data.median],['均值',data.mean],['最高',data.max]].map(([name,value])=><div key={String(name)}><dt>{name}</dt><dd>{priceText(value)}</dd></div>)}</dl>:<p>没有有效数值</p>}</section>;}
function PriceAxis({candidates,selected,select,unit}:{candidates:PriceCandidate[];selected?:PriceCandidate;select:(candidate:PriceCandidate)=>void;unit:string}){
 const points=candidates.flatMap(c=>{const value=numericPrice(c.value);return value==null?[]:[{candidate:c,value}];});
 if(!points.length)return null;
 const values=points.map(p=>p.value),min=Math.min(...values),max=Math.max(...values),sameValue=new Map<number,number>();
 const plotted=points.map(p=>{const lane=sameValue.get(p.value)||0;sameValue.set(p.value,lane+1);return {...p,lane};});
 const selectedValue=numericPrice(selected?.value);
 return <div className="pricing-map-axis"><div className="pricing-map-caption"><strong>候选数值位置</strong><small>{unit}</small></div><div className="pricing-map-track" style={{height:`${50+Math.max(...plotted.map(p=>p.lane))*20}px`}}>{selectedValue!=null&&<b style={{left:`${pricePosition(selectedValue,min,max)}%`}}>{priceText(selectedValue)}</b>}{plotted.map(({candidate,value,lane})=><button key={candidate.id} style={{left:`${pricePosition(value,min,max)}%`,top:`${30+lane*20}px`}} aria-label={`${priceText(value)}，${candidate.basis}`} aria-pressed={candidate.id===selected?.id} title={`${priceText(value)} ${unit} · ${candidate.basis}`} onClick={()=>select(candidate)}/> )}</div><div className="pricing-map-axis-labels"><span>{priceText(min)}</span><span>{priceText(max)}</span></div></div>;
}
export function SimilarityBadge({value}:{value?:number}){return value==null?null:<span className={`badge pricing-similarity${value===100?' is-exact':''}`} title={value===100?'要素相似度100%，不代表价格已确认':'要素相似度，不代表命中概率'}>{value}%</span>;}
