import { useEffect, useId, useRef, useState } from 'react';
import { Settings2, RotateCcw, X } from '../../PhosphorIcons';
import { DEFAULT_GALAXY_SETTINGS, GALAXY_SETTING_LIMITS } from './galaxy-settings.mjs';
import { galaxyCategoryColor } from './knowledge-galaxy-layout.mjs';

type Values = typeof DEFAULT_GALAXY_SETTINGS;
type Key = keyof typeof GALAXY_SETTING_LIMITS;
const layouts=[['nebula','立体星云','饱满纵深'],['spiral','旋臂银河','舒展流动'],['sphere','球状星团','均衡环绕']] as const;
const fields: {key:Key;label:string;percent?:boolean}[] = [
  {key:'depth',label:'空间厚度'}, {key:'rotationSpeed',label:'旋转速度'}, {key:'zoom',label:'画面缩放'}, {key:'inspectionZoom',label:'点选放大倍率'}, {key:'nodeSize',label:'节点大小'},
  {key:'nodeOpacity',label:'节点不透明度',percent:true}, {key:'labelBrightness',label:'名称亮度',percent:true},
  {key:'emissive',label:'自发光强度',percent:true}, {key:'haloStrength',label:'光晕强度',percent:true}, {key:'haloSize',label:'光晕大小'},
  {key:'flowSpeed',label:'光流速度'}, {key:'overviewBrightness',label:'鸟瞰连线亮度',percent:true},
  {key:'selectedBrightness',label:'关联连线亮度',percent:true}, {key:'lineWidth',label:'连线粗细'},
];
export default function GalaxySettings({ value, onChange, saved, categories }: {value:Values;onChange:(next:Values)=>void;saved:boolean;categories:string[]}) {
  const [open,setOpen]=useState(false), id=useId();
  const trigger=useRef<HTMLButtonElement>(null), panel=useRef<HTMLDivElement>(null);
  const close=()=>{setOpen(false);trigger.current?.focus({preventScroll:true});};
  useEffect(()=>{
    if(!open)return;
    panel.current?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});
    const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside,true);
    return ()=>document.removeEventListener('pointerdown',outside,true);
  },[open]);
  return <>
    <button ref={trigger} className="knowledge-article-text-button" aria-label="星图设置" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}><Settings2 size={16}/><span>设置</span></button>
    {open && <div ref={panel} id={id} role="dialog" aria-label="星图设置" aria-modal="false" className="galaxy-settings card" onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    }}>
      <header><strong>星图设置</strong><button className="btn btn-ghost btn-square btn-sm" aria-label="关闭星图设置" onClick={close}><X size={16}/></button></header>
      <fieldset className="galaxy-settings__layouts"><legend>空间形态</legend><div>{layouts.map(([key,label,hint])=><button key={key} type="button" aria-pressed={value.layout===key} className={`galaxy-layout-option ${value.layout===key?'is-active':''}`} onClick={()=>onChange({...value,layout:key})}><span className={`galaxy-layout-preview is-${key}`} aria-hidden="true">{Array.from({length:18},(_,i)=><i key={i} style={{'--star':i} as React.CSSProperties}/>)}</span><strong>{label}</strong><small>{hint}</small></button>)}</div></fieldset>
      <div className="galaxy-settings__fields">{fields.map(({key,label,percent})=><label key={key} className={key==='flowSpeed'?'galaxy-settings__field is-section':'galaxy-settings__field'}>
        <span>{label}<output>{percent?`${Math.round(value[key]*100)}%`:`${value[key].toFixed(1)}×`}</output></span>
        <input className="range range-xs" type="range" aria-label={label} aria-valuetext={percent?`${Math.round(value[key]*100)}%`:`${value[key].toFixed(1)} 倍`} min={GALAXY_SETTING_LIMITS[key][0]} max={GALAXY_SETTING_LIMITS[key][1]} step={percent ? .01 : .1} value={value[key]} onChange={event=>onChange({...value,[key]:Number(event.target.value)})}/>
      </label>)}</div>
      <details className="galaxy-settings__legend"><summary>分组配色 · {categories.length} 类</summary><ul>{categories.map(category=><li key={category}><span aria-hidden="true" style={{background:galaxyCategoryColor(category)}}/>{category}</li>)}</ul></details>
      <footer><span role="status">{saved?'自动记住设置':'仅本次生效'}</span><button className="btn btn-ghost btn-sm" onClick={()=>onChange({...DEFAULT_GALAXY_SETTINGS})}><RotateCcw size={14}/>恢复默认</button></footer>
    </div>}
  </>;
}
