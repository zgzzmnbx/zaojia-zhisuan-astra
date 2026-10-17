import {useEffect,useRef,useState,type CSSProperties,type KeyboardEvent,type PointerEvent} from 'react';
import {clampRatio,createResizeSession,floatingPreviewBounds,floatingConversationSpace,keyboardRatio,ratioBounds} from './layout-state';
import type {usePresentation} from './usePresentation';
export function useWorkbenchLayout(presentation:ReturnType<typeof usePresentation>,sandboxHome=false,sandboxChatCollapsed=false,classicHome=false,simpleHome=false){
 const [sandboxRatio,setSandboxRatio]=useState(()=>{try{const saved=Number(localStorage.getItem('astra.sandbox.chat-ratio.v1'));if(Number.isFinite(saved)&&saved>=.15&&saved<=.5)return saved}catch{}return presentation.state.ratio*.8});
 useEffect(()=>{if(sandboxHome)try{localStorage.setItem('astra.sandbox.chat-ratio.v1',String(sandboxRatio))}catch{}},[sandboxHome,sandboxRatio]);
 const commitRatio=(value:number)=>sandboxHome?setSandboxRatio(value):presentation.resize(value);
 const {state}=presentation,mode=sandboxHome?'content':classicHome?'chat':simpleHome?'summary':state.mode;
 const [width,setWidth]=useState(1200),[wide,setWide]=useState(()=>matchMedia('(min-width:1025px)').matches),[dragRatio,setDragRatio]=useState<number|null>(null);
 const [floatBounds,setFloatBounds]=useState(()=>floatingPreviewBounds(1200,720,100,510));
 const ref=useRef<HTMLDivElement>(null),latest=useRef(state);latest.current=state;
 const summary=mode==='summary',content=mode==='content'||mode==='fullscreen',expanded=mode==='fullscreen';
 const fitsFloat=wide&&floatBounds.available&&!floatBounds.compact,floating=summary&&fitsFloat,split=mode==='content'&&wide&&!(sandboxHome&&sandboxChatCollapsed);
 const summaryFallback=summary&&!fitsFloat,chatActive=!(sandboxHome&&sandboxChatCollapsed)&&(mode==='chat'||(wide&&!expanded&&!summaryFallback));
 const chatSpace=floatingConversationSpace(width,floatBounds.width,floating,false,true);
 const drag=useRef<{pointerId:number;node:HTMLElement;session:ReturnType<typeof createResizeSession>;cursor:string;select:string}|null>(null);
 function finish(cancel=false){const d=drag.current;if(!d)return;drag.current=null;document.body.style.cursor=d.cursor;document.body.style.userSelect=d.select;setDragRatio(null);if(!cancel)commitRatio(constrain(d.session.finish().ratio));if(d.node.hasPointerCapture?.(d.pointerId))d.node.releasePointerCapture(d.pointerId);}
 useEffect(()=>{const media=matchMedia('(min-width:1025px)');const update=()=>setWide(media.matches);media.addEventListener('change',update);update();
  const node=ref.current,composer=node?.querySelector<HTMLElement>('.composer-wrap'),messages=node?.querySelector<HTMLElement>('#astra-conversation .messages'),heading=node?.querySelector<HTMLElement>('#astra-conversation .conversation-heading'),toolbar=node?.querySelector<HTMLElement>('#astra-conversation .composer-toolbar');
  const measure=()=>{if(!node)return;const rect=node.getBoundingClientRect();if(!rect.width||!rect.height)return;setWidth(rect.width);const composerVisible=!!composer?.getClientRects().length;{const bounds=floatingPreviewBounds(rect.width,rect.height,0,0,.32,composerVisible?{top:heading?heading.getBoundingClientRect().bottom-rect.top-16:40,bottom:toolbar?toolbar.getBoundingClientRect().top+toolbar.getBoundingClientRect().height/2-rect.top:rect.height-60}:undefined);setFloatBounds(old=>JSON.stringify(old)===JSON.stringify(bounds)?old:bounds)}};
  const observer=node?new ResizeObserver(measure):null;for(const item of [node,composer,messages,heading,toolbar])if(item)observer?.observe(item);measure();window.addEventListener('resize',measure);
  return()=>{media.removeEventListener('change',update);window.removeEventListener('resize',measure);observer?.disconnect();finish(true)};
 },[]);
 useEffect(()=>{finish(true)},[state.context,state.conversationId,mode,sandboxHome]);
 const minimumChat=Math.min(320/Math.max(1,width-12),.45);
 const bounds=sandboxHome?{min:minimumChat,max:Math.max(minimumChat,Math.min(.5,(width-600)/Math.max(1,width-12)))}:ratioBounds(width);
 const constrain=(n:number)=>Math.max(bounds.min,Math.min(bounds.max,n));
 const ratio=constrain(clampRatio(dragRatio??(sandboxHome?sandboxRatio:state.ratio),width));
 function start(event:PointerEvent<HTMLDivElement>){if(drag.current||event.button!==0||!split)return;event.preventDefault();const rect=ref.current!.getBoundingClientRect();event.currentTarget.setPointerCapture(event.pointerId);drag.current={pointerId:event.pointerId,node:event.currentTarget,session:createResizeSession({policy:'manual',mode:'custom',ratio},rect.left,rect.width),cursor:document.body.style.cursor,select:document.body.style.userSelect};document.body.style.cursor='col-resize';document.body.style.userSelect='none';setDragRatio(ratio);}
 function move(event:PointerEvent<HTMLDivElement>){const d=drag.current;if(d?.pointerId===event.pointerId)setDragRatio(constrain(d.session.move(event.clientX).ratio))}
 function key(event:KeyboardEvent<HTMLDivElement>){if(!split)return;if(event.key==='Escape'&&drag.current){event.preventDefault();finish(true);return;}const next=keyboardRatio(ratio,event.key,width,event.shiftKey);if(next===null)return;event.preventDefault();commitRatio(constrain(next))}
 return {ref,ratio,wide,dragging:dragRatio!==null,floating,split,expanded,summary,summaryFallback,chatActive,previewActive:content,floatBounds,
  style:{'--floating-reserve':`${chatSpace.reserve}px`,'--chat-size':`${Math.max(0,(width-12)*ratio)}px`,'--float-top':`${floatBounds.top}px`,'--float-right':`${floatBounds.right}px`,'--float-width':`${floatBounds.width}px`,'--float-height':`${floatBounds.height}px`} as CSSProperties,
  separator:{onPointerDown:start,onPointerMove:move,onPointerUp:(e:PointerEvent<HTMLDivElement>)=>{if(e.pointerId===drag.current?.pointerId)finish()},onPointerCancel:(e:PointerEvent<HTMLDivElement>)=>{if(e.pointerId===drag.current?.pointerId)finish(true)},onLostPointerCapture:(e:PointerEvent<HTMLDivElement>)=>{if(e.pointerId===drag.current?.pointerId)finish()},onKeyDown:key,role:'separator','aria-orientation':'vertical' as const,'aria-label':'调整聊天和内容宽度','aria-controls':sandboxHome?'astra-conversation astra-sandbox':'astra-conversation astra-preview','aria-valuemin':Math.round(bounds.min*100),'aria-valuemax':Math.round(bounds.max*100),'aria-valuenow':Math.round(ratio*100),'aria-valuetext':`聊天 ${Math.round(ratio*100)}%，内容 ${Math.round((1-ratio)*100)}%`,tabIndex:split?0:-1}
 };
}
