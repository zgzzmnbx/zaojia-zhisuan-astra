import {useState} from 'react';
import {Gork} from './Gork';
import {Icon} from './ui';
import {gorkExpressionDuration} from './gork-custom';
import {expressionLabels,robotStates,webGorkStages,gorkExpression,type RobotState,type WebGorkStage} from './gork-preferences';
import {resetGorkPreferences,robotExpressions,robotPresets,saveGorkPreferences,useGorkSettings} from './useGorkSettings';
import './gork-settings.css';

export function GorkSettings(){
 const {preferences,error}=useGorkSettings();const [preview,setPreview]=useState<RobotState>('idle');
 const [previewStage,setPreviewStage]=useState<WebGorkStage>();
 const selectedExpression=gorkExpression(previewStage?'working':robotStates.find(s=>s.id===preview)!.state,preferences,previewStage);
 const [replay,setReplay]=useState(0);
 const duration=gorkExpressionDuration(selectedExpression,(window as any).GorkCatalog);
 const state=robotStates.find(s=>s.id===preview)!;
 return <div className="robot-settings">
  <p className="robot-scope">网页表情独立保存，不改变 Watch 表情或播报。</p>
  <label className="robot-placement robot-size-control"><span>消息气泡<small>独立于 Watch 通知，默认开启</small></span><input type="checkbox" role="switch" className="toggle toggle-primary" aria-label="网页智算消息气泡" checked={preferences.speechBubble} onChange={e=>saveGorkPreferences({...preferences,speechBubble:e.target.checked})}/></label>
  <section className="robot-placement" aria-labelledby="robot-placement-title">
   <h3 id="robot-placement-title">大小与位置</h3>
   <div className="robot-layout-options" role="group" aria-label="输入区机器人布局">{([{id:'roomy',title:'放大陪伴',detail:'84px · 工具栏向右避让'},{id:'classic',title:'原来布局',detail:'56px · 工具栏位于下方'}] as const).map(option=><button type="button" className="btn btn-ghost" key={option.id} aria-pressed={preferences.composerLayout===option.id} onClick={()=>saveGorkPreferences({...preferences,composerLayout:option.id})}><strong>{option.title}</strong><span>{option.detail}</span></button>)}</div>
   <label className="robot-size-control" htmlFor="robot-floating-size"><span>独立悬浮大小<small>只调整全屏时的悬浮机器人</small></span><output htmlFor="robot-floating-size">{preferences.floatingSize} px</output></label>
   <input id="robot-floating-size" className="range range-primary range-sm" type="range" min={48} max={128} step={4} value={preferences.floatingSize} aria-valuetext={`${preferences.floatingSize} 像素`} onChange={e=>saveGorkPreferences({...preferences,floatingSize:Number(e.target.value)})}/>
   <div className="robot-size-scale" aria-hidden="true"><span>小 · 48</span><span>大 · 128</span></div>
  </section>
  <section className="robot-preview" aria-label="形象与表情预览">
   <div className="robot-stage"><Gork replay={replay} size={116} state={previewStage?'working':state.state} stage={previewStage}/></div>
   <div className="robot-preview-controls"><strong>{robotPresets.find(p=>p.id===preferences.appearance.id)?.name}</strong><span>{webGorkStages.find(s=>s.id===previewStage)?.label||state.label} · {expressionLabels[selectedExpression]}</span>
    <div className="robot-state-switch" role="group" aria-label="预览状态">{robotStates.map(s=><button type="button" key={s.id} aria-pressed={!previewStage&&preview===s.id} onClick={()=>{setPreviewStage(undefined);setPreview(s.id);}}>{s.label}</button>)}</div>
    <div className="robot-preview-timing"><span>一轮约 {(Math.round(duration/100)/10).toFixed(1)} 秒 · 循环预览</span><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setReplay(n=>n+1)}><Icon name="refresh"/>重播</button></div>
   </div>
  </section>
  <section aria-labelledby="robot-shapes"><h3 id="robot-shapes">选择形象</h3><div className="robot-presets">{robotPresets.map(p=><button type="button" key={p.id} aria-label={`形象 ${p.name}`} aria-pressed={preferences.appearance.id===p.id} onClick={()=>saveGorkPreferences({...preferences,appearance:{id:p.id,bodyColor:p.colors.body,eyeColor:p.colors.eyes}})}><Gork size={44} still expressionOverride="idle" appearanceOverride={{id:p.id,bodyColor:p.colors.body,eyeColor:p.colors.eyes}}/><span>{p.name}</span></button>)}</div></section>
  <div className="robot-colors">{([{key:'bodyColor',label:'身体颜色'},{key:'eyeColor',label:'眼睛颜色'}] as const).map(({key,label})=><label key={key}><input type="color" aria-label={label} value={preferences.appearance[key]} onChange={e=>saveGorkPreferences({...preferences,appearance:{...preferences.appearance,[key]:e.target.value}})}/><span>{label}<small>{preferences.appearance[key].toUpperCase()}</small></span></label>)}</div>
  <section aria-labelledby="robot-expressions"><h3 id="robot-expressions">状态表情</h3><div className="robot-expression-grid">{robotStates.map(s=><label key={s.id}><span>{s.label}</span><select className="select" aria-label={`${s.label}表情`} value={preferences.expressions[s.id]} onChange={e=>{saveGorkPreferences({...preferences,expressions:{...preferences.expressions,[s.id]:e.target.value}});setPreviewStage(undefined);setPreview(s.id);}}>{robotExpressions.map(id=><option value={id} key={id}>{expressionLabels[id]||id}</option>)}</select></label>)}</div></section>
  <fieldset className="robot-work-stages"><legend>工作阶段表情</legend><div className="robot-expression-grid">{webGorkStages.map(s=><label key={s.id} htmlFor={`web-gork-stage-${s.id}`}><span>{s.label}</span><select id={`web-gork-stage-${s.id}`} name={`web-gork-stage-${s.id}`} className="select" value={preferences.stageExpressions[s.id]} onFocus={()=>setPreviewStage(s.id)} onChange={e=>{saveGorkPreferences({...preferences,stageExpressions:{...preferences.stageExpressions,[s.id]:e.target.value}});setPreviewStage(s.id);}}><option value="">沿用处理问题</option>{robotExpressions.map(id=><option value={id} key={id}>{expressionLabels[id]||id}</option>)}</select></label>)}</div></fieldset>
  <footer><span role="status" className={error?'robot-save-error':''}>{error||'自动保存 · 立即生效'}</span><button type="button" className="btn btn-ghost btn-sm" onClick={()=>{resetGorkPreferences();setPreviewStage(undefined);setPreview('idle');}}>恢复默认</button></footer>
 </div>;
}
