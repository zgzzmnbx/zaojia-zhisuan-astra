import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Icon} from './ui';
import {advanceWelcome,welcomeBeat,WELCOME_STAGES} from './welcome-demo.mjs';
import {WelcomeChatScene,WelcomeResultScene} from './WelcomeDemoScenes';
import './welcome-workspace-preview.css';

/** Synthetic storyboard: no live task, storage, API, or real business components. */
export function WelcomeWorkspacePreview(){
 const root=useRef<HTMLDivElement>(null),clock=useRef({index:0,elapsed:0});
 const [{index,reply},setBeat]=useState({index:0,reply:false}),[paused,setPaused]=useState(false),[visible,setVisible]=useState(false),[hidden,setHidden]=useState(document.hidden),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const running=!paused&&visible&&!hidden&&!reduced;
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),sync=()=>setReduced(media.matches),visibility=()=>setHidden(document.hidden);const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{threshold:.1});if(root.current)observer.observe(root.current);media.addEventListener('change',sync);document.addEventListener('visibilitychange',visibility);sync();return()=>{observer.disconnect();media.removeEventListener('change',sync);document.removeEventListener('visibilitychange',visibility);};},[]);
 useEffect(()=>{if(!running)return;let last=performance.now();const timer=setInterval(()=>{const now=performance.now();clock.current=advanceWelcome(clock.current,now-last);last=now;const next=welcomeBeat(clock.current);setBeat(old=>old.index===next.index&&old.reply===next.reply?old:next);},200);return()=>clearInterval(timer);},[running]);
 function choose(next:number){clock.current={index:next,elapsed:650};setBeat({index:next,reply:true});}
 const answerVisible=reply||reduced;
 const resultIndex=answerVisible?index:Math.max(0,index-1);
 return <div ref={root} className={`awp-player ${running?'is-playing':'is-paused'} ${reduced?'is-reduced':''}`} data-stage={WELCOME_STAGES[index].id} data-reply={answerVisible}>
  <div className="aw2-workspace awp-workspace" inert aria-hidden="true">
   <aside className="awp-rail"><span className="awp-brand">A</span><div>{['message','plus','folder','grid','sheet','book'].map((name,i)=><span key={name} className={i===(index===6?5:0)?'awp-rail-item is-current':'awp-rail-item'}><Icon name={name}/></span>)}</div><span className="awp-rail-item awp-rail-bottom"><Icon name="settings"/></span></aside>
   <div className="awp-main"><header className="awp-topbar"><div><Icon name="folder"/><strong>勘察测量示例项目</strong><span className="awp-workspace-label">工作空间</span></div><span className="awp-demo"><i/>合成数据 · 流程演示</span></header>
    <div className="awp-panes"><section className="awp-dialogue"><header className="awp-dialogue-heading"><strong>当前对话</strong><span><i className="awp-activity-dot"/>{WELCOME_STAGES[index].label}</span></header>
     <WelcomeChatTimeline index={index} reply={answerVisible}/>
     <div className="awp-composer"><span className="awp-quick-handle"><Icon name="grid"/>快捷功能<Icon name="chevron"/></span><div className="awp-input"><span>继续描述你的需求…</span><div><span><Icon name="plus"/><Icon name="spark"/>专业工具</span><span className="awp-send"><Icon name="arrow-up"/></span></div></div></div>
    </section><section className="awp-results"><header className="awp-view-tabs">{['表格','风险','知识图谱'].map((x,i)=><span key={x} className={(resultIndex===6?2:resultIndex===5?1:0)===i?'is-current':''}>{x}{i===1&&<i>2</i>}</span>)}<Icon name="expand"/></header>
     <div className="awp-result-stack">{WELCOME_STAGES.map((stage,i)=><div key={stage.id} className={`awp-result-scene ${i===resultIndex?'is-current':''}`}><WelcomeResultScene index={i} running={running} showGalaxy={visible&&!hidden&&resultIndex===6}/></div>)}</div>
     <footer className="awp-result-foot"><span><i/>示例成果</span><span>{index===6?'关联可追溯':'Excel / Word'}<Icon name={index===6?'network':'download'}/></span></footer>
    </section></div>
   </div>
  </div>
  <div className="awp-playback" aria-label="欢迎页演示控制"><span className="awp-playback-label">{reduced?'静态演示':'循环演示'}</span><div className="awp-stage-nav" role="group" aria-label="演示步骤">{WELCOME_STAGES.map((stage,i)=><button type="button" key={stage.id} aria-label={`查看演示：${stage.label}`} aria-current={index===i?'step':undefined} title={stage.label} onClick={()=>choose(i)}><span>{stage.label}</span><i/></button>)}</div><button type="button" className="btn btn-ghost btn-sm awp-pause" disabled={reduced} aria-label={paused?'播放欢迎页演示':'暂停欢迎页演示'} aria-pressed={paused||reduced} onClick={()=>setPaused(v=>!v)}><Icon name={paused||reduced?'play':'pause'}/><span>{reduced?'减少动效':paused?'播放':'暂停'}</span></button></div>
 </div>;
}

/** Append messages with stable keys; only the viewport moves, like a live chat. */
function WelcomeChatTimeline({index,reply}:{index:number;reply:boolean}){
 const viewport=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null);
 const [offset,setOffset]=useState(0);
 useLayoutEffect(()=>{
  const box=viewport.current,list=track.current;if(!box||!list)return;
  const measure=()=>setOffset(Math.max(0,list.offsetHeight-box.clientHeight));
  measure();const observer=new ResizeObserver(measure);observer.observe(box);observer.observe(list);return()=>observer.disconnect();
 },[index,reply]);
 return <div className="awp-dialogue-body awp-chat-viewport" ref={viewport}>
  <div className="awp-chat-track" ref={track} style={{transform:`translateY(-${offset}px)`}}>
   {WELCOME_STAGES.slice(0,index+1).map((stage,i)=><div className="awp-chat-turn" key={stage.id} data-turn={stage.id}>
    <div className={`awp-chat-bubble ${i===index?'is-new':''}`}><WelcomeChatScene index={i} part="user"/></div>
    {(i<index||reply)&&<div className={`awp-chat-bubble ${i===index?'is-new':''}`}><WelcomeChatScene index={i} part="assistant"/></div>}
   </div>)}
  </div>
 </div>;
}
