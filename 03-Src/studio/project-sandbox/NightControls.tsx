import type {BakedSettings} from './baked-settings';
export function NightControls({value,change}:{value:BakedSettings;change:(v:BakedSettings)=>void}){
 const n=value.nightSettings,update=(patch:Partial<typeof n>)=>change({...value,nightSettings:{...n,...patch}});
 return <fieldset className="sandbox-water-settings"><legend>赛博夜览</legend>
  <div className="sandbox-lighting-settings">{([['windows','建筑窗灯'],['flow','信息流霓虹'],['logo','集团 Logo 夜光'],['boats','小船星光']] as const).map(([key,label])=><label key={key}><input type="checkbox" className="toggle toggle-xs" checked={n[key]} onChange={e=>update({[key]:e.target.checked})}/>{label}</label>)}</div>
  {([['brightness','夜间建筑明暗',40,150],['bloom','夜间辉光',0,150]] as const).map(([key,label,min,max])=><label className="trial-slider" key={key}>{label}<output>{n[key]}%</output><input className="range range-xs" type="range" aria-label={label} min={min} max={max} step="5" value={n[key]} onChange={e=>update({[key]:Number(e.target.value)})}/></label>)}
  <label className="trial-slider">Logo 夜光亮度<output>{n.logoBrightness}%</output><input disabled={!n.logo} className="range range-xs" type="range" aria-label="Logo 夜光亮度" min="0" max="200" step="5" value={n.logoBrightness} onChange={e=>update({logoBrightness:Number(e.target.value)})}/></label>
  <label className="sandbox-uplight-color">Logo 夜光颜色<output>{n.logoColor.toUpperCase()}</output><input disabled={!n.logo} type="color" aria-label="Logo 夜光颜色" value={n.logoColor} onInput={e=>update({logoColor:e.currentTarget.value})}/></label>
  <small>夜间参数独立保存，返回日间恢复原画面。</small>
 </fieldset>;
}
