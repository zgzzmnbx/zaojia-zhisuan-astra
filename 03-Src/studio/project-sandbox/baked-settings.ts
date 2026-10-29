import {normalizeWaterSettings,type WaterSettings} from './water-settings.ts';
import {normalizeUplightSettings,type UplightSettings} from './uplight-settings.ts';
import {sandboxParameterDefaults} from './defaults.ts';
import {readSavedParameterRecord} from './parameter-storage.ts';
import {normalizeSandboxView} from './view-settings.ts';
import {sandboxGroundTone} from './ground-tones.ts';
import {readGroupLogo} from './group-logo.ts';
import {validBackground} from './scene-theme.ts';
export type NightSettings={style:'studio'|'classic';shell:number;core:number;halo:number;context:number;flowBrightness:number;flowSoftness:number;brightness:number;bloom:number;windows:boolean;flow:boolean;logo:boolean;boats:boolean;logoBrightness:number;logoColor:string};

export const bakedSettingsKey='astra.sandbox.baked-effects.v1';
export type ConveyorSettings={visible:boolean;continuous:boolean;style:'pale-blue'|'building-white'|'building-blue-edge';nightBrightness:number;weather:'clear'|'rain'|'snow';weatherStrength:number};
export type BakedSettings={preset:'adjusted'|'original';waterSettings:WaterSettings;uplightSettings:UplightSettings;bloom:boolean;focusBeam:boolean;shadows:boolean;flow:boolean;conveyor:ConveyorSettings;groupLogo:'hidden'|'original'|'white';logoGlow:{enabled:boolean;brightness:number;color:string};nightSettings:NightSettings;groundTone:string;backgroundColor:string|null;backgroundBrightness:number;modelBrightness:number;paintStrength:number;elevation:number;distance:number;zoom:number};
export function normalizeBakedSettings(raw:unknown,fallback?:BakedSettings):BakedSettings{
 const v=(raw&&typeof raw==='object'?raw:{}) as Partial<BakedSettings>;
 const base:BakedSettings=fallback??sandboxParameterDefaults.baked;
 const nightBase=base.nightSettings,n=v.nightSettings;
 const nightGain=(key:'shell'|'core'|'halo'|'context'|'flowBrightness'|'flowSoftness',min=0)=>typeof n?.[key]==='number'&&Number.isFinite(n[key])?Math.max(min,Math.min(200,n[key])):nightBase[key]??100;
 const nightSettings:NightSettings={...nightBase,...Object.fromEntries((['windows','flow','logo','boats'] as const).map(k=>[k,typeof n?.[k]==='boolean'?n[k]:nightBase[k]])),brightness:typeof n?.brightness==='number'&&Number.isFinite(n.brightness)?Math.max(40,Math.min(150,n.brightness)):nightBase.brightness,logoBrightness:typeof n?.logoBrightness==='number'&&Number.isFinite(n.logoBrightness)?Math.max(0,Math.min(200,n.logoBrightness)):nightBase.logoBrightness,logoColor:typeof n?.logoColor==='string'&&/^#[0-9a-f]{6}$/i.test(n.logoColor)?n.logoColor:nightBase.logoColor,bloom:typeof n?.bloom==='number'&&Number.isFinite(n.bloom)?Math.max(0,Math.min(150,n.bloom)):nightBase.bloom};
 Object.assign(nightSettings,{style:n?.style==='classic'?'classic':n?.style==='studio'?'studio':nightBase.style??'studio',shell:nightGain('shell',25),core:nightGain('core'),halo:nightGain('halo'),context:nightGain('context'),flowBrightness:nightGain('flowBrightness'),flowSoftness:nightGain('flowSoftness')});
 const number=(key:'backgroundBrightness'|'modelBrightness'|'paintStrength',min:number,max:number)=>typeof v[key]==='number'&&Number.isFinite(v[key])?Math.max(min,Math.min(max,v[key]!)):base[key];
 const conveyor=v.conveyor,conveyorBase=base.conveyor;
 return {...base,nightSettings,preset:v.preset==='original'?'original':v.preset==='adjusted'?'adjusted':base.preset,...normalizeSandboxView({...base,...v}),waterSettings:normalizeWaterSettings({...base.waterSettings,...v.waterSettings}),uplightSettings:normalizeUplightSettings({day:{...base.uplightSettings.day,...v.uplightSettings?.day},night:{...base.uplightSettings.night,...v.uplightSettings?.night}}),
  conveyor:{visible:typeof conveyor?.visible==='boolean'?conveyor.visible:conveyorBase.visible,continuous:typeof conveyor?.continuous==='boolean'?conveyor.continuous:conveyorBase.continuous,style:conveyor?.style==='pale-blue'||conveyor?.style==='building-white'||conveyor?.style==='building-blue-edge'?conveyor.style:conveyorBase.style,nightBrightness:typeof conveyor?.nightBrightness==='number'&&Number.isFinite(conveyor.nightBrightness)?Math.max(0,Math.min(200,conveyor.nightBrightness)):conveyorBase.nightBrightness,weather:conveyor?.weather==='rain'||conveyor?.weather==='snow'?conveyor.weather:'clear',weatherStrength:typeof conveyor?.weatherStrength==='number'&&Number.isFinite(conveyor.weatherStrength)?Math.max(0,Math.min(2,conveyor.weatherStrength)):conveyorBase.weatherStrength},
  ...Object.fromEntries((['bloom','focusBeam','shadows','flow'] as const).map(k=>[k,typeof v[k]==='boolean'?v[k]:base[k]])),
  groupLogo:v.groupLogo===undefined?base.groupLogo:readGroupLogo(v.groupLogo),groundTone:v.groundTone===undefined?base.groundTone:sandboxGroundTone(v.groundTone).id,
  logoGlow:{enabled:typeof v.logoGlow?.enabled==='boolean'?v.logoGlow.enabled:base.logoGlow.enabled,brightness:typeof v.logoGlow?.brightness==='number'&&Number.isFinite(v.logoGlow.brightness)?Math.max(0,Math.min(200,v.logoGlow.brightness)):base.logoGlow.brightness,color:typeof v.logoGlow?.color==='string'&&/^#[0-9a-f]{6}$/i.test(v.logoGlow.color)?v.logoGlow.color:base.logoGlow.color},
  backgroundColor:v.backgroundColor===undefined?base.backgroundColor:validBackground(v.backgroundColor),backgroundBrightness:number('backgroundBrightness',20,160),modelBrightness:number('modelBrightness',40,150),paintStrength:number('paintStrength',0,100)};
}
/** No explicit personal save means the approved default, never old auto-saved drafts. */
export function readBakedSettings():BakedSettings{return normalizeBakedSettings(readSavedParameterRecord()?.baked)}
