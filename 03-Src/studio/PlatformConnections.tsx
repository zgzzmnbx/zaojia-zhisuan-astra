import {useCallback,useEffect,useState} from 'react';
import {api,json} from './api';
import {Button,Icon} from './ui';
import './platform-connections.css';
import {platforms,platformStatus,platformTone,platformIssue,type Platform,type BotStatus,type StatusSnapshot} from './platform-status';
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
   const timeout=setTimeout(()=>current.abort(),5000);
   try{
    const data=await api<BotStatus>('/api/collaboration/feishu-app-bot/status',{signal:current.signal});
    if(!Array.isArray(data.profiles))throw new Error('平台状态响应无效');
    if(live&&controller===current&&!current.signal.aborted)setSnapshot({data,error:'',checkedAt:Date.now()});
   }catch{
    if(live&&controller===current&&!document.hidden)setSnapshot({data:null,error:'状态读取失败，请重试。',checkedAt:Date.now()});
   }finally{
    clearTimeout(timeout);
    if(live&&controller===current&&!document.hidden)timer=setTimeout(read,5000);
   }
  }
  function visibility(){clearTimeout(timer);controller?.abort();controller=undefined;if(document.hidden)setSnapshot({data:null,error:'',checkedAt:null});else void read();}
  void read();document.addEventListener('visibilitychange',visibility);window.addEventListener('online',visibility);window.addEventListener('focus',visibility);
  return()=>{live=false;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',visibility);window.removeEventListener('focus',visibility);};
 },[active,revision]);
 return {snapshot,refresh};
}
export function PlatformStatusButtons({snapshot,open}:{snapshot:StatusSnapshot;open:(id:Platform)=>void}){
 return <div className="legacy-top-links" aria-label="飞书与 WeAct 独立连接状态">{platforms.map(p=>{
  const status=platformStatus(snapshot,p.id);
  const tone=platformTone(status),issue=platformIssue(snapshot,p.id);
  return <button type="button" key={p.id} className="btn btn-ghost btn-sm legacy-status-chip" data-tone={tone} aria-label={p.label+'连接情况，'+status} title={p.label+' · '+status+(issue?' · '+issue:'')} onClick={()=>open(p.id)}>{tone!=='healthy'&&<Icon name="alert"/>}{p.label}<span className={status==='运行中'?'is-running':undefined}> · {status}</span></button>;
 })}</div>;
}
export function PlatformConnections({selected,select,snapshot,refresh,onSettings,onReview,onProgress}:{selected:Platform;select:(id:Platform)=>void;snapshot:StatusSnapshot;refresh:()=>void;onSettings:()=>void;onReview:()=>void;onProgress:()=>void}){
 const [pending,setPending]=useState<Platform|null>(null),[feedback,setFeedback]=useState('');
 const [checking,setChecking]=useState<Platform|null>(null);
 useEffect(()=>{
  if(checking&&platformStatus(snapshot,checking)==='运行中'){
   setFeedback(`${platforms.find(p=>p.id===checking)!.label}已连接。`);setChecking(null);
  }
 },[checking,snapshot]);
 async function connect(id:Platform,enabled:boolean){
  if(pending)return;
  setPending(id);setFeedback('');setChecking(null);
  try{
   await api(`/api/astra/connections/platforms/${id}/connection`,json({enabled}));
   setChecking(enabled?id:null);
   setFeedback(`${platforms.find(p=>p.id===id)!.label}${enabled?'正在连接，健康核验通过后更新状态。':'已请求断开连接。'}`);
  }catch(e){setFeedback((e as Error).message);}
  finally{setPending(null);refresh();}
 }
 return <div className="platform-review-hub legacy-connections">
  <div className="platform-review-toolbar"><span className="muted" role="status">{snapshot.error||(!snapshot.data?'正在读取平台状态…':'最近检查 '+new Date(snapshot.checkedAt!).toLocaleTimeString('zh-CN'))}</span><Button icon="refresh" onClick={refresh}>刷新</Button></div>
  <div className="platform-review-intro"><span className="platform-review-symbol"><Icon name="users"/></span><div><strong>同事复核</strong><p>在聊天中确认平台、复核人和发送内容。</p></div></div>
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
    <div><dt>后台监护</dt><dd>{profile?.supervision_ok?'正常':'未就绪'}</dd></div>
   </dl>{profile?.recovery_issue&&<p className="platform-connection-error" role="alert">{profile.recovery_issue}</p>}<div className="platform-connection-control"><Button primary={!profile?.enabled} icon={profile?.enabled?'close':'refresh'} disabled={Boolean(pending)||!profile?.configured||Boolean(profile?.configuration_error)||Boolean(snapshot.error)} onClick={()=>void connect(p.id,!profile?.enabled)}>{pending===p.id?'正在处理…':profile?.enabled?'断开'+p.label:'连接'+p.label}</Button>{(!profile?.configured||profile?.configuration_error)&&<Button icon="settings" onClick={onSettings}>配置</Button>}</div></article>;
  })}</div>
  <div className="platform-review-steps" aria-label="复核流程">{['选择平台与人员','确认后发送','跟踪意见与轮次'].map((label,i)=><span key={label}><i>{i+1}</i>{label}</span>)}</div>
  {feedback&&<p className="platform-connection-feedback" role="status">{feedback}</p>}
  <div className="platform-review-actions"><Button primary icon="users" onClick={onReview}>发起同事复核</Button><Button icon="clock" onClick={onProgress}>复核进度</Button><Button icon="settings" onClick={onSettings}>协同设置</Button></div>
  <p className="platform-review-footnote">{snapshot.data?.profiles.some(p=>p.configured)?'应用配置已读取；接收状态以实际运行检测为准。':'先在协同设置中引用 2.0 的应用配置，或填写独立配置。'}</p>
 </div>;
}
