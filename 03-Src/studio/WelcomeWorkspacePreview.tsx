import {useState} from 'react';
import {Gork,Icon} from './ui';
import {ConversationCard} from './ConversationCard';
import {Workbook,readPreviewPreferences} from './table/Workbook';
import type {Message,Result} from './types';

// Read-only welcome illustration composed from the current Astra components.
// It has no workspace hook, iframe, API request or persistence writes.
const previewResult:Result={job_id:'welcome-preview',project_name:'界面预览',downloads:{},summary:{total_data_rows:0,matched_rows:0,filled_rows:0,unchanged_rows:0,review_rows:0,conflict_rows:0,physical_experience_rows:0,technical_experience_rows:0,matching_status:'pending',output_excel:'',output_report:'',report_text:'',price_column:'E',table_preview:{sheet_name:'未载入资料',header_row:1,headers:['序号','项目名称','单位','数量','价格','实物工作系数','技术工作系数'],rows:[],row_numbers:[]}}};
const message:Message={id:'welcome-card',role:'assistant',text:'添加资料后，在这里查看表格、风险与报告。',card:{kind:'confirmation',title:'等待资料',caption:'当前界面预览',icon:'sheet',status:'无业务数据',note:'仅展示当前 Astra 界面，不执行真实业务。'},actions:[{label:'查看计算表',action:'table',primary:true},{label:'风险复核',action:'risk'}]};
const noop=()=>{};
export function WelcomeWorkspacePreview(){
 const [preferences,setPreferences]=useState(readPreviewPreferences);
 return <div className="aw2-workspace live-shell" inert aria-hidden="true">
  <aside className="aw2-sidebar aw2-icon-rail">
   <span className="brand-mark astra-mark">A</span>
   <div className="aw2-rail-actions">{[['plus','新对话'],['search','搜索对话'],['folder','项目'],['message','最近对话'],['grid','项目看板'],['book','资料库']].map(([icon,label])=><span key={icon} className={`aw2-rail-icon ${icon==='message'?'is-active':''}`} title={label}><Icon name={icon}/></span>)}</div>
   <span className="aw2-rail-icon aw2-rail-settings" title="设置"><Icon name="settings"/></span>
  </aside>
  <div className="aw2-main">
   <header className="topbar"><div className="breadcrumb"><Icon name="sidebar-close"/><span>工作空间</span><span className="slash">/</span><strong>智算Astra</strong></div><span className="badge badge-outline">当前界面 · 空表预览</span></header>
   <div className="aw2-panels aw2-preview-first">
    <section className="aw2-conversation">
     <div className="conversation-heading"><div className="conversation-identity"><Gork size={40} still/><div className="conversation-name"><div className="eyebrow">智算 · Gork</div><h2>控制价编制与复核</h2></div></div></div>
     <div className="context-line"><span className="badge skill-badge"><Icon name="spark"/>勘察测量</span><span>等待资料</span></div>
     <div className="aw2-messages"><div className="chat chat-end"><div className="chat-bubble">打开工作空间。</div></div><div className="assistant-author"><Gork size={26} still/>智算<small>Gork</small></div><div className="assistant-copy"><p>{message.text}</p><ConversationCard message={message} onAction={noop} unavailable={()=>undefined}/></div></div>
     <div className="aw2-composer"><div className="composer"><div className="aw2-prompt">描述你的需求，或添加资料…</div><div className="composer-toolbar"><div className="composer-tools"><Icon name="plus"/><span className="btn btn-ghost skill-selector"><Icon name="spark"/>专业工具</span><span className="tool-divider"/><span>任务协作</span></div><span className="btn btn-primary btn-square"><Icon name="arrow-up"/></span></div></div></div>
    </section>
    <section className="aw2-artifact"><header className="artifact-header"><div><span className="eyebrow">WORKSPACE</span><h2>计算表</h2></div><Icon name="expand"/></header><Workbook result={previewResult} sheetIndex={0} setSheetIndex={noop} busy={false} match={noop} recalculate={noop} needsRecalculate={false} edit={noop} inspect={noop} preferences={preferences} setPreferences={setPreferences} refreshHeaders={async()=>false}/></section>
   </div>
  </div>
 </div>;
}
