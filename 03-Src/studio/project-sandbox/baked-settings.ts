import {normalizeWaterSettings,readWaterSettings,type WaterSettings} from './water-settings.ts';
import {normalizeUplightSettings,readUplightSettings,type UplightSettings} from './uplight-settings.ts';
import {sandboxDefaults,readSandboxSwitch} from './defaults.ts';
import {normalizeSandboxView,readSandboxView,sandboxViewKey} from './view-settings.ts';
import {sandboxGroundTone,groundToneKey} from './ground-tones.ts';
import {readGroupLogo,groupLogoKey} from './group-logo.ts';
import {readPaintStrength,sandboxPaintKey} from './paint-settings.ts';
import {readBackgrounds,validBackground} from './scene-theme.ts';

export const bakedSettingsKey='astra.sandbox.baked-effects.v1';
export type BakedSettings={preset:'adjusted'|'original';waterSettings:WaterSettings;uplightSettings:UplightSettings;bloom:boolean;focusBeam:boolean;shadows:boolean;flow:boolean;groupLogo:'hidden'|'original'|'white';groundTone:string;backgroundColor:string|null;backgroundBrightness:number;modelBrightness:number;paintStrength:number;elevation:number;distance:number;zoom:number};
export function normalizeBakedSettings(raw:unknown,fallback?:BakedSettings):BakedSettings{
 const v=(raw&&typeof raw==='object'?raw:{}) as Partial<BakedSettings>;
 const base=fallback??{preset:'adjusted',waterSettings:normalizeWaterSettings(null),uplightSettings:normalizeUplightSettings(null),bloom:true,focusBeam:true,shadows:true,flow:true,groupLogo:'white',groundTone:'gray',backgroundColor:'#f5f7fa',backgroundBrightness:100,modelBrightness:100,paintStrength:65,...sandboxDefaults.camera};
 const number=(key:'backgroundBrightness'|'modelBrightness'|'paintStrength',min:number,max:number)=>typeof v[key]==='number'&&Number.isFinite(v[key])?Math.max(min,Math.min(max,v[key]!)):base[key];
 return {...base,preset:v.preset==='original'?'original':v.preset==='adjusted'?'adjusted':base.preset,...normalizeSandboxView({...base,...v}),waterSettings:normalizeWaterSettings({...base.waterSettings,...v.waterSettings}),uplightSettings:normalizeUplightSettings({day:{...base.uplightSettings.day,...v.uplightSettings?.day},night:{...base.uplightSettings.night,...v.uplightSettings?.night}}),
  ...Object.fromEntries((['bloom','focusBeam','shadows','flow'] as const).map(k=>[k,typeof v[k]==='boolean'?v[k]:base[k]])),
  groupLogo:v.groupLogo===undefined?base.groupLogo:readGroupLogo(v.groupLogo),groundTone:v.groundTone===undefined?base.groundTone:sandboxGroundTone(v.groundTone).id,
  backgroundColor:v.backgroundColor===undefined?base.backgroundColor:validBackground(v.backgroundColor),backgroundBrightness:number('backgroundBrightness',20,160),modelBrightness:number('modelBrightness',40,150),paintStrength:number('paintStrength',0,100)};
}
/** Seed once from the user's original settings; all later baked edits stay isolated. */
export function readBakedSettings():BakedSettings{
 try{
  const saved=localStorage.getItem(bakedSettingsKey);if(saved)return normalizeBakedSettings(JSON.parse(saved));
  return normalizeBakedSettings({waterSettings:readWaterSettings(),uplightSettings:readUplightSettings(),bloom:readSandboxSwitch('astra.sandbox.bloom',true),focusBeam:readSandboxSwitch('astra.sandbox.focus-beam',true),shadows:readSandboxSwitch('astra.sandbox.shadows',true),flow:readSandboxSwitch('astra.sandbox.flow',true),
   groupLogo:readGroupLogo(localStorage.getItem(groupLogoKey)),groundTone:sandboxGroundTone(localStorage.getItem(groundToneKey)).id,paintStrength:readPaintStrength(localStorage.getItem(sandboxPaintKey)),backgroundColor:readBackgrounds().classic??'#f5f7fa',...readSandboxView(localStorage.getItem(sandboxViewKey))});
 }catch{return normalizeBakedSettings(null)}
}
