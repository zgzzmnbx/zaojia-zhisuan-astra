import {Gork,type GorkPresented} from './Gork';
import {useGorkSettings} from './useGorkSettings';
import type {WebGorkStage} from './gork-preferences';
import './composer-companion.css';

/** The one live workspace companion belongs to the input, not the title. */
export function ComposerCompanion({stage,suspended,state,completion=0,onPresented}:{stage?:WebGorkStage;suspended:boolean;state:string;completion?:number;onPresented?:GorkPresented}){
 const {preferences}=useGorkSettings();
 return <div className="composer-companion" data-layout={preferences.composerLayout} aria-label="聊天输入区的智算小人"><Gork stage={stage} onPresented={onPresented} size={preferences.composerLayout==='roomy'?84:56} suspended={suspended} state={state} completion={completion} interactive followPointer pointerSmoothing="smooth"/></div>;
}
