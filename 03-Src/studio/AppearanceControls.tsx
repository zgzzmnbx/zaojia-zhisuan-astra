import {palettes,type Palette} from './appearance';
import {Icon} from './ui';
export function ThemeButton({open}:{open:()=>void}){
 return <button type="button" className="btn btn-ghost btn-square theme-trigger" aria-label="主题配色" title="外观与主题" onClick={open}><span aria-hidden="true"/></button>;
}
export function AppearanceControls({palette,dark,setPalette,setDark,reset,error}:{palette:Palette;dark:boolean;setPalette:(p:Palette)=>void;setDark:(d:boolean)=>void;reset:()=>void;error:string}){
 return <section className="appearance-controls" aria-label="外观偏好">
  <div className="appearance-intro"><div><h3>让工作空间，合你的心意</h3><p>六种配色，同样清晰。明暗由你选择。</p></div></div>
  <div className="appearance-mode" role="group" aria-label="明暗模式">
   <button type="button" aria-pressed={!dark} onClick={()=>setDark(false)}><Icon name="sun"/>亮色<span>默认</span></button>
   <button type="button" aria-pressed={dark} onClick={()=>setDark(true)}><Icon name="moon"/>深色</button>
  </div>
  <div className="appearance-palettes" role="group" aria-label="主题配色">
   {palettes.map(p=><button type="button" className="appearance-choice" key={p.id} aria-label={p.name} aria-pressed={palette===p.id} onClick={()=>setPalette(p.id)}>
    <span className="appearance-preview" data-astra-palette={p.id} data-astra-scheme={dark?'dark':'light'} aria-hidden="true"><span className="ap-rail"><i/><i/><i/></span><span className="ap-chat"><i/><i/><b/></span><span className="ap-detail"><i/><i/><i/></span></span>
    <span className="appearance-choice-title"><strong>{p.name}</strong>{palette===p.id?<Icon name="check"/>:<i/>}</span>
    <small>{p.description}</small>
   </button>)}
  </div>
  <div className="appearance-footer"><p role={error?'status':undefined}>{error||'立即生效，并记住你的选择。'}</p><button type="button" className="text-button" onClick={reset}>恢复默认</button></div>
  <p className="appearance-note">配色参考 daisyUI · 风险提示与表格标注保持业务含义</p>
 </section>;
}
