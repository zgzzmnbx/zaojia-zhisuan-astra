import KnowledgeDemoChart,{type KnowledgeDemoChartData} from '../professional/components/knowledge/KnowledgeDemoChart';
import {RetrievalChannelChart} from '../professional/components/data-visualization/ProfessionalVisuals';

export default function KnowledgeVisuals({chart,trace}:{chart?:KnowledgeDemoChartData|null;trace?:Record<string,unknown>}){
  return <div className="knowledge-visuals">{chart&&<KnowledgeDemoChart chart={chart}/>}{trace&&Object.keys(trace).length>0&&<details><summary>查看检索过程</summary><RetrievalChannelChart trace={trace}/></details>}</div>;
}
