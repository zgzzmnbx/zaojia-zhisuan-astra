import {useCallback,useEffect,useState} from 'react';
import {api} from './api';
import {Button,Note} from './ui';
import {platforms,platformStatus,type Platform,type BotStatus,type StatusSnapshot} from './platform-status';
import '../frontend-debug/legacy-system/legacy-system.css';

export function usePlatformStatus(active:boolean){
 const [snapshot,setSnapshot]=useState<StatusSnapshot>({data:null,error:'',checkedAt:null});
 const [revision,setRevision]=useState(0);
 const refresh=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{
  if(!active){setSnapshot({data:null,error:"",checkedAt:null});return;}
  let live=true,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
  async function read(){
   if(!live||document.hidden)return;
   controller?.abort();controller=new AbortController();
   const current=controller;
   const timeout=setTimeout(()=>current.abort(),10000);
   try{
    const data=await api<BotStatus>('/api/collaboration/feishu-app-bot/status',{signal:current.signal});
    if(!Array.isArray(data.profiles))throw new Error('平台状态响应无效');
    if(live&&controller===current&&!current.signal.aborted)setSnapshot({data,error:'',checkedAt:Date.now()});
   }catch{
    if(live&&controller===current&&!document.hidden)setSnapshot({data:null,error:'状态读取失败，请重试。',checkedAt:Date.now()});
   }finally{
    clearTimeout(timeout);
    if(live&&controller===current&&!document.hidden)timer=setTimeout(read,15000);
   }
  }
  function visibility(){clearTimeout(timer);controller?.abort();controller=undefined;if(document.hidden)setSnapshot({data:null,error:'',checkedAt:null});else void read();}
  void read();document.addEventListener('visibilitychange',visibility);
  return()=>{live=false;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',visibility);};
 },[active,revision]);
 return {snapshot,refresh};
}
export function PlatformStatusButtons({snapshot,open}:{snapshot:StatusSnapshot;open:(id:Platform)=>void}){
 return <div className="legacy-top-links" aria-label="飞书与 WeAct 独立连接状态">{platforms.map(p=>{
  const status=platformStatus(snapshot,p.id);
  return <button type="button" key={p.id} className="btn btn-ghost btn-sm legacy-status-chip" aria-label={p.label+'连接情况，'+status} title={p.label+' · '+status+' · Astra 独立工作区'} onClick={()=>open(p.id)}>{p.label}<span> · {status}</span></button>;
 })}</div>;
}
export function PlatformConnections({selected,select,snapshot,refresh}:{selected:Platform;select:(id:Platform)=>void;snapshot:StatusSnapshot;refresh:()=>void}){
 return <div className="panel-content legacy-connections"><div className="section-caption"><h3>双平台连接状态</h3><Button icon="refresh" onClick={refresh}>刷新状态</Button></div>
  <Note>以下来自当前 Astra 独立后端。仅查看状态；不会启动机器人、启用接收或发送消息。原系统与云端实例的状态不在此范围。</Note>
  <p className="muted" role="status">{snapshot.error||(!snapshot.data?'尚未检测': '状态接口可达 · 最近检查 '+new Date(snapshot.checkedAt!).toLocaleTimeString('zh-CN'))}</p>
  <div className="legacy-platform-grid">{platforms.map(p=>{
   const profile=snapshot.data?.profiles.find(item=>item.profile_id===p.id),health=profile?.health;
   const verified=Boolean(!snapshot.error&&profile?.running&&health?.fresh);
   const fact=(value:boolean|undefined,yes:string,no:string)=>verified?(value?yes:no):'未核验';
   return <article key={p.id} className={'card legacy-platform '+(selected===p.id?'is-selected':'')}><button type="button" className="legacy-platform-title" aria-pressed={selected===p.id} onClick={()=>select(p.id)}><strong>{p.label}</strong><span className="badge badge-outline">{platformStatus(snapshot,p.id)}</span></button><dl>
    <div><dt>平台域名</dt><dd>{profile?.domain_host||(snapshot.data?'未配置':'未读取')}</dd></div>
    <div><dt>应用标识</dt><dd>{profile?.app_id_suffix?'尾号 '+profile.app_id_suffix:(snapshot.data?'未配置':'未读取')}</dd></div>
    <div><dt>接收长连接</dt><dd>{fact(health?.connected,'已连接','未连接')}</dd></div>
    <div><dt>应用身份</dt><dd>{fact(health?.identity_ready,'已核验','待恢复')}</dd></div>
    <div><dt>机器人业务后端</dt><dd>{fact(health?.backend_ok,'健康','异常')}</dd></div>
   </dl></article>;
  })}</div><p className="muted">仅当进程、心跳、应用身份、业务后端及消息队列检查均通过时显示“运行中”。配置存在不代表连接成功；启停与平台配置仍在专业协同工具中操作。</p></div>;
}
