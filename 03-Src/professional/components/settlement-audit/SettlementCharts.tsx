import {Bar,BarChart,CartesianGrid,Cell,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import ChartFrame from '../data-visualization/ChartFrame';
import '../data-visualization/dataVisualization.css';

type Summary={reported_detail_total:number;reviewed_detail_total:number;suggested_difference:number;sheet_summaries?:{sheet:string;high:number;medium:number;low:number;total:number}[]};
const money=(value:number)=>`${(value/10000).toLocaleString('zh-CN',{maximumFractionDigits:2})} 万元`;
export default function SettlementCharts({summary,onSheet}:{summary:Summary;onSheet:(sheet:string)=>void}){
 const start=summary.reported_detail_total,end=summary.reviewed_detail_total;
 const valid=[start,end,summary.suggested_difference].every(Number.isFinite);
 const rows=[{label:'上报明细',range:[Math.min(0,start),Math.max(0,start)],value:start},{label:end<=start?'建议审减':'建议增加',range:[Math.min(start,end),Math.max(start,end)],value:end-start},{label:'审核建议',range:[Math.min(0,end),Math.max(0,end)],value:end}];
 return <details className="settlement-charts" open><summary>审核金额与工作表风险</summary>
  <ChartFrame id="settlement-waterfall" title="明细金额变化" visualId="VIS-07" summary="规则建议 · 待人工审定" state={valid?'ready':'insufficient'}>
   <div style={{height:230,width:'100%'}} role="img" aria-label={`上报 ${money(start)}，调整 ${money(end-start)}，审核建议 ${money(end)}`}>
    <ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{top:10,right:12,bottom:4,left:4}}><CartesianGrid vertical={false} strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fontSize:12}}/><YAxis width={66} tick={{fontSize:12}} tickFormatter={v=>`${Number(v/10000).toFixed(1)}万`}/><Tooltip formatter={(_value,_name,item)=>[money(item.payload.value),'金额']}/><Bar dataKey="range" maxBarSize={68}>{rows.map((row,i)=><Cell key={row.label} fill={i===1?(end<=start?'#2a9476':'#c3812c'):'#4f70d9'}/>)}</Bar></BarChart></ResponsiveContainer>
   </div><p className="dv-waterfall__equation">{money(start)} − {money(summary.suggested_difference)} = {money(end)}。结构化明细口径，不代表最终合同审定。</p>
  </ChartFrame>
  <ChartFrame id="settlement-sheet-risk" title="各工作表风险分布" visualId="VIS-08" summary="选择工作表定位问题" state={summary.sheet_summaries?.length?'ready':'empty'}>
   <div className="settlement-sheet-charts">{summary.sheet_summaries?.map(sheet=><button type="button" key={sheet.sheet} onClick={()=>onSheet(sheet.sheet)} aria-label={`${sheet.sheet}，${sheet.total} 项风险`}><strong>{sheet.sheet}</strong><span className="settlement-risk-track">{(['high','medium','low'] as const).map(level=><i key={level} className={`is-${level}`} style={{width:`${sheet[level]/Math.max(sheet.total,1)*100}%`}}/>)}</span><small>高 {sheet.high} · 中 {sheet.medium} · 低 {sheet.low}</small></button>)}</div>
  </ChartFrame>
 </details>;
}
