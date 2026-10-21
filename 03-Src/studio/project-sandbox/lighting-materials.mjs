import {Color,MeshStandardMaterial,Vector2} from 'three';
const plasterNames=new Set(['Warm plaster','Porcelain white','Limestone foundation']);
const RIVER='Blue river',RAIL='Cube001_3',FROSTED='Frosted blue glazing',ASTRA='Astra blue';
const WATER_DAY=new Color(0x2f86ad),WATER_NIGHT=new Color().setRGB(.012,.06,.13),BASE_NIGHT=new Color().setRGB(.035,.145,.32);
const WATER_NORMAL_SCALE=new Vector2(1.4,1.4),DETAIL_NORMAL_SCALE=new Vector2(.07,.07);
/** Capture once after the zone material clones; toggles restore the original values. */
export function createLightingMaterials(root){
 const entries=[],seen=new Map();
 root.traverse(object=>{
  if(!object.isMesh)return;
  let owner=object;while(owner&&!owner.userData.zone)owner=owner.parent;
  const zone=owner?.userData.zone||'ground';
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   let entry=seen.get(material);
   if(!entry){
    entry={material,zone,uv:!!object.geometry.attributes.uv1,meshes:[],
     roughness:material.roughness,metalness:material.metalness,envMapIntensity:material.envMapIntensity,
     normalMap:material.normalMap,normalScale:material.normalScale.clone(),
     lightMap:material.lightMap,lightMapIntensity:material.lightMapIntensity,
     aoMap:material.aoMap,aoMapIntensity:material.aoMapIntensity};
    seen.set(material,entry);entries.push(entry);
   }
   entry.uv=entry.uv||!!object.geometry.attributes.uv1;entry.meshes.push(object);
  }
 });
 let settle=1,water=null;
 const riverEntries=entries.filter(entry=>entry.material.name===RIVER&&entry.uv);
 if(riverEntries.length){
  const source=riverEntries[0].material;
  const material=new MeshStandardMaterial({name:RIVER,color:WATER_DAY.clone(),roughness:.12,metalness:.18,envMapIntensity:.45});
  water={material,normal:null,sourceColor:source.color.clone(),sourceRoughness:source.roughness,sourceMetalness:source.metalness,sourceEnvMapIntensity:source.envMapIntensity,sourceNormalScale:source.normalScale.clone()};
  const sources=new Set();
  for(const entry of riverEntries){for(const mesh of entry.meshes)mesh.material=material;sources.add(entry.material);entries.splice(entries.indexOf(entry),1);}
  sources.forEach(material=>material.dispose());
 }
 const railMesh=root.getObjectByName(RAIL),rail=railMesh?{mesh:railMesh,visible:railMesh.visible}:null;
 return {apply(resources,{enabled=false,dark=false,assembling=false}={}){
  const active=enabled&&!!resources;
  for(const entry of entries){
   const m=entry.material,oldMap=m.lightMap,oldNormal=m.normalMap,oldAo=m.aoMap;
   const lightMap=active&&entry.uv&&resources.maps?resources.maps.get(entry.zone)||null:null;
   m.lightMap=lightMap;
   // Static GI is disabled during assembly and at night; dynamic shadows remain.
   m.lightMapIntensity=active?(lightMap?(dark||assembling?0:.85*settle):0):entry.lightMapIntensity;
   const aoMap=active&&entry.uv&&resources.aoMaps?resources.aoMaps.get(entry.zone)||null:null;
   m.aoMap=aoMap;
   m.aoMapIntensity=aoMap?(dark?.55:.9):entry.aoMapIntensity;
   m.normalMap=active&&plasterNames.has(m.name)&&resources.maps?resources.maps.get('normal')||null:entry.normalMap;
   m.normalScale.copy(active&&plasterNames.has(m.name)?DETAIL_NORMAL_SCALE:entry.normalScale);
   m.roughness=active?(m.name===FROSTED?.16:m.name===ASTRA?.24:m.name==='Ceramic trim'?.32:entry.roughness):entry.roughness;
   m.metalness=active?(m.name===FROSTED?.14:m.name===ASTRA?.22:entry.metalness):entry.metalness;
   m.envMapIntensity=active&&m.name===ASTRA?1.15:entry.envMapIntensity;
   if(oldMap!==m.lightMap||oldAo!==m.aoMap||oldNormal!==m.normalMap)m.needsUpdate=true;
  }
  if(water){
   const m=water.material,sky=active?resources.water?.sky||null:null,normal=active?resources.water?.normal||null:null;
   m.color.copy(active?(dark?WATER_NIGHT:WATER_DAY):(dark?BASE_NIGHT:water.sourceColor));
   m.roughness=active?.12:water.sourceRoughness;
   m.metalness=active?.18:water.sourceMetalness;
   m.envMapIntensity=active?(dark?.35:.45):water.sourceEnvMapIntensity;
   m.normalScale.copy(active?WATER_NORMAL_SCALE:water.sourceNormalScale);
   m.lightMap=null;m.lightMapIntensity=0;m.aoMap=null;m.aoMapIntensity=0;
   if(m.envMap!==sky){m.envMap=sky;m.needsUpdate=true;}
   if(m.normalMap!==normal){m.normalMap=normal;m.needsUpdate=true;}
   water.normal=normal;water.sky=sky;
  }
  // 导轨白天像河道里的车道线，只在夜航作为发光流线出现。
  if(rail)rail.mesh.visible=active?rail.visible&&dark:rail.visible;
 },setAssembly(active,enabled,dark){
  if(active)settle=0;
  for(const {material} of entries)if(enabled&&material.lightMap)material.lightMapIntensity=dark||active?0:.85*settle;
 },tick(delta,assembling,enabled,dark,reduced=false,now=0){
  const waterActive=!!(enabled&&water?.normal&&!reduced);
  if(waterActive&&now>0){water.normal.offset.x=(now*.000025)%1;water.normal.offset.y=(now*.000040)%1;}
  if(assembling)return waterActive;
  if(settle<1){
   settle=reduced?1:Math.min(1,settle+Math.min(50,delta)/450);
   for(const {material} of entries)if(enabled&&material.lightMap)material.lightMapIntensity=dark?0:.85*settle;
  }
  return settle<1||waterActive;
 },getState:()=>({materials:entries.length+(water?1:0),lightmapped:entries.filter(e=>!!e.material.lightMap).length,aoMapped:entries.filter(e=>!!e.material.aoMap).length,water:!!water?.normal,waterOffset:water?.normal?[water.normal.offset.x,water.normal.offset.y]:null,railVisible:rail?rail.mesh.visible:null})};
}
