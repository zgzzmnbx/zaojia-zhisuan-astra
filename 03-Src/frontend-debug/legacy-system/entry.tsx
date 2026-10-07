import {useState} from 'react';
import {Icon} from '../../studio/ui';
import type {Platform} from './disabled';
import './legacy-system.css';
const platforms=[{id:'default' as const,label:'飞书'},{id:'weact_cost' as const,label:'WeAct'}];
const source='zgzzmnbx/zaojia-zhisuan · 5b6b8d2';
export function LegacyStatusButtons({open}:{open:(id:Platform)=>void}){
 return <div className="legacy-top-links" aria-label="飞书与 WeAct 独立连接状态">{platforms.map(p=><button type="button" key={p.id} className="btn btn-ghost btn-sm legacy-status-chip" aria-label={`${p.label}连接情况，未检测`} title={`${p.label} · 云端前端演示，未检测连接`} onClick={()=>open(p.id)}>{p.label}<span> · 未检测</span></button>)}</div>;
}
export function LegacyConnections({selected,select}:{selected:Platform;select:(id:Platform)=>void}){
 const [demo,setDemo]=useState('');
 return <div className="panel-content legacy-connections"><div className="section-caption"><h3>第二层 · 双平台独立长连接</h3><span className="badge badge-outline">原系统功能视图</span></div><div className="notice"><Icon name="info"/><span>云端演示 · 未检测。当前 Astra 仅托管前端，未连接原系统状态服务。以下不代表你本机飞书或 WeAct 的实际运行情况。</span></div><p className="panel-lead">原系统中，普通飞书与 WeAct 分别接收消息、文件和卡片回调，共用专业处理能力与全局单任务顺序队列；任务与回调绑定原平台。</p>
  <div className="legacy-platform-grid">{platforms.map(p=><article key={p.id} className={`card legacy-platform ${selected===p.id?'is-selected':''}`}><button type="button" className="legacy-platform-title" aria-pressed={selected===p.id} onClick={()=>select(p.id)}><Icon name="message"/><strong>{p.label}</strong><span className="badge badge-ghost">未检测</span></button><dl><div><dt>平台域名</dt><dd>未读取</dd></div><div><dt>应用身份</dt><dd>未读取</dd></div><div><dt>接收长连接</dt><dd>未检测</dd></div><div><dt>后端健康</dt><dd>未检测</dd></div></dl><label className="legacy-receive"><input className="toggle toggle-sm" type="checkbox" checked={false} disabled readOnly/><span>启用接收</span></label><small>前端预览不启停原平台，不接收凭据。</small></article>)}</div>
  <section className="legacy-health-detail"><h3>{platforms.find(p=>p.id===selected)?.label} · 状态含义</h3><p>原系统只有连接、身份、后端及消息队列的健康数据均通过，才显示“运行中”。“未检测”表示这里没有运行数据，不等同于“已关闭”。</p><div className="legacy-metrics">{['并发任务','等待中','已完成','留存天数'].map(label=><div key={label}><strong>—</strong><span>{label} · 未读取</span></div>)}</div><p className="muted">未读取最近任务，也未获取任何群组、消息或文件。</p></section>
  <details className="legacy-status-demo"><summary>预览原系统状态样式（合成演示）</summary><label>演示状态<select className="select select-bordered" value={demo} onChange={e=>setDemo(e.target.value)}><option value="">不演示</option>{['运行中','待核验','重连中','身份待恢复','后端异常','有失败消息','待补发','配置异常','启动中','停止中','已关闭','未配置'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>{demo&&<p role="status"><span className={`badge ${demo==='运行中'?'badge-info':'badge-warning'}`}>【演示】{demo}</span> 仅显示原状态文案；顶部真实检测状态仍为“未检测”。</p>}</details>
  <details className="legacy-boundaries"><summary>原系统连接边界</summary><p>同一平台 App ID 在本地与云端只允许一个实例启用。普通飞书与 WeAct 并行连接、顺序处理；某一平台配置异常不表示另一平台异常。第一层 Webhook 主动通知与第二层接收机器人是不同能力，本页展示第二层状态。</p></details><p className="legacy-provenance">界面字段、状态顺序与边界来自 {source} 的 App.tsx；当前只迁移展示，不接入状态轮询、启停或外部发送。</p>
 </div>;
}
// The offline diagrams are shared with the formal build.
export {Architecture as LegacyArchitecture} from '../../studio/SystemArchitecture';
