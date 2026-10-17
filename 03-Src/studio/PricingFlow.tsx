import {memo,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Background,Handle,Position,ReactFlow,ReactFlowProvider,useNodesInitialized,useNodesState,useReactFlow,type Edge,type Node,type NodeProps} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {priceText,type PriceCandidate} from './row-pricing';
import {candidateAgreement} from './pricing-visual';
import {FLOW_PAGE_SIZE,pricingFieldRelation,pricingFlowPage} from './pricing-flow-model';
import './pricing-flow.css';

type Props={conditions:[string,unknown][];candidates:PriceCandidate[];selected?:PriceCandidate;select:(c:PriceCandidate)=>void;unit:string;current:unknown;saved:boolean;savedValue?:unknown;step:number;showBasis:()=>void;returnToChat:()=>void;experienceCount:number;experienceMean?:number;visible:boolean};
type FlowData=Record<string,unknown>&{kind:'condition'|'candidate'|'result';conditions?:[string,unknown][];field?:string|null;focusField?:(key:string)=>void;candidate?:PriceCandidate;active?:boolean;step:number;unit:string;current?:unknown;saved?:boolean;savedValue?:unknown;showBasis?:()=>void;returnToChat?:()=>void;experienceCount?:number;experienceMean?:number};
type FlowNode=Node<FlowData>;
const FlowCard=memo(function FlowCard({data}:NodeProps<FlowNode>){
 const c=data.candidate,count=c?candidateAgreement(c):null;
 if(data.kind==='condition')return <div className={`pf-card pf-condition ${data.step===0?'pf-explaining':''}`}><div className="pf-label">01 / 本行计价条件</div><strong className="pf-current">当前值 {priceText(data.current)} <small>{data.unit}</small></strong><div className="pf-fields">{data.conditions?.slice(0,4).map(([key,value],i)=><button className={`nodrag ${data.field===key?'pf-focused':''}`} key={key} onClick={()=>data.focusField?.(key)} title={`${key}：${String(value)}`}><small>{key}</small><span>{String(value)}</span><Handle type="source" id={`f${i}`} position={Position.Right}/></button>)}</div>{!data.conditions?.length&&<p>按字段适用规则核对</p>}{(data.conditions?.length||0)>4&&<p>其余 {data.conditions!.length-4} 项见下方逐项对照</p>}<Handle type="source" id="all" position={Position.Right} style={{top:32}}/></div>;
 if(data.kind==='candidate'&&c)return <div className={`pf-card pf-candidate ${data.active?'pf-active':''} ${data.active&&data.step===1?'pf-explaining':''}`} title={`${c.basis}；${c.reason}`}><Handle type="target" position={Position.Left}/><div><strong>{priceText(c.value)}</strong>{c.similarity!=null&&<span className={`badge pf-similarity ${c.similarity===100?'pf-exact':''}`}>{c.similarity}%</span>}</div><small>{count?`${count.matched}/${count.total} 要素一致`:c.source_label||'适用规则'}</small><Handle type="source" position={Position.Right}/></div>;
 return <div className={`pf-card pf-result ${data.step===2||data.step===3?'pf-explaining':''}`}><Handle type="target" position={Position.Left}/><div className="pf-label">03 / 选中依据 → 人工复核</div>{c?<><strong className="pf-value">{priceText(c.value)} <small>{data.unit}</small></strong><p className="pf-basis" title={c.basis}>{c.basis}</p><p className="pf-experience">经验池 {data.experienceCount} 条{data.experienceMean!=null&&<> · 均值 {priceText(data.experienceMean)}</>}<br/>仅作复核参考</p><button className="btn btn-outline btn-sm nodrag" onClick={data.showBasis}>查看选中依据</button></>:<p>没有规则候选，可查看下方分析和经验样本。</p>}<div className="pf-review"><p>{data.saved?`已确认填写 ${priceText(data.savedValue)}`:'选择候选不会填写价格'}</p><button className="btn btn-ghost btn-sm nodrag" onClick={data.returnToChat}>返回聊天确认</button></div></div>;
});
const nodeTypes={pricing:FlowCard};
export default function PricingFlow(props:Props){return <ReactFlowProvider><PricingFlowView {...props}/></ReactFlowProvider>;}
function PricingFlowView(props:Props){
 const {candidates,selected,conditions,step,visible}=props;
 const [page,setPage]=useState(()=>Math.max(0,Math.floor(candidates.findIndex(c=>c.id===selected?.id)/FLOW_PAGE_SIZE)));
 const [field,setField]=useState<string|null>(null),[onlyPath,setOnlyPath]=useState(false),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),[onscreen,setOnscreen]=useState(true),[foreground,setForeground]=useState(!document.hidden);
 const host=useRef<HTMLDivElement>(null);
 const [nodes,setNodes,onNodesChange]=useNodesState<FlowNode>([]);
 const {fitView,zoomIn,zoomOut}=useReactFlow(),initialized=useNodesInitialized();
 const slice=pricingFlowPage(candidates,page),ids=JSON.stringify(slice.items.map(c=>c.id));
 useEffect(()=>{const index=candidates.findIndex(c=>c.id===selected?.id);if(index>=0)setPage(Math.floor(index/FLOW_PAGE_SIZE));setField(null);},[selected?.id,candidates]);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(media.matches);media.addEventListener('change',change);
  const hide=()=>setForeground(!document.hidden);document.addEventListener('visibilitychange',hide);
  const observer=new IntersectionObserver(([entry])=>setOnscreen(entry.isIntersecting));if(host.current)observer.observe(host.current);
  return()=>{media.removeEventListener('change',change);document.removeEventListener('visibilitychange',hide);observer.disconnect();};
 },[]);
 const reset=useCallback(()=>{
  const candidateIds:string[]=JSON.parse(ids);
  setNodes([{id:'conditions',type:'pricing',position:{x:0,y:35},data:{kind:'condition',step:-1,unit:''}},{id:'result',type:'pricing',position:{x:730,y:20},data:{kind:'result',step:-1,unit:''}},...candidateIds.map((id,i)=>({id:`candidate:${id}`,type:'pricing',position:{x:360,y:i*65},data:{kind:'candidate' as const,step:-1,unit:''},ariaLabel:`查看候选依据 ${priceText(candidates.find(c=>c.id===id)?.value)}`}))]);
 },[ids,setNodes,candidates]);
 useEffect(()=>{reset();},[reset]);
 useEffect(()=>{if(!initialized||!visible)return;const frame=requestAnimationFrame(()=>{void fitView({padding:.08,minZoom:.8,maxZoom:1,duration:0});});return()=>cancelAnimationFrame(frame);},[initialized,ids,visible,fitView]);
 useEffect(()=>{if(step===0){const index=candidates.findIndex(c=>c.id===selected?.id);if(index>=0)setPage(Math.floor(index/FLOW_PAGE_SIZE));}},[step,selected?.id,candidates]);
 const focusField=useCallback((key:string)=>setField(old=>old===key?null:key),[]);
 const displayed=nodes.map(n=>({...n,data:{...n.data,...props,field,focusField,candidate:n.id.startsWith('candidate:')?candidates.find(c=>`candidate:${c.id}`===n.id):selected,active:n.id===`candidate:${selected?.id}`}}));
 const animated=visible&&onscreen&&foreground&&!reduced;
 const edges=useMemo(()=>{
  const result:Edge[]=[];
  for(const c of slice.items){const active=c.id===selected?.id,target=`candidate:${c.id}`;
   if(!active&&onlyPath)continue;
   if(active&&conditions.length){for(const [i,[key,value]] of conditions.slice(0,4).entries()){
    const relation=pricingFieldRelation(value,c.candidate_key?.[key]);
    result.push({id:`input:${i}:${c.id}`,source:'conditions',sourceHandle:`f${i}`,target,animated:animated&&step===1,className:`pf-edge pf-${relation}`,style:{opacity:field&&field!==key? .18:1},zIndex:2});
   }}else result.push({id:`input:${c.id}`,source:'conditions',sourceHandle:'all',target,animated:active&&animated&&step===1,className:`pf-edge ${active?'pf-same':'pf-muted'}`});
   result.push({id:`result:${c.id}`,source:target,target:'result',animated:active&&animated&&step===2,className:`pf-edge ${active?'pf-same':'pf-muted'}`,zIndex:active?2:0});
  }return result;
 },[ids,candidates,selected?.id,conditions,onlyPath,field,step,animated]);
 const selectNode=(id:string)=>{const c=candidates.find(c=>`candidate:${c.id}`===id);if(c){props.select(c);props.showBasis();}};
 return <div ref={host} className="pricing-flow" aria-label="交互匹配路径" onKeyDownCapture={e=>{const node=(e.target as HTMLElement).closest<HTMLElement>('.react-flow__node');if(node?.dataset.id?.startsWith('candidate:')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectNode(node.dataset.id);}}}>
  <div className="pf-toolbar"><span>条件 → 候选 → 依据</span><div><label><input type="checkbox" className="checkbox checkbox-xs" checked={onlyPath} onChange={e=>setOnlyPath(e.target.checked)}/>只看选中路径</label><button className="btn btn-ghost btn-xs" disabled={slice.index===0} aria-label="上一组候选" onClick={()=>setPage(p=>p-1)}>上一组</button><small>{slice.items.length?`${slice.start+1}–${slice.start+slice.items.length}`:'0'} / {candidates.length}</small><button className="btn btn-ghost btn-xs" disabled={slice.index>=slice.last} aria-label="下一组候选" onClick={()=>setPage(p=>p+1)}>下一组</button></div></div>
  <div className="pf-canvas"><ReactFlow nodes={displayed} edges={edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes} onNodeClick={(_,n)=>selectNode(n.id)} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} minZoom={.8} maxZoom={1.6} zoomOnScroll={false} panOnScroll={false} preventScrolling={false} fitView fitViewOptions={{padding:.08,minZoom:.8,maxZoom:1}} ariaLabelConfig={{'node.a11yDescription.default':'按 Enter 查看候选依据，方向键移动节点。'}}><Background color="var(--line)" gap={24} size={1}/></ReactFlow></div>
  <div className="pf-controls"><button className="btn btn-sm" aria-label="放大匹配图" onClick={()=>void zoomIn({duration:reduced?0:200})}>＋</button><button className="btn btn-sm" aria-label="缩小匹配图" onClick={()=>void zoomOut({duration:reduced?0:200})}>−</button><button className="btn btn-sm" onClick={()=>void fitView({padding:.08,minZoom:.8,maxZoom:1,duration:reduced?0:200})}>适应画布</button><button className="btn btn-sm" onClick={reset}>复位布局</button><small>可拖动 · 实线一致 · 虚线差异/缺项</small></div>
 </div>;
}
