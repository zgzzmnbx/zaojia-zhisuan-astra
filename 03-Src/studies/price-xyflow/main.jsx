import React,{memo,useState,useEffect,useMemo,useRef,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {ReactFlow,ReactFlowProvider,Handle,Position,Background,useNodesState,useReactFlow} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {fields,target,candidates,format} from '../price-relief/data.mjs';
import './style.css';

const Condition=memo(({data})=><div className={`condition node-shell ${data.phase===0?'phase-active':''}`}><div className="node-eyebrow">01 / 当前清单</div><h2>首级控制测量</h2><p className="node-meta">单位：个 · 4 项计价条件</p><div className="condition-rows">{fields.map((field,i)=><button key={field} className={`condition-row nodrag ${data.field===i?'focused':''}`} onClick={()=>data.onField(i)}><span>{field}</span><strong>{target[i]}</strong><Handle type="source" position={Position.Right} id={`f${i}`} style={{top:'50%'}} /></button>)}</div><p className="node-note">点击条件，查看对应关系</p></div>);
const Candidate=memo(({data})=><div className={`candidate node-shell ${data.active?'active':''} ${data.active&&data.phase===1?'phase-active':''}`}><Handle type="target" position={Position.Left}/><div className="candidate-top"><strong>{format(data.item.price)}</strong><span className={`badge ${data.item.matches===4?'full':''}`}>{data.item.matches*25}%</span></div><div className="candidate-meta"><span>元/个</span><span>{data.item.matches}/4 要素一致</span></div><Handle type="source" position={Position.Right}/></div>);
const Result=memo(({data})=><div className={`result node-shell ${data.phase===2||data.phase===3?'phase-active':''}`}><Handle type="target" position={Position.Left}/><div className="node-eyebrow">03 / 填写结果</div><span className="result-status">{data.filled?'已模拟填写':'待人工确认'}</span><div className="result-price">{format(data.item.price)}<small>元/个</small></div><p>计价库 · 第 {data.item.row} 行</p><div className="result-rule">{data.item.matches===4?'单位与 4 项要素一致':'存在 '+(4-data.item.matches)+' 项要素差异'}<br/>适用条件仍需核对</div><button className="btn btn-primary nodrag" onClick={data.onConfirm}>{data.filled?'查看模拟结果':'核对并模拟填写'}</button></div>);
const nodeTypes={condition:Condition,candidate:Candidate,result:Result};
const positions=[{id:'condition',type:'condition',position:{x:0,y:122}},{id:'result',type:'result',position:{x:580,y:136}},...candidates.map((item,i)=>({id:`c${i}`,type:'candidate',position:{x:305,y:i*91},ariaLabel:`候选 ${format(item.price)} 元，相似度 ${item.matches*25}%`}))];
const phases=['读取本行条件','逐项比较候选','追溯选中依据','等待人工确认'];

function Study(){
 const [chosen,setChosen]=useState(0),[field,setField]=useState(null),[filled,setFilled]=useState(false),[dark,setDark]=useState(false),[phase,setPhase]=useState(-1),[onlyPath,setOnlyPath]=useState(false);
 const [nodes,setNodes,onNodesChange]=useNodesState(positions.map(n=>({...n,data:{}})));
 const {fitView,zoomIn,zoomOut}=useReactFlow();
 const dialog=useRef(null),timers=useRef([]),trigger=useRef(null);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const item=candidates[chosen];
 const stop=useCallback(()=>{timers.current.forEach(clearTimeout);timers.current=[];setPhase(-1);},[]);
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>{setReduced(mq.matches);stop();};mq.addEventListener('change',change);const hidden=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hidden);return()=>{timers.current.forEach(clearTimeout);mq.removeEventListener('change',change);document.removeEventListener('visibilitychange',hidden);};},[stop]);
 const play=()=>{stop();setField(null);setPhase(0);[1,2,3].forEach(p=>timers.current.push(setTimeout(()=>setPhase(p),p*1500)));timers.current.push(setTimeout(()=>{setPhase(-1);timers.current=[];},6000));};
 const confirm=useCallback((e)=>{trigger.current=e?.currentTarget;stop();dialog.current.showModal();},[stop]);
 const choose=(index)=>{stop();setChosen(index);setFilled(false);setField(null);};
 const showField=useCallback(i=>{setField(old=>old===i?null:i);},[]);
 const displayedNodes=useMemo(()=>nodes.map(n=>({...n,data:n.id==='condition'?{phase,field,onField:showField}:n.id==='result'?{phase,item,filled,onConfirm:confirm}:{item:candidates[Number(n.id.slice(1))],active:n.id===`c${chosen}`,phase}})),[nodes,phase,field,item,filled,confirm,chosen,showField]);
 const edges=useMemo(()=>{
  const result=[];
  if(!onlyPath)candidates.forEach((c,i)=>{if(i!==chosen){result.push({id:`other-in-${i}`,source:'condition',sourceHandle:'f1',target:`c${i}`,type:'default',style:{stroke:dark?'#46586b':'#cfdae5',strokeWidth:1,opacity:.6}});result.push({id:`other-out-${i}`,source:`c${i}`,target:'result',style:{stroke:dark?'#46586b':'#cfdae5',strokeWidth:1,opacity:.6}});}});
  fields.forEach((_,i)=>{const match=item.values[i]===target[i];result.push({id:`selected-${i}`,source:'condition',sourceHandle:`f${i}`,target:`c${chosen}`,animated:phase===1&&!reduced,style:{stroke:match?'#2689db':'#b67c35',strokeWidth:field===i?3.5:2,opacity:field!==null&&field!==i?.18:1},zIndex:2});});
  result.push({id:'result-path',source:`c${chosen}`,target:'result',animated:phase===2&&!reduced,style:{stroke:'#2689db',strokeWidth:2.5},zIndex:2});return result;
 },[chosen,field,item,phase,reduced,onlyPath,dark]);
 const reset=()=>{setNodes(positions.map(n=>({...n,position:{...n.position},data:{}})));requestAnimationFrame(()=>fitView({padding:.09,duration:reduced?0:350}));};
 const close=()=>{dialog.current.close();trigger.current?.focus();};
 return <main className={`study ${dark?'dark':''}`} data-theme={dark?'dark':'light'}>
  <header className="heading"><div className="brand">Z</div><div className="heading-copy"><h1>价格匹配 <span>/ xyflow</span><span className="badge sample">交互示例</span></h1><p>表2－通用工程测量费用 · 第 5 行 · 单价</p></div><nav><a className="btn btn-ghost" href="/price-relief-study/">三层浮雕版 ↗</a><button className="btn btn-ghost" onClick={()=>setDark(!dark)}>{dark?'浅色':'深色'}</button><button className="btn btn-primary" onClick={phase<0?play:stop}>{phase<0?'播放匹配过程':'停止播放'}</button></nav></header>
  <div className="workspace"><section className="graph-area" aria-label="可拖动缩放的价格匹配路径" onKeyDownCapture={e=>{const n=e.target.closest('.react-flow__node-candidate');if(n&&(e.key==='Enter'||e.key===' ')){e.preventDefault();choose(Number(n.dataset.id.slice(1)));}}}><div className="graph-top"><strong>01 条件 → 02 候选 → 03 结果</strong><label><input className="checkbox checkbox-xs" type="checkbox" checked={onlyPath} onChange={e=>setOnlyPath(e.target.checked)}/>仅显示选中连线</label></div>
   <ReactFlow nodes={displayedNodes} edges={edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes} onNodeClick={(_,n)=>{if(n.type==='candidate')choose(Number(n.id.slice(1)));}} onNodeDoubleClick={(_,n)=>{if(n.type==='result')confirm();}} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} minZoom={.8} maxZoom={1.6} fitView fitViewOptions={{padding:.09}} colorMode={dark?'dark':'light'} proOptions={{hideAttribution:false}} ariaLabelConfig={{'node.a11yDescription.default':'按 Enter 选择节点，方向键移动节点。','controls.zoomIn.ariaLabel':'放大','controls.zoomOut.ariaLabel':'缩小'}}>
    <Background color={dark?'#3c5267':'#cbd9e6'} gap={22} size={1}/>
   </ReactFlow>
   <div className="graph-controls"><button className="btn" aria-label="放大画布" onClick={()=>zoomIn({duration:reduced?0:200})}>＋</button><button className="btn" aria-label="缩小画布" onClick={()=>zoomOut({duration:reduced?0:200})}>−</button><button className="btn" onClick={()=>fitView({padding:.09,duration:reduced?0:300})}>适应画布</button><button className="btn" onClick={reset}>复位布局</button></div>
   <div className="graph-legend"><span>● 要素一致</span><span>● 存在差异</span><span>拖动节点 · 滚轮缩放</span></div>
  </section><aside className="evidence"><div className="aside-heading"><h2>选中依据</h2><span className={`badge ${item.matches===4?'full':''}`}>{item.matches*25}% 相似度</span></div><div className="aside-price">{format(item.price)}<small>元/个</small></div><p className="subtle">{item.matches}/4 要素一致 · {4-item.matches} 项差异</p><div className="compare"><div className="compare-head"><span>本行条件</span><span>候选依据</span></div>{fields.map((name,i)=><button className={`compare-row ${item.values[i]!==target[i]?'different':''} ${field===i?'focused':''}`} key={name} onClick={()=>showField(i)}><small>{name}</small><div><span>{target[i]}</span><b>{item.values[i]===target[i]?'＝':'≠'}</b><span>{item.values[i]}</span></div></button>)}</div><div className="evidence-source"><span>来源位置</span><strong>结构化计价库 · 第 {item.row} 行</strong><p>候选为示例摘录，实际适用范围与版本需复核。</p></div><div className="experience"><span>经验参考</span><strong>4,274 <small>元/个</small></strong><p>1 条同类样本，仅作复核参考。</p></div><div className="decision"><span className={`badge ${filled?'full':''}`}>{filled?'已模拟填写':'尚未填写'}</span><p>{filled?'本页演示结果已更新。':'选中候选只查看依据，确认后才模拟填写。'}</p><button className="btn btn-primary" onClick={confirm}>{filled?'查看模拟结果':'核对并模拟填写'}</button></div></aside></div>
  <footer><span aria-live="polite">{phase<0?'点击候选，追踪价格来源':`演示 ${phase+1}/4 · ${phases[phase]}`}</span><div className="steps-inline">{phases.map((p,i)=><span key={p} className={phase===i?'current':''}>{String(i+1).padStart(2,'0')} {p}</span>)}</div><span>示例数据 · 不写入任务</span></footer>
  <dialog className="modal" ref={dialog} onCancel={()=>trigger.current?.focus()}><div className="modal-box"><h2>{filled?'模拟填写结果':'确认模拟填写'}</h2><p>第 5 行单价：<strong>{format(item.price)} 元/个</strong></p><p>{item.matches===4?'4 项要素一致，适用范围与版本仍需人工核对。':`存在 ${4-item.matches} 项差异，请先核对候选条件。`}</p><p className="subtle">仅演示交互，不修改真实工作簿，不调用模型。</p><div className="modal-action"><button className="btn" onClick={close}>返回核对</button>{!filled&&<button className="btn btn-primary" onClick={()=>{setFilled(true);close();}}>确认模拟填写</button>}</div></div><form method="dialog" className="modal-backdrop"><button onClick={()=>trigger.current?.focus()}>关闭</button></form></dialog>
 </main>;
}
createRoot(document.getElementById('root')).render(<ReactFlowProvider><Study/></ReactFlowProvider>);
