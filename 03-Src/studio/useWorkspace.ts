import type {DocumentSource,DocumentState} from './document-types';
import {useEffect,useRef,useState} from 'react';
import {api,json} from './api';
import type {Message,SheetConfig,View} from './types';

export const workspaceApi='/api/astra/workspace';
export type Project={id:string;name:string;background:string};
export type Snapshot={selectedDocument?:DocumentSource|null;documents?:Record<string,DocumentState>;messages:Message[];draft:string;locatedRow?:number;context:string;inputFileId:string;project:string;sheets:SheetConfig[];job_id:string;view:View;visible:boolean;sheetIndex:number;panelProjectId?:string;chatMode?:'task'|'knowledge';knowledgeOptions?:{library_ids:string[]|null;retrieval_mode:'classic'|'hybrid';engine?:'local'|'weknora'|'compare'}};
export type Conversation={id:string;title:string;project_id:string|null;revision:number;preview?:string;job_id?:string;state?:Partial<Snapshot>};
export type Asset={id:string;name:string;size:number;sha256:string;project_id:string|null;public:number;created_at:string};
type Index={projects:Project[];conversations:Conversation[];jobs:Record<string,string>};
const clientId=sessionStorage.getItem('astra.client-id')||crypto.randomUUID();
sessionStorage.setItem('astra.client-id',clientId);
const pendingKey=(id:string)=>`astra.unsaved.${clientId}.${id}`;

export function useWorkspace(snapshot:Snapshot,apply:(state:Partial<Snapshot>,conversation:Conversation)=>Promise<void>){
  const [index,setIndex]=useState<Index>({projects:[],conversations:[],jobs:{}});
  const [active,setActive]=useState<Conversation|null>(null);
  const [ready,setReady]=useState(false);const [status,setStatus]=useState('正在载入对话');const [error,setError]=useState('');
  const [recovery,setRecovery]=useState('');
  const activeRef=useRef<Conversation|null>(null), current=useRef(snapshot), applyRef=useRef(apply);
  current.current=snapshot;applyRef.current=apply;
  const hydrated=useRef(false), saved=useRef(''), flight=useRef<Promise<void>|null>(null), mounted=useRef(true);
  const switching=useRef(false);
  async function refresh(){const data=await api<Index>(workspaceApi);if(mounted.current)setIndex(data);return data;}
  async function flush(){
    if(flight.current){await flight.current;return flush();}
    if(!hydrated.current||!activeRef.current)return;
    const conv=activeRef.current,state=current.current, encoded=JSON.stringify(state);
    if(encoded===saved.current)return;
    const title=conv.title==='新对话'?(state.project?.slice(0,60)||state.messages.find(m=>m.role==='user')?.text.slice(0,40)||conv.title):conv.title;
    const cached=localStorage.getItem(pendingKey(conv.id));let previous:any=null;
    try{previous=cached?JSON.parse(cached):null;}catch{/* An invalid browser cache never overrides the database. */}
    const payload=previous?.encoded===encoded&&previous?.revision===conv.revision?previous:{state,title,revision:conv.revision,write_token:crypto.randomUUID(),encoded};
    localStorage.setItem(pendingKey(conv.id),JSON.stringify(payload));setStatus('正在保存');setError('');
    const work=(async()=>{
      try{
        const response=await api<{revision:number}>(`${workspaceApi}/conversations/${conv.id}`,{...json(payload),method:'PUT'});
        const updated={...conv,title,revision:response.revision};activeRef.current=updated;setActive(updated);saved.current=encoded;
        localStorage.removeItem(pendingKey(conv.id));setStatus('已保存');await refresh();
      }catch(e){setStatus('尚未保存');setError((e as Error).message);throw e;}
    })();flight.current=work;
    try{await work;}finally{flight.current=null;}
    if(JSON.stringify(current.current)!==saved.current)await flush();
  }
  async function load(id:string){
    hydrated.current=false;setReady(false);
    try{
    const conv=await api<Conversation>(`${workspaceApi}/conversations/${id}`);
    let state=conv.state||{};const pending=localStorage.getItem(pendingKey(id));let recovery='';
    const archiveKey=`astra.recovery.${clientId}.${id}`;
    setRecovery(localStorage.getItem(archiveKey)||'');
    if(pending){try{const cache=JSON.parse(pending);if(cache.revision===conv.revision){state=cache.state;recovery='已恢复未保存草稿';}else{
      localStorage.setItem(archiveKey,pending);localStorage.removeItem(pendingKey(id));setRecovery(pending);
      recovery='发现其他窗口更新；本机未保存内容可导出核对。';
    }}catch{recovery='本机草稿缓存不可读，已载入已保存对话。';}}
    await applyRef.current(state,conv);activeRef.current=conv;setActive(conv);localStorage.setItem('astra.active-conversation',id);saved.current=JSON.stringify(conv.state||{});setStatus(recovery||'已保存');setError('');}
    finally{hydrated.current=Boolean(activeRef.current);setReady(Boolean(activeRef.current));}
  }
  async function transition(work:()=>Promise<void>){
    if(switching.current)throw new Error('对话正在切换，请稍候');
    switching.current=true;setReady(false);
    try{await flush();await work();}
    finally{switching.current=false;setReady(Boolean(activeRef.current));}
  }
  async function select(id:string){await transition(()=>load(id));}
  async function create(project_id?:string){await transition(async()=>{const conv=await api<Conversation>(`${workspaceApi}/conversations`,json({project_id}));await load(conv.id);await refresh();});}
  async function rename(title:string){await flush();if(!activeRef.current)return;const conv={...activeRef.current,title};activeRef.current=conv;setActive(conv);saved.current='';await flush();}
  async function assign(project_id:string){await transition(async()=>{if(!activeRef.current)return;const id=activeRef.current.id;await api(`${workspaceApi}/conversations/${id}/project`,json({project_id}));await load(id);await refresh();});}
  const encoded=JSON.stringify(snapshot);
  useEffect(()=>{if(!ready)return;const timer=setTimeout(()=>void flush().catch(()=>{}),500);return()=>clearTimeout(timer);},[encoded,ready]);
  useEffect(()=>{
    const unload=(e:BeforeUnloadEvent)=>{if(hydrated.current&&activeRef.current&&JSON.stringify(current.current)!==saved.current){
      const conv=activeRef.current;localStorage.setItem(pendingKey(conv.id),JSON.stringify({state:current.current,title:conv.title,revision:conv.revision,write_token:crypto.randomUUID(),encoded:JSON.stringify(current.current)}));e.preventDefault();
    }};
    window.addEventListener('beforeunload',unload);
    void refresh().then(async data=>{const last=localStorage.getItem('astra.active-conversation');const id=data.conversations.find(c=>c.id===last)?.id||data.conversations[0]?.id;if(id)await load(id);else await create();}).catch(e=>{setError(e.message);setStatus('对话载入失败');});
    return()=>{mounted.current=false;window.removeEventListener('beforeunload',unload);};
  },[]);
  function exportDraft(){const content=recovery||JSON.stringify(current.current,null,2);const url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='智算Astra-未保存对话.json';link.click();URL.revokeObjectURL(url);}
  return {...index,currentConversation:()=>activeRef.current,active,ready,status,error,recovery,exportDraft,refresh,flush,select,create,rename,assign};
}
