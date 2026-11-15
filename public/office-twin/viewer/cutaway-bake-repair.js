import * as THREE from 'three';

// Private face-masked atlases repair obsolete cutaway occlusion. Geometry, UVs,
// healthy face shading, floor shadows and shared source materials stay intact.
export function isCutawayCabinet(object){
  for(let node=object;node;node=node.parent)if(/^CAB_0(?:4[4-9]|5[0-4])$/.test(node.name||''))return true;
  return false;
}
export function isCutawayColumn(object){
  for(let node=object;node;node=node.parent)if(/^COL_\d{2}_cut$/.test(node.name||''))return true;
  return false;
}
export function isCutawayWall(object){
  for(let node=object;node;node=node.parent)if(node.name==='W_E_MS_S_cut')return true;
  return false;
}
export function applyCutawayRepair(root,texture,kind='cabinet'){
  const copies=new Map();let count=0;
  root.traverse(object=>{
    const eligible=kind==='wall'?isCutawayWall:kind==='column'?isCutawayColumn:isCutawayCabinet;
    if(!object.isMesh||!eligible(object)||!object.geometry?.attributes.uv)return;
    const replace=source=>{
      if(!source.isMeshBasicMaterial||source.name!==(kind==='cabinet'?'BAKED_furniture_AgX':'V065_NATIVE_WALL_LIGHTING_UNLIT'))return source;
      if(!copies.has(source)){const copy=source.clone();copy.map=texture;copy.name=kind+'_cutaway_diffuse';copies.set(source,copy);}
      count++;return copies.get(source);
    };
    object.material=Array.isArray(object.material)?object.material.map(replace):replace(object.material);
  });
  return count;
}
export async function restoreCutawayBake(root,isDisposed=()=>false){
  return await Promise.all(['cabinet','column','wall'].map(async kind=>{try{
    const texture=await new THREE.TextureLoader().loadAsync(new URL('../models/'+kind+'-cutaway-v0314.png',import.meta.url).href);
    texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;
    if(isDisposed()){texture.dispose();return {count:0,status:'cancelled'};}
    const count=applyCutawayRepair(root,texture,kind);if(!count)texture.dispose();
    return {kind,count,status:count?'ready':'not-applicable'};
  }catch{return {kind,count:0,status:'original-bake-fallback'};}}));
}
