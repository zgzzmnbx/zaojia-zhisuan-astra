import {useEffect,useState} from 'react';
import {readLoadingMotion,saveLoadingMotion,loadingLogoKey,loadingLogoEvent,type LoadingMotion} from './loading-preferences';
export function useLoadingMotion(){
 const [motion,setMotion]=useState(readLoadingMotion);
 useEffect(()=>{
  const sync=()=>setMotion(readLoadingMotion());
  const storage=(e:StorageEvent)=>{if(e.key===loadingLogoKey||e.key===null)sync();};
  window.addEventListener(loadingLogoEvent,sync);window.addEventListener('storage',storage);sync();
  return()=>{window.removeEventListener(loadingLogoEvent,sync);window.removeEventListener('storage',storage);};
 },[]);
 return [motion,(next:LoadingMotion)=>{saveLoadingMotion(next);setMotion(next);}] as const;
}
