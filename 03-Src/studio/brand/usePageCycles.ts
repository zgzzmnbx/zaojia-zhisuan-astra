import {useEffect,useState} from 'react';
import {readPageCycles,savePageCycles,pageCyclesKey,pageCyclesEvent} from './sequences.mjs';
export function usePageCycles(){
 const [cycles,setCycles]=useState(readPageCycles);
 useEffect(()=>{const sync=()=>setCycles(readPageCycles()),storage=(e:StorageEvent)=>{if(e.key===pageCyclesKey||e.key===null)sync();};window.addEventListener(pageCyclesEvent,sync);window.addEventListener('storage',storage);return()=>{window.removeEventListener(pageCyclesEvent,sync);window.removeEventListener('storage',storage);};},[]);
 function change(id:'welcome'|'studio',state:'loop'|'paused'|'manual'){const next={...readPageCycles(),[id]:state};savePageCycles(next);setCycles(next);}
 return [cycles,change] as const;
}
