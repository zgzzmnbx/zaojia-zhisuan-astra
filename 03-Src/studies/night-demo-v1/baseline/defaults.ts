/** Approved browser preset, 2026-10-21. Only missing/invalid fields fall back here. */
export const sandboxDefaults=Object.freeze({
 chatWidth:600,
 roofLabels:true,autoOrbit:true,orbitDelay:2,cool:true,infoVisible:true,shadows:true,flow:true,paintStrength:65,
 groupLogo:'white' as const,groundTone:'gray' as const,enhanced:true,bloom:true,focusBeam:true,studioLighting:true,softShadows:false,brightBackground:true,nightBloom:true,
 uplights:Object.freeze({day:Object.freeze({brightness:100,color:'#b9e4ff'}),night:Object.freeze({brightness:100,color:'#ffffff'})}),
 camera:Object.freeze({elevation:34,zoom:135,distance:85}),
});
export function savedSwitch(raw:unknown,on:string,off:string,fallback:boolean){return raw===on?true:raw===off?false:fallback}
export function readSandboxSwitch(key:string,fallback:boolean|null):boolean|null{
 try{const raw=localStorage.getItem(key);return raw==='on'?true:raw==='off'?false:fallback}catch{return fallback}
}
export function saveSandboxSwitch(key:string,value:boolean){try{localStorage.setItem(key,value?'on':'off')}catch{}}

/** User-approved full view parameters, 2026-10-23. Personal saves override these. */
export const sandboxParameterDefaults={
 "baked": {
  "preset": "adjusted",
  "waterSettings": {
   "enabled": false,
   "motion": true,
   "boats": true,
   "quality": "normal",
   "speed": 95,
   "ripple": 35,
   "reflection": 30,
   "bloom": 75
  },
  "uplightSettings": {
   "day": {
    "brightness": 85,
    "color": "#f3b344"
   },
   "night": {
    "brightness": 60,
    "color": "#ffffff"
   }
  },
  "bloom": true,
  "focusBeam": true,
  "shadows": true,
  "flow": true,
  "groupLogo": "hidden",
  "logoGlow": {"enabled": true,"brightness": 60,"color": "#b9e4ff"},
  "nightSettings": {"brightness":100,"bloom":85,"windows":true,"flow":true,"logo":true,"boats":true,"logoBrightness":80,"logoColor":"#b9e4ff"},
  "groundTone": "mist",
  "backgroundColor": "#ffffff",
  "backgroundBrightness": 105,
  "modelBrightness": 145,
  "paintStrength": 0,
  "elevation": 30,
  "zoom": 130,
  "distance": 60
 },
 "visual": {
  "mode": "baked",
  "city": {
   "baked": true
  },
  "dof": false,
  "strength": 0.4
 },
 "display": {
  "infoVisible": true,
  "cardTransparency": 85,
  "chatTransparency": 15,
  "roofLabels": true,
  "autoOrbit": true,
  "orbitDelay": 2
 }
} as const;
