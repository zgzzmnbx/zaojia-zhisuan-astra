import {useEffect,useState} from 'react';
import {api} from './api';
import {Gork,Icon} from './ui';
import './gork-console.css';
type LinkState={state:string;message:string;tracking:boolean;robot_connected:boolean;version?:string;mode?:string;target?:string;last_success_at?:string;task_id?:string;history_count?:number};
const labels:Record<string,string>={offline:'待连接',upgrade_required:'待重开控制台',other_source:'待选择来源',paused:'已暂停',error:'连接异常',connecting:'正在连接',tracking:'正在跟踪'};
export function GorkConsole(){
 const [status,setStatus]=useState<LinkState>(),[error,setError]=useState(''),[revision,refresh]=useState(0);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>,cancelled=false;const controller=new AbortController();
  const read=async()=>{if(document.hidden){timer=setTimeout(read,8000);return;}try{const result=await api<LinkState>('/api/astra/gork/status',{signal:controller.signal});if(!cancelled){setStatus(result);setError('');}}catch(e){if(!cancelled){setStatus(undefined);setError((e as Error).message);};}finally{if(!cancelled)timer=setTimeout(read,8000);}};
  void read();return()=>{cancelled=true;clearTimeout(timer);controller.abort();};
 },[revision]);
 return <div className="gork-console panel-content">
  <header className="gork-console-intro"><Gork size={60} still/><div><p>让智算，从屏幕来到身边</p><h3>让 Gork 替你留意任务进展</h3></div></header>
  <section className="gork-link-card" aria-label="Gork 联动状态"><div className="gork-link-heading"><strong>机器人控制台</strong><span className={`badge ${status?.tracking?'badge-success':''}`}>{error?'连接异常':status?labels[status.state]:'检测中'}</span></div><p role="status">{error||status?.message||'正在检测本机 Gork 控制台…'}</p>
   <dl><div><dt>控制台版本</dt><dd>{status?.version||'未读取'}</dd></div><div><dt>机器人连接</dt><dd>{status?.robot_connected?'已连接':'尚未确认'}</dd></div>{status?.tracking&&<><div><dt>跟随方式</dt><dd>{status.mode==='specific'?'指定任务':'自动跟随'}</dd></div><div><dt>最近读取</dt><dd>{status.last_success_at?new Date(status.last_success_at).toLocaleTimeString():'建立基线中'}</dd></div></>}</dl>
   <div className="gork-link-actions"><a className="btn btn-primary" href="http://127.0.0.1:8766/#cost" target="_blank" rel="noreferrer">打开 Gork 控制台<Icon name="arrow-up-right"/></a><button className="btn btn-ghost" onClick={()=>refresh(n=>n+1)}><Icon name="refresh"/>重新检测</button></div>
  </section>
  <ol className="gork-link-steps"><li><span>01</span><div><strong>选择 Astra 作为任务来源</strong><p>在控制台「造价助手 → Gork 任务哨兵」选择「智算 Astra」。</p></div></li><li><span>02</span><div><strong>决定跟随方式与提醒位置</strong><p>自动跟随正在执行的任务，或指定某个任务；桌面小人、机器人和声音由控制台统一管理。</p></div></li><li><span>03</span><div><strong>应用设置，继续工作</strong><p>转换、匹配、预警、风险报告与协同节点到来时提醒。首次连接不补播历史任务。</p></div></li></ol>
  <p className="gork-link-note"><Icon name="shield"/>只读任务状态。Gork 不会替你启动任务、修改价格或批准结果。</p>
 </div>;
}
