import {useEffect,useRef,useState} from 'react';
import './sheet-tabs.css';

/** Adapted from 智算 2.0 preview-tabs: visible, scrollable sheet choices. */
export function SheetTabs({names,index,onChange,panelId}:{names:string[];index:number;onChange:(index:number)=>void;panelId:string}){
  const list=useRef<HTMLDivElement>(null);
  const [overflow,setOverflow]=useState({left:false,right:false});
  const active=Number.isInteger(index)&&index>=0&&index<names.length?index:0;
  const signature=JSON.stringify(names);
  useEffect(()=>{
    const node=list.current;if(!node)return;
    const measure=()=>setOverflow({left:node.scrollLeft>1,right:node.scrollLeft+node.clientWidth<node.scrollWidth-1});
    const reveal=()=>{
      const tab=node.querySelector<HTMLElement>('[aria-selected="true"]');
      if(tab){const box=tab.getBoundingClientRect(),viewport=node.getBoundingClientRect();
        if(box.left<viewport.left)node.scrollLeft+=box.left-viewport.left;
        else if(box.right>viewport.right)node.scrollLeft+=box.right-viewport.right;
      }
      measure();
    };
    reveal();const observer=new ResizeObserver(reveal);observer.observe(node);
    node.addEventListener('scroll',measure,{passive:true});
    return()=>{observer.disconnect();node.removeEventListener('scroll',measure);};
  },[active,signature]);
  if(!names.length)return null;
  function scroll(direction:number){const node=list.current;if(node)node.scrollBy({left:direction*Math.max(120,node.clientWidth*.75),behavior:'auto'});}
  return <div className="workbook-sheet-nav">
    <button type="button" className="sheet-scroll" aria-label="向左滚动工作表页签" disabled={!overflow.left} onClick={()=>scroll(-1)}><span aria-hidden="true">‹</span></button>
    <div ref={list} className="workbook-sheet-tabs" role="tablist" aria-label="预览工作表">
      {names.map((name,i)=><button type="button" key={`${i}-${name}`} id={`${panelId}-tab-${i}`} role="tab" aria-controls={panelId} aria-selected={i===active} tabIndex={i===active?0:-1} title={name} onClick={()=>onChange(i)} onKeyDown={event=>{
        const next=event.key==='ArrowRight'?(i+1)%names.length:event.key==='ArrowLeft'?(i+names.length-1)%names.length:event.key==='Home'?0:event.key==='End'?names.length-1:null;
        if(next!==null){event.preventDefault();onChange(next);(list.current?.children[next] as HTMLButtonElement)?.focus({preventScroll:true});}
      }}>{name}</button>)}
    </div>
    <button type="button" className="sheet-scroll" aria-label="向右滚动工作表页签" disabled={!overflow.right} onClick={()=>scroll(1)}><span aria-hidden="true">›</span></button>
    <span className="sheet-count" title={`共 ${names.length} 张工作表`}>{active+1}<span> / {names.length}</span></span>
  </div>;
}
