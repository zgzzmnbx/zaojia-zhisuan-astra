import {useEffect,useRef,useState} from 'react';
import {api} from './api';
export type WeKnoraStatus={available:boolean;checking?:boolean;reason?:{code:string;message:string};document_count?:number;documents?:{id:string;name:string}[]};
export function useWeKnora(){
  const [status,setStatus]=useState<WeKnoraStatus>({available:false,checking:true});
  const generation=useRef(0);
  async function refresh(){const id=++generation.current;setStatus(s=>({...s,checking:true}));try{const data=await api<WeKnoraStatus>('/api/astra/weknora/capabilities');if(generation.current===id)setStatus(data);}catch{if(generation.current===id)setStatus({available:false,reason:{code:'UNAVAILABLE',message:'无法检查 WeKnora 连接，请稍后重试'}});}}
  useEffect(()=>{void refresh();return()=>{generation.current++;};},[]);
  return {status,refresh};
}
