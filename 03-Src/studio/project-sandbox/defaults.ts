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

/** User-approved in-app browser snapshot, 2026-10-28. Update only on user request. */
export const sandboxParameterDefaults={
 "baked": {
  "preset": "adjusted",
  "waterSettings": {
   "enabled": true,
   "motion": true,
   "boats": true,
   "quality": "normal",
   "speed": 50,
   "ripple": 100,
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
  "shadows": false,
  "flow": true,
  "conveyor": {"visible":true,"continuous":true,"style":"building-blue-edge","nightBrightness":100,"weather":"clear","weatherStrength":1},
  "groupLogo": "hidden",
  "logoGlow": {"enabled": true,"brightness": 60,"color": "#b9e4ff"},
  "nightSettings": {"style":"studio","shell":25,"core":120,"halo":120,"context":110,"flowBrightness":185,"flowSoftness":150,"brightness":45,"bloom":110,"windows":true,"flow":true,"logo":true,"boats":true,"logoBrightness":110,"logoColor":"#85d0ff"},
  "groundTone": "mist",
  "backgroundColor": "#ffffff",
  "backgroundBrightness": 105,
  "modelBrightness": 145,
  "paintStrength": 0,
  "elevation": 30,
  "zoom": 110,
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
  "cardTransparency": 55,
  "chatTransparency": 15,
  "roofLabels": true,
  "autoOrbit": true,
  "orbitDelay": 2
 }
} as const;
