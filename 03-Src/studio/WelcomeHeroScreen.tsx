import {useEffect,useRef,useState} from 'react';
import {ThemeButton,ThemeModeButton} from './AppearanceControls';
import {Gork,Icon} from './ui';
import {WelcomeLogo} from './WelcomeLogo';
import {WelcomeWorkspacePreview} from './WelcomeWorkspacePreview';
import {TaskProgress} from './TaskProgress';
import {readSkipWelcome,type WelcomeProps} from './ClassicWelcomeScreen';
import './welcome-hero.css';

export function WelcomeHeroScreen({runtimeStatus,ready,busy,dark,toggleTheme,openAppearance,error,enter,newChat,openLogo,logoActive=true,openArchitecture}:WelcomeProps){
 const [skip,setSkip]=useState(readSkipWelcome),[preferenceError,setPreferenceError]=useState('');
 const [entering,setEntering]=useState(false),[creating,setCreating]=useState(false),[creationError,setCreationError]=useState('');
 const [paused,setPaused]=useState(false),[hidden,setHidden]=useState(document.hidden);
 const stage=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null),actionLock=useRef(false);
 useEffect(()=>{if(!document.querySelector('dialog[open]'))heading.current?.focus({preventScroll:true});},[]);
 useEffect(()=>{const sync=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',sync);return()=>document.removeEventListener('visibilitychange',sync);},[]);
 useEffect(()=>{const element=stage.current;if(!element)return;const observer=new ResizeObserver(([entry])=>element.style.setProperty('--board-scale',String(Math.min(.94,entry.contentRect.width/1040))));observer.observe(element);return()=>observer.disconnect();},[]);
 useEffect(()=>{const player=stage.current?.querySelector('.awp-player');if(!player)return;const sync=()=>setPaused(player.classList.contains('is-paused'));const observer=new MutationObserver(sync);observer.observe(player,{attributes:true,attributeFilter:['class']});sync();return()=>observer.disconnect();},[]);
 function savePreference(value:boolean){setSkip(value);try{localStorage.setItem('astra.skip-welcome.v1',String(value));setPreferenceError('');}catch{setPreferenceError('浏览器暂时无法保存此偏好，下次仍会显示欢迎页。');}}
 function enterStudio(){if(actionLock.current||busy||(!ready&&!error))return;actionLock.current=true;setEntering(true);enter();}
 async function createTask(){if(actionLock.current||busy||!ready)return;actionLock.current=true;setCreating(true);setCreationError('');try{await newChat();}catch(e){setCreationError(e instanceof Error?e.message:'新建任务失败，请重试。');}finally{actionLock.current=false;setCreating(false);}}
 return <main className={`astra-welcome-hero ${paused||hidden||!logoActive?'motion-paused':''}`} aria-label="造价智算 欢迎页">
  <svg className="welcome-lowpoly" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">
   <polygon points="0,0 330,0 336,239" fillOpacity={0.16}/>
   <polygon points="0,0 336,239 0,154" fillOpacity={0.035}/>
   <polygon points="330,0 458,0 336,239" fillOpacity={0.055}/>
   <polygon points="458,0 547,172 336,239" fillOpacity={0.16}/>
   <polygon points="458,0 873,0 831,217" fillOpacity={0.16}/>
   <polygon points="458,0 831,217 547,172" fillOpacity={0.08}/>
   <polygon points="873,0 1165,0 831,217" fillOpacity={0.16}/>
   <polygon points="1165,0 1091,253 831,217" fillOpacity={0.055}/>
   <polygon points="1165,0 1427,0 1378,181" fillOpacity={0.13}/>
   <polygon points="1165,0 1378,181 1091,253" fillOpacity={0.16}/>
   <polygon points="1427,0 1600,0 1378,181" fillOpacity={0.08}/>
   <polygon points="1600,0 1600,157 1378,181" fillOpacity={0.13}/>
   <polygon points="0,154 336,239 0,418" fillOpacity={0.035}/>
   <polygon points="336,239 280,414 0,418" fillOpacity={0.08}/>
   <polygon points="336,239 547,172 574,468" fillOpacity={0.08}/>
   <polygon points="336,239 574,468 280,414" fillOpacity={0.16}/>
   <polygon points="547,172 831,217 574,468" fillOpacity={0.055}/>
   <polygon points="831,217 807,505 574,468" fillOpacity={0.105}/>
   <polygon points="831,217 1091,253 1145,488" fillOpacity={0.055}/>
   <polygon points="831,217 1145,488 807,505" fillOpacity={0.055}/>
   <polygon points="1091,253 1378,181 1145,488" fillOpacity={0.08}/>
   <polygon points="1378,181 1428,403 1145,488" fillOpacity={0.13}/>
   <polygon points="1378,181 1600,157 1600,449" fillOpacity={0.16}/>
   <polygon points="1378,181 1600,449 1428,403" fillOpacity={0.035}/>
   <polygon points="0,418 280,414 281,671" fillOpacity={0.105}/>
   <polygon points="0,418 281,671 0,784" fillOpacity={0.105}/>
   <polygon points="280,414 574,468 281,671" fillOpacity={0.035}/>
   <polygon points="574,468 437,656 281,671" fillOpacity={0.13}/>
   <polygon points="574,468 807,505 882,785" fillOpacity={0.16}/>
   <polygon points="574,468 882,785 437,656" fillOpacity={0.035}/>
   <polygon points="807,505 1145,488 882,785" fillOpacity={0.08}/>
   <polygon points="1145,488 1087,672 882,785" fillOpacity={0.16}/>
   <polygon points="1145,488 1428,403 1413,712" fillOpacity={0.055}/>
   <polygon points="1145,488 1413,712 1087,672" fillOpacity={0.035}/>
   <polygon points="1428,403 1600,449 1413,712" fillOpacity={0.105}/>
   <polygon points="1600,449 1600,661 1413,712" fillOpacity={0.16}/>
   <polygon points="0,784 281,671 0,1000" fillOpacity={0.055}/>
   <polygon points="281,671 257,1000 0,1000" fillOpacity={0.08}/>
   <polygon points="281,671 437,656 525,1000" fillOpacity={0.08}/>
   <polygon points="281,671 525,1000 257,1000" fillOpacity={0.035}/>
   <polygon points="437,656 882,785 525,1000" fillOpacity={0.035}/>
   <polygon points="882,785 850,1000 525,1000" fillOpacity={0.055}/>
   <polygon points="882,785 1087,672 1035,1000" fillOpacity={0.035}/>
   <polygon points="882,785 1035,1000 850,1000" fillOpacity={0.13}/>
   <polygon points="1087,672 1413,712 1035,1000" fillOpacity={0.055}/>
   <polygon points="1413,712 1270,1000 1035,1000" fillOpacity={0.16}/>
   <polygon points="1413,712 1600,661 1600,1000" fillOpacity={0.13}/>
   <polygon points="1413,712 1600,1000 1270,1000" fillOpacity={0.16}/>
  </svg>
  <header className="demo-header"><span className="demo-wordmark">ZSuan<span>造价智算</span></span><div>{runtimeStatus}<nav className="demo-header-actions" aria-label="欢迎页设置"><button type="button" className="btn btn-ghost btn-square" aria-label="系统架构图" title="系统架构图" onClick={openArchitecture}><Icon name="architecture"/></button><ThemeButton open={openAppearance}/><ThemeModeButton dark={dark} toggle={toggleTheme}/></nav></div></header>
  <div className="hero-layout">
   <section className="hero-copy" aria-labelledby="hero-title">
    <div className="hero-logo"><WelcomeLogo dark={dark} active={!hidden&&!paused&&logoActive} openLibrary={openLogo}/></div>
    <h1 id="hero-title" ref={heading} tabIndex={-1}>造价智算</h1>
    <p className="hero-role">工程造价辅助智能体</p>
    <p className="hero-description">从清单识别、智能匹配到风险复核，<br/>让专业计算与协同工作，在对话中完成。</p>
    <div className="hero-actions"><button type="button" className="btn btn-primary" disabled={entering||creating||busy||(!ready&&!error)} onClick={enterStudio}>{entering?'正在进入…':'进入系统'}<Icon name="arrow-up-right"/></button><button type="button" className="btn btn-outline" disabled={entering||creating||busy||!ready} aria-busy={creating} onClick={()=>void createTask()}>{creating?<span className="loading loading-spinner loading-sm" aria-hidden="true"/>:<Icon name="plus"/>}{creating?'正在新建…':'新建任务'}</button></div>
    <label className="hero-preference"><input type="checkbox" className="checkbox checkbox-sm" checked={skip} onChange={e=>savePreference(e.target.checked)}/><span>下次直接进入主界面</span></label>
    <div className="hero-feedback">{!ready&&!error&&!creating&&<TaskProgress compact indicator="spinner" label="正在恢复工作空间"/>}{(creationError||error||preferenceError)&&<p className="hero-error" role="alert">{creationError||error||preferenceError}</p>}</div>
   </section>
   <section ref={stage} className="hero-stage" aria-label="工作台立体动态演示，使用合成数据">
    <div className="mascot-plane"><div className="hero-mascot"><Gork size={180} state={busy?'working':'idle'} still={paused} suspended={hidden||!logoActive} followPointer pointerSmoothing="smooth"/></div></div>
    <div className="workspace-depth"><WelcomeWorkspacePreview active={logoActive&&!hidden}/></div>
    <div className="floating-sheet" aria-hidden="true"><div className="sheet-heading"><Icon name="sheet"/><span>费用汇总</span><span className="sheet-badge">示例</span></div><div className="sheet-value">121.32<small>万元</small></div><div className="sheet-chart">{[38,57,46,72,62,87,76,100].map((height,i)=><i key={i} style={{height:`${height}%`,animationDelay:`${i*90}ms`}}/>)}</div><div className="sheet-bottom"><span>地质勘察</span><span>工程测量</span></div></div>
    <div className="floating-review" aria-hidden="true"><span className="review-symbol"><Icon name="shield"/></span><div><strong>规则匹配 · 风险复核</strong><span>依据与成果，清晰可追溯</span></div><Icon name="check"/></div>
   </section>
  </div>
 </main>;
}
