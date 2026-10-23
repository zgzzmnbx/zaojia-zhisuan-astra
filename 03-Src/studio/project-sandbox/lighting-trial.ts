export type LightCard={name:string;enabled:boolean;x:number;y:number;z:number;width:number;height:number;power:number;color?:number[]};
export type LightingTrial={sunAzimuth:number;sunElevation:number;sun:number;fill:number;hemisphere:number;environment:number;exposure:number;shadowSoftness:number;background:number;wallRoughness:number;normal:number;tankRoughness:number;tankMetalness:number;pipeRoughness:number;pipeMetalness:number;reflection:number;blueDepth:number;cards:LightCard[]};
export const lightingTrialKey='astra.sandbox.lighting-trial.v1';
export const trialControls=[
 ['sunAzimuth','主光方位',-180,180,1,'°'],['sunElevation','主光高度',15,80,1,'°'],['sun','主光强度',0,8,.1,''],
 ['fill','侧面补光',0,1,.02,''],['hemisphere','天空补光',0,1,.02,''],['environment','环境反射',0,2,.05,''],
 ['exposure','曝光',.5,1.5,.02,''],['shadowSoftness','阴影柔度',.015,.2,.005,''],
 ['background','背景提亮',0,1,.05,''],['wallRoughness','白墙粗糙度',.25,1,.01,''],['normal','白墙微纹理',0,.06,.002,''],
 ['tankRoughness','储罐粗糙度',.08,.8,.01,''],['tankMetalness','储罐金属感',0,.65,.01,''],
 ['pipeRoughness','管道粗糙度',.08,.8,.01,''],['pipeMetalness','管道金属感',0,.65,.01,''],['reflection','管罐反射强度',0,3,.05,''],
 ['blueDepth','蓝色深度',0,1,.05,''],
] as const;
export const cardControls=[['x','左右 X',-25,25,1],['y','高度 Y',1,25,1],['z','前后 Z',-25,25,1],['width','宽度',1,25,.5],['height','高度',1,25,.5],['power','亮度',0,12,.2]] as const;
export function referenceTrial():LightingTrial{return {
 sunAzimuth:-55,sunElevation:48,sun:5,fill:.08,hemisphere:.14,environment:.55,exposure:1.02,shadowSoftness:.10,background:.60,
 wallRoughness:.62,normal:.008,tankRoughness:.18,tankMetalness:.28,pipeRoughness:.23,pipeMetalness:.18,reflection:2.5,blueDepth:.7,
 cards:[
  {name:'主反射灯板',enabled:true,x:-10,y:6,z:12,width:6,height:18,power:10},
  {name:'侧后轮廓灯板',enabled:true,x:12,y:7,z:-7,width:3,height:14,power:5},
  {name:'顶部柔光灯板',enabled:true,x:0,y:15,z:-2,width:10,height:7,power:1.4},
  {name:'正面补光灯板',enabled:true,x:2,y:3,z:12,width:7,height:5,power:.4},
 ]};}
export function normalizeTrial(value:unknown,base:LightingTrial=referenceTrial()):LightingTrial{
 const defaults=structuredClone(base),source=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const number=(v:unknown,f:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):f;
 for(const [key,,min,max] of trialControls)defaults[key]=number(source[key],defaults[key],min,max);
 defaults.cards=defaults.cards.map((card,i)=>{const v=Array.isArray(source.cards)&&source.cards[i]&&typeof source.cards[i]==='object'?source.cards[i]:{};
  for(const [key,,min,max] of cardControls)card[key]=number(v[key],card[key],min,max);
  card.enabled=typeof v.enabled==='boolean'?v.enabled:card.enabled;return card;});return defaults;
}
/** User-confirmed saved browser configuration, 2026-10-21. Draft edits never mutate this preset. */
export function approvedLighting():LightingTrial{return {
 sunAzimuth:-41,sunElevation:54,sun:6.9,fill:.08,hemisphere:.14,environment:.55,exposure:.98,shadowSoftness:.10,background:.75,
 wallRoughness:.62,normal:.008,tankRoughness:.18,tankMetalness:.18,pipeRoughness:.23,pipeMetalness:.18,reflection:2.5,blueDepth:.7,
 cards:[
  {name:'主反射灯板',enabled:true,x:-10,y:6,z:12,width:6,height:18,power:10},
  {name:'侧后轮廓灯板',enabled:true,x:12,y:7,z:-7,width:3,height:14,power:5},
  {name:'顶部柔光灯板',enabled:true,x:0,y:15,z:-2,width:10,height:7,power:1.4},
  {name:'正面补光灯板',enabled:true,x:2,y:3,z:12,width:7,height:5,power:.4},
 ]};}
export function readTrial(){try{const raw=localStorage.getItem(lightingTrialKey);return raw?normalizeTrial(JSON.parse(raw)):approvedLighting()}catch{return approvedLighting()}}
export function trialProfile(value:LightingTrial,base?:LightingTrial){
 const t=normalizeTrial(value,base),az=t.sunAzimuth*Math.PI/180,el=t.sunElevation*Math.PI/180;
 return {...t,sunPosition:[Math.sin(az)*Math.cos(el)*40,Math.sin(el)*40,Math.cos(az)*Math.cos(el)*40],backgroundWhiteMix:t.background,shadowAngularRadius:t.shadowSoftness,
  surfaces:{'Warm plaster':{roughness:t.wallRoughness,normal:t.normal},'Porcelain white':{roughness:t.wallRoughness,normal:t.normal},'Limestone foundation':{normal:0},
   'coated-tank':{roughness:t.tankRoughness,metalness:t.tankMetalness,normal:0,environment:t.reflection},'coated-pipe':{roughness:t.pipeRoughness,metalness:t.pipeMetalness,normal:0,environment:t.reflection}}};
}
