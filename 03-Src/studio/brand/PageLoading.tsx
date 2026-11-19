import {createContext,Suspense,useCallback,useContext,useLayoutEffect,useState,type ReactNode} from 'react';
import {LoadingLogo} from './LoadingLogo';

export function PageLoading({label, detail, action, active=true, paused=false}:{
  label:string; detail?:string; action?:ReactNode; active?:boolean; paused?:boolean;
}){
  return <div className="page-loading-brand">
    <LoadingLogo size={200} active={active} paused={paused}/>
    <div className="page-loading-caption">
      <span>{label}</span>
      {detail&&<small>{detail}</small>}
      {action}
    </div>
  </div>;
}

const PendingContext=createContext<null|(()=>()=>void)>(null);

/** Keep one visible canvas when the module, its data, and its viewer load in succession. */
export function PageLoadingBoundary({children,label,detail,active=true}:{children:ReactNode;label:string;detail?:string;active?:boolean}){
  const [pending,setPending]=useState(0);
  const register=useCallback(()=>{
    setPending(n=>n+1);
    return ()=>setPending(n=>n-1);
  },[]);
  return <PendingContext.Provider value={register}>
    <Suspense fallback={<PagePending label={label}/>}>{children}</Suspense>
    {active&&pending>0&&<div className="page-loading-layer" role="status"><PageLoading label={label} detail={detail}/></div>}
  </PendingContext.Provider>;
}

export function PagePending({label}:{label:string}){
  const register=useContext(PendingContext);
  useLayoutEffect(()=>register?.(),[register]);
  return register?null:<div className="page-loading-layer" role="status"><PageLoading label={label}/></div>;
}
