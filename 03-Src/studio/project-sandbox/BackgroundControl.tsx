import {backgroundColors} from './scene-theme';
export function BackgroundControl({value,change,disabled=false}:{value:string|null;change:(value:string|null)=>void;disabled?:boolean}){
 return <fieldset className="sandbox-background" disabled={disabled}><legend>背景颜色{disabled?' · 日间可调':''}</legend><div className="sandbox-color-options">
  <button className="btn btn-ghost btn-sm" aria-pressed={value===null} onClick={()=>change(null)}>随主题</button>
  {backgroundColors.map(c=><button key={c.color} className="btn btn-ghost btn-sm" aria-label={'背景：'+c.label} aria-pressed={value===c.color} onClick={()=>change(c.color)}><i style={{background:c.color}}/>{c.label}</button>)}
  <label className="sandbox-custom-color">自定义<input type="color" aria-label="自定义背景颜色" value={value??'#cbd0d5'} onChange={e=>change(e.target.value)}/></label>
 </div></fieldset>;
}
