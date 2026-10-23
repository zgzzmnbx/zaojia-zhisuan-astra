import type {VisualModeSettings} from './visual-mode-settings';
export function VisualModeControls({value,change,status,retry}:{value:VisualModeSettings;change:(v:VisualModeSettings)=>void;status:{mode:string;reason:string;loading:boolean;error:string};retry:()=>void}){
 return <div className="sandbox-visual-mode">
  <fieldset className="sandbox-scene-theme"><legend>沙盘画面</legend><div>{([{id:'baked',label:'V11 白色烘焙'},{id:'original',label:'主线原效果'}] as const).map(m=><button type="button" className="btn btn-sm" key={m.id} aria-pressed={value.mode===m.id} onClick={()=>change({...value,mode:m.id})}>{m.label}</button>)}</div></fieldset>
  <div className="sandbox-view-toggles"><label><input type="checkbox" className="toggle toggle-xs" checked={value.city[value.mode]} onChange={e=>change({...value,city:{...value.city,[value.mode]:e.target.checked}})}/>外围城市</label>{value.mode==='baked'&&<label><input type="checkbox" className="toggle toggle-xs" checked={value.dof} onChange={e=>change({...value,dof:e.target.checked})}/>V11 景深</label>}</div>
  {value.mode==='baked'&&<div className="sandbox-camera-settings"><label>景深强度 <output>{Math.round(value.strength*100)}%</output><input aria-label="V11 景深强度" className="range range-xs" type="range" min="0" max="100" step="5" disabled={!value.dof} value={Math.round(value.strength*100)} onChange={e=>change({...value,strength:Number(e.target.value)/100})}/></label></div>}
  {(status.loading||status.reason||status.error)&&<div role="status" className="sandbox-trial-entry"><span>{status.error||status.reason||(status.loading?'正在载入画面…':'')}</span>{status.error&&<button className="btn btn-sm btn-ghost" onClick={retry}>重试切换</button>}</div>}
 </div>;
}
