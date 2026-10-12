import {attachGorkPointer} from './gork-pointer';
import {useEffect,useRef,useState} from 'react';
import '../vendor/gork/gork-catalog.js';
import '../vendor/gork/gork-avatar.js';
import {choreographGork,createGorkController,gorkDescriptions,greetings} from './gork-motion';
import {gorkExpression,type GorkAppearance} from './gork-preferences';
import {useGorkSettings} from './useGorkSettings';
import {mountGorkPlayer,gorkExpressionDuration} from './gork-custom';
import './gork.css';

// User explicitly chose playback for all visible animated avatars (2026-10-06).
// Legacy pause preferences are intentionally ignored; visibility still owns teardown.
export function useGorkMotion(){return [false,(_next:boolean)=>{},true] as const;}
const catalog=choreographGork((window as any).GorkCatalog);
export type GorkPresented=(state:string,duration:number)=>void;
type Props={onPresented?:GorkPresented;replay?:number;state?:string;size?:number;still?:boolean;suspended?:boolean;interactive?:boolean;completion?:number;onGreet?:()=>void;followPointer?:boolean;pointerSmoothing?:'smooth'|'default';appearanceOverride?:GorkAppearance;expressionOverride?:string};

export function Gork({onPresented,replay=0,state='idle',size=32,still=false,suspended=false,interactive=false,completion=0,onGreet,followPointer=false,pointerSmoothing='default',appearanceOverride,expressionOverride}:Props){
  const {preferences}=useGorkSettings();
  const appearance=appearanceOverride||preferences.appearance;
  const expression=(semantic:string)=>expressionOverride||gorkExpression(semantic,preferences);
  const configuration=JSON.stringify([appearance,expressionOverride||preferences.expressions]);
  const canvas=useRef<HTMLCanvasElement>(null),controller=useRef<ReturnType<typeof createGorkController>|null>(null);
  const [paused,,forceMotion]=useGorkMotion(),[status,setStatus]=useState({state,active:false});
  const values=useRef({state,paused:paused||still,suspended,followPointer,pointerSmoothing,onPresented});values.current={state,paused:paused||still,suspended,followPointer,pointerSmoothing,onPresented};
  const reconcile=useRef<()=>void>(()=>{}),greetingIndex=useRef(0),lastGreeting=useRef(-Infinity),lastCompletion=useRef(completion);
  useEffect(()=>{
    const element=canvas.current;if(!element)return;
    let visible=false;
    const instance=createGorkController((next,frozen)=>{
      let rendered=next;
      const pointer=!frozen&&values.current.followPointer?attachGorkPointer(element,()=>['idle','listening'].includes(rendered)&&!values.current.paused&&!values.current.suspended,values.current.pointerSmoothing==='smooth'?{responseMs:260,maxSpeed:90}:{}):undefined;
      const player=mountGorkPlayer(element,catalog,{still:frozen,expression:expression(next),appearance,onStarted:()=>values.current.onPresented?.(rendered,gorkExpressionDuration(expression(rendered),catalog))});
      if(!frozen)player.set(expression(next));
      return {set(next:string){rendered=next;pointer?.reset();player.set(expression(next),['working','searching','thinking','confused'].includes(next));},dispose(){pointer?.dispose();player.dispose();}};
    },next=>setStatus(old=>old.state===next.state&&old.active===next.active?old:next),undefined,state=>gorkExpressionDuration(expression(state),catalog),180);
    controller.current=instance;
    const update=()=>instance.update({state:values.current.state,visible:visible&&!document.hidden&&!values.current.suspended,paused:values.current.paused});
    reconcile.current=update;
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;update();});
    observer.observe(element);document.addEventListener('visibilitychange',update);
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',update);instance.dispose();controller.current=null;reconcile.current=()=>{};};
  },[configuration,replay]);
  useEffect(()=>reconcile.current(),[state,paused,still,suspended]);
  useEffect(()=>{
    if(completion===lastCompletion.current)return;
    lastCompletion.current=completion;controller.current?.react('happy',true);
  },[completion]);
  function greet(){
    const now=performance.now();if(now-lastGreeting.current<900)return;
    if(controller.current?.react(greetings[greetingIndex.current%greetings.length])){greetingIndex.current++;lastGreeting.current=now;}
    onGreet?.();
  }
  const picture=<canvas ref={canvas} width={size*2} height={size*2} style={{width:size,height:size}} role="img" aria-label={`Gork，智算的化身 · ${gorkDescriptions[status.state]||'与你一起工作'}`}/>;
  return <span className={`gork-companion ${interactive?'gork-interactive':''}`} data-state={status.state} data-expression={expression(status.state)} data-appearance={appearance.id} data-animated={status.active&&!still} data-motion-override={forceMotion} style={{width:size,height:size}}>
    {interactive?<button type="button" className="gork-touch" aria-label="和 Gork 打个招呼" title={`${gorkDescriptions[status.state]||'与你一起工作'} · 点一下和 Gork 互动`} onClick={greet}>{picture}</button>:picture}
  </span>;
}
