import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {WelcomeLogo} from '../../studio/WelcomeLogo';
import {WelcomeWorkspacePreview} from '../../studio/WelcomeWorkspacePreview';
import {Gork} from '../../studio/Gork';
import {ThemeButton,ThemeModeButton} from '../../studio/AppearanceControls';
import {palettes,type Palette} from '../../studio/appearance';
import {ArchitectureWindow} from '../../studio/SystemArchitecture';
import {Icon} from './Icon';
import '../../studio/appearance.css';
import './style.css';

function Demo(){
 const [dark,setDark]=useState(false),[paused,setPaused]=useState(false),[hidden,setHidden]=useState(document.hidden),[notice,setNotice]=useState('');
 const [palette,setPalette]=useState<Palette>('astra'),[panel,setPanel]=useState<'appearance'|'architecture'|null>(null);
 const stage=useRef<HTMLDivElement>(null);
 useEffect(()=>{document.documentElement.dataset.astraScheme=dark?'dark':'light';document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';},[dark]);
 useEffect(()=>{document.documentElement.dataset.astraPalette=palette;},[palette]);
 useEffect(()=>{const sync=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',sync);return()=>document.removeEventListener('visibilitychange',sync);},[]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);},[notice]);
 useEffect(()=>{
  const element=stage.current;if(!element)return;
  const observer=new ResizeObserver(([entry])=>element.style.setProperty('--board-scale',String(Math.min(.94,entry.contentRect.width/1040))));
  observer.observe(element);return()=>observer.disconnect();
 },[]);
 // The existing storyboard owns its clock and pause control. Mirror its state for the spatial motion.
 useEffect(()=>{const element=stage.current?.querySelector('.awp-player');if(!element)return;
  const sync=()=>setPaused(element.classList.contains('is-paused'));
  const observer=new MutationObserver(sync);observer.observe(element,{attributes:true,attributeFilter:['class']});sync();return()=>observer.disconnect();
 },[]);
 return <main className={`hero-demo ${paused||hidden||panel?'motion-paused':''}`}>
  <div className="background-contours" aria-hidden="true"><i/><i/></div>
  <header className="demo-header"><span className="demo-wordmark">ZSuan<span>造价智算</span></span><div><span className="demo-label">欢迎页概念预览</span><nav className="demo-header-actions" aria-label="欢迎页设置"><button type="button" className="btn btn-ghost btn-square" aria-label="系统架构图" title="系统架构图" onClick={()=>setPanel('architecture')}><Icon name="architecture"/></button><ThemeButton open={()=>setPanel('appearance')} expanded={panel==='appearance'}/><ThemeModeButton dark={dark} toggle={()=>setDark(v=>!v)}/></nav></div></header>
  <div className="hero-layout">
   <section className="hero-copy" aria-labelledby="hero-title">
    <div className="hero-logo"><WelcomeLogo dark={dark} active={!hidden&&!paused&&!panel}/></div>
    <h1 id="hero-title">造价智算</h1>
    <p className="hero-role">工程造价辅助智能体</p>
    <p className="hero-description">从清单识别、智能匹配到风险复核，<br/>让专业计算与协同工作，在对话中完成。</p>
    <div className="hero-actions"><button type="button" className="btn btn-primary" onClick={()=>setNotice('这是欢迎页设计预览，当前系统保持不变。')}>进入系统<Icon name="arrow-up-right"/></button><button type="button" className="btn btn-outline" onClick={()=>setNotice('新建任务按钮效果预览，未创建业务任务。')}><Icon name="plus"/>新建任务</button></div>
    <label className="hero-preference"><input type="checkbox" className="checkbox checkbox-sm"/><span>下次直接进入主界面</span></label>
    <p className="hero-notice" role="status">{notice}</p>
   </section>
   <section ref={stage} className="hero-stage" aria-label="原工作台的立体动态演示，使用合成数据">
    <div className="stage-light" aria-hidden="true"/>
    <div className="mascot-plane"><div className="hero-mascot"><Gork size={180} state="idle" still={paused} suspended={hidden||!!panel} followPointer pointerSmoothing="smooth"/></div></div>
    <div className="workspace-depth"><WelcomeWorkspacePreview/></div>
    <div className="floating-sheet" aria-hidden="true"><div className="sheet-heading"><Icon name="sheet"/><span>费用汇总</span><span className="sheet-badge">示例</span></div><div className="sheet-value">121.32<small>万元</small></div><div className="sheet-chart">{[38,57,46,72,62,87,76,100].map((height,i)=><i key={i} style={{height:`${height}%`,animationDelay:`${i*90}ms`}}/>)}</div><div className="sheet-bottom"><span>地质勘察</span><span>工程测量</span></div></div>
    <div className="floating-review" aria-hidden="true"><span className="review-symbol"><Icon name="shield"/></span><div><strong>规则匹配 · 风险复核</strong><span>依据与成果，清晰可追溯</span></div><Icon name="check"/></div>
   </section>
  </div>
  <footer className="demo-footer"><span>清单识别 / 智能匹配 / 风险复核 / 成果交付</span><span>Demo v1.1.0 · 合成数据演示</span></footer>
  {panel==='appearance'&&<PaletteDialog palette={palette} dark={dark} select={setPalette} close={()=>setPanel(null)}/>}
  {panel==='architecture'&&<div className="studio demo-architecture"><ArchitectureWindow dark={dark} close={()=>setPanel(null)}/></div>}
 </main>;
}
function PaletteDialog({palette,dark,select,close}:{palette:Palette;dark:boolean;select:(value:Palette)=>void;close:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current,trigger=document.activeElement as HTMLElement;node?.showModal();return()=>{node?.close();trigger?.focus({preventScroll:true});};},[]);
 return <dialog ref={dialog} className="modal demo-palette-dialog" aria-labelledby="palette-title" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}><div className="modal-box"><header><h2 id="palette-title">主题配色</h2><button type="button" className="btn btn-ghost btn-square" aria-label="关闭主题配色" onClick={close}><Icon name="close"/></button></header><div className="demo-palette-grid">{palettes.map(p=><button type="button" key={p.id} aria-pressed={palette===p.id} onClick={()=>select(p.id)}><span className="palette-swatch" data-astra-palette={p.id} data-astra-scheme={dark?'dark':'light'}><i/><i/><i/></span><span>{p.name}</span>{palette===p.id&&<Icon name="check"/>}</button>)}</div></div></dialog>;
}
createRoot(document.getElementById('root')!).render(<Demo/>);
