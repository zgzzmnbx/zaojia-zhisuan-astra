import {Color,Vector3} from 'three';
import {surfaceIdentity} from './surface-identity.mjs';
import {dayProfile} from './render-profile.mjs';
const plasterNames=new Set(['Warm plaster','Porcelain white','Limestone foundation']);
const WATER='Blue river';
const WATER_DAY=new Color(0x2f86ad),WATER_NIGHT=new Color().setRGB(.012,.06,.13);
/** Theme owns color/emissive; this layer restores all surface properties from zone clones. */
export function createLightingMaterials(root){
 const entries=[],seen=new Map();let settle=1,giStrength=dayProfile.gi;
 root.traverse(object=>{
  if(!object.isMesh)return;
  let owner=object;while(owner&&!owner.userData.zone)owner=owner.parent;
  const zone=owner?.userData.zone||'ground';
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(seen.has(material)){const entry=seen.get(material);entry.uv&&=!!object.geometry.attributes.uv1&&entry.zone===zone;entry.meshes.push(object);continue;}
   const entry={material,zone,uv:!!object.geometry.attributes.uv1,...surfaceIdentity(material),meshes:[object],
    roughness:material.roughness,metalness:material.metalness,envMapIntensity:material.envMapIntensity,
    normalMap:material.normalMap,normalScale:material.normalScale.clone(),
    lightMap:material.lightMap,lightMapIntensity:material.lightMapIntensity,
    aoMap:material.aoMap,aoMapIntensity:material.aoMapIntensity,envMap:material.envMap};
   seen.set(material,entry);entries.push(entry);
  }
 });
 const waterEntries=entries.filter(entry=>entry.baseName===WATER&&entry.uv);
 let waterUVReady=false;
 /** Surface keeps the stretched 0–1 river UV; v2.2.0 baked water in world-scale UV (0.35·x, 0.35·z). */
 function prepareWaterUV(){
  if(waterUVReady)return;waterUVReady=true;const point=new Vector3();
  for(const {meshes} of waterEntries)for(const mesh of meshes){
   const position=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;if(!position||!uv)continue;
   mesh.updateWorldMatrix(true,false);
   for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);uv.setXY(i,point.x*.35,point.z*.35);}
   uv.needsUpdate=true;
  }
 }
 return {apply(resources,{enabled=false,baked=enabled,dark=false,assembling=false,profile=dayProfile,local=null}={}){
  const active=enabled&&!!resources,gi=baked&&!!resources,localActive=!!local?.resources;giStrength=profile.gi;
  if(localActive)prepareWaterUV();
  for(const entry of entries){
   const m=entry.material,oldMap=m.lightMap,oldNormal=m.normalMap,oldAo=m.aoMap,oldEnv=m.envMap;
   const {baseName,role}=entry,plaster=plasterNames.has(baseName),water=baseName===WATER;
   m.lightMap=gi&&entry.uv?(resources.maps.get(entry.zone)??entry.lightMap):entry.lightMap;
   m.lightMapIntensity=gi?(dark||assembling?0:giStrength*settle):entry.lightMapIntensity;
   m.normalMap=active&&plaster?resources.maps.get('normal'):entry.normalMap;
   m.normalScale.copy(entry.normalScale);if(active&&plaster)m.normalScale.set(.055,.055);
   m.roughness=active?(baseName==='Frosted blue glazing'?.24:baseName==='Ceramic trim'?.32:entry.roughness):entry.roughness;
   m.metalness=entry.metalness;m.envMapIntensity=entry.envMapIntensity;
   m.aoMap=entry.aoMap;m.aoMapIntensity=entry.aoMapIntensity;
   if(water)m.envMap=entry.envMap;
   if(active&&!dark){
    const surface=profile.surfaces[role]??profile.surfaces[baseName];
    if(surface){
     m.roughness=surface.roughness??m.roughness;m.metalness=surface.metalness??m.metalness;
     m.envMapIntensity=surface.environment??m.envMapIntensity;
     if(surface.normal===0){m.normalMap=null;m.normalScale.set(0,0);}
     else if(surface.normal!==undefined)m.normalScale.setScalar(surface.normal);
    }
   }
   if(localActive){
    const localResources=local.resources;
    if(water){
     m.color.copy(dark?WATER_NIGHT:WATER_DAY);
     m.roughness=.12;m.metalness=.18;m.envMapIntensity=dark?.35:.45;
     m.normalMap=localResources.water.normal;m.normalScale.setScalar(1.4);
     m.envMap=localResources.water.sky;
     m.aoMap=null;m.aoMapIntensity=0;
     m.lightMap=null;m.lightMapIntensity=0;
    }else{
     if(entry.uv&&localResources.aoMaps.get(entry.zone)){m.aoMap=localResources.aoMaps.get(entry.zone);m.aoMapIntensity=dark?.55:.9;}
     if(baseName==='Frosted blue glazing'){m.roughness=.16;m.metalness=.14;}
     else if(baseName==='Astra blue'){m.roughness=.24;m.metalness=.22;m.envMapIntensity=1.15;}
     else if(baseName==='Ceramic trim'){m.roughness=.32;}
     if(plaster&&m.normalMap)m.normalScale.setScalar(.07);
    }
   }
   if(oldMap!==m.lightMap||oldNormal!==m.normalMap||oldAo!==m.aoMap||oldEnv!==m.envMap)m.needsUpdate=true;
  }
 },setAssembly(active,enabled,dark){
  if(active)settle=0;
  for(const {material} of entries)if(enabled&&material.lightMap)material.lightMapIntensity=dark||active?0:giStrength*settle;
 },tick(delta,assembling,enabled,dark,reduced=false,local=false,now=0){
  const waterActive=!!(local&&!reduced&&waterEntries.some(entry=>entry.material.normalMap));
  if(waterActive&&now>0)for(const {material} of waterEntries){const offset=material.normalMap?.offset;if(offset){offset.x=(now*.000025)%1;offset.y=(now*.000040)%1;}}
  if(assembling)return waterActive;
  if(settle<1){
   settle=reduced?1:Math.min(1,settle+Math.min(50,delta)/450);
   for(const {material} of entries)if(enabled&&material.lightMap)material.lightMapIntensity=dark?0:giStrength*settle;
  }
  return settle<1||waterActive;
 },getState:()=>({materials:entries.length,lightmapped:entries.filter(e=>!!e.material.lightMap).length,
  activeLightmapped:entries.filter(e=>!!e.material.lightMap&&e.material.lightMapIntensity>0).length,
  aoMapped:entries.filter(e=>!!e.material.aoMap).length,
  water:waterEntries.some(e=>!!e.material.normalMap),
  waterOffset:waterEntries.find(e=>e.material.normalMap)?.material.normalMap.offset.toArray()??null,
  intensityRange:entries.length?[Math.min(...entries.map(e=>e.material.lightMapIntensity)),Math.max(...entries.map(e=>e.material.lightMapIntensity))]:[0,0],
  surfaces:entries.map(e=>({zone:e.zone,baseName:e.baseName,role:e.role,roughness:e.material.roughness,metalness:e.material.metalness,
   normal:!!e.material.normalMap,normalScale:e.material.normalScale.toArray(),envMapIntensity:e.material.envMapIntensity,gi:e.material.lightMapIntensity,ao:!!e.material.aoMap,uv:e.uv}))})};
}
