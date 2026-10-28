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
 </fieldset></div>;
}
