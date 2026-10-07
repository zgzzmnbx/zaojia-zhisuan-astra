import {useEffect,useRef,useState} from 'react';
import {ThemeButton} from './AppearanceControls';
import {Gork,Icon} from './ui';
import {WelcomeWorkspacePreview} from './WelcomeWorkspacePreview';
import {DEBUG_MODE} from '../frontend-debug/mock-adapter';
import './welcome-screen.css';

const preferenceKey='astra.skip-welcome.v1';
export function readSkipWelcome(){try{return localStorage.getItem(preferenceKey)==='true';}catch{return false;}}
type Props={ready:boolean;busy:boolean;dark:boolean;toggleTheme:()=>void;openAppearance:()=>void;currentTitle?:string;hasWork:boolean;error?:string;enter:()=>void;newChat:()=>void;open:(view:string)=>void};
/** Layout ported from zaojia-zhisuan@5b6b8d2 welcome-screen; lower preview uses Astra. */
export function WelcomeScreen({ready,busy,dark,toggleTheme,openAppearance,error,enter}:Props){
 const [skip,setSkip]=useState(readSkipWelcome),[preferenceError,setPreferenceError]=useState('');
 const [entering,setEntering]=useState(false);
 const heading=useRef<HTMLHeadingElement>(null),bot=useRef<HTMLDivElement>(null);
 useEffect(()=>{heading.current?.focus();},[]);
 function savePreference(value:boolean){setSkip(value);try{localStorage.setItem(preferenceKey,String(value));setPreferenceError('');}catch{setPreferenceError('浏览器暂时无法保存此偏好，下次仍会显示欢迎页。');}}
 async function enterStudio(){if(entering||busy)return;setEntering(true);if(bot.current){const a=bot.current.animate([{transform:'translateY(0)'},{transform:'translateY(-9%)',offset:.45},{transform:'translateY(65%)'}],{duration:340,fill:'forwards'});try{await a.finished}catch{/* Navigation remains available when animation is interrupted. */}}enter();}
 return <main className="astra-welcome-v2" aria-label="智算Astra 欢迎页">
  <div className="aw2-appearance"><ThemeButton open={openAppearance}/><button className="btn btn-ghost btn-square" type="button" aria-label="切换欢迎页明暗主题" onClick={toggleTheme}><Icon name={dark?'sun':'moon'}/></button></div>
  <div className="aw2-shell">
   <section className="aw2-copy" aria-labelledby="aw2-title">
    <p className="aw2-kicker badge badge-outline"><Icon name="shield"/>{DEBUG_MODE?'前端调试 · 模拟数据 · 外连已隔离':'规则可追溯 · 关键决策由你确认'}</p>
    <h1 id="aw2-title" ref={heading} tabIndex={-1}>智算 Astra</h1>
    <p className="aw2-role">工程造价辅助智能体</p>
    <p className="aw2-lead">在对话中推进编制，表格、依据与成果随时在侧。</p>
    <div className="aw2-actions"><button className="btn btn-neutral aw2-enter" type="button" disabled={entering||busy||(!ready&&!error)} onClick={()=>void enterStudio()}><Icon name="spark"/>{entering?'正在进入…':'进入系统'}</button><label className="aw2-check"><input className="checkbox checkbox-sm" type="checkbox" checked={skip} onChange={e=>savePreference(e.target.checked)}/><span>下次直接进入主界面</span></label></div>
    {!ready&&!error&&<p className="aw2-status" role="status">正在恢复工作空间…</p>}
    {(error||preferenceError)&&<p className="aw2-error" role="alert">{error||preferenceError}</p>}
   </section>
   <div className="aw2-product-wrap">
    <div ref={bot} className="aw2-bot-peek"><Gork size={102} state={busy?'working':'idle'} interactive followPointer/></div>
    <div className="aw2-product-frame card" role="img" aria-label="当前 Astra 工作室预览：左侧项目与对话，中间任务协作，右侧计算表；展示合成样例。"><WelcomeWorkspacePreview/></div>
   </div>
  </div>
 </main>;
}
