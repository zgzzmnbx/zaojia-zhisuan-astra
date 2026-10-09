import {palettes,type Palette} from './appearance';
import {Icon} from './ui';
export function ThemeModeButton({dark,toggle}:{dark:boolean;toggle:()=>void}){
 const label=dark?'切换到亮色模式':'切换到深色模式';
 return <button type="button" className="btn btn-ghost btn-square theme-mode-toggle" aria-label={label} aria-pressed={dark} title={label} onClick={toggle}><Icon name={dark?'sun':'moon'}/></button>;
}
export function ThemeButton({open,className='',expanded,label='主题配色'}:{open:()=>void;className?:string;expanded?:boolean;label?:string}){
 return <button type="button" className={`btn btn-ghost btn-square theme-trigger ${className}`} aria-label={label} aria-haspopup="dialog" aria-expanded={expanded} title="外观与主题" onClick={open}><span aria-hidden="true"/></button>;
}
export function AppearanceControls({palette,dark,setPalette,setDark,reset,error}:{palette:Palette;dark:boolean;setPalette:(p:Palette)=>void;setDark:(d:boolean)=>void;reset:()=>void;error:string}){
 return <section className="appearance-controls" aria-label="外观偏好">
  <div className="appearance-intro"><div><h3>外观</h3></div></div>
  <div className="appearance-mode" role="group" aria-label="明暗模式">
   <button type="button" aria-pressed={!dark} onClick={()=>setDark(false)}><Icon name="sun"/>亮色<span>默认</span></button>
   <button type="button" aria-pressed={dark} onClick={()=>setDark(true)}><Icon name="moon"/>深色</button>
  </div>
  <div className="appearance-palettes" role="group" aria-label="主题配色">
   {palettes.map(p=><button type="button" className="appearance-choice" key={p.id} aria-label={p.name} aria-pressed={palette===p.id} onClick={()=>setPalette(p.id)}>
    <span className="appearance-preview" data-astra-palette={p.id} data-astra-scheme={dark?'dark':'light'} aria-hidden="true"><span className="ap-rail"><i/><i/><i/></span><span className="ap-chat"><i/><i/><b/></span><span className="ap-detail"><i/><i/><i/></span></span>
    <span className="appearance-choice-title"><strong>{p.name}</strong>{palette===p.id?<Icon name="check"/>:<i/>}</span>
   </button>)}
  </div>
  <div className="appearance-footer">{error&&<p role="status">{error}</p>}<button type="button" className="text-button" onClick={reset}>恢复默认</button></div>
 </section>;
}
