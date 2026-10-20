import {Vector2} from 'three';
const plasterNames=new Set(['Warm plaster','Porcelain white','Limestone foundation']);
/** Capture once after the zone material clones; toggles restore the original values. */
export function createLightingMaterials(root){
 const entries=[],seen=new Set();let settle=1;
 root.traverse(object=>{
  if(!object.isMesh)return;
  let owner=object;while(owner&&!owner.userData.zone)owner=owner.parent;
  const zone=owner?.userData.zone||'ground';
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(seen.has(material))continue;seen.add(material);
   entries.push({material,zone,uv:!!object.geometry.attributes.uv1,
    roughness:material.roughness,normalMap:material.normalMap,normalScale:material.normalScale.clone(),
    lightMap:material.lightMap,lightMapIntensity:material.lightMapIntensity});
  }
 });
 return {apply(resources,{enabled=false,dark=false,assembling=false}={}){
  const active=enabled&&!!resources;
  for(const entry of entries){
   const m=entry.material,oldMap=m.lightMap,oldNormal=m.normalMap;
   m.lightMap=active&&entry.uv?resources.maps.get(entry.zone):entry.lightMap;
   // Static GI is disabled during assembly and at night; dynamic shadows remain.
   m.lightMapIntensity=active?(dark||assembling?0:.85*settle):entry.lightMapIntensity;
   m.normalMap=active&&plasterNames.has(m.name)?resources.maps.get('normal'):entry.normalMap;
   m.normalScale.copy(active&&plasterNames.has(m.name)?new Vector2(.055,.055):entry.normalScale);
   m.roughness=active?(m.name==='Frosted blue glazing'?.24:m.name==='Ceramic trim'?.32:entry.roughness):entry.roughness;
   if(oldMap!==m.lightMap||oldNormal!==m.normalMap)m.needsUpdate=true;
  }
 },setAssembly(active,enabled,dark){
  if(active)settle=0;
  for(const {material} of entries)if(enabled&&material.lightMap)material.lightMapIntensity=dark||active?0:.85*settle;
 },tick(delta,assembling,enabled,dark,reduced=false){
  if(assembling||settle===1)return false;
  settle=reduced?1:Math.min(1,settle+Math.min(50,delta)/450);
  for(const {material} of entries)if(enabled&&material.lightMap)material.lightMapIntensity=dark?0:.85*settle;
  return settle<1;
 },getState:()=>({materials:entries.length,lightmapped:entries.filter(e=>!!e.material.lightMap).length})};
}
