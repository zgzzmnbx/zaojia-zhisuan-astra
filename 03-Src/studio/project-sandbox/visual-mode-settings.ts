export type VisualMode='original'|'baked';
export type VisualModeSettings={mode:VisualMode;city:Record<VisualMode,boolean>;dof:boolean;strength:number};
// Production opt-in. Never migrate the experiment's baked-first preferences.
export const visualModeKey='astra.sandbox.visual-modes.v1';
export function normalizeVisualMode(value:unknown):VisualModeSettings{
 const v=value&&typeof value==='object'?value as Partial<VisualModeSettings>:{};
 return {mode:v.mode==='baked'?'baked':'original',city:{original:v.city?.original===true,baked:v.city?.baked!==false},dof:v.dof!==false,strength:typeof v.strength==='number'&&Number.isFinite(v.strength)?Math.max(0,Math.min(1,v.strength)):.4};
}
export function readVisualMode():VisualModeSettings{try{return normalizeVisualMode(JSON.parse(localStorage.getItem(visualModeKey)||'null'))}catch{return normalizeVisualMode(null)}}
export function visualPresentation(requested:VisualMode,{dark,assembly}:{dark:boolean;assembly:boolean}){
 if(requested==='baked'&&dark)return {mode:'original' as VisualMode,reason:'夜航使用主线原光影；返回日间后恢复白色版。'};
 if(requested==='baked'&&assembly)return {mode:'original' as VisualMode,reason:'装配使用主线原画面；构件归位后恢复白色版。'};
 return {mode:requested,reason:''};
}
