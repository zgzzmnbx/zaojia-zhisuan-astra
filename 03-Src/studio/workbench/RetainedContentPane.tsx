import {useLayoutEffect,useRef,type ReactNode} from 'react';
type Position={top:number;left:number};
const memory=new Map<string,Position[]>();
function elements(node:HTMLElement){return [node,...node.querySelectorAll<HTMLElement>('.result-tab-panel,.table-scroll,.example-table-scroll,.example-scroll,.professional-surface,.project-dashboard,.workspace-scroll')];}
function save(node:HTMLElement){const key=node.dataset.scrollKey;if(!key)return;memory.set(key,elements(node).map(el=>({top:el.scrollTop,left:el.scrollLeft})));if(memory.size>100)memory.delete(memory.keys().next().value!);}
export function restoreContentScroll(node:HTMLElement,key:string){const prior=memory.get(key);if(!prior)return false;elements(node).forEach((el,i)=>{if(prior[i]){el.scrollTop=prior[i].top;el.scrollLeft=prior[i].left}});return true;}
export function captureContentScroll(root:HTMLElement|null){root?.querySelectorAll<HTMLElement>('[data-content-active="true"]').forEach(save);}
export function RetainedContentPane({scope,view,variant,active,children}:{scope:string;view:string;variant:string;active:boolean;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null),key=`${scope}:${view}:${variant}`;
 useLayoutEffect(()=>{const node=ref.current;if(!node||!active)return;restoreContentScroll(node,key);},[key,active]);
 return <div className="retained-content-pane" ref={ref} hidden={!active} data-scroll-key={key} data-content-active={active?'true':'false'} onScrollCapture={()=>{if(active&&ref.current)save(ref.current)}}>{children}</div>;
}
