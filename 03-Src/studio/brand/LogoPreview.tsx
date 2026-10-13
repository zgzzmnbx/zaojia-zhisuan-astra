import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import type {mountLogo} from './logo-renderer.mjs';

export type LogoController=ReturnType<typeof mountLogo>;
type Props={options:{mode:string;palette:string;seed:string;dark:boolean;speed:number;paused:boolean;active:boolean;sequence?:string};onReady:(ready:boolean)=>void};
export const LogoPreview=forwardRef<LogoController|null,Props>(function LogoPreview({options,onReady},ref){
 const host=useRef<HTMLDivElement>(null),controller=useRef<LogoController|null>(null),latest=useRef(options),readyCallback=useRef(onReady);
 const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);latest.current=options;readyCallback.current=onReady;
 useImperativeHandle(ref,()=>controller.current!,[ready]);
 useEffect(()=>{let disposed=false;const element=host.current;if(!element)return;
  const fail=()=>{if(disposed)return;setFailed(true);setReady(false);readyCallback.current(false);controller.current?.dispose();controller.current=null;};
  import('./logo-renderer.mjs').then(({mountLogo})=>{if(disposed)return;try{controller.current=mountLogo(element,fail);controller.current.update(latest.current);setReady(true);readyCallback.current(true);}catch{fail();}}).catch(fail);
  Object.defineProperty(element,'logoDiagnostics',{value:()=>controller.current?.inspect()??null,configurable:true});
  return()=>{disposed=true;controller.current?.dispose();controller.current=null;delete (element as any).logoDiagnostics;};
 },[]);
 useEffect(()=>{controller.current?.update(options);},[options.mode,options.palette,options.seed,options.dark,options.speed,options.paused,options.active,options.sequence]);
 return <div className="logo-library-canvas" ref={host} role="img" aria-label="造价智算三维 Logo 预览" data-ready={ready}>{!ready&&<div className="logo-library-fallback">{failed?'三维预览暂不可用。仍可导出配置和 GLB 模型。':<span className="loading loading-spinner"/>}</div>}</div>;
});
