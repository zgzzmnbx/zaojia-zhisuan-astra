export const sandboxViewKey='astra.sandbox.camera.v1';
export function normalizeSandboxView(value:unknown){
 const v=value as {elevation?:number;zoom?:number}|null;
 const bounded=(n:unknown,fallback:number,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
 return {elevation:bounded(v?.elevation,28,22,45),zoom:bounded(v?.zoom,125,100,160)};
}
export function readSandboxView(raw:string|null){try{return normalizeSandboxView(JSON.parse(raw||'null'))}catch{return normalizeSandboxView(null)}}
export function sandboxCameraDistances(zoom:number){const safe=normalizeSandboxView({zoom}).zoom;return {overview:48,building:25*100/safe,task:30*100/safe}}
export function compactSandboxTitle(title:string){return title.replace(/【(?:项目例子|测试输入|演示)】/g,'').replace(/\s*\.xlsx?$/i,'').trim()||title;}
