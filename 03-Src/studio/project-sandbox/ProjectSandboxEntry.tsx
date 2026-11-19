import {lazy,Suspense,useCallback,useState,type ComponentProps} from 'react';
import {PageLoading} from '../brand/PageLoading';
import {readDisplayParameters} from './parameter-storage';

const Sandbox=lazy(()=>import('./ProjectSandbox'));

export function ProjectSandboxEntry(props:Omit<ComponentProps<typeof Sandbox>,'onLoadingChange'>){
  const [pending,setPending]=useState(true);
  const [infoOpen,setInfoOpen]=useState(()=>readDisplayParameters().infoVisible);
  const update=useCallback((loading:boolean,info:boolean)=>{setPending(loading);setInfoOpen(info);},[]);
  const immersive=props.variant!=='card';
  return <div className="sandbox-scene-slot">
    <Suspense fallback={null}><Sandbox {...props} onLoadingChange={update}/></Suspense>
    {pending&&props.active&&<div className="sandbox-loading" role="status" data-chat-open={immersive&&!props.chatCollapsed} data-info-open={immersive&&!!props.overview&&infoOpen}>
      <PageLoading label="正在加载沙盘…"/>
    </div>}
  </div>;
}
