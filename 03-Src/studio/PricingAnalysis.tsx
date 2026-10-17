import {Icon} from './ui';
import {Prose} from './Prose';
import {pricingAnalysisSections} from './row-pricing';
import './row-pricing.css';

export function PricingAnalysis({text}:{text:string}){
 const parts=pricingAnalysisSections(text),hasHeadings=parts.some(p=>p.title);
 const preface=hasHeadings&&parts[0]?.title===''&&parts[0].body.startsWith('**结构化排序首选：')?parts[0]:undefined;
 const labels:Record<string,{label:string;icon:string}>={结论:{label:'首选建议',icon:'spark'},依据与解释:{label:'备选与依据',icon:'book'},适用条件与复核:{label:'采用前核对',icon:'shield'},项目记忆:{label:'项目经验',icon:'database'}};
 return <div className="pricing-analysis-sections">{parts.filter(p=>p!==preface).map((part,i)=>part.title==='使用边界'?<div className="pricing-analysis-boundary" key={i}><Icon name="info"/><Prose text={part.body}/></div>:<section className="pricing-analysis-section" key={i}><h4><Icon name={labels[part.title]?.icon||'book'}/>{labels[part.title]?.label||part.title||'分析说明'}</h4><Prose text={part.body}/></section>)}{preface&&<details className="pricing-analysis-source"><summary>规则排序说明</summary><Prose text={preface.body}/></details>}</div>;
}
