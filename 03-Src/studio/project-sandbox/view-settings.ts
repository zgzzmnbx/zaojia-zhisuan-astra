import {sandboxDefaults} from './defaults.ts';
export const sandboxViewKey='astra.sandbox.camera.v1';
export function normalizeSandboxView(value:unknown){
 const v=value as {elevation?:number;zoom?:number;distance?:number}|null;
 const bounded=(n:unknown,fallback:number,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
 return {elevation:bounded(v?.elevation,sandboxDefaults.camera.elevation,22,45),zoom:bounded(v?.zoom,sandboxDefaults.camera.zoom,50,160),distance:bounded(v?.distance,sandboxDefaults.camera.distance,35,140)};
}
export function readSandboxView(raw:string|null){try{return normalizeSandboxView(JSON.parse(raw||'null'))}catch{return normalizeSandboxView(null)}}
export function sandboxCameraDistances(zoom:number,distance=100){const safe=normalizeSandboxView({zoom,distance});return {overview:48*safe.distance/100,building:25*100/safe.zoom,task:30*100/safe.zoom}}
export function compactSandboxTitle(title:string){return title.replace(/【(?:项目例子|测试输入|演示)】/g,'').replace(/\s*\.xlsx?$/i,'').trim()||title;}
