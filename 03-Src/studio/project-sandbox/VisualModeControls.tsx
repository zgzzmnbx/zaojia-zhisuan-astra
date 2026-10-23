import type {VisualModeSettings} from './visual-mode-settings';
export function VisualModeControls({value,change,status,retry}:{value:VisualModeSettings;change:(v:VisualModeSettings)=>void;status:{mode:string;reason:string;loading:boolean;error:string};retry:()=>void}){
 return <div className="sandbox-visual-mode">
  <div className="sandbox-view-toggles"><label><input type="checkbox" className="toggle toggle-xs" checked={value.city.baked} onChange={e=>change({...value,city:{baked:e.target.checked}})}/>外围城市</label><label><input type="checkbox" className="toggle toggle-xs" checked={value.dof} onChange={e=>change({...value,dof:e.target.checked})}/>V11 景深</label></div>
  <div className="sandbox-camera-settings"><label>景深强度 <output>{Math.round(value.strength*100)}%</output><input aria-label="V11 景深强度" className="range range-xs" type="range" min="0" max="100" step="5" disabled={!value.dof} value={Math.round(value.strength*100)} onChange={e=>change({...value,strength:Number(e.target.value)/100})}/></label></div>
  {(status.loading||status.error)&&<div role="status" className="sandbox-trial-entry"><span>{status.error||(status.loading?'正在载入画面…':'')}</span>{status.error&&<button className="btn btn-sm btn-ghost" onClick={retry}>重试</button>}</div>}
 </div>;
}
