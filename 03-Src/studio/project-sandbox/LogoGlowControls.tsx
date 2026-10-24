import type {BakedSettings} from './baked-settings';
export function LogoGlowControls({value,change}:{value:BakedSettings;change:(v:BakedSettings)=>void}){
 const glow=value.logoGlow,update=(patch:Partial<typeof glow>)=>change({...value,logoGlow:{...glow,...patch}});
 return <fieldset className="sandbox-uplight-settings" disabled={value.preset==='original'||value.groupLogo==='hidden'}>
  <label><input type="checkbox" className="toggle toggle-xs" aria-label="集团 Logo 发光" checked={glow.enabled} onChange={e=>update({enabled:e.target.checked})}/>集团 Logo 发光</label>
  <label className="trial-slider">发光亮度 <output>{glow.brightness}%</output><input type="range" className="range range-xs" aria-label="集团 Logo 发光亮度" min="0" max="200" step="5" value={glow.brightness} onChange={e=>update({brightness:Number(e.target.value)})}/></label>
  <label className="sandbox-uplight-color">发光颜色 <output>{glow.color.toUpperCase()}</output><input type="color" aria-label="集团 Logo 发光颜色" value={glow.color} onInput={e=>update({color:e.currentTarget.value})}/></label>
 </fieldset>;
}
