import {useEffect,useRef,useState} from 'react';
import {mountKnowledgeGalaxy} from './knowledge-articles/knowledge-galaxy';
const categories=['油气输送管道工程','通用安装工程','参考计价依据','全费用清单单价'];
const nodes=Array.from({length:36},(_,i)=>({id:`welcome-${i}`,title:['工程量清单','计价依据','安装工程','勘察测量'][i%4],category:categories[i%4],tags:[],degree:3}));
const data={nodes,edges:nodes.flatMap((node,i)=>[1,5].map(offset=>({source:node.id,target:nodes[(i+offset)%nodes.length].id})))};
/** Shared renderer; synthetic nodes and local assets, no business reads or writes. */
export default function WelcomeDemoGalaxy({running}:{running:boolean}){
 const host=useRef<HTMLDivElement>(null),renderer=useRef<ReturnType<typeof mountKnowledgeGalaxy>|null>(null),current=useRef(running);current.current=running;
 const [failed,setFailed]=useState(false);
 const update=()=>renderer.current?.update({motion:current.current,selectedId:null,query:'',preferences:{rotationSpeed:.65,flowSpeed:.6,labelBrightness:0,overviewBrightness:.32}});
 useEffect(()=>{if(!host.current)return;let disposed=false;
  try{renderer.current=mountKnowledgeGalaxy(host.current,data,{onSelect:()=>{},onClear:()=>{},onHover:()=>{},onVisibility:()=>{},onError:()=>{if(!disposed)setFailed(true);}});update();}catch{setFailed(true);}
  return()=>{disposed=true;renderer.current?.dispose();renderer.current=null;};
 },[]);
 useEffect(update,[running]);
 useEffect(()=>{if(failed){renderer.current?.dispose();renderer.current=null;}},[failed]);
 return <div className="awp-galaxy"><div ref={host} className="awp-galaxy-canvas"/>{failed&&<div className="awp-galaxy-fallback"><svg viewBox="0 0 400 300">{nodes.map((n,i)=>{const a=i*2.4,r=30+Math.sqrt(i)*20;return <g key={n.id}><path d={`M200 150L${200+Math.cos(a)*r} ${150+Math.sin(a)*r*.65}`} stroke="#9ac7f3" opacity=".25"/><circle cx={200+Math.cos(a)*r} cy={150+Math.sin(a)*r*.65} r={3+i%4} fill="#acd5ee"/></g>})}</svg><small>静态星图 · 3D 暂不可用</small></div>}<div className="awp-galaxy-caption"><span>知识图谱</span><strong>知识关联 · 来源追溯</strong><small>36 个示例节点 · 72 条示例关系</small></div></div>;
}
