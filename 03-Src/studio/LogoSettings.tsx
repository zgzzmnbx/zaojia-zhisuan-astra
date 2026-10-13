import {useEffect,useRef,useState} from 'react';
import {icon} from '../icons.js';
import {LogoPreview,type LogoController} from './brand/LogoPreview';
import {LOGO_MOTIONS} from './brand/motion-options.mjs';
import {LOGO_SEQUENCES,sequenceSteps} from './brand/sequences.mjs';
import {usePageCycles} from './brand/usePageCycles';
import {DEFAULT_LOGO_CONFIG,LOGO_PALETTES,normalizeLogoConfig,parseLogoConfig,serializeLogoConfig,welcomeLogoKey,welcomeLogoEvent} from './brand/logo-config.mjs';
import './logo-settings.css';

const libraryKey='astra.logo-library.v1';
function Icon({name}:{name:string}){return <span className="astra-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:icon(name)}}/>;}
const partNames=['底梁 1','底梁 2','底梁 3','底梁 4','尾巴块','下阶方块','中间方块','上阶方块','顶梁 1','顶梁 2','顶梁 3','顶梁 4','顶梁 5'];
const descriptions:Record<string,string>={static:'保持完整标志',idle:'方块依次旋转、归位',ring:'围成圆环，旋转后重组',wave:'从第一块开始起伏舒展',sway:'整体轻轻左右摇摆',tail:'偶尔飞出，转一圈再回来',scatter:'散开、旋转、有序复原',assembly:'模块组装与尾块互动'};
function readConfig(){try{return normalizeLogoConfig(JSON.parse(localStorage.getItem(libraryKey)||'null'));}catch{return {...DEFAULT_LOGO_CONFIG};}}
export default function LogoSettings({active=true,standalone=false}:{active?:boolean;standalone?:boolean}){
 const [config,setConfig]=useState(readConfig),[paused,setPaused]=useState(false),[ready,setReady]=useState(false),[part,setPart]=useState(4),[status,setStatus]=useState(''),[error,setError]=useState(''),[working,setWorking]=useState('');
 const [cycles,changeCycle]=usePageCycles(),[sequence,setSequence]=useState('welcome'),[phase,setPhase]=useState<{index:number;remaining:number;phase:string;mode:string;cycle:number}|null>(null);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),[allowed,setAllowed]=useState(false);
 const [seed,setSeed]=useState(()=>getComputedStyle(document.documentElement).getPropertyValue('--astra-primary').trim()||'#284bd4');
 const controller=useRef<LogoController|null>(null),file=useRef<HTMLInputElement>(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{try{localStorage.setItem(libraryKey,JSON.stringify(config));}catch{setError('浏览器无法保存偏好，可以导出配置保留当前方案。');}},[config]);
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>{setReduced(mq.matches);setAllowed(false);};mq.addEventListener('change',change);change();const sync=()=>setSeed(getComputedStyle(document.documentElement).getPropertyValue('--astra-primary').trim()||'#284bd4');const observer=new MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-astra-palette','data-astra-scheme']});sync();return()=>{mq.removeEventListener('change',change);observer.disconnect();};},[]);
 function change(patch:Partial<typeof config>){setConfig(c=>({...c,...patch}));setStatus('');setError('');}
 function motion(mode:string){setSequence('');setAllowed(true);setPaused(false);change({mode});controller.current?.restart();}
 function previewCycle(id:string){setSequence(id);setAllowed(true);setPaused(false);controller.current?.restart();setStatus('');}
 function toggleCycle(id:'welcome'|'studio'){try{changeCycle(id,cycles[id]==='loop'?'paused':'loop');setError('');}catch{setError('无法保存页面循环设置，请检查浏览器存储权限。');}}
 useEffect(()=>{if(!sequence||!active){setPhase(null);return;}const sync=()=>{if(!document.hidden)setPhase(controller.current?.inspect().sequence??null);};sync();const timer=window.setInterval(sync,250);return()=>clearInterval(timer);},[sequence,active,ready]);
 const resting=reduced&&!allowed;
 const options={mode:resting||sequence?'static':config.mode,sequence:resting?undefined:sequence||undefined,palette:config.palette,seed,dark:config.background==='dark',speed:sequence==='studio'?1:config.speed,paused,active};
 async function run(label:string,action:()=>Promise<void>){if(working)return;setWorking(label);setError('');setStatus('');try{await action();}catch(e){if(alive.current)setError(e instanceof Error?e.message:'操作未完成，请重试。');}finally{if(alive.current)setWorking('');}}
 function applyWelcome(){try{localStorage.setItem(welcomeLogoKey,JSON.stringify({mode:config.mode,palette:config.palette,speed:config.speed,paused}));if(!sequence)changeCycle('welcome','manual');else if(sequence==='welcome')changeCycle('welcome',paused?'paused':'loop');window.dispatchEvent(new Event(welcomeLogoEvent));setStatus('已应用到欢迎页。');setError('');}catch{setError('无法保存欢迎页设置，请检查浏览器存储权限。');}}
 async function exportFile(kind:'png'|'glb'|'json'){
  const {downloadBlob,exportLogoGLB,exportLogoPNG}=await import('./brand/logo-export.mjs');
  const name=`造价智算-Logo-${config.palette}-${config.mode}`;
  if(kind==='json')downloadBlob(new Blob([serializeLogoConfig(config)],{type:'application/json'}),name+'.json');
  else if(kind==='glb')downloadBlob(await exportLogoGLB(config,seed),name+'.glb');
  else{const blob=await controller.current?.snapshot();if(!(blob instanceof Blob))throw Error('三维预览尚未就绪。');downloadBlob(await exportLogoPNG(blob,config) as Blob,name+'.png');}
  if(alive.current)setStatus('已导出'+({png:' PNG 图片',glb:' GLB 动效模型',json:'配置文件'}[kind])+'。');
 }
 function once(kind:string){setSequence('');setAllowed(true);setPaused(false);controller.current?.update({...options,sequence:undefined,mode:config.mode,paused:false});controller.current?.playOnce(kind,part);setStatus(kind==='spin'?`${partNames[part]}正在旋转。`:kind==='explode'?'打散后保持，可点击组合。':'正在组合。');}
 return <div className="logo-library" data-standalone={standalone}>
  <div className="logo-library-preview-column">
   <div className="logo-library-preview" data-background={config.background}>
    <div className="logo-library-preview-top"><span>实时预览</span><span>13 个独立方块</span></div>
    <div className="logo-library-lockup" data-layout={config.layout}>
     <LogoPreview ref={controller} options={options} onReady={setReady}/>
     {config.layout!=='icon'&&<strong className="logo-library-wordmark">造价智算</strong>}
    </div>
    <div className="logo-library-transport">
     <button type="button" className="btn btn-ghost btn-square" disabled={!ready} aria-label={paused||resting?'播放 Logo 预览':'暂停 Logo 预览'} onClick={()=>{setAllowed(true);setPaused(resting?false:!paused);}}><Icon name={paused||resting?'play':'pause'}/></button>
     <button type="button" className="btn btn-ghost btn-square" disabled={!ready} aria-label="重播 Logo 动效" onClick={()=>{setAllowed(true);setPaused(false);controller.current?.restart();}}><Icon name="refresh"/></button>
     <span>{sequence?`${LOGO_SEQUENCES.find(s=>s.id===sequence)?.name}循环 · ${phase?.phase==='rest'?`静止 ${Math.ceil(phase.remaining)} 秒`:LOGO_MOTIONS.find(m=>m.id===phase?.mode)?.name||'准备'}`:LOGO_MOTIONS.find(m=>m.id===config.mode)?.name}</span>
     <label>速度<select className="select select-sm" aria-label="Logo 动效速度" disabled={sequence==='studio'} value={options.speed} onChange={e=>change({speed:Number(e.target.value)})}>{[.5,.75,1,1.25,1.5].map(n=><option value={n} key={n}>{n}×</option>)}</select></label>
    </div>
   </div>
   {resting&&<p className="logo-library-note">系统已开启减少动效；点击播放可预览。</p>}
   <div className="logo-library-export"><button className="btn btn-outline btn-sm" disabled={!ready||!!working} onClick={()=>void run('正在导出图片',()=>exportFile('png'))}><Icon name="download"/>导出 PNG</button><button className="btn btn-outline btn-sm" disabled={!!working} onClick={()=>void run('正在导出模型',()=>exportFile('glb'))}><Icon name="download"/>导出 GLB</button><button className="btn btn-ghost btn-sm" disabled={!!working} onClick={()=>void run('正在导出配置',()=>exportFile('json'))}>导出配置</button><button className="btn btn-ghost btn-sm" disabled={!!working} onClick={()=>file.current?.click()}>导入配置</button></div>
   <p className="logo-library-note">PNG 保存当前画面；GLB 包含八种单动作。页面循环的顺序与停留时间见右侧。</p>
   <input type="file" ref={file} hidden accept=".json,application/json" aria-label="导入 Logo 配置文件" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void run('正在读取配置',async()=>{if(f.size>65536)throw Error('配置文件过大，请选择 Logo 配置 JSON。');const next=parseLogoConfig(await f.text());if(alive.current){setSequence('');setConfig(next);setPaused(false);controller.current?.restart();setStatus('配置已导入。');}});}}/>
   <div className="logo-library-feedback" aria-live="polite">{error?<p role="alert">{error}</p>:<p>{working||status}</p>}</div>
  </div>
  <div className="logo-library-options">
   <fieldset className="logo-page-cycles"><legend>页面循环</legend>{LOGO_SEQUENCES.map(s=><section key={s.id} className="logo-cycle" aria-label={`${s.name}循环流程`}>
    <header><strong>{s.name}</strong><span>{cycles[s.id as 'welcome'|'studio']==='loop'?'已启用循环':cycles[s.id as 'welcome'|'studio']==='paused'?'已暂停':'自选动作'}</span></header>
    <ol>{sequenceSteps(s.id).map((step,i)=><li key={i} data-current={sequence===s.id&&phase?.index===i&&!resting} aria-current={sequence===s.id&&phase?.index===i&&!resting?'step':undefined}>{step.phase==='rest'?`静止 ${s.rest} 秒`:LOGO_MOTIONS.find(m=>m.id===step.mode)?.name}</li>)}</ol>
    <footer><span>归位后重复循环</span><button type="button" className="btn btn-ghost btn-sm" aria-label={`预览${s.name}循环`} aria-pressed={sequence===s.id} onClick={()=>previewCycle(s.id)}><Icon name="play"/>预览</button><button type="button" className="btn btn-ghost btn-sm" aria-label={`${cycles[s.id as 'welcome'|'studio']==='loop'?'暂停':'启用'}${s.name}循环`} onClick={()=>toggleCycle(s.id as 'welcome'|'studio')}>{cycles[s.id as 'welcome'|'studio']==='loop'?'暂停循环':'启用循环'}</button></footer>
   </section>)}</fieldset>
   <fieldset><legend>配色</legend><div className="logo-palette-grid">{LOGO_PALETTES.map(p=><button type="button" key={p.id} aria-pressed={config.palette===p.id} title={p.name} onClick={()=>change({palette:p.id})}><i style={{background:p.seed||'var(--astra-primary)'}}/><span>{p.name}</span>{config.palette===p.id&&<Icon name="check"/>}</button>)}</div></fieldset>
   <fieldset><legend>单个动效</legend><div className="logo-motion-grid">{LOGO_MOTIONS.map(m=><button type="button" key={m.id} aria-pressed={!sequence&&config.mode===m.id} onClick={()=>motion(m.id)}><strong>{m.name}</strong><span>{descriptions[m.id]}</span></button>)}</div></fieldset>
   <div className="logo-library-selects"><label>组合<select className="select select-sm" aria-label="Logo 文字组合" value={config.layout} onChange={e=>change({layout:e.target.value})}><option value="horizontal">横向 · 造价智算</option><option value="vertical">上下 · 造价智算</option><option value="icon">仅图形</option></select></label><label>背景<select className="select select-sm" aria-label="Logo 预览背景" value={config.background} onChange={e=>change({background:e.target.value})}><option value="light">浅色</option><option value="dark">深色</option><option value="transparent">透明</option></select></label></div>
   <fieldset><legend>方块互动</legend><div className="logo-parts-control"><select className="select select-sm" aria-label="选择 Logo 方块" value={part} onChange={e=>setPart(Number(e.target.value))}>{partNames.map((name,i)=><option key={name} value={i}>{name}</option>)}</select><button className="btn btn-outline btn-sm" disabled={!ready} onClick={()=>once('spin')}>旋转一圈</button></div><div className="logo-parts-actions"><button className="btn btn-ghost btn-sm" disabled={!ready} onClick={()=>once('explode')}>打散</button><button className="btn btn-ghost btn-sm" disabled={!ready} onClick={()=>once('assemble')}>组合</button><button className="btn btn-ghost btn-sm" disabled={!ready} onClick={()=>{controller.current?.restart();setStatus('已恢复所选动效。');}}>恢复动效</button></div></fieldset>
   <div className="logo-library-apply"><button type="button" className="btn btn-primary" onClick={applyWelcome}><Icon name="check"/>应用到欢迎页</button>{!standalone&&<a className="btn btn-ghost btn-sm" href="/logo.html" target="_blank" rel="noreferrer">独立页面<Icon name="arrow-up-right"/></a>}</div>
  </div>
 </div>;
}
