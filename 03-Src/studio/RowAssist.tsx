import {useEffect,useRef,useState} from 'react';
import {api,json} from './api';
import {Icon} from './ui';
import {Prose} from './Prose';
import {PricingDetails,SimilarityBadge} from './PricingDetails';
import type {Result} from './types';
import {pricingAnalysisSections,priceText,topPrices,type RowContext,type RowCandidates,type RowPricingState,type PriceCandidate} from './row-pricing';
import './row-pricing.css';
export type {RowContext,RowCandidates} from './row-pricing';
const question='请辅助当前行 target_header 指定的字段（基价/单价或实物/技术工作费调整系数）。只分析当前目标字段，不把价格当作系数。依据给定的 candidate_recommendations 原始排序，解释前三个不同数值各自的要素一致程度、来源、样本支持、冲突和适用限制，给出首选及备选建议。相似度不是命中概率；没有三个可信数值时按实际数量，不得编造数值或样本。清楚区分计价库规则依据、经验均值和模型推断。只提供分析，由用户点击候选按钮确认写入，仅修改目标字段。输出要求：正文尽量控制在240字以内，保留系统要求的Markdown二级标题。结论只用一句话给首选数值、单位和最关键理由；依据与解释最多两条短句，说明备选数值的关键差异，不重复卡片已有的要素数量与来源行号；适用条件与复核只用一句话说明影响采用的冲突或缺项，重要风险不能为凑字数省略；使用边界仅一句。只在确实引用项目记忆时输出该节。不要复述问题、讲工作流程、列长表、重复推荐或输出candidate id、knowledge_similar等内部英文标识。';

export function RowAssist({state,job,context,active,blocked,headers,change,saved,retry,working,professional}:{state:RowPricingState;job:string;context:string;active:boolean;blocked:boolean;headers:Record<string,number>;change:(state:RowPricingState)=>void;saved:(result:Result)=>void;retry:()=>void;working:(label:string)=>void;professional:(row:RowContext)=>void}){
 const [details,setDetails]=useState(false),[saving,setSaving]=useState('');
 const request=useRef<AbortController|null>(null),current=useRef(state),live=useRef(true),allowed=useRef(active),savingRef=useRef(false);
 current.current=state;allowed.current=active;
 const callbacks=useRef({change,saved,working});callbacks.current={change,saved,working};
 const publish=(patch:Partial<RowPricingState>)=>{if(!live.current)return;const next={...current.current,...patch};current.current=next;callbacks.current.change(next);};
 useEffect(()=>{live.current=true;return()=>{live.current=false;request.current?.abort();};},[]);
 useEffect(()=>{if(!active){request.current?.abort();return;}if(state.phase!=='loading')return;
  const controller=new AbortController();request.current=controller;
  void (async()=>{try{
   const data=await api<RowCandidates>('/api/astra/row-assist/candidates',{...json({job_id:job,conversation_id:state.conversation,context,sheet_name:state.cell.sheet,row_number:state.cell.row,target_header:state.cell.header}),signal:controller.signal});
   if(controller.signal.aborted||!live.current||!allowed.current)return;
   publish({data,phase:'analyzing',error:''});
   const answer=await api<{answer:string;generated_by_model?:boolean;answer_mode?:string}>('/api/astra/row-assist/ask',{...json({row_context:data.row_context,token:data.token,question}),signal:controller.signal});
   if(!controller.signal.aborted&&live.current&&allowed.current)publish({phase:'ready',answer:answer.answer,generated:answer.generated_by_model===true||answer.answer_mode==='model_answer'||answer.answer_mode==='general_model_fallback'});
  }catch(e){if(!controller.signal.aborted&&live.current&&allowed.current)publish({phase:'error',error:(e as Error).message});}})();
  return()=>controller.abort();
 },[active,state.cell.header]);
 function stop(){request.current?.abort();publish({phase:'stopped'});}
 async function confirm(candidate:PriceCandidate){
  const data=current.current.data;if(!data||!allowed.current||savingRef.current||blocked||current.current.phase==='saved')return;
  savingRef.current=true;request.current?.abort();setSaving(candidate.id);callbacks.current.working('正在填写已确认价格');publish({phase:current.current.phase==='analyzing'?'stopped':current.current.phase,error:''});
  try{const reply=await api<Result>('/api/astra/row-assist/confirm',json({row_context:data.row_context,token:data.token,candidate_id:candidate.id,note:`用户确认 AI 辅助填写候选：${candidate.source_label}；${candidate.reason}；${candidate.basis}`,header_rows:headers}));
   if(live.current&&allowed.current){publish({phase:'saved',savedValue:candidate.value});callbacks.current.saved(reply);}
  }catch(e){if(live.current&&allowed.current)publish({phase:'error',error:(e as Error).message});}
  finally{savingRef.current=false;if(live.current)setSaving('');callbacks.current.working('');}
 }
 const data=state.data,coefficient=/系数/.test(state.cell.header),unit=coefficient?'':String(data?.context.row['单位']||''),running=active&&['loading','analyzing'].includes(state.phase),prices=topPrices(data?.candidates||[]);
 return <section className="card row-pricing-card" aria-label={`第 ${state.cell.row} 行 AI 填价`}>
  <header className="pricing-heading"><span className="pricing-symbol"><Icon name="spark"/></span><div><strong>AI 填价 <small>第 {state.cell.row} 行</small></strong><span title={state.cell.sheet}>{state.cell.sheet}</span></div>{data&&<button className="btn btn-ghost btn-sm" onClick={()=>setDetails(true)}><Icon name="chart"/>详细</button>}</header>
  <nav className="pricing-field-tabs" aria-label="辅助填写字段">{[['','基价 / 单价'],['实物工作费调整系数','实物系数'],['技术工作费调整系数','技术系数']].map(([field,label])=><button key={field} className={`btn btn-sm ${state.cell.header===field?'btn-primary':'btn-ghost'}`} aria-pressed={state.cell.header===field} disabled={!active||blocked||!!saving} onClick={()=>{if(state.cell.header===field)return;request.current?.abort();publish({cell:{...state.cell,header:field},data:undefined,answer:undefined,generated:false,error:'',phase:'loading'});}}>{label}</button>)}</nav>
  {data&&<div className="pricing-context"><span>{Object.entries(data.context.row).filter(([k,v])=>k.startsWith('要素')&&v).map(([,v])=>String(v)).join(' · ')||'当前计价行'}</span><small>当前 {data.row_context.target_header} <b>{priceText(data.row_context.current_value)}</b>{unit&&` 元/${unit}`}</small></div>}
  {state.phase==='loading'&&active?<div className="pricing-loading" role="status"><span className="loading loading-spinner loading-sm"/>正在检索当前字段的规则与经验池</div>:data&&<><div className="pricing-caption"><span>{coefficient?'建议系数':'建议价格'}</span><small>按规则、要素与来源排序 · {prices.length} 项</small></div><ol className="pricing-shortlist">{prices.map((candidate,index)=><li key={candidate.id} className={index===0?'is-first':''}>
   <span className="pricing-rank">{String(index+1).padStart(2,'0')}</span><div className="pricing-candidate"><div className="pricing-price"><strong>{priceText(candidate.value)}</strong>{!coefficient&&<small>元{unit&&`/${unit}`}</small>}<span className="badge badge-ghost">{candidate.source==='experience_pool'?'经验池':candidate.source_label==='匹配规则'?'规则库':'计价库'}</span></div><p className="pricing-reason"><SimilarityBadge value={candidate.similarity}/><span>{candidate.reason}</span></p><div className="pricing-candidate-actions">{!!candidate.risk_tips?.length&&<details className="pricing-caution"><summary>适用条件与差异</summary>{candidate.risk_tips.map(t=><p key={t}>{t}</p>)}</details>}<button type="button" className={`btn btn-sm ${index===0?'btn-primary':'btn-outline'}`} disabled={!active||blocked||!!saving||state.phase==='saved'} onClick={()=>void confirm(candidate)}><Icon name={state.phase==='saved'&&state.savedValue===candidate.value?'check':'edit'}/>{saving===candidate.id?'正在填写':state.phase==='saved'&&state.savedValue===candidate.value?'已填写':coefficient?'填写此系数':'填写此价格'}</button></div></div>
  </li>)}</ol>{!prices.length&&<p className="pricing-empty">未找到当前字段的可信候选。可查看详细依据或进入逐字段分析。</p>}</>}
  {data&&<div className="pricing-analysis"><div className="pricing-caption"><span><Icon name="spark"/>{state.generated?'模型分析':'辅助分析'}</span>{running&&<button className="text-button" onClick={stop}>停止</button>}</div>{running?<p className="pricing-loading" role="status"><span className="loading loading-dots loading-sm"/>大模型正在核对候选依据…</p>:state.answer?<><span className="pricing-model-label">{state.generated?'模型已返回 · 请核对后采用':'本地依据 · 未生成模型答案'}</span><PricingAnalysis text={state.answer}/></>:<p className="muted">{state.phase==='saved'?'已确认数值，请重算公式与报告。':'分析已停止，可重新分析。'}</p>}</div>}
  {state.error&&<p className="pricing-error" role="alert">{state.error}</p>}
  <footer className="pricing-footer"><span>{state.phase==='saved'?`已填写 ${priceText(state.savedValue)} · 仅修改当前字段`:!active?'历史快照 · 重新分析后可填写':'确认后只填写本行当前字段'}</span>{!running&&<button className="text-button" disabled={blocked||!!saving} onClick={retry}><Icon name="refresh"/>重新分析</button>}</footer>
  {details&&data&&<PricingDetails data={data} close={()=>setDetails(false)} professional={()=>{setDetails(false);professional(data.row_context);}}/>}
 </section>;
}

function PricingAnalysis({text}:{text:string}){
 const parts=pricingAnalysisSections(text),hasHeadings=parts.some(p=>p.title);
 const preface=hasHeadings&&parts[0]?.title===''&&parts[0].body.startsWith('**结构化排序首选：')?parts[0]:undefined;
 const labels:Record<string,{label:string;icon:string}>={结论:{label:'首选建议',icon:'spark'},依据与解释:{label:'备选与依据',icon:'book'},适用条件与复核:{label:'采用前核对',icon:'shield'},项目记忆:{label:'项目经验',icon:'database'}};
 return <div className="pricing-analysis-sections">{parts.filter(p=>p!==preface).map((part,i)=>part.title==='使用边界'?<div className="pricing-analysis-boundary" key={i}><Icon name="info"/><Prose text={part.body}/></div>:<section className="pricing-analysis-section" key={i}><h4><Icon name={labels[part.title]?.icon||'book'}/>{labels[part.title]?.label||part.title||'分析说明'}</h4><Prose text={part.body}/></section>)}{preface&&<details className="pricing-analysis-source"><summary>规则排序说明</summary><Prose text={preface.body}/></details>}</div>;
}
