import type {WaterSettings} from './water-settings';
export function WaterControls({value,change,disabled=false}:{value:WaterSettings;change:(v:WaterSettings)=>void;disabled?:boolean}){
 return <fieldset className="sandbox-water-settings" disabled={disabled}><legend>河流水体 · 试用</legend>
  <label className="sandbox-water-toggle"><input type="checkbox" className="toggle toggle-xs" checked={value.enabled} onChange={e=>change({...value,enabled:e.target.checked})}/>水体效果</label>
  <div className="sandbox-water-quality" role="group" aria-label="水体质量">{(['normal','high'] as const).map(q=><button type="button" className="btn btn-sm" disabled={!value.enabled} key={q} aria-pressed={value.quality===q} onClick={()=>change({...value,quality:q})}>{q==='normal'?'普通':'高质量'}</button>)}</div>
  <p>{value.quality==='high'?'水纹、环境反光与场景倒影':'水纹与环境反光'}</p>
  {([['speed','流速'],['ripple','细波纹'],['reflection','反光强度'],['bloom','波光泛光']] as const).map(([key,label])=><label className="trial-slider" key={key}>{label}<output>{value[key]}%</output><input className="range range-xs" type="range" aria-label={'河流'+label} min="0" max="100" step="5" disabled={!value.enabled} value={value[key]} onChange={e=>change({...value,[key]:Number(e.target.value)})}/></label>)}</fieldset>;
}
