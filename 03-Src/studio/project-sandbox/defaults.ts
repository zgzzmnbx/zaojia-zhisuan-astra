/** Approved browser preset, 2026-10-21. Only missing/invalid fields fall back here. */
export const sandboxDefaults=Object.freeze({
 chatWidth:600,
 roofLabels:true,autoOrbit:true,orbitDelay:2,cool:true,infoVisible:true,shadows:true,flow:true,paintStrength:65,
 groupLogo:'white' as const,groundTone:'gray' as const,enhanced:true,bloom:true,studioLighting:true,softShadows:false,bakedLighting:false,brightBackground:true,nightBloom:true,solidVersion:false,localSurface:false,
 camera:Object.freeze({elevation:34,zoom:135,distance:85}),
});
export function savedSwitch(raw:unknown,on:string,off:string,fallback:boolean){return raw===on?true:raw===off?false:fallback}
export function readSandboxSwitch(key:string,fallback:boolean|null):boolean|null{
 try{const raw=localStorage.getItem(key);return raw==='on'?true:raw==='off'?false:fallback}catch{return fallback}
}
export function saveSandboxSwitch(key:string,value:boolean){try{localStorage.setItem(key,value?'on':'off')}catch{}}
