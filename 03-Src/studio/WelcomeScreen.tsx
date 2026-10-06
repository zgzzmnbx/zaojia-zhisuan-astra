import {ThemeButton} from './AppearanceControls';
import {useEffect,useRef,useState} from 'react';
import {Gork,Icon} from './ui';
import {useGorkMotion} from './Gork';
import './welcome-screen.css';

const preferenceKey='astra.skip-welcome.v1';
export function readSkipWelcome(){try{return localStorage.getItem(preferenceKey)==='true';}catch{return false;}}

type Props={
  ready:boolean; busy:boolean; dark:boolean; toggleTheme:()=>void; openAppearance:()=>void;
  currentTitle?:string; hasWork:boolean; error?:string;
  enter:()=>void; newChat:()=>void; open:(view:string)=>void;
};

/** Original welcome entry / skip preference, adapted to Astra's conversation workspace. */
export function WelcomeScreen({ready,busy,dark,toggleTheme,openAppearance,currentTitle,hasWork,error,enter,newChat,open}:Props){
  const [skip,setSkip]=useState(readSkipWelcome),[preferenceError,setPreferenceError]=useState('');
  const [greeting,setGreeting]=useState(false),[paused,setPaused]=useGorkMotion();
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();return()=>clearTimeout(timer.current);},[]);
  function greet(){clearTimeout(timer.current);setGreeting(true);timer.current=setTimeout(()=>setGreeting(false),2600);}
  function savePreference(value:boolean){
    setSkip(value);
    try{localStorage.setItem(preferenceKey,String(value));setPreferenceError('');}
    catch{setPreferenceError('浏览器暂时无法保存此偏好，下次仍会显示欢迎页。');}
  }
  const unavailable=!ready||busy;
  return <main className="astra-welcome" aria-label="智算Astra 欢迎页">
    <header className="aw-header">
      <div className="aw-brand"><span className="brand-mark astra-mark" aria-hidden="true">A</span><span><strong>智算 Astra</strong><small>专业工程造价智能体</small></span></div>
      <div className="aw-header-actions"><span>从一句话开始，一起把工作做好</span><ThemeButton open={openAppearance}/><button type="button" className="btn btn-ghost btn-square" aria-label="切换欢迎页明暗主题" onClick={toggleTheme}><Icon name={dark?'sun':'moon'}/></button></div>
    </header>
    <div className="aw-content">
      <section className="aw-intro" aria-labelledby="aw-title">
        <p className="aw-eyebrow"><span/>你好，我是智算</p>
        <h1 id="aw-title" ref={heading} tabIndex={-1}>把复杂的工作，<br/><span>聊出清晰的结果。</span></h1>
        <p className="aw-lead">带上资料，说说你要完成的事。<br/>Gork 陪你推进每一步，表格、依据与成果随时在侧。</p>
        <div className="aw-actions"><button type="button" className="btn btn-primary aw-enter" disabled={busy||(!ready&&!error)} onClick={enter}>进入工作室<Icon name="arrow-right"/></button><button type="button" className="btn btn-ghost" disabled={unavailable} onClick={newChat}><Icon name="plus"/>新建对话</button></div>
        <label className="aw-preference"><input type="checkbox" className="checkbox checkbox-primary" checked={skip} onChange={e=>savePreference(e.target.checked)}/><span>下次直接进入工作室</span></label>
        {preferenceError&&<p className="aw-error" role="alert">{preferenceError}</p>}
        {error&&<p className="aw-error" role="alert">{error}<br/>进入工作室后可重试保存或导出草稿。</p>}
        {!ready&&!error&&<p className="aw-status" role="status">正在恢复你的工作空间…</p>}
        {ready&&hasWork&&<button type="button" className="aw-resume" disabled={busy} onClick={enter}><span className="aw-resume-icon"><Icon name="message"/></span><span><small>接着上次的思路</small><strong>{currentTitle||'当前对话'}</strong></span><Icon name="arrow-up-right"/></button>}
      </section>
      <section className="aw-companion" aria-label="Gork 与工作方式">
        <div className="aw-gork-stage">
          <div className="aw-orbit" aria-hidden="true"/>
          <div className="aw-gork"><Gork size={156} interactive onGreet={greet}/></div>
          <p className="aw-gork-speech" aria-live="polite">{greeting?'收到，今天也一起把事做好。':'我在，准备好就一起开工。'}</p>
          <button type="button" className="btn btn-ghost btn-square aw-motion" aria-label={paused?'播放 Gork 动效':'暂停 Gork 动效'} aria-pressed={paused} onClick={()=>setPaused(!paused)}><Icon name={paused?'play':'pause'}/></button>
        </div>
        <div className="aw-flow card">
          <div className="aw-flow-heading"><span><Icon name="spark"/>与你这样协作</span><small>Gork · 智算的化身</small></div>
          <ol>
            <li><span className="aw-step">01</span><div><strong>带上资料，说出目标</strong><p>导入工作量表，或直接提出专业问题。</p></div><Icon name="sheet"/></li>
            <li><span className="aw-step">02</span><div><strong>在对话中，一步步推进</strong><p>确认结构、调用规则，关键决定由你掌握。</p></div><Icon name="message"/></li>
            <li><span className="aw-step">03</span><div><strong>在右侧，核对每一项成果</strong><p>查看表格与引用，复核后输出 Excel 和 Word。</p></div><Icon name="panel"/></li>
          </ol>
          <div className="aw-flow-note"><Icon name="shield"/>专业规则决定数字，依据随成果保留</div>
        </div>
      </section>
      <section className="aw-explore" aria-labelledby="aw-explore-title">
        <div className="aw-explore-heading"><h2 id="aw-explore-title">也可以，从这里开始</h2><span>在同一个工作空间里继续</span></div>
        <div className="aw-entry-grid">
          {[
            ['knowledge','book','问问智算','查找专业依据，核对回答来源'],
            ['library','folder','资料库','把资料归入项目，随时取用'],
            ['architecture','network','了解工作方式','查看系统架构与业务流程'],
            ['universe','orbit','探索能力星图','在银河中认识专业工具'],
          ].map(([view,icon,title,detail])=><button type="button" key={view} className="aw-entry card" disabled={unavailable} onClick={()=>open(view)}><span className="aw-entry-icon"><Icon name={icon}/></span><span><strong>{title}</strong><small>{detail}</small></span><Icon name="arrow-up-right"/></button>)}
        </div>
      </section>
    </div>
    <footer className="aw-footer"><span>与你一起，算得清楚，做得踏实。</span><span>智算 Astra <i/> 与 Gork 一起工作</span></footer>
  </main>;
}
