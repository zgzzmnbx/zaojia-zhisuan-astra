import {palettes,type Palette,type SandboxChatBackground} from './appearance';
import {Icon} from './ui';
export function ThemeModeButton({dark,toggle}:{dark:boolean;toggle:()=>void}){
 const label=dark?'切换到亮色模式':'切换到深色模式';
 return <button type="button" className="btn btn-ghost btn-square theme-mode-toggle" aria-label={label} aria-pressed={dark} title={label} onClick={toggle}><Icon name={dark?'sun':'moon'}/></button>;
}
export function ThemeButton({open,className='',expanded,label='主题配色'}:{open:()=>void;className?:string;expanded?:boolean;label?:string}){
 return <button type="button" className={`btn btn-ghost btn-square theme-trigger ${className}`} aria-label={label} aria-haspopup="dialog" aria-expanded={expanded} title="外观与主题" onClick={open}><span aria-hidden="true"/></button>;
}
export function AppearanceControls({palette,dark,setPalette,setDark,reset,error,sandboxChatBackground,sandboxChatTransparency,setSandboxChatBackground,setSandboxChatTransparency,sandboxAutoOrbit,sandboxOrbitDelay,setSandboxAutoOrbit,setSandboxOrbitDelay}:{palette:Palette;dark:boolean;setPalette:(p:Palette)=>void;setDark:(d:boolean)=>void;reset:()=>void;error:string;sandboxChatBackground:SandboxChatBackground;sandboxChatTransparency:number;setSandboxChatBackground:(v:SandboxChatBackground)=>void;setSandboxChatTransparency:(v:number)=>void;sandboxAutoOrbit:boolean;sandboxOrbitDelay:number;setSandboxAutoOrbit:(v:boolean)=>void;setSandboxOrbitDelay:(v:number)=>void}){
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
  <fieldset className="sandbox-chat-appearance"><legend>沙盘聊天背景</legend>
   <div className="appearance-mode" role="group" aria-label="沙盘聊天背景">
    <button type="button" aria-pressed={sandboxChatBackground==='glass'} onClick={()=>setSandboxChatBackground('glass')}>磨砂玻璃</button>
    <button type="button" aria-pressed={sandboxChatBackground==='solid'} onClick={()=>setSandboxChatBackground('solid')}>默认聊天背景</button>
   </div>
   {sandboxChatBackground==='glass'&&<label className="sandbox-chat-transparency"><span>透明度<output>{sandboxChatTransparency}%</output></span><input className="range range-primary range-sm" type="range" min="0" max="80" step="1" aria-label="沙盘聊天背景透明度" aria-valuetext={`${sandboxChatTransparency}%`} value={sandboxChatTransparency} onChange={e=>setSandboxChatTransparency(Number(e.target.value))}/><span className="transparency-scale"><small>更实</small><small>更透</small></span></label>}
  </fieldset>
  <fieldset className="sandbox-chat-appearance"><legend>沙盘环游</legend><label className="sandbox-orbit-setting"><span>空闲自动环游</span><input type="checkbox" className="toggle toggle-primary toggle-sm" checked={sandboxAutoOrbit} onChange={e=>setSandboxAutoOrbit(e.target.checked)}/></label><label className="sandbox-orbit-setting"><span>空闲等待</span><select className="select select-sm" aria-label="沙盘环游空闲等待" disabled={!sandboxAutoOrbit} value={sandboxOrbitDelay} onChange={e=>setSandboxOrbitDelay(Number(e.target.value))}>{[2,5,10,15,30,60].map(s=><option key={s} value={s}>{s} 秒</option>)}</select></label><p className="sandbox-orbit-help">操作时暂停；查看详情、处理任务及减少动效时不自动环游。调节后可在沙盘视图中保存当前参数。</p></fieldset>
  <div className="appearance-footer">{error&&<p role="status">{error}</p>}<button type="button" className="text-button" onClick={reset}>恢复默认</button></div>
 </section>;
}
