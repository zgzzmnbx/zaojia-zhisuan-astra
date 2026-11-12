import {useWelcomeStyle} from './welcome-preferences';
import './welcome-style-settings.css';

export function WelcomeStyleSettings(){
 const {style,select,error}=useWelcomeStyle();
 return <fieldset className="welcome-style-setting"><legend>欢迎页</legend><div className="appearance-mode" role="group" aria-label="欢迎页样式"><button type="button" aria-pressed={style==='hero'} onClick={()=>select('hero')}>新版<span>默认</span></button><button type="button" aria-pressed={style==='classic'} onClick={()=>select('classic')}>经典版</button></div>{error&&<p role="alert">{error}</p>}</fieldset>;
}
