import {useEffect,useRef,useState} from 'react';
import {createGorkFeedback,type GorkFeedback} from './gork-feedback';

export function useGorkFeedback(){
 const [value,setValue]=useState<GorkFeedback>({success:false,warning:false});
 const policy=useRef<ReturnType<typeof createGorkFeedback>|null>(null);
 useEffect(()=>{
  const current=createGorkFeedback(setValue);policy.current=current;
  const visibility=()=>{if(document.hidden)current.reset();};
  document.addEventListener('visibilitychange',visibility);
  return()=>{document.removeEventListener('visibilitychange',visibility);current.dispose();policy.current=null;};
 },[]);
 return {value,presented:(duration:number)=>policy.current?.presented(duration),interruptSuccess:()=>policy.current?.interruptSuccess(),success:()=>policy.current?.success(),warning:()=>policy.current?.warning(),reset:()=>policy.current?.reset(),observeWarning:(key:string,present:boolean)=>policy.current?.observeWarning(key,present)};
}
