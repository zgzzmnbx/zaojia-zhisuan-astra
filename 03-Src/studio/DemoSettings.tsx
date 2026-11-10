import {useEffect,useState} from 'react';
import type {DemoController,DemoSettings as Values} from './demo-settings';
import {Button,Icon} from './ui';
import './demo-settings.css';

export function DemoModeSwitch({controller,blocked=false,openSettings}:{controller:DemoController;blocked?:boolean;openSettings:()=>void}){
 const {value,error,saving,save}=controller;
 return <div className="demo-mode-control" title={error||(!value?'正在读取演示设置':`演示模式${value.enabled?'已开启':'已关闭'}；在设置中配置演示与调试选项`)}>
  <label><span>演示</span><input type="checkbox" role="switch" aria-label="演示模式" className="toggle toggle-primary toggle-sm" checked={!!value?.enabled} disabled={!value||saving||blocked} onChange={e=>{if(value)void save({...value,enabled:e.target.checked}).catch(()=>{});}}/></label>
  {error&&<button type="button" className="btn btn-ghost btn-square btn-sm" aria-label={`演示设置异常：${error}`} onClick={openSettings}><Icon name="info"/></button>}
 </div>;
}

const options=[
 ['rowPreset','单行填价预设','表2第6行 · 3203 元/个，仍需人工确认写入。'],
 ['reportPreset','风险报告预设','演示文件使用固定报告，五万元口径；不调用模型。'],
 ['knowledgePreset','知识问答预设','固定演示问题使用已有答案，并保留预设标识。'],
] as const;

export function DemoSettings({controller,openDebug,blocked=false}:{controller:DemoController;openDebug:(section:'runtime-console'|'gork')=>void;blocked?:boolean}){
 const {value,error,saving,save,refresh}=controller;
 const [draft,setDraft]=useState<Values>(),[dirty,setDirty]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{if(!dirty)setDraft(value);},[value,dirty]);
 const change=(key:keyof Omit<Values,'revision'>,checked:boolean)=>{if(draft){setDraft({...draft,[key]:checked});setDirty(true);setMessage('');}};
 return <div className="demo-settings-panel">
  {!value&&!error&&<p role="status">正在读取演示设置…</p>}
  {draft&&<>
   <label className="demo-option demo-option-master"><span><strong>演示模式</strong><small>关闭后按正常流程处理；切换不会重跑任务或改写已有成果。</small></span><input type="checkbox" role="switch" aria-label="设置中的演示模式" className="toggle toggle-primary" checked={draft.enabled} disabled={saving||blocked} onChange={e=>change('enabled',e.target.checked)}/></label>
   <div className="demo-preset-options">{options.map(([key,label,description])=><label className="demo-option" key={key}><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" role="switch" aria-label={label} className="toggle toggle-primary toggle-sm" checked={draft[key]} disabled={!draft.enabled||saving||blocked} onChange={e=>change(key,e.target.checked)}/></label>)}</div>
   <div className="demo-settings-actions"><span role="status">{message||(dirty?'有未保存的更改':'')}</span><Button disabled={saving||blocked||!dirty} primary onClick={async()=>{try{setDraft(await save(draft));setDirty(false);setMessage('设置已保存');}catch{setMessage('');}}}>保存设置</Button></div>
  </>}
  {error&&<p className="demo-settings-error" role="alert">{error}</p>}
  <div className="demo-debug-tools"><h4>调试工具</h4><div><Button icon="monitor" onClick={()=>openDebug('runtime-console')}>运行日志</Button><Button icon="robot" onClick={()=>openDebug('gork')}>机器人联动</Button><Button icon="refresh" disabled={saving} onClick={()=>{setDirty(false);setMessage('');void refresh();}}>重新读取设置</Button></div></div>
 </div>;
}
