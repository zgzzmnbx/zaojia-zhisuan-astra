import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import './project-view-tabs.css';

export type ProjectTab='board'|'map'|'showcase'|'runs';
const tabs=[['board','项目总览'],['map','全国项目'],['showcase','地图展示'],['runs','运行记录']] as const;
export function ProjectViewTabs({active,select}:{active:ProjectTab;select:(tab:ProjectTab)=>void}){
 const strip=useRef<HTMLDivElement>(null);
 const [edges,setEdges]=useState({left:false,right:false});
 useEffect(()=>{
  const node=strip.current;if(!node)return;
  const measure=()=>setEdges({left:node.scrollLeft>1,right:node.scrollLeft+node.clientWidth<node.scrollWidth-1});
  const reveal=()=>{const selected=node.querySelector<HTMLElement>('[aria-selected="true"]');if(selected){const left=selected.getBoundingClientRect().left-node.getBoundingClientRect().left+node.scrollLeft;if(left<node.scrollLeft)node.scrollLeft=left;else if(left+selected.offsetWidth>node.scrollLeft+node.clientWidth)node.scrollLeft=left+selected.offsetWidth-node.clientWidth;}measure();};
  const observer=new ResizeObserver(reveal);observer.observe(node);node.addEventListener('scroll',measure,{passive:true});reveal();
  return()=>{observer.disconnect();node.removeEventListener('scroll',measure);};
 },[active]);
 function key(event:KeyboardEvent<HTMLButtonElement>,index:number){
  const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;
  if(next<0)return;event.preventDefault();select(tabs[next][0]);strip.current?.querySelector<HTMLButtonElement>(`#dashboard-tab-${tabs[next][0]}`)?.focus({preventScroll:true});
 }
 return <nav className="dashboard-view-nav" aria-label="项目看板">
  <button type="button" className="dashboard-tab-scroll" aria-label="向左滚动看板页签" disabled={!edges.left} onClick={()=>strip.current?.scrollBy({left:-160})}>‹</button>
  <div ref={strip} className="dashboard-view-tabs" role="tablist" aria-label="项目看板视图" aria-orientation="horizontal">{tabs.map(([tab,label],index)=><button key={tab} id={`dashboard-tab-${tab}`} type="button" role="tab" aria-selected={active===tab} aria-controls="astra-dashboard-panel" tabIndex={active===tab?0:-1} className="dashboard-view-tab" onClick={()=>select(tab)} onKeyDown={event=>key(event,index)}>{label}</button>)}</div>
  <button type="button" className="dashboard-tab-scroll" aria-label="向右滚动看板页签" disabled={!edges.right} onClick={()=>strip.current?.scrollBy({left:160})}>›</button>
 </nav>;
}
