import {useEffect,useState} from 'react';
import type {TaskActivity} from './task-activity';

/** One slot below the title. A new run cancels the previous handoff. */
export function useTaskDisclosure(activity:TaskActivity|null,scope:string,visible:boolean,reduced:boolean){
 const key=activity?`${scope}:${activity.run}`:'';
 const [state,setState]=useState({key:'',stage:'progress' as 'progress'|'closing'|'details'});
 const stage=state.key===key?state.stage:'progress';
 useEffect(()=>{
  if(!activity||activity.phase==='running'){setState({key,stage:'progress'});return;}
  if(!visible||stage==='details')return;
  // The paint clock gets 700ms to finish a confirmed result. Ending a request
  // alone does not fill that clock; pending/error/cancel details stay truthful.
  const delay=stage==='closing'?(reduced?0:260):activity.phase==='settled'?1000:2400;
  const timer=setTimeout(()=>setState({key,stage:stage==='progress'?'closing':'details'}),delay);
  return()=>clearTimeout(timer);
 },[key,activity?.phase,stage,visible,reduced]);
 return activity?stage:'details';
}
