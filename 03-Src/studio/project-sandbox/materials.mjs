import {Color} from 'three';
import {createBuildingPaint} from './building-paint.mjs';
import {surfaceIdentity} from './surface-identity.mjs';

// glTF materials are shared across buildings. Give each zone its own material
// instances before applying selection, and update each instance only once.
export function createSandboxMaterials(root){
 const scopes=new Map(),entries=[],sources=new Set(),paint=createBuildingPaint();
 root.traverse(object=>{
  if(!object.isMesh)return;
  let owner=object;while(owner&&!owner.userData.zone)owner=owner.parent;
  const zone=owner?.userData.zone??null;
  function scoped(source){
   sources.add(source);
   let byZone=scopes.get(source);if(!byZone){byZone=new Map();scopes.set(source,byZone);}
   if(!byZone.has(zone)){
    const material=source.clone();byZone.set(zone,material);paint.attach(material,zone);
    entries.push({material,zone,color:source.color.clone(),emissive:source.emissive.clone(),intensity:source.emissiveIntensity});
   }
   return byZone.get(zone);
  }
  object.material=Array.isArray(object.material)?object.material.map(scoped):scoped(object.material);
 });
 // Clones retain shared textures; only release the unused source materials.
 sources.forEach(material=>material.dispose());
 const highlight=new Color(0x167ed0),trialBlues={'Blue river':new Color().setRGB(.025,.27,.55),'Frosted blue glazing':new Color().setRGB(.085,.32,.57),'Astra blue':new Color().setRGB(.006,.20,.62)};
 return {paint:paint.frame,apply({dark=false,cool=false,selected=null,trial=false,blueDepth=0}={}){
  for(const {material:m,zone,color,emissive,intensity} of entries){
   const {baseName}=surfaceIdentity(m);
   m.color.copy(color);m.emissive.copy(emissive);m.emissiveIntensity=intensity;
   if(dark&&['Warm plaster','Porcelain white','Cool shadow','Limestone foundation','Ceramic trim','Architectural recess'].includes(baseName))m.color.multiplyScalar(baseName==='Warm plaster'?.08:.14);
   if(!dark&&baseName==='Porcelain white')m.color.setRGB(...(cool?[.83,.89,.97]:[.83,.87,.92]));
   if(!dark&&baseName==='Warm plaster')m.color.setRGB(...(cool?[.86,.91,.98]:[.95,.94,.91]));
   if(dark&&baseName==='Blue river')m.color.setRGB(.035,.145,.32);
   if(dark&&['Astra blue','Frosted blue glazing'].includes(baseName)){m.emissive.set(0x168fff);m.emissiveIntensity=baseName==='Astra blue'?3.2:1.05;}
   if(trial&&!dark&&cool&&['Porcelain white','Warm plaster'].includes(baseName))m.color.setRGB(.90,.91,.93);
   if(trial&&!dark&&trialBlues[baseName])m.color.lerp(trialBlues[baseName],blueDepth);
   if(selected&&zone===selected){m.emissive.lerp(highlight,.45);m.emissiveIntensity=trial&&!dark?.07:m.emissiveIntensity+.045;}
  }
 }};
}
