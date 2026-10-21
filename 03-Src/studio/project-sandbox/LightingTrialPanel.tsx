import {useEffect,useRef,useState} from 'react';
import {cardControls,trialControls,approvedLighting,lightingTrialKey,type LightingTrial} from './lighting-trial';
type Props={value:LightingTrial;change:(value:LightingTrial)=>void;active:boolean;legacy:boolean;restoreLegacy:()=>void;activate:(value:boolean)=>void;dark:boolean;day:()=>void;close:()=>void};
export function LightingTrialPanel({value,change,active,legacy,restoreLegacy,activate,dark,day,close}:Props){
 const [card,setCard]=useState(0),[saved,setSaved]=useState('');const first=useRef<HTMLButtonElement>(null);
 useEffect(()=>{first.current?.focus({preventScroll:true})},[]);
 const update=(next:LightingTrial)=>{change(next);activate(true);setSaved('')};
 const sliders=(keys:string[])=>trialControls.filter(c=>keys.includes(c[0])).map(([key,label,min,max,step,unit])=><label className="trial-slider" key={key}><span>{label}</span><output>{Number(value[key].toFixed(3))}{unit}</output><input className="range range-xs" type="range" aria-label={label} min={min} max={max} step={step} value={value[key]} onChange={e=>update({...value,[key]:Number(e.target.value)})}/></label>);
 return <section className="sandbox-lighting-trial" role="region" aria-label="光照试调" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close()}}}>
  <header><strong>光照试调</strong><span>{legacy?'原默认备份':active?'待视觉确认':'已确认默认'}</span><button className="btn btn-ghost btn-sm" aria-label="关闭光照试调" onClick={close}>关闭</button></header>
  <div className="trial-comparison"><button ref={first} className="btn btn-sm" aria-pressed={!active&&!legacy} onClick={()=>activate(false)}>正式默认</button><button className="btn btn-sm" aria-pressed={active&&!legacy} onClick={()=>activate(true)}>试调效果</button><button className="btn btn-sm" aria-pressed={legacy} onClick={restoreLegacy}>原默认备份</button></div>
  {dark?<p className="trial-note">试调仅作用日间。<button className="text-button" onClick={day}>切到日间</button></p>:<p className="trial-note">{legacy?'完整恢复旧版光照、材质与光影开关，仅本次预览。':'修改仅用于试调；正式默认已保存。关闭相关效果时，对应参数暂不生效。'}</p>}
  <div className="trial-body" hidden={legacy}>
   <details open><summary>主光与明暗</summary>{sliders(['sunAzimuth','sunElevation','sun','fill','hemisphere','environment','exposure','gi','shadowSoftness','background'])}</details>
   <details><summary>反射灯板 · 位置与形状</summary><p className="trial-note">灯板朝向模型中心，控制表面亮带。投影方向由主光决定。</p>
    <div className="trial-light-count"><button className="btn btn-ghost btn-sm" onClick={()=>update({...value,cards:value.cards.map((c,i)=>({...c,enabled:i<2}))})}>仅主灯与轮廓灯</button><button className="btn btn-ghost btn-sm" onClick={()=>update({...value,cards:value.cards.map(c=>({...c,enabled:true}))})}>四灯配合</button></div>
    <select className="select select-sm" aria-label="选择反射灯板" value={card} onChange={e=>setCard(Number(e.target.value))}>{value.cards.map((c,i)=><option key={c.name} value={i}>{c.name}</option>)}</select>
    <label className="trial-switch"><input className="toggle toggle-xs" type="checkbox" checked={value.cards[card].enabled} onChange={e=>update({...value,cards:value.cards.map((c,i)=>i===card?{...c,enabled:e.target.checked}:c)})}/>启用此灯板</label>
    <svg className="trial-map" viewBox="0 0 220 150" role="img" aria-label="灯板位置俯视图，横轴X，纵轴Z"><path d="M20 75H200M110 15V135"/><rect x="91" y="56" width="38" height="38"/><text x="97" y="79">模型</text><text x="192" y="69">X</text><text x="115" y="139">Z</text>{value.cards.map((c,i)=><g key={c.name} opacity={c.enabled?1:.3}><circle cx={110+c.x*3.2} cy={75+c.z*2.2} r={i===card?7:4}/><text x={120+c.x*3.2} y={79+c.z*2.2}>{i+1}</text></g>)}</svg>
    {cardControls.map(([key,label,min,max,step])=><label className="trial-slider" key={key}><span>{label}</span><output>{value.cards[card][key]}</output><input className="range range-xs" aria-label={'灯板'+label} type="range" min={min} max={max} step={step} value={value.cards[card][key]} onChange={e=>update({...value,cards:value.cards.map((c,i)=>i===card?{...c,[key]:Number(e.target.value)}:c)})}/></label>)}
   </details>
   <details><summary>白墙与管罐材质</summary>{sliders(['wallRoughness','normal','tankRoughness','tankMetalness','pipeRoughness','pipeMetalness','reflection','blueDepth'])}</details>
  </div>
  <footer><button className="btn btn-ghost btn-sm" onClick={()=>update(approvedLighting())}>载入已确认参数</button><button className="btn btn-primary btn-sm" disabled={legacy} onClick={()=>{try{localStorage.setItem(lightingTrialKey,JSON.stringify(value));setSaved('参数已保存，刷新后可手动启用')}catch{setSaved('保存失败，请检查浏览器存储')}}}>保存我的参数</button><small role="status">{saved}</small></footer>
 </section>;
}
