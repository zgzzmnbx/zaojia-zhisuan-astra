import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Icon} from './ui';
import {consoleLine,consoleTime} from './runtime-console';
import type {useRuntimeConsole} from './useRuntimeConsole';
import './runtime-console.css';

type Model=ReturnType<typeof useRuntimeConsole>;
function readConsoleScheme(){try{return localStorage.getItem('astra.runtime-console.scheme')==='light'?'light':'dark';}catch{return 'dark';}}
function uptime(seconds:number){return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(value=>String(value).padStart(2,'0')).join(':');}
export function RuntimeConsole({model,active}:{model:Model;active:boolean}){
 const scroll=useRef<HTMLDivElement>(null);
 const {setOpen}=model;
 useEffect(()=>{setOpen(active);return()=>setOpen(false);},[active,setOpen]);
 const [scheme,setScheme]=useState(readConsoleScheme);
 function toggleScheme(){setScheme(value=>{const next=value==='dark'?'light':'dark';try{localStorage.setItem('astra.runtime-console.scheme',next);}catch{}return next;});}
 const [level,setLevel]=useState('all'),[query,setQuery]=useState(''),[source,setSource]=useState('all'),[follow,setFollow]=useState(true),[unread,setUnread]=useState(0);
 const lastIds=useRef<Set<string>>(new Set());
 // Keep records in the model, but do not format or reconcile hidden log rows.
 const filtered=useMemo(()=>{if(!active||!model.open)return [];const search=query.toLowerCase();return model.events.filter(row=>(level==='all'||level==='normal'&&row.level!=='debug'||row.level===level)&&(source==='all'||(source==='ui')===(row.source==='当前界面'))&&(!search||consoleLine(row).toLowerCase().includes(search)));},[active,model.open,model.events,level,source,query]);
 const rowIds=useMemo(()=>model.events.map(row=>`${row.id>0?model.snapshot?.instance:'ui'}:${row.id}`),[model.events,model.snapshot?.instance]);
 const rowKey=rowIds.join(',');
 useLayoutEffect(()=>{
  const added=rowIds.filter(id=>!lastIds.current.has(id)).length;lastIds.current=new Set(rowIds);
  if(model.open&&follow){if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;setUnread(0);}
  else if(added)setUnread(value=>value+added);
 },[rowKey,model.open,follow,level,query,source]);
 function exportLogs(){const text=['造价智算 · 运行控制台',`导出范围：当前筛选，共 ${filtered.length} 条`,`宿主实例：${model.snapshot?.instance||'未连接'}`,...filtered.map(row=>consoleLine(row)+(row.frames?' '+JSON.stringify(row.frames):''))].join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`造价智算-运行日志-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const logRows=useMemo(()=>filtered.map(row=><div className="runtime-row" data-level={row.level} key={`${row.id>0?model.snapshot?.instance:'ui'}:${row.id}`}><span className="runtime-row-index" aria-hidden="true">{row.id<0?'UI':String(row.id).padStart(4,'0')}</span><time>{consoleTime(row.time)}</time><span className="runtime-level" title={row.level}>{({debug:'DEBUG',info:'INFO',warning:'WARN',error:'ERROR'} as Record<string,string>)[row.level]||row.level}</span><div><span className="runtime-source" data-source={row.source}>{row.source}</span><span>{row.message}</span>{(row.path||row.logger)&&<details><summary>{row.method?<><span className="runtime-method">{row.method}</span> <span className="runtime-path">{row.path}</span></>:row.logger}{row.status&&<span className="runtime-http" data-status={row.status>=500?'error':row.status>=400?'warning':'ok'}> {row.status}</span>}{row.duration_ms!==undefined&&<span className="runtime-duration"> {row.duration_ms}ms</span>}</summary><div className="runtime-details">{row.request_id&&<div>请求 #{row.request_id}</div>}{row.exception&&<div>{row.exception}</div>}{row.frames?.map((frame,index)=><div key={index}>{frame.module}:{frame.line}</div>)}{row.path&&<div>耗时统计到响应结束；HTTP 状态不代表业务验收结果。</div>}</div></details>}</div></div>),[filtered,model.snapshot?.instance]);
 return <div id="runtime-console" className="studio runtime-console runtime-settings-console card" data-console-scheme={scheme} data-streaming={model.working&&!model.unavailable&&active&&!model.paused} role="region" aria-label="运行日志控制台">
  <header className="runtime-heading">
   <div className="runtime-drag runtime-settings-title"><span className="runtime-prompt-mark" aria-hidden="true">&gt;_</span><strong>运行日志</strong><span className="runtime-session" title="本次宿主实例">{model.snapshot?.instance.slice(0,8)||"--------"}</span></div>
   <button type="button" className="btn btn-ghost btn-square btn-sm" aria-label={scheme==='dark'?'控制台切换浅色':'控制台切换深色'} title={scheme==='dark'?'控制台切换浅色':'控制台切换深色'} onClick={toggleScheme}><Icon name={scheme==='dark'?'sun':'moon'}/></button>
  </header>
  <div className="runtime-current" data-unavailable={model.unavailable}><span className="runtime-shell-prompt" aria-hidden="true">zsuan<span>@local</span> <b>❯</b></span><span role="status">{model.label}</span><span className="runtime-cursor" aria-hidden="true"/>{model.working&&!model.unavailable&&<span>{model.elapsed}秒</span>}<span className="runtime-live">{model.paused?'PAUSED':model.unavailable?'OFFLINE':follow?'LIVE':'HOLD'}</span></div>
  <div className="runtime-filters">
   <select className="select select-sm" aria-label="日志级别" value={level} onChange={event=>setLevel(event.target.value)}><option value="normal">运行记录</option><option value="all">含调试</option><option value="warning">警告</option><option value="error">错误</option></select>
   <select className="select select-sm" aria-label="日志来源" value={source} onChange={event=>setSource(event.target.value)}><option value="all">全部来源</option><option value="host">宿主</option><option value="ui">当前界面</option></select>
   <label className="runtime-search"><Icon name="search"/><input className="input input-sm" aria-label="搜索日志" placeholder="搜索日志" value={query} onChange={event=>setQuery(event.target.value)}/></label>
  </div>
  {model.paused&&<div className="runtime-notice">日志采集已暂停，业务任务照常运行。</div>}
  {model.notice&&<div className="runtime-notice">{model.notice}</div>}
  <div ref={scroll} className="runtime-log" tabIndex={0} aria-label="运行日志记录" onScroll={event=>{if(!model.open)return;const node=event.currentTarget;if(node.scrollHeight-node.scrollTop-node.clientHeight>32)setFollow(false);}}>
   {!filtered.length?<div className="runtime-empty"><Icon name="monitor"/><p>{model.paused?'日志采集已暂停':model.unavailable?'宿主记录暂不可用':model.events.length?'当前筛选下暂无记录':'等待运行事件'}</p><span>{model.paused?'点击“开始采集”查看运行记录':'切换“含调试”可查看接口读取记录'}</span></div>:logRows}
  </div>
  <footer className="runtime-footer"><span title="记录仅保留本次宿主运行最近1000条与当前页面阶段；重启或刷新会影响记录范围。">{filtered.length} 条<span className="runtime-uptime" title="宿主本次运行时长"> / ↑ {uptime(model.snapshot?.uptime||0)}</span></span><button type="button" className="btn btn-ghost btn-sm" aria-pressed={!model.paused} onClick={()=>model.setPaused(!model.paused)}><Icon name={model.paused?'play':'pause'}/>{model.paused?'开始采集':'暂停采集'}</button><button type="button" className="btn btn-ghost btn-sm" aria-pressed={follow} onClick={()=>setFollow(value=>!value)}><Icon name={follow?'pause':'play'}/>{follow?'暂停跟随':unread?`${unread}条新记录`:'继续跟随'}</button><button type="button" className="btn btn-ghost btn-sm" disabled={!filtered.length} onClick={exportLogs}><Icon name="download"/>导出</button></footer>
 </div>;
}
