import {surfaceIdentity} from './surface-identity.mjs';
import {dayProfile} from './render-profile.mjs';
const plasterNames=new Set(['Warm plaster','Porcelain white','Limestone foundation']);
/** Theme owns color/emissive; this layer restores all surface properties from zone clones. */
export function createLightingMaterials(root){
 const entries=[],seen=new Map();let settle=1;
 root.traverse(object=>{
  if(!object.isMesh)return;
  let owner=object;while(owner&&!owner.userData.zone)owner=owner.parent;
  const zone=owner?.userData.zone||'ground';
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(seen.has(material)){const entry=seen.get(material);entry.uv&&=!!object.geometry.attributes.uv1&&entry.zone===zone;continue;}
   const entry={material,zone,uv:!!object.geometry.attributes.uv1,...surfaceIdentity(material),
    roughness:material.roughness,metalness:material.metalness,envMapIntensity:material.envMapIntensity,
    normalMap:material.normalMap,normalScale:material.normalScale.clone(),
    lightMap:material.lightMap,lightMapIntensity:material.lightMapIntensity};
   seen.set(material,entry);entries.push(entry);
  }
 });
 return {apply(resources,{enabled=false,dark=false,assembling=false}={}){
  const active=enabled&&!!resources;
  for(const entry of entries){
   const m=entry.material,oldMap=m.lightMap,oldNormal=m.normalMap;
   const {baseName,role}=entry,plaster=plasterNames.has(baseName);
   m.lightMap=active&&entry.uv?(resources.maps.get(entry.zone)??entry.lightMap):entry.lightMap;
   m.lightMapIntensity=active?(dark||assembling?0:dayProfile.gi*settle):entry.lightMapIntensity;
   m.normalMap=active&&plaster?resources.maps.get('normal'):entry.normalMap;
   m.normalScale.copy(entry.normalScale);if(active&&plaster)m.normalScale.set(.055,.055);
   m.roughness=active?(baseName==='Frosted blue glazing'?.24:baseName==='Ceramic trim'?.32:entry.roughness):entry.roughness;
   m.metalness=entry.metalness;m.envMapIntensity=entry.envMapIntensity;
   if(active&&!dark){
    const surface=dayProfile.surfaces[role]??dayProfile.surfaces[baseName];
    if(surface){
     m.roughness=surface.roughness??m.roughness;m.metalness=surface.metalness??m.metalness;
     if(surface.normal===0){m.normalMap=null;m.normalScale.set(0,0);}
     else if(surface.normal!==undefined)m.normalScale.setScalar(surface.normal);
    }
   }
   if(oldMap!==m.lightMap||oldNormal!==m.normalMap)m.needsUpdate=true;
  }
 },setAssembly(active,enabled,dark){
  if(active)settle=0;
  for(const {material} of entries)if(enabled&&material.lightMap)material.lightMapIntensity=dark||active?0:dayProfile.gi*settle;
 },tick(delta,assembling,enabled,dark,reduced=false){
  if(assembling||settle===1)return false;
  settle=reduced?1:Math.min(1,settle+Math.min(50,delta)/450);
  for(const {material} of entries)if(enabled&&material.lightMap)material.lightMapIntensity=dark?0:dayProfile.gi*settle;
  return settle<1;
 },getState:()=>({materials:entries.length,lightmapped:entries.filter(e=>!!e.material.lightMap).length,
  activeLightmapped:entries.filter(e=>e.material.lightMap&&e.material.lightMapIntensity>0).length,
  intensityRange:entries.length?[Math.min(...entries.map(e=>e.material.lightMapIntensity)),Math.max(...entries.map(e=>e.material.lightMapIntensity))]:[0,0],
  surfaces:entries.map(e=>({zone:e.zone,baseName:e.baseName,role:e.role,roughness:e.material.roughness,metalness:e.material.metalness,
   normal:!!e.material.normalMap,normalScale:e.material.normalScale.toArray(),envMapIntensity:e.material.envMapIntensity,gi:e.material.lightMapIntensity,uv:e.uv}))})};
}
