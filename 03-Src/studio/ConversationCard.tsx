import {Prose,sourceExcerpt} from './Prose';
import {Gork,Icon} from './ui';
import type {Action,Message} from './types';
import './conversation-cards.css';

type Props={message:Message;onAction:(action:Action)=>void;unavailable:(action:Action)=>string|undefined};

export function ConversationCard({message,onAction,unavailable}:Props){
  const card=message.card!;
  const settled=card.kind==='input'&&message.actions?.some(a=>a.action==='convert'&&unavailable(a)==='结构已确认')||card.kind==='confirmation'&&message.actions?.some(a=>a.action==='match'&&unavailable(a)==='匹配已完成');
  const refreshed=card.kind==='edit'&&message.actions?.some(a=>a.action==='recalculate'&&unavailable(a)==='已刷新');
  const title=refreshed?'修改已保存，成果已刷新':card.title;
  return <section className={`card conversation-card card-${card.kind}`} aria-label={title}>
    <header className="cc-heading"><span className="cc-symbol"><Icon name={card.icon}/></span><div><span className="cc-caption">{card.caption}</span><h3>{title}</h3></div><span className={`badge cc-status ${settled||refreshed?'tone-success':card.tone?`tone-${card.tone}`:''}`}>{refreshed?'已刷新':settled?'已确认':card.status}</span></header>
    <div className="cc-body">
      {card.metrics&&<dl className={`cc-metrics ${card.metrics.length===1?'cc-metrics-single':''}`}>{card.metrics.map(m=><div key={m.label}><dt>{m.label}</dt><dd className={m.tone==='attention'?'tone-attention':''}>{m.value.toLocaleString('zh-CN')}</dd></div>)}</dl>}
      {card.steps&&<ol className="cc-steps" aria-label="编制流程">{card.steps.map(s=><li key={s.label} data-state={s.state}><span>{s.state==='done'?<Icon name="check"/>:<i/>}</span>{s.label}</li>)}</ol>}
      {card.facts&&<dl className="cc-facts">{card.facts.map(f=><div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>}
      {card.items&&<div className={`cc-items ${card.kind==='result'||card.kind==='artifact'?'cc-artifacts':''}`}>{card.items.map((item,i)=>{
        const content=<><span className="cc-item-icon"><Icon name={item.icon}/></span><span className="cc-item-copy"><strong>{item.title}</strong><small>{message.evidence?sourceExcerpt(item.detail):item.detail}</small></span>{item.action&&<Icon name="arrow-up-right"/>}</>;
        return item.action?<button type="button" className="cc-item" key={i} aria-label={item.action.label} title={unavailable(item.action)||item.title} disabled={!!unavailable(item.action)} onClick={()=>onAction(item.action!)}>{content}</button>:<div className="cc-item" key={i}>{content}</div>;
      })}</div>}
      {card.disclosure&&<details className="collapse cc-disclosure"><summary>{card.disclosure.label}<Icon name="chevron"/></summary><div>{card.kind==='source'?<Prose text={card.disclosure.lines.join('\n')}/>:card.disclosure.lines.map((line,i)=><p key={i}>{line}</p>)}</div></details>}
      {card.note&&<p className="cc-note">{refreshed?'修改依据已留存，公式与报告已刷新。':card.note}</p>}
    </div>
    {!!message.actions?.length&&<footer className="cc-actions">{message.actions.map(a=>{const reason=unavailable(a);const finished=reason&&['结构已确认','匹配已完成','已刷新'].includes(reason);return <button key={a.action} type="button" className={`btn ${a.primary&&!reason?'btn-primary':'btn-ghost'}`} disabled={!!reason} title={reason} onClick={()=>onAction(a)}>{finished&&<Icon name="check"/>}{finished?reason:a.label}{a.primary&&!reason&&<Icon name="arrow-right"/>}</button>;})}</footer>}
  </section>;
}

export function WorkingCard({label}:{label:string}){
  return <div className="cc-working" role="status"><Gork state="thinking" size={30} still/><div><strong>{label}</strong><small>正在处理，完成后会在这里展示结果</small></div><span className="loading loading-spinner loading-sm" aria-hidden="true"/></div>;
}
