import {approvedLighting,normalizeTrial,type LightingTrial} from './lighting-trial.ts';
import {readSandboxEffects,type SandboxEffects} from './effect-settings.ts';

export type SceneTheme='classic'|'solid';
export const sceneThemeKey='astra.sandbox.scene-theme.v1';
export const solidSettingsKey='astra.sandbox.solid-settings.v1';
export const backgroundKey='astra.sandbox.backgrounds.v1';
export const sceneThemes=[{id:'classic',label:'冷白建筑'},{id:'solid',label:'纯色棚拍'}] as const;
export const backgroundColors=[{label:'纯白',color:'#ffffff'},{label:'雾白',color:'#f5f7fa'},{label:'浅灰',color:'#cbd0d5'},{label:'冰蓝',color:'#eaf4ff'},{label:'暖白',color:'#fff8ed'}];
export function readSceneTheme():SceneTheme{try{const saved=localStorage.getItem(sceneThemeKey);return saved==='solid'||(saved!=='classic'&&localStorage.getItem('astra.sandbox.solid-version')==='on')?'solid':'classic'}catch{return 'classic'}}
export function solidLighting():LightingTrial{
 const t=approvedLighting(),distance=Math.hypot(12,22,10);
 return {...t,sunAzimuth:Math.atan2(-12,10)*180/Math.PI,sunElevation:Math.asin(22/distance)*180/Math.PI,sun:2.6,fill:0,hemisphere:.7,environment:1,exposure:1,normal:0,
  tankRoughness:.28,tankMetalness:.62,pipeRoughness:.24,pipeMetalness:.32,reflection:1,
  cards:[
   {name:'主反射灯板',enabled:true,x:-12,y:22,z:10,width:9,height:12,power:12,color:[1,.97,.93]},
   {name:'侧面补光灯板',enabled:true,x:14,y:16,z:2,width:13,height:16,power:1.2,color:[.88,.94,1]},
   {name:'后侧轮廓灯板',enabled:true,x:-3,y:19,z:-12,width:5,height:13,power:6,color:[.93,.97,1]},
   {name:'左侧条形灯板',enabled:true,x:-8,y:4,z:12,width:7,height:22,power:4,color:[1,1,1]},
   {name:'右侧条形灯板',enabled:true,x:10,y:3,z:6,width:4,height:19,power:2.6,color:[.93,.97,1]},
  ]};
}
export type SolidSettings={lighting:LightingTrial;bakeStrength:number;bakeBrightness:number;effects:SandboxEffects;enhanced:boolean};
export function normalizeSolidSettings(raw:unknown):SolidSettings{
 const v=raw&&typeof raw==='object'?raw as Partial<SolidSettings>:{};
 const effects={...readSandboxEffects(),studioLighting:true,softShadows:false,bakedLighting:true,brightBackground:true};
 for(const k of Object.keys(effects) as (keyof SandboxEffects)[])if(typeof v.effects?.[k]==='boolean')effects[k]=v.effects[k];
 const number=(x:unknown,d:number,min:number,max:number)=>typeof x==='number'&&Number.isFinite(x)?Math.max(min,Math.min(max,x)):d;
 return {lighting:normalizeTrial(v.lighting,solidLighting()),bakeStrength:number(v.bakeStrength,1,0,1),bakeBrightness:number(v.bakeBrightness,1,.4,1.8),effects,enhanced:typeof v.enhanced==='boolean'?v.enhanced:true};
}
export function readSolidSettings(){try{return normalizeSolidSettings(JSON.parse(localStorage.getItem(solidSettingsKey)||'null'))}catch{return normalizeSolidSettings(null)}}
export function validBackground(value:unknown):string|null{return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():null}
export function readBackgrounds():Record<SceneTheme,string|null>{try{const v=JSON.parse(localStorage.getItem(backgroundKey)||'{}');return {classic:validBackground(v?.classic),solid:validBackground(v?.solid)}}catch{return {classic:null,solid:null}}}
export function saveThemeValue(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
