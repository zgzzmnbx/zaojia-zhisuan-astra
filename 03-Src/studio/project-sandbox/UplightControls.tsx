import type {UplightSettings} from './uplight-settings';

export function UplightControls({value,change,disabled=false,night=false}:{value:UplightSettings;change:(value:UplightSettings)=>void;disabled?:boolean;night?:boolean}){
 return <div className="sandbox-uplight-settings">{([night?'night':'day'] as const).map(mode=>{
  const label=night?'夜间射灯':'日间射灯',setting=value[mode];
  return <fieldset key={mode} disabled={disabled}><legend>{label}</legend>
   <label className="trial-slider">亮度 <output>{setting.brightness}%</output><input type="range" className="range range-xs" aria-label={label+'亮度'} min="0" max="200" step="5" value={setting.brightness} onChange={e=>change({...value,[mode]:{...setting,brightness:Number(e.target.value)}})}/></label>
   <label className="sandbox-uplight-color">颜色 <output>{setting.color.toUpperCase()}</output><input type="color" aria-label={label+'颜色'} value={setting.color} onInput={e=>change({...value,[mode]:{...setting,color:e.currentTarget.value}})}/></label>
  </fieldset>;
 })}</div>;
}
