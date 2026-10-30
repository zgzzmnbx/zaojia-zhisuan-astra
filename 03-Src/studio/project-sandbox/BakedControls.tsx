import {WaterControls} from './WaterControls';
import {UplightControls} from './UplightControls';
import {BackgroundControl} from './BackgroundControl';
import type {BakedSettings} from './baked-settings';
import {NightControls} from './NightControls';
export function BakedControls({value,change,dark=false}:{value:BakedSettings;change:(v:BakedSettings)=>void;dark?:boolean}){
 return <div className="sandbox-baked-settings">
  <fieldset className="sandbox-ground-tones" disabled={dark}><legend>白色烘焙预设</legend><div>{([['adjusted','我的调节'],['original','原始白色烘焙']] as const).map(([preset,label])=><button type="button" className="btn btn-sm btn-ghost" key={preset} aria-pressed={value.preset===preset} onClick={()=>change({...value,preset})}>{label}</button>)}</div></fieldset>
  {dark&&<NightControls value={value} change={change}/>}
  {!dark&&value.preset==='original'&&<small role="status">已恢复原始材质、光影与背景；调节参数仍保留。</small>}
  <fieldset disabled={value.preset==='original'} className="sandbox-baked-adjustments">
  <div className="sandbox-lighting-settings" aria-label="白色版光影">{([['bloom','聚焦辉光'],['focusBeam','地面射灯'],['shadows','射灯阴影'],['flow','信息流']] as const).filter(([key])=>dark?key!=='flow':key==='bloom'||key==='flow').map(([key,label])=><label key={key}><input type="checkbox" className="toggle toggle-xs" checked={value[key]} onChange={e=>change({...value,[key]:e.target.checked})}/>{label}</label>)}</div>
  <div className="sandbox-camera-settings">{([['modelBrightness','模型明暗',40,150],['backgroundBrightness','背景明暗',20,160]] as const).map(([key,label,min,max])=><label key={key}>{label}{dark?' · 日间可调':''}<output>{value[key]}%</output><input disabled={dark} aria-label={label} type="range" className="range range-xs" min={min} max={max} step="5" value={value[key]} onChange={e=>change({...value,[key]:Number(e.target.value)})}/></label>)}</div>
  <BackgroundControl disabled={dark} value={value.backgroundColor} change={backgroundColor=>change({...value,backgroundColor})}/>
  <WaterControls value={value.waterSettings} change={waterSettings=>change({...value,waterSettings})}/>
  {dark&&<UplightControls night value={value.uplightSettings} change={uplightSettings=>change({...value,uplightSettings})}/>}
 </fieldset>
 <fieldset className="sandbox-baked-adjustments" disabled={value.preset==='original'}><legend>传送带与天气</legend>
  <div className="sandbox-lighting-settings"><label><input type="checkbox" className="toggle toggle-xs" checked={value.conveyor.visible} onChange={e=>change({...value,conveyor:{...value.conveyor,visible:e.target.checked}})}/>显示传送带</label><label><input type="checkbox" className="toggle toggle-xs" checked={value.conveyor.continuous} onChange={e=>change({...value,conveyor:{...value.conveyor,continuous:e.target.checked}})}/>连续运输</label></div>
  <div className="sandbox-camera-settings"><label>传送带样子<select className="select select-sm" aria-label="传送带样子" value={value.conveyor.style} onChange={e=>change({...value,conveyor:{...value.conveyor,style:e.target.value as BakedSettings['conveyor']['style']}})}><option value="pale-blue">淡蓝带面</option><option value="building-white">建筑物纯白</option><option value="building-blue-edge">建筑柔白（侧嵌蓝线）</option></select></label><label>传送带夜晚亮度 <output>{value.conveyor.nightBrightness}%</output><input className="range range-xs" aria-label="传送带夜晚亮度" type="range" min="0" max="200" step="10" disabled={!dark||!value.conveyor.visible} value={value.conveyor.nightBrightness} onChange={e=>change({...value,conveyor:{...value.conveyor,nightBrightness:Number(e.target.value)}})}/></label></div>
  <div className="sandbox-camera-settings"><label>天气<select className="select select-sm" aria-label="沙盘天气" value={value.conveyor.weather} onChange={e=>change({...value,conveyor:{...value.conveyor,weather:e.target.value as 'clear'|'rain'|'snow'}})}><option value="clear">晴朗</option><option value="rain">下雨</option><option value="snow">下雪</option></select></label><label>雨雪强度 <output>{Math.round(value.conveyor.weatherStrength*100)}%</output><input className="range range-xs" aria-label="雨雪强度" type="range" min="0" max="200" step="10" disabled={value.conveyor.weather==='clear'} value={Math.round(value.conveyor.weatherStrength*100)} onChange={e=>change({...value,conveyor:{...value.conveyor,weatherStrength:Number(e.target.value)/100}})}/></label></div>
  <small>白色包裹仅作运输视觉；绿色包裹跟随当前真实任务活动。</small>
 </fieldset></div>;
}
