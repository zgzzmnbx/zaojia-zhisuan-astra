import {useCallback,useEffect,useRef,useState} from 'react';
import {api,json} from './api';

export type DemoSettings={revision:number;enabled:boolean;rowPreset:boolean;reportPreset:boolean;knowledgePreset:boolean};
const endpoint='/api/astra/demo-settings',signalKey='astra.demo-settings.changed';
export const readDemoSettings=()=>api<DemoSettings>(endpoint);
export const saveDemoSettings=(value:DemoSettings)=>api<DemoSettings>(endpoint,{...json(value),method:'PUT'});

export function useDemoSettings(){
 const [value,setValue]=useState<DemoSettings>(),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const sequence=useRef(0),pending=useRef(false),alive=useRef(true);
 const refresh=useCallback(async()=>{
  if(pending.current)return;
  const id=++sequence.current;
  try{const next=await readDemoSettings();if(alive.current&&id===sequence.current){setValue(next);setError('');}}
  catch(e){if(alive.current&&id===sequence.current){setValue(undefined);setError((e as Error).message);}}
 },[]);
 useEffect(()=>{
  alive.current=true;void refresh();
  const sync=()=>{if(!document.hidden)void refresh();};
  const storage=(e:StorageEvent)=>{if(e.key===signalKey)sync();};
  window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);window.addEventListener('storage',storage);
  const timer=window.setInterval(sync,10000);
  return()=>{alive.current=false;sequence.current++;clearInterval(timer);window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',sync);window.removeEventListener('storage',storage);};
 },[refresh]);
 const save=async(next:DemoSettings)=>{
  if(pending.current)throw Error('演示设置正在保存');
  pending.current=true;sequence.current++;setSaving(true);
  try{const saved=await saveDemoSettings(next);if(alive.current){setValue(saved);setError('');}try{localStorage.setItem(signalKey,String(Date.now()));}catch{}return saved;}
  catch(e){if(alive.current)setError((e as Error).message);throw e;}
  finally{pending.current=false;if(alive.current)setSaving(false);}
 };
 return {value,error,saving,refresh,save};
}
export type DemoController=ReturnType<typeof useDemoSettings>;
