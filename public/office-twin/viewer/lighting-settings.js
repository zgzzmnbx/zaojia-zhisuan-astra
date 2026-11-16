// Office adaptation of the approved Astra studio defaults. Change this baseline
// only after the user asks to make a reviewed parameter snapshot the default.
import {ASTRA_STUDIO} from './astra-lighting-profile.js';
// Calibrated to the user's Astra reference image on this office bake. Equal
// numeric multipliers on different baked textures do not yield equal whites.
export const LIGHTING_DEFAULTS_VERSION='astra-office-reference-context-2026-11-17';
export const LIGHTING_KEY='astra.office.saved-lighting.v1';
export const LIGHTING_SPECS=Object.freeze([
  {key:'windowBlueStrength',label:'玻璃蓝色浓度',min:0,max:100,step:1,value:55,group:'day'},
  {key:'buildingBrightness',label:'主楼外墙亮度',min:40,max:180,step:1,value:120,group:'day'},
  {key:'floorBrightness',label:'楼层地板亮度',min:40,max:180,step:1,value:115,group:'day'},
  {key:'officeBrightness',label:'办公室亮度',min:40,max:180,step:1,value:120,group:'day'},
  {key:'contextBrightness',label:'周边建筑亮度',min:20,max:180,step:1,value:105,group:'day'},
  {key:'groundBrightness',label:'地面亮度',min:20,max:160,step:1,value:105,group:'day'},
  {key:'buildingWhite',label:'主体白度',min:0,max:100,step:1,value:0,group:'day'},
  {key:'contextWhite',label:'周边建筑白度',min:0,max:100,step:1,value:100,group:'day'},
  {key:'contrast',label:'明暗层次',min:50,max:150,step:1,value:80,group:'day'},
  {key:'backgroundBrightness',label:'背景亮度',min:20,max:160,step:1,value:100,group:'day'},
  {key:'nightShell',label:'主楼轮廓',min:0,max:200,step:1,value:25,group:'night'},
  {key:'nightOffice',label:'室内照明',min:0,max:200,step:1,value:100,group:'night'},
  {key:'nightAmbient',label:'夜间环境亮度',min:0,max:200,step:1,value:100,group:'night'},
  {key:'nightContext',label:'周边建筑轮廓',min:0,max:200,step:1,value:25,group:'night'},
  {key:'nightWindows',label:'主楼窗灯',min:0,max:200,step:1,value:120,group:'night'},
  {key:'nightContextWindows',label:'周边窗灯',min:0,max:200,step:1,value:110,group:'night'},
  {key:'nightScreens',label:'屏幕蓝光',min:0,max:200,step:1,value:100,group:'night'},
  {key:'nightBloom',label:'灯光辉光',min:0,max:200,step:1,value:120,group:'night'},
  {key:'blue',label:'蓝色点缀',min:0,max:1,step:.05,value:1,unit:'ratio'},
  {key:'exposure',label:'整体曝光',min:-1.5,max:1.5,step:.05,value:0,unit:'EV'},
]);
export const LIGHTING_DEFAULTS=Object.freeze({...Object.fromEntries(LIGHTING_SPECS.map(s=>[s.key,s.value])),backgroundColor:ASTRA_STUDIO.backgroundColor,groundColor:ASTRA_STUDIO.groundColor,windowStyle:'astra-blue',realtimeShadows:ASTRA_STUDIO.shadows});
export function normalizeLighting(raw){
  const result={...LIGHTING_DEFAULTS};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
  for(const s of LIGHTING_SPECS)if(typeof raw[s.key]==='number'&&Number.isFinite(raw[s.key]))result[s.key]=Number((Math.round(Math.max(s.min,Math.min(s.max,raw[s.key]))/s.step)*s.step).toFixed(4));
  // Migrate the former shared gain once; subsequent edits carry both values.
  if(!Number.isFinite(raw.floorBrightness)&&Number.isFinite(raw.buildingBrightness))result.floorBrightness=result.buildingBrightness;
  if(typeof raw.backgroundColor==='string'&&/^#[0-9a-f]{6}$/i.test(raw.backgroundColor))result.backgroundColor=raw.backgroundColor.toLowerCase();
  if(typeof raw.groundColor==='string'&&/^#[0-9a-f]{6}$/i.test(raw.groundColor))result.groundColor=raw.groundColor.toLowerCase();
  if(['white','astra-blue'].includes(raw.windowStyle))result.windowStyle=raw.windowStyle;
  if(typeof raw.realtimeShadows==='boolean')result.realtimeShadows=raw.realtimeShadows;
  return result;
}
export function readLighting(storage){
  try{const saved=JSON.parse(storage.getItem(LIGHTING_KEY)||'null');if(saved?.version===1)return normalizeLighting(saved.values);
    // Retain legacy personal exposure/accent adjustments, without carrying its gray background.
    const legacy=JSON.parse(storage.getItem('h1-office-twin:baked-picture:v2')||'null');return normalizeLighting(legacy);
  }catch{return {...LIGHTING_DEFAULTS};}
}
export function saveLighting(storage,values){const normalized=normalizeLighting(values);storage.setItem(LIGHTING_KEY,JSON.stringify({version:1,defaults:LIGHTING_DEFAULTS_VERSION,values:normalized}));return normalized;}
