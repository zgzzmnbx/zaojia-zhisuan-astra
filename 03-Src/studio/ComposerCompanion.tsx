import {Gork} from './Gork';
import './composer-companion.css';

/** The one live workspace companion belongs to the input, not the title. */
export function ComposerCompanion({suspended,state,completion}:{suspended:boolean;state:string;completion:number}){
 return <div className="composer-companion" aria-label="聊天输入区的智算小人"><Gork size={56} suspended={suspended} state={state} completion={completion} interactive followPointer pointerSmoothing="smooth"/></div>;
}
