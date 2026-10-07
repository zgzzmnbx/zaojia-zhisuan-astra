import {Icon} from '../ui';
export function ContentActions({fullscreen,onFullscreen,onReturn,onClose}:{fullscreen:boolean;onFullscreen:()=>void;onReturn:()=>void;onClose:()=>void}){
 return <div className="artifact-tools"><button type="button" className="btn btn-ghost content-fullscreen" aria-label={fullscreen?'返回对话':'应用内全屏查看内容'} title={fullscreen?'返回对话':'应用内全屏'} onClick={fullscreen?onReturn:onFullscreen}><Icon name={fullscreen?'panel':'expand'}/><span>{fullscreen?'返回对话':'全屏'}</span></button><button type="button" className="btn btn-ghost btn-square" aria-label="关闭当前内容" title="关闭当前内容" onClick={onClose}><Icon name="close"/></button></div>;
}
