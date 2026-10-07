import {useEffect,useRef,useState,type CSSProperties,type KeyboardEvent,type PointerEvent} from 'react';
import {clampRatio,createResizeSession,floatingPreviewBounds,floatingConversationSpace,keyboardRatio,ratioBounds} from './layout-state';
import type {usePresentation} from './usePresentation';
export function useWorkbenchLayout(presentation:ReturnType<typeof usePresentation>){
 const {state}=presentation,mode=state.mode;
 const [width,setWidth]=useState(1200),[wide,setWide]=useState(()=>matchMedia('(min-width:1025px)').matches),[dragRatio,setDragRatio]=useState<number|null>(null);
 const [floatBounds,setFloatBounds]=useState(()=>floatingPreviewBounds(1200,720,100,510));
 const ref=useRef<HTMLDivElement>(null),latest=useRef(state);latest.current=state;
 const summary=mode==='summary',content=mode==='content'||mode==='fullscreen',expanded=mode==='fullscreen';
 const fitsFloat=wide&&floatBounds.available&&!floatBounds.compact,floating=summary&&fitsFloat,split=mode==='content'&&wide;
 const summaryFallback=summary&&!fitsFloat,chatActive=mode==='chat'||(wide&&!expanded&&!summaryFallback);
 const chatSpace=floatingConversationSpace(width,floatBounds.width,floating,false,true);
 const drag=useRef<{pointerId:number;node:HTMLElement;session:ReturnType<typeof createResizeSession>;cursor:string;select:string}|null>(null);
 function finish(cancel=false){const d=drag.current;if(!d)return;drag.current=null;document.body.style.cursor=d.cursor;document.body.style.userSelect=d.select;setDragRatio(null);if(!cancel)presentation.resize(d.session.finish().ratio);if(d.node.hasPointerCapture?.(d.pointerId))d.node.releasePointerCapture(d.pointerId);}
 useEffect(()=>{const media=matchMedia('(min-width:1025px)');const update=()=>setWide(media.matches);media.addEventListener('change',update);update();
  const node=ref.current,composer=node?.querySelector<HTMLElement>('.composer-wrap'),messages=node?.querySelector<HTMLElement>('#astra-conversation .messages'),heading=node?.querySelector<HTMLElement>('#astra-conversation .conversation-heading'),toolbar=node?.querySelector<HTMLElement>('#astra-conversation .composer-toolbar');
  const measure=()=>{if(!node)return;const rect=node.getBoundingClientRect();if(!rect.width||!rect.height)return;setWidth(rect.width);if(composer?.getClientRects().length){const bounds=floatingPreviewBounds(rect.width,rect.height,0,0,.32,{top:heading?heading.getBoundingClientRect().bottom-rect.top-16:40,bottom:toolbar?toolbar.getBoundingClientRect().top+toolbar.getBoundingClientRect().height/2-rect.top:rect.height-60});setFloatBounds(old=>JSON.stringify(old)===JSON.stringify(bounds)?old:bounds)}};
  const observer=node?new ResizeObserver(measure):null;for(const item of [node,composer,messages,heading,toolbar])if(item)observer?.observe(item);measure();window.addEventListener('resize',measure);
  return()=>{media.removeEventListener('change',update);window.removeEventListener('resize',measure);observer?.disconnect();finish(true)};
 },[]);
 useEffect(()=>{finish(true)},[state.context,state.conversationId,mode]);
 const ratio=clampRatio(dragRatio??state.ratio,width),bounds=ratioBounds(width);
 function start(event:PointerEvent<HTMLDivElement>){if(drag.current||event.button!==0||!split)return;event.preventDefault();const rect=ref.current!.getBoundingClientRect();event.currentTarget.setPointerCapture(event.pointerId);drag.current={pointerId:event.pointerId,node:event.currentTarget,session:createResizeSession({policy:'manual',mode:'custom',ratio:latest.current.ratio},rect.left,rect.width),cursor:document.body.style.cursor,select:document.body.style.userSelect};document.body.style.cursor='col-resize';document.body.style.userSelect='none';setDragRatio(ratio);}
 function move(event:PointerEvent<HTMLDivElement>){const d=drag.current;if(d?.pointerId===event.pointerId)setDragRatio(d.session.move(event.clientX).ratio)}
 function key(event:KeyboardEvent<HTMLDivElement>){if(!split)return;if(event.key==='Escape'&&drag.current){event.preventDefault();finish(true);return;}const next=keyboardRatio(ratio,event.key,width,event.shiftKey);if(next===null)return;event.preventDefault();presentation.resize(next)}
 return {ref,ratio,wide,dragging:dragRatio!==null,floating,split,expanded,summary,summaryFallback,chatActive,previewActive:content,floatBounds,
  style:{'--floating-reserve':`${chatSpace.reserve}px`,'--chat-size':`${Math.max(0,(width-12)*ratio)}px`,'--float-top':`${floatBounds.top}px`,'--float-right':`${floatBounds.right}px`,'--float-width':`${floatBounds.width}px`,'--float-height':`${floatBounds.height}px`} as CSSProperties,
  separator:{onPointerDown:start,onPointerMove:move,onPointerUp:(e:PointerEvent<HTMLDivElement>)=>{if(e.pointerId===drag.current?.pointerId)finish()},onPointerCancel:(e:PointerEvent<HTMLDivElement>)=>{if(e.pointerId===drag.current?.pointerId)finish(true)},onLostPointerCapture:(e:PointerEvent<HTMLDivElement>)=>{if(e.pointerId===drag.current?.pointerId)finish()},onKeyDown:key,role:'separator','aria-orientation':'vertical' as const,'aria-label':'调整聊天和内容宽度','aria-controls':'astra-conversation astra-preview','aria-valuemin':Math.round(bounds.min*100),'aria-valuemax':Math.round(bounds.max*100),'aria-valuenow':Math.round(ratio*100),'aria-valuetext':`聊天 ${Math.round(ratio*100)}%，内容 ${Math.round((1-ratio)*100)}%`,tabIndex:split?0:-1}
 };
}
