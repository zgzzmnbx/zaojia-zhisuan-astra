import {useEffect,useRef,useState} from 'react';
import {Button,Icon,Modal} from '../../studio/ui';
import {workspaceApi,type Asset} from '../../studio/useWorkspace';
const demos=[{id:'demo',title:'工程结算资料与审查协同系统需求说明书',file:'settlement-review.docx',name:'工程结算审查协同需求-演示案例.docx',detail:'演示案例 · 人工构造 · 3 页'},{id:'demo-customer',title:'客户信息管理 · 教材练习题例子1',file:'customer-management.md',name:'客户信息管理-演示案例.md',detail:'演示案例 · 软件工程造价师培训教材练习题'}];

export function DigitalFilePicker({conversationId,close,upload}:{conversationId:string;close:()=>void;upload:(file:File)=>void}){
 const [assets,setAssets]=useState<Asset[]>([]),[selected,setSelected]=useState('demo'),[local,setLocal]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const input=useRef<HTMLInputElement>(null),live=useRef(true),abort=useRef<AbortController|null>(null);
 useEffect(()=>{live.current=true;const controller=new AbortController();void fetch(`${workspaceApi}/assets?scope=conversation&conversation_id=${encodeURIComponent(conversationId)}`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('项目文件读取失败，仍可选演示示例或本地文件');return r.json();}).then(r=>setAssets(r.items.filter((a:Asset)=>/\.(docx|pdf|txt|md)$/i.test(a.name)))).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>{live.current=false;controller.abort();abort.current?.abort();};},[conversationId]);
 async function choose(){
  if(busy)return;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;
  try{
   let file=local;
   if(selected!=='local'){
    const asset=assets.find(a=>a.id===selected);
    const demo=demos.find(d=>d.id===selected);
    const url=demo?`/modules/digital-cost/demo/${demo.file}`:`${workspaceApi}/assets/${asset?.id}?conversation_id=${encodeURIComponent(conversationId)}`;
    if(!demo&&!asset)throw Error('请选择文件');
    const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('文件暂时无法读取，请重试或选择本地文件');
    file=new File([await response.blob()],asset?.name||demo!.name);
   }
   if(!file)throw Error('请选择文件');if(file.size>12*1024*1024)throw Error('请选择不超过 12 MB 的文件');
   if(live.current)upload(file);
  }catch(e){if(live.current)setError((e as Error).message);}finally{if(live.current)setBusy(false);}
 }
 return <Modal title="项目文件" close={close}><div className="digital-file-picker">
  {demos.map(d=><label key={d.id} className={`digital-file-option ${selected===d.id?'selected':''}`}><input className="radio radio-sm" type="radio" name="digital-file" checked={selected===d.id} onChange={()=>setSelected(d.id)} disabled={busy}/><Icon name="file"/><span><strong>{d.title}</strong><small>{d.detail}</small></span></label>)}
  {assets.map(a=><label className="digital-file-option" key={a.id}><input className="radio radio-sm" type="radio" name="digital-file" checked={selected===a.id} onChange={()=>setSelected(a.id)} disabled={busy}/><Icon name="file"/><span><strong>{a.name}</strong><small>当前项目资料</small></span></label>)}
  {local&&<label className="digital-file-option"><input className="radio radio-sm" type="radio" name="digital-file" checked={selected==='local'} onChange={()=>setSelected('local')}/><Icon name="file"/><span><strong>{local.name}</strong><small>本地文件</small></span></label>}
  <input ref={input} hidden type="file" accept=".docx,.pdf,.txt,.md" onChange={e=>{const f=e.target.files?.[0];if(f){setLocal(f);setSelected('local');}e.target.value='';}}/>
  {error&&<p role="alert">{error}</p>}<div className="action-row"><Button disabled={busy} onClick={()=>input.current?.click()}>选择本地文件</Button><Button primary disabled={busy} onClick={()=>void choose()}>{busy?'正在读取…':'上传并打开'}</Button></div>
 </div></Modal>;
}
