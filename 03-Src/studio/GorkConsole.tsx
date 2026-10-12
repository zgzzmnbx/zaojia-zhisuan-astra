import {useEffect,useRef,useState} from 'react';
import {api} from './api';
import {Gork,Icon} from './ui';
import {robotExpressions} from './useGorkSettings';
import {expressionLabels} from './gork-preferences';
import {debugSubmission,deliveryLabel,notificationFailure} from './gork-notification-feedback';
import type {NotificationFeedback} from './gork-notification-feedback';
import './gork-console.css';

type Stage={enabled:boolean;expression:string;expression_mode:'once'|'loop';kind:'state'|'notice';text:string;duration_ms:number;speech:boolean;speech_text:string;display_target:'inherit'|'desktop'|'watch'|'both'|'none';speech_target:'inherit'|'current'|'pc'|'watch';ttl_ms:number;priority:number};
type Settings={revision:number;enabled:boolean;token_file:string;display_target:string;sound:boolean;speech_target:string;speech_mode:string;heartbeat_ms:number;lease_ms:number;stages:Record<string,Stage>};
type Runtime={state:string;message:string;legacy?:{tracking:boolean;message:string;version?:string};policy?:{display_targets:string[];speech_targets:string[];max_priority:number};current_sound_target?:string;history?:{event_id:string;stage:string;status:string;delivery:Record<string,string>;error:string}[]};
type Response={settings:Settings;defaults:Record<string,Stage>;stages:{id:string;label:string}[];status:Runtime};
type DebugRecord={event_id:string;task_id:string;attempt:string;status:string;remote_confirmed?:boolean;request:{stage:string;sequence:number;kind:string;expression:string;text:string;display_target:string;speech:{text:string;target:string}|null};delivery:Record<string,string>;error:string};
const route='/api/astra/gork/notifications';
const targetLabels:Record<string,string>={desktop:'桌面小人',watch:'Watch',pc:'电脑',both:'两端',none:'不显示',current:'沿用控制台',inherit:'沿用统一设置'};
const stateLabels:Record<string,string>={ready:'接口就绪',disabled:'已关闭',unconfigured:'待登记',unavailable:'待连接',error:'通知异常'};
const receipts:Record<string,string>={pending:'待提交',queued:'已入队',dispatching:'输出中',active:'状态有效',completed:'输出完成',partial:'部分完成',failed:'失败',cancelled:'已取消',superseded:'已取代',expired:'已过期',interrupted:'已中断'};
export function localStagePreview(template:string){return template.replace(/\{(amount|review|warnings|task)\}/g,(_,key:string)=>({amount:'表内含税总额9447173元。公式重算未确认。',review:'1项待复核。',warnings:'2项需复核。',task:'示例任务'} as Record<string,string>)[key]);}

export function GorkConsole({active=true,onBusy=()=>{}}:{active?:boolean;onBusy?:(label:string)=>void}){
 const [response,setResponse]=useState<Response>(),[form,setForm]=useState<Settings>(),[selected,setSelected]=useState('match_completed');
 const [dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[playing,setPlaying]=useState(false);
 const [page,setPage]=useState<'stages'|'debug'>('stages'),[debug,setDebug]=useState<DebugRecord>(),[sending,setSending]=useState(false),[includeAmount,setIncludeAmount]=useState(false),[amount,setAmount]=useState('9447173.00');
 const debugId=useRef(''),debugInFlight=useRef(false);
 const [feedback,setFeedback]=useState<NotificationFeedback>(),feedbackNode=useRef<HTMLDivElement>(null);
 const alive=useRef(true),inflight=useRef(false),dirtyRef=useRef(false),controller=useRef<AbortController|null>(null);
 const busyRef=useRef(onBusy);busyRef.current=onBusy;
 async function read(){
  if(inflight.current)return;inflight.current=true;controller.current?.abort();const abort=new AbortController();controller.current=abort;
  try{const value=await api<Response>(route,{signal:abort.signal});if(alive.current){setResponse(value);if(!dirtyRef.current)setForm(value.settings);setError('');setFeedback(undefined);}}
  catch(e){if(alive.current&&!abort.signal.aborted)setError((e as Error).message);}
  finally{inflight.current=false;}
 }
 useEffect(()=>{alive.current=true;void read();return()=>{alive.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{if(!active)setPlaying(false);},[active]);
 useEffect(()=>{if(active&&page==='debug'&&feedback)feedbackNode.current?.scrollIntoView({block:'nearest',behavior:'auto'});},[feedback,active,page]);
 useEffect(()=>{if(!active||!debug?.event_id||!['pending','queued','dispatching','active','partial'].includes(debug.status))return;
  const abort=new AbortController(),id=debug.event_id;let stopped=false,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{try{const record=await api<DebugRecord>(`${route}/debug/${id}`,{signal:abort.signal});if(!stopped&&debugId.current===id)setDebug(record);}catch(e){if(!abort.signal.aborted&&!stopped){const next=notificationFailure((e as Error).message,'receipt');setFeedback(previous=>previous?.title===next.title&&previous?.message===next.message?previous:next);}}finally{if(!stopped)timer=setTimeout(poll,2000);}};
  timer=setTimeout(poll,600);return()=>{stopped=true;clearTimeout(timer);abort.abort();};
 },[active,debug?.event_id,debug?.status]);
 async function debugAction(action:'send'|'cancel'|'heartbeat'){
  if(debugInFlight.current)return;debugInFlight.current=true;setSending(true);busyRef.current('正在处理调试通知');setFeedback(undefined);
  try{const path=action==='send'?'/debug/send':action==='cancel'?'/debug/cancel':`/debug/${debugId.current}/heartbeat`;
   const value=await api<DebugRecord&{remote_confirmed?:boolean}>(route+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action==='send'?{stage:selected,include_amount:includeAmount,amount}:{})});
   if(alive.current){if(action==='cancel'){debugId.current='';setDebug(previous=>previous?{...previous,status:'cancelled'}:previous);setFeedback({title:value.remote_confirmed===false?'本地已取消 · 控制台尚未确认':'控制台已确认取消',message:value.remote_confirmed===false?'取消请求正在重试，远端输出可能仍在进行。':'本轮调试通知已取消，下一次发送会开始新一轮。',code:'',console:value.remote_confirmed===false});}else{debugId.current=value.event_id;setDebug(value);if(action==='heartbeat')setFeedback({title:'控制台已确认报活',message:'当前状态已续期，不会重复播放语音。',code:'',console:false});}}
  }catch(e){if(alive.current)setFeedback(notificationFailure((e as Error).message,action,response?.status.legacy?.tracking));}finally{debugInFlight.current=false;if(alive.current)setSending(false);busyRef.current('');}
 }
 function change(patch:Partial<Settings>){setForm(previous=>previous?{...previous,...patch}:previous);dirtyRef.current=true;setDirty(true);setSaved(false);}
 const stage=form?.stages[selected];
 function update(patch:Partial<Stage>){if(form&&stage)change({stages:{...form.stages,[selected]:{...stage,...patch}}});setPlaying(false);}
 async function save(){
  if(!form||saving||inflight.current)return;setSaving(true);busyRef.current('正在保存阶段通知');setError('');
  try{const value=await api<Response>(route,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});if(alive.current){setResponse(value);setForm(value.settings);dirtyRef.current=false;setDirty(false);setSaved(true);}}
  catch(e){if(alive.current)setError((e as Error).message);}
  finally{if(alive.current)setSaving(false);busyRef.current('');}
 }
 if(!form||!response||!stage)return <div className="gork-console"><p role={error?'alert':'status'}>{error||'正在读取阶段通知设置…'}</p>{error&&<button className="btn btn-outline" onClick={()=>void read()}>重新读取</button>}</div>;
 const label=response.stages.find(s=>s.id===selected)?.label||selected;
 const consoleVersion=(response.status.legacy?.version||'0.0.0').split('-')[0].split('.').map(Number);
 const legacyHash=consoleVersion[0]>0||consoleVersion[1]>20||(consoleVersion[1]===20&&consoleVersion[2]>=28)?'external':'cost';
 const statusIssue=response.status.state==='unavailable'?notificationFailure(response.status.message,'send',response.status.legacy?.tracking):undefined;
 const shownFeedback=feedback||statusIssue&&{...statusIssue,title:statusIssue.title.replace(/^未发送/,'暂不可发送')};
 const submission=debug?debugSubmission(debug):undefined;
 const recordFailure=debug?.error?notificationFailure(debug.error,'delivery'):undefined;
 const debugAmount=includeAmount&&selected==='match_completed'?`表内含税总额${amount}元。公式重算未确认。`:'请查看结果。';
 let debugText=stage.text.replace(/\{(amount|review|warnings|task)\}/g,(_,key:string)=>({amount:debugAmount,review:'1项待复核。',warnings:selected==='warning_completed'?'未发现经验偏离。':'2项需复核。',task:'独立调试任务'} as Record<string,string>)[key]);
 if(includeAmount&&selected==='match_completed'&&!debugText.includes(debugAmount))debugText+=' '+debugAmount;
 const select=(key:keyof Stage,title:string,options:string[])=><label><span>{title}</span><select className="select" value={String(stage[key])} onChange={e=>update({[key]:e.target.value})}>{options.map(value=><option key={value} value={value}>{targetLabels[value]||value}</option>)}</select></label>;
 return <div className="gork-console">
  <div className="notification-status"><div><span className="badge badge-outline">{stateLabels[response.status.state]||'检测中'}</span><p role="status">{statusIssue?statusIssue.title.replace(/^未发送 · /,''):response.status.message}</p></div><label className="notification-toggle"><span>启用阶段通知</span><input className="toggle toggle-sm" type="checkbox" checked={form.enabled} disabled={saving} onChange={e=>change({enabled:e.target.checked})}/></label></div>
  <details className="notification-connection"><summary>连接与统一输出</summary><div className="notification-connection-body">
   <label className="notification-wide"><span>独立凭据文件</span><input className="input" value={form.token_file} maxLength={512} onChange={e=>change({token_file:e.target.value})}/></label>
   <div className="notification-fields"><label><span>显示位置</span><select className="select" value={form.display_target} onChange={e=>change({display_target:e.target.value})}>{['both','desktop','watch','none'].map(id=><option key={id} value={id}>{targetLabels[id]}</option>)}</select></label><label><span>声音位置</span><select className="select" value={form.speech_target} onChange={e=>change({speech_target:e.target.value})}>{['current','pc','watch'].map(id=><option key={id} value={id}>{targetLabels[id]}</option>)}</select></label>
   <label><span>报活间隔 · 秒</span><input className="input" type="number" min={1} max={30} value={form.heartbeat_ms/1000} onChange={e=>change({heartbeat_ms:Math.round(Number(e.target.value)*1000)})}/></label><label><span>失联复位 · 秒</span><input className="input" type="number" min={3} max={90} value={form.lease_ms/1000} onChange={e=>change({lease_ms:Math.round(Number(e.target.value)*1000)})}/></label>
   <label><span>语音生成</span><select className="select" value={form.speech_mode} onChange={e=>change({speech_mode:e.target.value})}><option value="auto">沿用当前音色</option><option value="tts">当前 TTS</option><option value="cached">仅固定短句缓存</option></select></label><label className="notification-checkbox"><input className="checkbox checkbox-sm" type="checkbox" checked={form.sound} onChange={e=>change({sound:e.target.checked})}/><span>开启阶段语音</span></label></div>
   {response.status.policy&&<p className="notification-help">获准显示：{response.status.policy.display_targets.map(x=>targetLabels[x]||x).join(' / ')||'无'}；声音：{response.status.policy.speech_targets.map(x=>targetLabels[x]||x).join(' / ')||'无'}；最高优先级：{response.status.policy.max_priority}</p>}
   <div className="notification-link-actions"><a className="btn btn-outline" href="http://127.0.0.1:8766/#external" target="_blank" rel="noreferrer">控制台登记与授权<Icon name="arrow-up-right"/></a><button type="button" className="btn btn-ghost" disabled={saving} onClick={()=>void read()}><Icon name="refresh"/>重新检测</button></div>
  </div></details>
  {response.status.legacy?.tracking&&<p className="notification-legacy">兼容任务哨兵正在跟踪 Astra · {response.status.legacy.version}<a href={`http://127.0.0.1:8766/#${legacyHash}`} target="_blank" rel="noreferrer">查看现用联动</a></p>}
  <div className="notification-pages" aria-label="通知设置页面"><button type="button" className="btn btn-ghost" aria-pressed={page==='stages'} onClick={()=>setPage('stages')}>阶段设置</button><button type="button" className="btn btn-ghost" aria-pressed={page==='debug'} onClick={()=>{setPage('debug');setPlaying(false);}}>调试</button></div>
  <div className="notification-editor">
   <nav className="notification-stages" aria-label="通知阶段">{response.stages.map(item=><button type="button" key={item.id} aria-pressed={selected===item.id} onClick={()=>{setSelected(item.id);setPlaying(false);}}><span className={form.stages[item.id].enabled?'stage-dot enabled':'stage-dot'}/><span>{item.label}</span>{form.stages[item.id].kind==='state'&&<small>持续</small>}</button>)}</nav>
   {page==='debug'?<section className="notification-debug" aria-label="手动阶段调试"><div className="notification-stage-heading"><strong>{label}</strong><span className="badge badge-outline">独立测试信号</span></div><p className="notification-help">使用已保存的阶段文案，不创建业务任务。</p>
    <dl className="notification-debug-summary"><div><dt>表情 / 类型</dt><dd>{expressionLabels[stage.expression]||stage.expression} · {stage.kind==='state'?'持续状态':'短提醒'}</dd></div><div><dt>显示位置</dt><dd>{targetLabels[stage.display_target==='inherit'?form.display_target:stage.display_target]}</dd></div><div><dt>声音</dt><dd>{form.sound&&stage.speech?targetLabels[stage.speech_target==='inherit'?form.speech_target:stage.speech_target]:'关闭'}</dd></div></dl>
    <div className="notification-debug-copy"><small>模拟消息预览</small><p>{debugText}</p></div>
    {selected==='match_completed'&&<div className="notification-debug-amount"><label className="notification-checkbox"><input type="checkbox" className="checkbox checkbox-sm" checked={includeAmount} onChange={e=>setIncludeAmount(e.target.checked)}/><span>附加模拟金额</span></label>{includeAmount&&<label className="notification-wide"><span>模拟金额 · 元</span><input className="input" value={amount} inputMode="decimal" maxLength={24} onChange={e=>setAmount(e.target.value)}/></label>}</div>}
    <div className="notification-debug-actions"><button className="btn btn-primary" type="button" disabled={dirty||saving||sending||!stage.enabled} onClick={()=>void debugAction('send')}>{sending?'处理中…':'发送此阶段信号'}</button><button type="button" className="btn btn-outline" disabled={!debug||sending||saving} onClick={()=>void debugAction('cancel')}>取消调试通知</button>{debug?.request.kind==='state'&&['active','partial'].includes(debug.status)&&<button type="button" className="btn btn-ghost" disabled={sending} onClick={()=>void debugAction('heartbeat')}>为此状态报活</button>}</div>
    {sending&&<p role="status" className="notification-help">正在提交调试请求，等待控制台确认…</p>}
    {!sending&&shownFeedback&&<div ref={feedbackNode} className="notification-debug-feedback" role={shownFeedback.code?'alert':'status'}><strong>{shownFeedback.title}</strong><p>{shownFeedback.message}</p><div className="notification-link-actions">{shownFeedback.console&&<a className="btn btn-outline" href={`http://127.0.0.1:8766/#${legacyHash}`} target="_blank" rel="noreferrer">打开通知哨兵<Icon name="arrow-up-right"/></a>}<button className="btn btn-ghost" type="button" onClick={()=>void read()} disabled={saving||sending}>重新检测</button></div>{shownFeedback.code&&<details><summary>诊断代码</summary><code>{shownFeedback.code}</code></details>}</div>}
    {dirty&&<p className="notification-help">请先保存阶段设置，再发送调试信号。</p>}
    {debug&&<div className="notification-debug-receipt" role="status"><small>最近提交的信号</small><strong>{response.stages.find(s=>s.id===debug.request.stage)?.label||debug.request.stage} · {receipts[debug.status]||debug.status}</strong><p className="notification-submission"><b>{submission?.label}</b><br/>{submission?.message}</p><dl><div><dt>事件</dt><dd>{debug.event_id}</dd></div><div><dt>序列</dt><dd>{debug.request.sequence}</dd></div><div><dt>独立任务</dt><dd>{debug.task_id}</dd></div></dl><p>{debug.request.text}</p><ul>{Object.entries(debug.delivery).map(([k,v])=><li key={k}>{k==='speech'?'声音':k==='watch'?'Watch':'桌面'}：{deliveryLabel(v)}</li>)}</ul>{recordFailure&&<p>{recordFailure.title}：{recordFailure.message}</p>}<details><summary>回执诊断</summary><code>{JSON.stringify({status:debug.status,remote_confirmed:debug.remote_confirmed,delivery:debug.delivery,error:debug.error})}</code></details></div>}
   </section>:<fieldset className="notification-stage" disabled={saving}><div className="notification-stage-heading"><strong>{label}</strong><label className="notification-checkbox"><input className="checkbox checkbox-sm" type="checkbox" checked={stage.enabled} onChange={e=>update({enabled:e.target.checked})}/><span>发送此阶段</span></label></div>
    <div className="notification-preview" aria-label="本地合成预览"><Gork size={76} state={stage.expression} expressionOverride={stage.expression} still={!playing} suspended={!active}/><div><small>本地预览 · 合成数据</small><p>{localStagePreview(stage.text)||'未设置显示消息'}</p><button type="button" className="text-button" aria-pressed={playing} onClick={()=>setPlaying(x=>!x)}>{playing?'结束预览':'预览表情'}</button></div></div>
    <div className="notification-fields"><label><span>表情</span><select className="select" value={stage.expression} onChange={e=>update({expression:e.target.value})}>{robotExpressions.map(id=><option value={id} key={id}>{expressionLabels[id]||id}</option>)}</select></label><label><span>播放方式</span><select className="select" value={stage.expression_mode} onChange={e=>update({expression_mode:e.target.value as Stage['expression_mode']})}><option value="once">播放一次</option><option value="loop">循环播放</option></select></label>
    <label><span>输出类型</span><select className="select" value={stage.kind} onChange={e=>update({kind:e.target.value as Stage['kind']})}><option value="state">持续状态</option><option value="notice">短提醒</option></select></label><label><span>提醒显示 · 秒</span><input className="input" type="number" min={.5} max={60} step={.5} value={stage.duration_ms/1000} disabled={stage.kind==='state'} onChange={e=>update({duration_ms:Math.round(Number(e.target.value)*1000)})}/></label></div>
    <label className="notification-wide"><span>显示消息</span><textarea className="textarea" rows={3} maxLength={300} value={stage.text} onChange={e=>update({text:e.target.value})}/></label>
    <div className="notification-variables" aria-label="插入消息变量">{['amount','review','warnings','task'].map((key,i)=><button type="button" className="btn btn-ghost" key={key} title={`插入 {${key}}`} onClick={()=>update({text:(stage.text+`{${key}}`).slice(0,300)})}>{['金额','待复核','风险数','任务名'][i]}</button>)}</div>
    <label className="notification-checkbox"><input className="checkbox checkbox-sm" type="checkbox" checked={stage.speech} onChange={e=>update({speech:e.target.checked})}/><span>播报此阶段</span>{!form.sound&&<small>统一语音开关已关闭</small>}</label>
    <label className="notification-wide"><span>语音消息</span><textarea className="textarea" rows={2} maxLength={300} value={stage.speech_text} placeholder="留空沿用显示消息" onChange={e=>update({speech_text:e.target.value})}/></label>
    <details className="notification-advanced"><summary>此阶段的输出与有效期</summary><div className="notification-fields">{select('display_target','显示位置',['inherit','desktop','watch','both','none'])}{select('speech_target','声音位置',['inherit','current','pc','watch'])}<label><span>优先级 · 0–5</span><input className="input" type="number" min={0} max={5} value={stage.priority} onChange={e=>update({priority:Number(e.target.value)})}/></label><label><span>排队有效期 · 秒</span><input className="input" type="number" min={1} max={90} value={stage.ttl_ms/1000} onChange={e=>update({ttl_ms:Math.round(Number(e.target.value)*1000)})}/></label></div></details>
    <div className="notification-stage-footer"><p className="notification-help">{selected==='review_sent'?'同轮飞书、WeAct 送达只自动提醒一次。':stage.kind==='state'?'操作执行期间续期；报活不重复播语音。':'新阶段替换旧显示；不打断已开始的语音。'}</p><button className="text-button" type="button" onClick={()=>update(response.defaults[selected])}>恢复此阶段默认</button></div>
   </fieldset>}
  </div>
  {!!response.status.history?.length&&<details className="notification-history"><summary>最近通知回执</summary><ol>{response.status.history.map(item=><li key={item.event_id}><strong>{response.stages.find(s=>s.id===item.stage)?.label||item.stage}</strong><span>{receipts[item.status]||item.status}</span><small>{Object.entries(item.delivery).map(([k,v])=>`${k==='speech'?'声音':k==='watch'?'Watch':'桌面'}：${v}`).join(' · ')}{item.error}</small></li>)}</ol></details>}
  <footer className="notification-save"><p role={error?'alert':'status'}>{error|| (dirty?'有尚未保存的更改':saved?'设置已保存，等待新阶段':'保存设置不会发送测试通知')}</p><button type="button" className="btn btn-primary" disabled={!dirty||saving} onClick={()=>void save()}>{saving?'保存中…':'保存设置'}</button></footer>
 </div>;
}
