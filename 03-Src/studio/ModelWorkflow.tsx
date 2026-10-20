import {memo,useEffect} from 'react';
import {Background,Handle,MarkerType,Position,ReactFlow,ReactFlowProvider,useNodesState,type Node,type NodeProps,type Edge} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {Icon} from './ui';

type Data=Record<string,unknown>&{title:string;detail:string;icon:string;kind?:string;selected?:boolean;top?:boolean;bottom?:boolean};
type FlowNode=Node<Data>;
const WorkflowNode=memo(function WorkflowNode({data}:NodeProps<FlowNode>){
 return <div className={`mw-node ${data.kind||''} ${data.selected?'is-selected':''}`}>
  <Handle type="target" position={data.kind==='provider'?Position.Top:Position.Left}/>
  <span className="mw-node-icon"><Icon name={data.icon}/></span><strong>{data.title}</strong><p>{data.detail}</p>
  <Handle type="source" position={data.kind==='provider'?Position.Top:Position.Right}/>
  {data.bottom&&<Handle type="target" id="api" position={Position.Bottom}/>}
 </div>;
});
const nodeTypes={workflow:WorkflowNode};
export default function ModelWorkflow(props:{company:boolean;model:string;status:string;selectCompany:(value:boolean)=>void}){
 return <ReactFlowProvider><Workflow {...props}/></ReactFlowProvider>;
}
function Workflow({company,model,status,selectCompany}:{company:boolean;model:string;status:string;selectCompany:(value:boolean)=>void}){
 const [nodes,setNodes,onNodesChange]=useNodesState<FlowNode>([]);
 useEffect(()=>{setNodes(previous=>{
  const spec=[
   {id:'input',position:{x:0,y:0},data:{title:'项目资料',detail:'清单 · 工程条件',icon:'file'}},
   {id:'rules',position:{x:185,y:0},data:{title:'规则与知识',detail:'检索依据 · 规则匹配',icon:'book'}},
   {id:'model',position:{x:370,y:0},data:{title:'大模型辅助',detail:'填价分析 · 问答 · 报告',icon:'brain',kind:'model',bottom:true}},
   {id:'review',position:{x:555,y:0},data:{title:'人工确认与成果',detail:'核对建议 · Excel / Word',icon:'check'}},
   {id:'external',position:{x:250,y:188},data:{title:model||'外部模型 API',detail:status,icon:'link',kind:'provider',selected:!company}},
   {id:'company',position:{x:505,y:188},data:{title:'管网大模型 API',detail:'未来接入 · 待协议与鉴权验证',icon:'buildings',kind:'provider',selected:company}},
  ];
  return spec.map(n=>({...n,type:'workflow',position:previous.find(p=>p.id===n.id)?.position||n.position,ariaLabel:n.data.title}));
 });},[company,model,status,setNodes]);
 const edges:Edge[]=[
  ...[['input','rules'],['rules','model'],['model','review']].map(([source,target])=>({id:source+target,source,target,type:'smoothstep',markerEnd:{type:MarkerType.ArrowClosed,color:'var(--astra-accent)'},className:'mw-edge'})),
  ...['external','company'].map(source=>({id:source+'api',source,target:'model',targetHandle:'api',type:'smoothstep',markerEnd:{type:MarkerType.ArrowClosed,color:company===(source==='company')?'var(--astra-primary)':'var(--line)'},className:`mw-edge mw-connection ${company===(source==='company')?'is-selected':''}`,label:source==='company'?'后续替换':'当前配置'})),
 ];
 return <div className="model-workflow">
  <div className="mw-flow-heading"><span>运行时工作流</span><small>连接示意 · 非实时任务状态</small></div>
  <div className="mw-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeClick={(_,n)=>{if(n.id==='external'||n.id==='company')selectCompany(n.id==='company');}} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} zoomOnScroll={false} panOnScroll={false} preventScrolling={false} minZoom={.85} maxZoom={1.3} fitView fitViewOptions={{padding:.06,minZoom:.85,maxZoom:1}} ariaLabelConfig={{'node.a11yDescription.default':'方向键移动节点。模型接入方案也可通过图上方按钮选择。'}}><Background color="var(--line)" gap={24} size={1}/></ReactFlow></div>
 </div>;
}
