import type {WaterSettings} from './water-settings';
export function WaterControls({value,change,disabled=false}:{value:WaterSettings;change:(v:WaterSettings)=>void;disabled?:boolean}){
 return <fieldset className="sandbox-water-settings" disabled={disabled}><legend>河流 · 卡通三渲二</legend>
  <label className="sandbox-water-toggle"><input type="checkbox" className="toggle toggle-xs" checked={value.enabled} onChange={e=>change({...value,enabled:e.target.checked})}/>卡通水体</label>
  <div className="sandbox-lighting-settings">{([['motion','波浪流动'],['boats','小船浮动']] as const).map(([key,label])=><label key={key}><input disabled={!value.enabled} type="checkbox" className="toggle toggle-xs" checked={value[key]} onChange={e=>change({...value,[key]:e.target.checked})}/>{label}</label>)}</div>
  <p>水面真实隆起，波峰向下游推进，小船随浪升降。起伏为 0 时水面平坦；关闭恢复原河面。</p>
  {([['speed','流速'],['ripple','波浪起伏']] as const).map(([key,label])=><label className="trial-slider" key={key}>{label}<output>{value[key]}%</output><input className="range range-xs" type="range" aria-label={'河流'+label} min="0" max="100" step="5" disabled={!value.enabled} value={value[key]} onChange={e=>change({...value,[key]:Number(e.target.value)})}/></label>)}</fieldset>;
}
