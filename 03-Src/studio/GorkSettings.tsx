import {useState} from 'react';
import {Gork} from './Gork';
import {expressionLabels,robotStates,type RobotState} from './gork-preferences';
import {resetGorkPreferences,robotExpressions,robotPresets,saveGorkPreferences,useGorkSettings} from './useGorkSettings';
import './gork-settings.css';

export function GorkSettings(){
 const {preferences,error}=useGorkSettings();const [preview,setPreview]=useState<RobotState>('idle');
 const state=robotStates.find(s=>s.id===preview)!;
 return <div className="robot-settings">
  <p className="robot-scope">仅用于本项目网页中的智算形象。</p>
  <section className="robot-placement" aria-labelledby="robot-placement-title">
   <h3 id="robot-placement-title">大小与位置</h3>
   <div className="robot-layout-options" role="group" aria-label="输入区机器人布局">{([{id:'roomy',title:'放大陪伴',detail:'84px · 工具栏向右避让'},{id:'classic',title:'原来布局',detail:'56px · 工具栏位于下方'}] as const).map(option=><button type="button" className="btn btn-ghost" key={option.id} aria-pressed={preferences.composerLayout===option.id} onClick={()=>saveGorkPreferences({...preferences,composerLayout:option.id})}><strong>{option.title}</strong><span>{option.detail}</span></button>)}</div>
   <label className="robot-size-control" htmlFor="robot-floating-size"><span>独立悬浮大小<small>只调整全屏时的悬浮机器人</small></span><output htmlFor="robot-floating-size">{preferences.floatingSize} px</output></label>
   <input id="robot-floating-size" className="range range-primary range-sm" type="range" min={48} max={128} step={4} value={preferences.floatingSize} aria-valuetext={`${preferences.floatingSize} 像素`} onChange={e=>saveGorkPreferences({...preferences,floatingSize:Number(e.target.value)})}/>
   <div className="robot-size-scale" aria-hidden="true"><span>小 · 48</span><span>大 · 128</span></div>
  </section>
  <section className="robot-preview" aria-label="形象与表情预览">
   <div className="robot-stage"><Gork size={116} state={state.state}/></div>
   <div className="robot-preview-controls"><strong>{robotPresets.find(p=>p.id===preferences.appearance.id)?.name}</strong><span>{state.label} · {expressionLabels[preferences.expressions[preview]]}</span>
    <div className="robot-state-switch" role="group" aria-label="预览状态">{robotStates.map(s=><button type="button" key={s.id} aria-pressed={preview===s.id} onClick={()=>setPreview(s.id)}>{s.label}</button>)}</div>
   </div>
  </section>
  <section aria-labelledby="robot-shapes"><h3 id="robot-shapes">选择形象</h3><div className="robot-presets">{robotPresets.map(p=><button type="button" key={p.id} aria-label={`形象 ${p.name}`} aria-pressed={preferences.appearance.id===p.id} onClick={()=>saveGorkPreferences({...preferences,appearance:{id:p.id,bodyColor:p.colors.body,eyeColor:p.colors.eyes}})}><Gork size={44} still expressionOverride="idle" appearanceOverride={{id:p.id,bodyColor:p.colors.body,eyeColor:p.colors.eyes}}/><span>{p.name}</span></button>)}</div></section>
  <div className="robot-colors">{([{key:'bodyColor',label:'身体颜色'},{key:'eyeColor',label:'眼睛颜色'}] as const).map(({key,label})=><label key={key}><input type="color" aria-label={label} value={preferences.appearance[key]} onChange={e=>saveGorkPreferences({...preferences,appearance:{...preferences.appearance,[key]:e.target.value}})}/><span>{label}<small>{preferences.appearance[key].toUpperCase()}</small></span></label>)}</div>
  <section aria-labelledby="robot-expressions"><h3 id="robot-expressions">状态表情</h3><div className="robot-expression-grid">{robotStates.map(s=><label key={s.id}><span>{s.label}</span><select className="select" aria-label={`${s.label}表情`} value={preferences.expressions[s.id]} onChange={e=>{saveGorkPreferences({...preferences,expressions:{...preferences.expressions,[s.id]:e.target.value}});setPreview(s.id);}}>{robotExpressions.map(id=><option value={id} key={id}>{expressionLabels[id]||id}</option>)}</select></label>)}</div></section>
  <footer><span role="status" className={error?'robot-save-error':''}>{error||'自动保存 · 立即生效'}</span><button type="button" className="btn btn-ghost btn-sm" onClick={()=>{resetGorkPreferences();setPreview('idle');}}>恢复默认</button></footer>
 </div>;
}
