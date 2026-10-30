import {isDemoKnowledgeQuestion} from '../professional/components/knowledge/knowledgeDemoQuestions.ts';
/** Legacy AgentComposer's single-# space completion; no business action is sent. */
export function agentComposerSpaceCompletion(value:string){
 return value==='#'?'#知识库：':null;
}

/** null means ordinary chat; an empty string means the question is still missing. */
export function prefixedKnowledgeQuestion(value:string){
 const text=value.trim();
 return /^#知识/.test(text)?text.replace(/^#(?:知识库|知识)\s*[：:]?\s*/,'').trim():null;
}

/** Original suggestions only open for the unfinished knowledge prefix. */
export function showKnowledgeSuggestions(value:string){return /^#知识库[：:]?$/.test(value.trim());}
export function knowledgeQuestionPrompt(question:string){return `#知识库：${question.trim()}`;}

/** A row save must preserve the latest other rows and reject duplicates. */
export function replaceRecommendedQuestion(questions:string[],index:number,value:string){
 const question=value.replace(/\r/g,'').trim();
 if(!Number.isInteger(index)||index<0||index>=questions.length)throw Error('问题列表已变化，请重新打开。');
 if(!question||question.length>500)throw Error('问题不能为空或超过 500 字。');
 if(questions.some((item,i)=>i!==index&&item.trim()===question))throw Error('问题不能与其他条目重复。');
 return questions.map((item,i)=>i===index?question:item);
}

export function knowledgeAnswerEngine(question:string,engine:'local'|'weknora'|'compare'='local'){return isDemoKnowledgeQuestion(question)?'local':engine;}

/** Recommendations cover both original libraries; retain an explicit user scope. */
export function recommendedKnowledgeScope(current:string[]|null,available:string[]){return current??available;}

export const isPresetKnowledgeQuestion=isDemoKnowledgeQuestion;
export const PRESET_KNOWLEDGE_LOADING='正在检索答案';
/** User-requested presentation animation; never represents model/retrieval progress. */
export function waitForKnowledgePresentation(question:string,signal:AbortSignal):Promise<void>{
 if(!isDemoKnowledgeQuestion(question))return Promise.resolve();
 if(signal.aborted)return Promise.reject(new DOMException('展示已停止','AbortError'));
 return new Promise((resolve,reject)=>{
  const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('展示已停止','AbortError'));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},4000);
  signal.addEventListener('abort',abort,{once:true});
 });
}
