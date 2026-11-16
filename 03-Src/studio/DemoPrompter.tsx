import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {api,json} from './api';
import {cueEvent,type CueDocument} from './demo-cues';
import {Button,Modal} from './ui';
import './demo-cues.css';

const endpoint='/api/astra/demo-cues';
export function DemoPrompter({enabled,pageCue}:{enabled:boolean;pageCue:string|undefined}){
 const [documentData,setDocumentData]=useState<CueDocument>(),[selected,setSelected]=useState(pageCue||'intro');
 const [host,setHost]=useState<Element>(document.body),node=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{if(enabled&&pageCue)setSelected(pageCue);},[enabled,pageCue]);
 useEffect(()=>{
  if(!enabled)return;
  const change=(event:Event)=>setSelected((event as CustomEvent<string>).detail);
  window.addEventListener(cueEvent,change);
  return()=>window.removeEventListener(cueEvent,change);
 },[enabled]);
 useEffect(()=>{
  if(!enabled)return;
  let disposed=false,timer=0,request:AbortController|undefined;
  const poll=async()=>{
   request=new AbortController();const timeout=window.setTimeout(()=>request?.abort(),4000);
   try{const next=await api<CueDocument>(endpoint,{signal:request.signal});if(!disposed)setDocumentData(next);}
   catch{if(!disposed)setDocumentData(undefined);}
   finally{clearTimeout(timeout);if(!disposed)timer=window.setTimeout(poll,5000);}
  };
  void poll();return()=>{disposed=true;clearTimeout(timer);request?.abort();};
 },[enabled]);
 useEffect(()=>{
  if(!enabled)return;
  const sync=()=>{
   const dialogs=document.querySelectorAll('dialog:modal');
   const next=dialogs[dialogs.length-1]||document.fullscreenElement||document.body;
   setHost(current=>current===next?current:next);
  };
  sync();const observer=new MutationObserver(sync);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('fullscreenchange',sync);
  return()=>{observer.disconnect();document.removeEventListener('fullscreenchange',sync);};
 },[enabled]);
 const entries=documentData?.entries||[],index=entries.findIndex(e=>e.id===selected),entry=entries[index];
 useLayoutEffect(()=>{if(enabled&&entry)node.current?.showPopover?.();},[enabled,entry,host]);
 if(!enabled||!entry)return null;
 return createPortal(<div ref={node} popover="manual" className="studio demo-prompter" aria-label="演示提词" data-cue={entry.id}>
  <div className="demo-prompter-controls">
   <button type="button" aria-label="上一段提词" disabled={index===0} onClick={()=>setSelected(entries[index-1].id)}>‹</button>
   <select aria-label="选择提词段落" value={selected} onChange={e=>setSelected(e.target.value)}>{entries.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select>
   <button type="button" aria-label="下一段提词" disabled={index===entries.length-1} onClick={()=>setSelected(entries[index+1].id)}>›</button>
  </div>
  <p>{entry.text}</p>
 </div>,host);
}

export function DemoCueEditor({close}:{close:()=>void}){
 const [data,setData]=useState<CueDocument>(),[selected,setSelected]=useState(''),[text,setText]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 const dirty=!!data&&text!==data.entries.find(e=>e.id===selected)?.text;
 async function load(){try{const next=await api<CueDocument>(endpoint);setData(next);const entry=next.entries.find(e=>e.id===selected)||next.entries[0];setSelected(entry.id);setText(entry.text);setError('');setMessage('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void load();},[]);
 const safeClose=()=>{if(!dirty||window.confirm('放弃尚未保存的提词修改？'))close();};
 return <div onKeyDownCapture={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();safeClose();}}}><Modal title="编辑演示提词" close={safeClose}>
  <div className="demo-cue-editor">
   {data&&<><label>段落<select className="select select-bordered" aria-label="编辑提词段落" disabled={saving} value={selected} onChange={e=>{if(dirty&&!window.confirm('放弃当前段落尚未保存的修改？'))return;const entry=data.entries.find(v=>v.id===e.target.value)!;setSelected(entry.id);setText(entry.text);setMessage('');}}>{data.entries.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
   <label>讲解原话<textarea className="textarea textarea-bordered" aria-label="提词正文" maxLength={4000} rows={8} disabled={saving} value={text} onChange={e=>{setText(e.target.value);setMessage('');}}/></label>
   <details><summary>文档位置</summary><p className="demo-cue-path">{data.path}</p></details></>}
   {error&&<p role="alert">{error}</p>}<span role="status">{message}</span>
   <div className="modal-action"><Button disabled={saving} onClick={()=>{if(!dirty||window.confirm('重新读取会放弃尚未保存的修改，继续？'))void load();}}>重新读取</Button><Button primary disabled={!data||saving||!dirty||!text.trim()} onClick={async()=>{if(!data)return;setSaving(true);try{const next=await api<CueDocument>(endpoint,{...json({revision:data.revision,id:selected,text}),method:'PUT'});setData(next);setText(next.entries.find(e=>e.id===selected)!.text);setError('');setMessage('提词已保存');}catch(e){setError((e as Error).message);}finally{setSaving(false);}}}>{saving?'正在保存…':'保存提词'}</Button></div>
  </div>
 </Modal></div>;
}
