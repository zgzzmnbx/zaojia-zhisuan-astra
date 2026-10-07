import {useEffect,useReducer,useRef} from 'react';
import {initialPresentation,presentationReducer,readPresentationPreferences,PRESENTATION_KEY} from './presentation-state';
import {normalizeSplitRatio,SPLIT_RATIO_KEY} from './layout-state';
import type {View} from '../types';
export function usePresentation(beforeChange?:()=>void){
 const before=useRef(beforeChange),interaction=useRef(0);before.current=beforeChange;
 const [state,dispatch]=useReducer(presentationReducer,undefined,()=>{try{return initialPresentation(readPresentationPreferences(JSON.parse(localStorage.getItem(PRESENTATION_KEY)||'null')),normalizeSplitRatio(localStorage.getItem(SPLIT_RATIO_KEY)))}catch{return initialPresentation()}});
 useEffect(()=>{try{localStorage.setItem(PRESENTATION_KEY,JSON.stringify(state.preferences))}catch{}},[state.preferences]);
 const send=(action:Parameters<typeof presentationReducer>[1])=>{if(action.type!=='result-available'&&action.type!=='enter'){before.current?.();interaction.current++;}dispatch(action)};
 return {state,interactionToken:()=>interaction.current,enter:(projectId:string|null,conversationId:string)=>send({type:'enter',projectId,conversationId}),showSummary:()=>send({type:'show-summary'}),toggleSummary:()=>send({type:'toggle-summary'}),closeSummary:()=>send({type:'close-summary'}),chat:()=>send({type:'chat'}),open:(view:View)=>send({type:'open-content',view}),closeContent:()=>send({type:'close-content'}),fullscreen:()=>send({type:'fullscreen'}),returnToSplit:()=>send({type:'return-to-split'}),resize:(ratio:number)=>send({type:'resize',ratio}),resultAvailable:(view?:View)=>send({type:'result-available',view})};
}
