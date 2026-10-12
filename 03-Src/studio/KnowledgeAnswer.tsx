import type {Evidence} from './KnowledgeWorkspace';
import type {ReactNode} from 'react';
import {BookOpen,Brain,FileCheck2,Network} from '../PhosphorIcons';
import {Prose,normalizeAnswerTables} from './Prose';
import './composer-knowledge.css';

export function KnowledgeAnswer({evidence,text,label,actions,sources}:{evidence:Evidence;text:string;label?:string;actions?:ReactNode;sources?:ReactNode}){
 const preset=evidence.answer_mode==='curated_demo';
 const AnswerIcon=preset?FileCheck2:evidence.answer_mode==='weknora'?Network:['evidence_only','evidence_fallback'].includes(evidence.answer_mode)?BookOpen:Brain;
 const chart=evidence.chart,maximum=chart?Math.max(...chart.items.map(item=>item.value),1):1;
 const chartWidth=chart?Math.max(680,chart.items.length*50+66):680;
 return <section className="card chat-knowledge-answer" aria-label="知识库回答"><header className="knowledge-answer-heading"><span className="knowledge-answer-symbol" aria-hidden="true"><AnswerIcon size={19}/></span><strong>{label||'知识库回答'}</strong></header><div className="knowledge-answer-body">{preset&&<span className="knowledge-preset-label"><i className="knowledge-preset-dot" aria-hidden="true"/>预设答案 · 非模型生成</span>}<Prose text={normalizeAnswerTables(text)}/>{chart&&chart.type==='bar'&&<figure className="chat-knowledge-chart" aria-label={chart.title}><figcaption><strong>{chart.title}</strong><span>{chart.y_axis_label}</span></figcaption><div className="chat-knowledge-chart-scroll"><svg role="img" aria-label={`${chart.title}，共${chart.items.length}个管径`} width={chartWidth} height={300} style={{width:chartWidth,height:300}} viewBox={`0 0 ${chartWidth} 300`}>
  {[0,.25,.5,.75,1].map(r=><g key={r}><line x1={58} x2={chartWidth-8} y1={234-r*180} y2={234-r*180} stroke="var(--line)"/><text x={50} y={238-r*180} textAnchor="end" fill="var(--muted)" fontSize={12}>{new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(maximum*r)}</text></g>)}
  {chart.items.map((item,i)=>{const x=66+i*50,h=item.value/maximum*180;return <g key={item.label}><rect className="chat-knowledge-bar" x={x} y={234-h} width={30} height={h} rx={3} fill={item.highlight?'var(--astra-primary)':'color-mix(in srgb,var(--astra-primary) 55%,var(--paper))'}><title>{`${item.label}：${item.value} ${chart.unit}${item.highlight?' · 最高单价':''}`}</title></rect><text className="chat-knowledge-value" x={x+15} y={228-h} textAnchor="middle" fill="var(--ink)" fontSize={12}>{item.value}</text><text transform={`translate(${x+15},252) rotate(-38)`} textAnchor="end" fill="var(--muted)" fontSize={12}>{item.label}</text></g>;})}</svg></div><p>{chart.x_axis_label}按知识库记录从小到大排列；深色标记最高单价。</p></figure>}</div>{actions&&<div className="knowledge-answer-actions">{actions}</div>}{sources}</section>;
}
