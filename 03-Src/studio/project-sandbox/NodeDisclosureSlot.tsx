import {useLayoutEffect,useRef,type ReactNode} from 'react';

/** Keep the title in place when a task's disabled footer gives way to results. */
export function NodeDisclosureSlot({selected,scope,phase,children}:{selected:boolean;scope:string;phase:string;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const slot=ref.current!,menu=slot.querySelector<HTMLElement>('.sandbox-node-menu');
  if(!selected||!menu){slot.style.minHeight='';return;}
  let width=0,reserved=0;
  const measure=()=>{const nextWidth=menu.offsetWidth,height=menu.offsetHeight;reserved=Math.abs(nextWidth-width)>1?height:Math.max(reserved,height);width=nextWidth;slot.style.minHeight=`${reserved}px`;};
  measure();const observer=new ResizeObserver(measure);observer.observe(menu);
  return()=>observer.disconnect();
 },[selected,scope]);
 return <div ref={ref} className="sandbox-node-slot" data-disclosure={phase}>{children}</div>;
}
