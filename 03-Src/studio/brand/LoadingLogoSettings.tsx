import {useState} from 'react';
import {LoadingLogo} from './LoadingLogo';
import {useLoadingMotion} from './useLoadingMotion';
import type {LoadingMotion} from './loading-preferences';

export function LoadingLogoSettings({active}:{active:boolean}){
 const [motion,change]=useLoadingMotion(),[playing,setPlaying]=useState(false),[preview,setPreview]=useState(0),[error,setError]=useState('');
 return <fieldset className="logo-loading-settings"><legend>加载动画</legend>
  <div className="logo-loading-controls"><label>默认动画<select className="select select-sm" aria-label="默认加载动画" value={motion} onChange={e=>{try{change(e.target.value as LoadingMotion);setError('');}catch{setError('无法保存加载动画，请检查浏览器存储权限。');}}}><option value="ring">圆环加载（默认）</option><option value="wave">波浪加载</option></select></label>
   <button type="button" className="btn btn-outline btn-sm" onClick={()=>{setPlaying(true);setPreview(n=>n+1);}}>预览加载动画</button>
   {playing&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>setPlaying(false)}>暂停预览</button>}
  </div>
  <div className="logo-loading-preview"><LoadingLogo key={preview} size={72} active={active} paused={!playing} allowMotion={playing}/><span>正在加载，请稍候…</span></div>
  {error&&<p role="alert">{error}</p>}
 </fieldset>;
}
