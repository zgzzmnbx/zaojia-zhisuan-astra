import {TaskProgress} from "./TaskProgress";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ThemeButton,ThemeModeButton} from './AppearanceControls';
import {Gork,Icon} from './ui';
import {WelcomeWorkspacePreview} from './WelcomeWorkspacePreview';
import {WelcomeLogo} from './WelcomeLogo';
import {DEBUG_MODE} from '../frontend-debug/mock-adapter';
import './welcome-screen.css';

const preferenceKey='astra.skip-welcome.v1';
export function readSkipWelcome(){try{return localStorage.getItem(preferenceKey)==='true';}catch{return false;}}
type Props={openLogo?:()=>void;logoActive?:boolean;runtimeStatus?:ReactNode;ready:boolean;busy:boolean;dark:boolean;toggleTheme:()=>void;openAppearance:()=>void;currentTitle?:string;hasWork:boolean;error?:string;enter:()=>void;newChat:()=>void;open:(view:string)=>void};
/** Welcome surface follows DESIGN.md; the lower preview remains a synthetic example. */
export function WelcomeScreen({runtimeStatus,ready,busy,dark,toggleTheme,openAppearance,error,enter,openLogo,logoActive}:Props){
 const [skip,setSkip]=useState(readSkipWelcome),[preferenceError,setPreferenceError]=useState('');
 const [entering,setEntering]=useState(false);
 const heading=useRef<HTMLHeadingElement>(null),bot=useRef<HTMLDivElement>(null);
 useEffect(()=>{heading.current?.focus();},[]);
 function savePreference(value:boolean){setSkip(value);try{localStorage.setItem(preferenceKey,String(value));setPreferenceError('');}catch{setPreferenceError('浏览器暂时无法保存此偏好，下次仍会显示欢迎页。');}}
 async function enterStudio(){if(entering||busy)return;setEntering(true);if(bot.current){const a=bot.current.animate([{transform:'translateY(0)'},{transform:'translateY(-9%)',offset:.45},{transform:'translateY(65%)'}],{duration:340,fill:'forwards'});try{await a.finished}catch{/* Navigation remains available when animation is interrupted. */}}enter();}
 return <main className="astra-welcome-v2" aria-label="造价智算 欢迎页">
  <div className="aw2-appearance">{runtimeStatus}<ThemeButton open={openAppearance}/><ThemeModeButton dark={dark} toggle={toggleTheme}/></div>
  <div className="aw2-shell">
   <section className="aw2-copy" aria-labelledby="aw2-title">
    <div className="aw2-engraving" aria-hidden="true"><i/><i/><span/><span/></div>
    {DEBUG_MODE&&<p className="aw2-kicker badge badge-outline"><Icon name="shield"/>前端调试 · 模拟数据 · 外连已隔离</p>}
    <div className="aw2-title-group"><WelcomeLogo dark={dark} active={logoActive} openLibrary={openLogo}/><div className="aw2-brand-copy"><h1 id="aw2-title" ref={heading} tabIndex={-1}>造价智算</h1>
    <p className="aw2-role">工程造价辅助智能体</p></div></div>
    <div className="aw2-actions"><button className="btn btn-primary aw2-enter" type="button" disabled={entering||busy||(!ready&&!error)} onClick={()=>void enterStudio()}><Icon name="spark"/>{entering?'正在进入…':'进入系统'}</button><label className="aw2-check"><input className="checkbox checkbox-sm" type="checkbox" checked={skip} onChange={e=>savePreference(e.target.checked)}/><span>下次直接进入主界面</span></label></div>
    <div className="aw2-feedback">
     {!ready&&!error&&<TaskProgress compact label="正在恢复工作空间"/>}
     {(error||preferenceError)&&<p className="aw2-error" role="alert">{error||preferenceError}</p>}
    </div>
   </section>
   <div className="aw2-product-wrap">
    <div ref={bot} className="aw2-bot-peek"><Gork size={102} state={busy?'working':'idle'} interactive followPointer pointerSmoothing="smooth"/></div>
    <div className="aw2-product-frame" role="group" aria-label="造价智算 工作室流程演示；全部数值为合成示例，不是当前项目成果。"><WelcomeWorkspacePreview/></div>
   </div>
  </div>
 </main>;
}
