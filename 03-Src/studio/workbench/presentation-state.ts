import type {View} from '../types';
export type PresentationMode='chat'|'summary'|'content'|'fullscreen';
export type ProjectPresentationPreference={summaryDismissed:boolean;ratio:number};
export type PresentationPreferences=Record<string,ProjectPresentationPreference>;
export type PresentationState={mode:PresentationMode;context:string;projectId:string|null;conversationId:string;content:View|null;returnMode:'chat'|'summary';ratio:number;preferences:PresentationPreferences;visited:View[];revision:number};
export type PresentationAction=
 |{type:'enter';projectId:string|null;conversationId:string}
 |{type:'show-summary'}|{type:'toggle-summary'}|{type:'close-summary'}|{type:'chat'}
 |{type:'open-content';view:View}|{type:'close-content'}|{type:'fullscreen'}|{type:'return-to-split'}
 |{type:'resize';ratio:number}|{type:'result-available';view?:View};
export const PRESENTATION_KEY='astra.four-surface.v1';
const safeRatio=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?Math.max(.15,Math.min(.85,n)):.32;
export function readPresentationPreferences(value:unknown):PresentationPreferences{if(!value||typeof value!=='object'||Array.isArray(value))return {};const result:PresentationPreferences={};for(const [key,p] of Object.entries(value as Record<string,any>)){if(!p||typeof p!=='object'||key==='__proto__'||key==='constructor')continue;result[key]={summaryDismissed:p.summaryDismissed===true,ratio:safeRatio(p.ratio)}}return result;}
export function initialPresentation(preferences:PresentationPreferences={},ratio=.32):PresentationState{return {mode:'chat',context:'',projectId:null,conversationId:'',content:null,returnMode:'chat',ratio:safeRatio(ratio),preferences,visited:[],revision:0};}
export function presentationReducer(state:PresentationState,action:PresentationAction):PresentationState{
 const revise=(next:Partial<PresentationState>)=>({...state,...next,revision:state.revision+1});
 const preference=(dismissed:boolean,ratio=state.ratio)=>state.context?{...state.preferences,[state.context]:{summaryDismissed:dismissed,ratio}}:state.preferences;
 if(action.type==='enter'){
  const context=action.projectId?'project:'+action.projectId:'conversation:'+action.conversationId;
  if(context===state.context&&action.conversationId===state.conversationId)return state;
  const p=state.preferences[context],mode=action.projectId&&!p?.summaryDismissed?'summary':'chat';
  return revise({context,projectId:action.projectId,conversationId:action.conversationId,mode,returnMode:mode,content:null,visited:[],ratio:p?.ratio??.32});
 }
 if(action.type==='result-available')return state;
 if(action.type==='resize')return revise({ratio:safeRatio(action.ratio),preferences:preference(state.preferences[state.context]?.summaryDismissed??false,safeRatio(action.ratio))});
 if(action.type==='chat')return revise({mode:'summary',returnMode:'summary',preferences:preference(false)});
 if(action.type==='show-summary')return revise({mode:'summary',returnMode:'summary',preferences:preference(false)});
 if(action.type==='toggle-summary')return presentationReducer(state,{type:state.mode==='summary'?'close-summary':'show-summary'});
 if(action.type==='close-summary')return revise({mode:'chat',returnMode:'chat',preferences:preference(true)});
 if(action.type==='open-content'){
  if(action.view==='insights')return presentationReducer(state,{type:'show-summary'});
  const returnMode=state.mode==='chat'||state.mode==='summary'?state.mode:state.returnMode;
  return revise({mode:action.view==='architecture'||state.mode==='fullscreen'?'fullscreen':'content',content:action.view,returnMode,visited:state.visited.includes(action.view)?state.visited:[...state.visited,action.view]});
 }
 if(action.type==='close-content')return presentationReducer(state,{type:'chat'});
 if(action.type==='fullscreen'&&state.mode==='content')return revise({mode:'fullscreen'});
 if(action.type==='return-to-split'&&state.mode==='fullscreen')return revise({mode:'content'});
 return state;
}
