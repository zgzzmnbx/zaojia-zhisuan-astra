import {useEffect,useState} from 'react';
import {api} from './api';
import {Icon} from './ui';
import {gorkPlatformPresentation,type GorkPlatform} from './gork-platform-status';
import './gork-connection.css';

export function GorkConnection({active,open}:{active:boolean;open:()=>void}){
 const [value,setValue]=useState<GorkPlatform|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!active)return;
  let live=true,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
  async function read(){
   clearTimeout(timer);controller?.abort();
   if(!live||document.hidden)return;
   const current=new AbortController();controller=current;
   const timeout=setTimeout(()=>current.abort(),5000);
   try{
    const result=await api<GorkPlatform>('/api/astra/gork/notifications/platform',{signal:current.signal});
    if(live&&controller===current){setValue(result);setFailed(false);}
   }catch{if(live&&controller===current&&!document.hidden)setFailed(true);}
   finally{clearTimeout(timeout);if(live&&controller===current&&!document.hidden)timer=setTimeout(read,10000);}
  }
  function visibility(){clearTimeout(timer);controller?.abort();controller=undefined;if(document.hidden){setValue(null);setFailed(false);}else void read();}
  void read();document.addEventListener('visibilitychange',visibility);window.addEventListener('online',visibility);window.addEventListener('focus',visibility);
  return()=>{live=false;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',visibility);window.removeEventListener('focus',visibility);};
 },[active]);
 const status=gorkPlatformPresentation(value,failed);
 return <div className="tooltip tooltip-bottom header-icon-tip" data-tip={status.label}><button type="button" className="btn btn-ghost btn-square header-icon-action gork-platform-icon" data-tone={status.tone} aria-label={status.label+'，打开机器人联动'} title={status.label} onClick={open}><Icon name="robot"/></button></div>;
}
